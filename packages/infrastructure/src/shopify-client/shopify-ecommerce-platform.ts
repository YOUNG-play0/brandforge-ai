import {
  ERROR_CODES,
  agentFail,
  agentOk,
  createAgentError,
  type AgentResult,
} from "@brandforge/shared";
import type {
  ApplyThemeInput,
  CreateCollectionInput,
  CreatePageInput,
  CreatedResource,
  IEcommercePlatform,
  PlatformProductInput,
  PublishedProduct,
} from "@brandforge/domain";
import {
  rejectUserErrors,
  type ShopifyGraphQlClient,
  type ShopifyUserError,
} from "./shopify-graphql-client.js";

/** Réglages de la plateforme réellement utilisés par cette classe. */
export interface StorePlatformOptions {
  /** Archive ZIP servant de thème de base ; sans elle, le thème publié est réutilisé. */
  readonly baseThemeUrl?: string;
}

/** Fragment commun : identifiant et titre d'une ressource créée. */
const RESOURCE_FIELDS = "id\n title";

const MAIN_THEME_QUERY = `
  query mainTheme {
    themes(first: 1, roles: [MAIN]) {
      nodes { id name }
    }
  }
`;

const THEME_CREATE_MUTATION = `
  mutation themeCreate($source: URL!, $name: String) {
    themeCreate(source: $source, name: $name) {
      theme { id name }
      userErrors { field message }
    }
  }
`;

const COLLECTION_CREATE_MUTATION = `
  mutation collectionCreate($input: CollectionInput!) {
    collectionCreate(input: $input) {
      collection { ${RESOURCE_FIELDS} }
      userErrors { field message }
    }
  }
`;

const PAGE_CREATE_MUTATION = `
  mutation pageCreate($page: PageCreateInput!) {
    pageCreate(page: $page) {
      page { ${RESOURCE_FIELDS} }
      userErrors { field message }
    }
  }
`;

const PRODUCT_CREATE_MUTATION = `
  mutation productCreate($input: ProductInput!) {
    productCreate(input: $input) {
      product { id onlineStoreUrl }
      userErrors { field message }
    }
  }
`;

const PRODUCT_UPDATE_MUTATION = `
  mutation productUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product { id onlineStoreUrl }
      userErrors { field message }
    }
  }
`;

const SHOP_URL_QUERY = `
  query shopUrl {
    shop {
      name
      primaryDomain { url }
    }
  }
`;

/**
 * Implémentation Shopify du port `IEcommercePlatform` (ARCHITECTURE.md §10).
 *
 * Traduit les concepts du domaine en requêtes GraphQL Admin. Toute l'authentification est
 * déléguée au `ShopifyGraphQlClient`, lui-même adossé au `ShopifyTokenProvider` : cette
 * classe ne manipule ni token, ni identifiants (ADR 0005).
 */
export class ShopifyEcommercePlatform implements IEcommercePlatform {
  /**
   * Ne reçoit que les réglages qui la concernent, jamais la configuration complète : le
   * `clientSecret` n'a rien à faire ici (moindre privilège, ADR 0005).
   */
  constructor(
    private readonly client: ShopifyGraphQlClient,
    private readonly options: StorePlatformOptions = {},
  ) {}

  /**
   * Prépare le thème de la boutique.
   *
   * Deux comportements selon la configuration (cf. docs/DECISIONS/0006) :
   * - `SHOPIFY_BASE_THEME_URL` renseignée : un thème est créé depuis cette archive. Shopify
   *   le crée avec le rôle `UNPUBLISHED` — sa publication reste une action manuelle.
   * - sinon : le thème déjà publié sur la boutique est réutilisé et son identifiant retourné.
   *
   * Dans les deux cas, l'identité de marque n'est **pas** injectée dans les réglages du
   * thème : cela suppose d'écrire `settings_data.json` via l'API Asset, hors périmètre de
   * ce module.
   */
  async applyTheme(input: ApplyThemeInput): Promise<AgentResult<{ readonly themeId: string }>> {
    const baseThemeUrl = this.options.baseThemeUrl;

    if (baseThemeUrl !== undefined) {
      const created = await this.client.request<{
        themeCreate?: { theme?: { id: string } | null; userErrors?: ShopifyUserError[] };
      }>(THEME_CREATE_MUTATION, {
        source: baseThemeUrl,
        name: `${input.brand.name} — BrandForge`,
      });

      if (!created.success) {
        return agentFail(created.error);
      }

      const userError = rejectUserErrors(created.output.themeCreate?.userErrors, "themeCreate");
      if (userError !== null) {
        return agentFail(themeFailure(userError.message));
      }

      const themeId = created.output.themeCreate?.theme?.id;
      if (themeId === undefined) {
        return agentFail(themeFailure("Shopify n'a retourné aucun thème."));
      }

      return agentOk({ themeId });
    }

    const current = await this.client.request<{
      themes?: { nodes?: { id: string }[] };
    }>(MAIN_THEME_QUERY);

    if (!current.success) {
      return agentFail(current.error);
    }

    const themeId = current.output.themes?.nodes?.[0]?.id;
    if (themeId === undefined) {
      return agentFail(
        themeFailure(
          "Aucun thème publié sur la boutique. Publiez un thème, ou renseignez SHOPIFY_BASE_THEME_URL.",
        ),
      );
    }

    return agentOk({ themeId });
  }

