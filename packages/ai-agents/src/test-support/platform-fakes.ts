/**
 * Doublures de la plateforme e-commerce et des dépôts, réservées aux tests d'agents.
 *
 * Elles rendent les agents testables sans réseau ni base (CODING_STANDARDS.md §7).
 */
import {
  agentFail,
  agentOk,
  createAgentError,
  type AgentResult,
  type ErrorCode,
} from "@brandforge/shared";
import type {
  CreatedResource,
  IEcommercePlatform,
  IProductRepository,
  ISeoContentRepository,
  Product,
  PublishedProduct,
  SeoContent,
} from "@brandforge/domain";

/** Journal des appels reçus par la plateforme simulée. */
export interface PlatformCalls {
  themes: number;
  collections: { title: string; description: string }[];
  pages: { title: string; type: string; content: string }[];
  createdProducts: { title: string; metaTitle?: string }[];
  updatedProducts: { id: string; title: string }[];
}

/** Plateforme simulée dont chaque opération réussit. */
export function fakePlatform(
  overrides: Partial<{
    themeId: string;
    storeUrl: string;
    productId: string;
    productUrl: string;
  }> = {},
): IEcommercePlatform & { calls: PlatformCalls } {
  const calls: PlatformCalls = {
    themes: 0,
    collections: [],
    pages: [],
    createdProducts: [],
    updatedProducts: [],
  };
  let sequence = 0;
  const nextResource = (title: string): CreatedResource => {
    sequence += 1;
    return { id: `gid://shopify/Resource/${String(sequence)}`, title };
  };
  const published: PublishedProduct = {
    platformProductId: overrides.productId ?? "gid://shopify/Product/42",
    ...(overrides.productUrl === undefined ? {} : { url: overrides.productUrl }),
  };

  return {
    calls,
    applyTheme: async () => {
      calls.themes += 1;
      return agentOk({ themeId: overrides.themeId ?? "gid://shopify/OnlineStoreTheme/1" });
    },
    createCollection: async (input) => {
      calls.collections.push({ title: input.title, description: input.description });
      return agentOk(nextResource(input.title));
    },
    createPage: async (input) => {
      calls.pages.push({ title: input.title, type: input.type, content: input.content });
      return agentOk(nextResource(input.title));
    },
    publishStore: async () =>
      agentOk({ storeUrl: overrides.storeUrl ?? "https://f992av-n1.myshopify.com" }),
    createProduct: async (input) => {
      calls.createdProducts.push({
        title: input.title,
        ...(input.metaTitle === undefined ? {} : { metaTitle: input.metaTitle }),
      });
      return agentOk(published);
    },
    updateProduct: async (id, input) => {
      calls.updatedProducts.push({ id, title: input.title });
      return agentOk(published);
    },
  };
}

/** Plateforme dont l'opération nommée échoue. */
export function failingPlatform(
  failing: keyof Pick<
    IEcommercePlatform,
    | "applyTheme"
    | "createCollection"
    | "createPage"
    | "publishStore"
    | "createProduct"
    | "updateProduct"
  >,
  code: ErrorCode,
  retryable = false,
): IEcommercePlatform & { calls: PlatformCalls } {
  const platform = fakePlatform();
  const failure = async (): Promise<AgentResult<never>> =>
    agentFail(createAgentError(code, `échec simulé : ${failing}`, retryable));

  return { ...platform, [failing]: failure };
}

/** Dépôt de produits en mémoire, limité à ce dont les agents ont besoin. */
export function fakeProductRepository(product: Product | null): IProductRepository {
  return {
    save: async () => undefined,
    findById: async () => product,
    findByStoreProjectId: async () => (product === null ? [] : [product]),
  };
}

/** Dépôt de contenu SEO en mémoire. */
export function fakeSeoRepository(content: SeoContent | null): ISeoContentRepository {
  return {
    save: async () => undefined,
    findByProductId: async () => content,
  };
}