  async createCollection(input: CreateCollectionInput): Promise<AgentResult<CreatedResource>> {
    const result = await this.client.request<{
      collectionCreate?: { collection?: CreatedResource | null; userErrors?: ShopifyUserError[] };
    }>(COLLECTION_CREATE_MUTATION, {
      input: { title: input.title, descriptionHtml: input.description },
    });

    if (!result.success) {
      return agentFail(result.error);
    }

    const userError = rejectUserErrors(
      result.output.collectionCreate?.userErrors,
      "collectionCreate",
    );
    if (userError !== null) {
      return agentFail(userError);
    }

    const collection = result.output.collectionCreate?.collection;
    return collection === undefined || collection === null
      ? agentFail(missingResource("collection"))
      : agentOk(collection);
  }

  async createPage(input: CreatePageInput): Promise<AgentResult<CreatedResource>> {
    const result = await this.client.request<{
      pageCreate?: { page?: CreatedResource | null; userErrors?: ShopifyUserError[] };
    }>(PAGE_CREATE_MUTATION, {
      page: { title: input.title, body: input.content },
    });

    if (!result.success) {
      return agentFail(result.error);
    }

    const userError = rejectUserErrors(result.output.pageCreate?.userErrors, "pageCreate");
    if (userError !== null) {
      return agentFail(userError);
    }

    const page = result.output.pageCreate?.page;
    return page === undefined || page === null ? agentFail(missingResource("page")) : agentOk(page);
  }

  /**
   * Retourne l'URL publique de la boutique.
   *
   * **Ne lève pas la protection par mot de passe** : Shopify n'expose aucune API pour cela,
   * c'est une action manuelle dans l'administration. Le critère d'acceptation n°6 du PRD
   * (« boutique accessible, pas seulement en preview ») n'est donc pas entièrement
   * automatisable — cf. docs/DECISIONS/0006.
   */
  async publishStore(_storeProjectId: string): Promise<AgentResult<{ readonly storeUrl: string }>> {
    const result = await this.client.request<{
      shop?: { primaryDomain?: { url?: string } };
    }>(SHOP_URL_QUERY);

    if (!result.success) {
      return agentFail(result.error);
    }

    const storeUrl = result.output.shop?.primaryDomain?.url;
    if (storeUrl === undefined || storeUrl.length === 0) {
      return agentFail(
        createAgentError(
          ERROR_CODES.SHOPIFY_VALIDATION_ERROR,
          "Shopify n'a retourné aucun domaine principal pour la boutique.",
          false,
        ),
      );
    }

    return agentOk({ storeUrl });
  }

  async createProduct(input: PlatformProductInput): Promise<AgentResult<PublishedProduct>> {
    return this.writeProduct(PRODUCT_CREATE_MUTATION, "productCreate", productInput(input));
  }

  async updateProduct(
    platformProductId: string,
    input: PlatformProductInput,
  ): Promise<AgentResult<PublishedProduct>> {
    return this.writeProduct(PRODUCT_UPDATE_MUTATION, "productUpdate", {
      id: platformProductId,
      ...productInput(input),
    });
  }

  /** Création et mise à jour ne diffèrent que par la mutation et l'identifiant. */
  private async writeProduct(
    mutation: string,
    operation: "productCreate" | "productUpdate",
    input: Record<string, unknown>,
  ): Promise<AgentResult<PublishedProduct>> {
    const result = await this.client.request<
      Record<
        string,
        {
          product?: { id: string; onlineStoreUrl?: string | null } | null;
          userErrors?: ShopifyUserError[];
        }
      >
    >(mutation, { input });

    if (!result.success) {
      return agentFail(result.error);
    }

    const payload = result.output[operation];
    const userError = rejectUserErrors(payload?.userErrors, operation);
    if (userError !== null) {
      return agentFail(userError);
    }

    const product = payload?.product;
    if (product === undefined || product === null) {
      return agentFail(missingResource("produit"));
    }

    const url = product.onlineStoreUrl;
    return agentOk({
      platformProductId: product.id,
      // `onlineStoreUrl` est nul tant que le produit n'est pas publié sur le canal en ligne.
      ...(url === undefined || url === null ? {} : { url }),
    });
  }
}

/** Construit la charge produit commune à la création et à la mise à jour. */
function productInput(input: PlatformProductInput): Record<string, unknown> {
  return {
    title: input.title,
    descriptionHtml: input.description,
    ...(input.metaTitle === undefined && input.metaDescription === undefined
      ? {}
      : {
          seo: {
            ...(input.metaTitle === undefined ? {} : { title: input.metaTitle }),
            ...(input.metaDescription === undefined ? {} : { description: input.metaDescription }),
          },
        }),
  };
}

function themeFailure(message: string): ReturnType<typeof createAgentError> {
  return createAgentError(ERROR_CODES.THEME_APPLICATION_FAILED, message, true);
}

function missingResource(label: string): ReturnType<typeof createAgentError> {
  return createAgentError(
    ERROR_CODES.SHOPIFY_VALIDATION_ERROR,
    `Shopify n'a retourné aucun(e) ${label} après l'opération.`,
    false,
  );
}
