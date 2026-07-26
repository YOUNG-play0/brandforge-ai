import { describe, expect, it } from "vitest";
import { ERROR_CODES, agentFail, agentOk, createAgentError } from "@brandforge/shared";
import type { BrandSummary } from "@brandforge/domain";
import { ShopifyEcommercePlatform } from "./shopify-ecommerce-platform.js";
import type { ShopifyGraphQlClient } from "./shopify-graphql-client.js";

/** Sans archive de base : le thème publié de la boutique est réutilisé. */
const baseConfig = {};

const brand: BrandSummary = {
  name: "Solaris",
  positioning: "Lunettes premium",
  tone: "premium",
  colorPalette: [{ hex: "#1A1A1A", role: "primary" }],
  typography: { heading: "Playfair Display", body: "Inter" },
};

/** Client GraphQL simulé, retournant successivement les réponses fournies. */
function clientReturning(...payloads: unknown[]): ShopifyGraphQlClient & { queries: string[] } {
  const queries: string[] = [];
  let index = 0;

  return {
    queries,
    request: async (query: string) => {
      queries.push(query);
      const payload = payloads[Math.min(index, payloads.length - 1)];
      index += 1;
      return agentOk(payload);
    },
  } as unknown as ShopifyGraphQlClient & { queries: string[] };
}

function clientFailing(code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES]): ShopifyGraphQlClient {
  return {
    request: async () => agentFail(createAgentError(code, "échec simulé", false)),
  } as unknown as ShopifyGraphQlClient;
}

describe("ShopifyEcommercePlatform — thème", () => {
  it("réutilise le thème publié quand aucune archive de base n'est configurée", async () => {
    const client = clientReturning({
      themes: { nodes: [{ id: "gid://shopify/OnlineStoreTheme/1" }] },
    });

    const result = await new ShopifyEcommercePlatform(client, baseConfig).applyTheme({
      storeProjectId: "project-1",
      brand,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.themeId).toBe("gid://shopify/OnlineStoreTheme/1");
    expect(client.queries[0]).toContain("themes(first: 1, roles: [MAIN])");
  });

  it("crée un thème depuis l'archive configurée", async () => {
    const client = clientReturning({
      themeCreate: { theme: { id: "gid://shopify/OnlineStoreTheme/9" }, userErrors: [] },
    });
    const config = { baseThemeUrl: "https://cdn.example.com/theme.zip" };

    const result = await new ShopifyEcommercePlatform(client, config).applyTheme({
      storeProjectId: "project-1",
      brand,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.themeId).toBe("gid://shopify/OnlineStoreTheme/9");
    expect(client.queries[0]).toContain("themeCreate");
  });

  it("échoue clairement si la boutique n'a aucun thème publié", async () => {
    const client = clientReturning({ themes: { nodes: [] } });

    const result = await new ShopifyEcommercePlatform(client, baseConfig).applyTheme({
      storeProjectId: "project-1",
      brand,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.THEME_APPLICATION_FAILED);
    expect(result.error.message).toContain("SHOPIFY_BASE_THEME_URL");
  });

  it("traduit un refus de Shopify sur themeCreate", async () => {
    const client = clientReturning({
      themeCreate: { theme: null, userErrors: [{ field: ["source"], message: "invalid URL" }] },
    });
    const config = { baseThemeUrl: "https://cdn.example.com/theme.zip" };

    const result = await new ShopifyEcommercePlatform(client, config).applyTheme({
      storeProjectId: "project-1",
      brand,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.THEME_APPLICATION_FAILED);
  });
});

describe("ShopifyEcommercePlatform — collections et pages", () => {
  it("crée une collection et retourne la ressource", async () => {
    const client = clientReturning({
      collectionCreate: {
        collection: { id: "gid://shopify/Collection/1", title: "Nouveautés" },
        userErrors: [],
      },
    });

    const result = await new ShopifyEcommercePlatform(client, baseConfig).createCollection({
      storeProjectId: "project-1",
      title: "Nouveautés",
      description: "Les dernières montures.",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.id).toBe("gid://shopify/Collection/1");
  });

  it("échoue si Shopify refuse la collection malgré un HTTP 200", async () => {
    const client = clientReturning({
      collectionCreate: { collection: null, userErrors: [{ message: "Title can't be blank" }] },
    });

    const result = await new ShopifyEcommercePlatform(client, baseConfig).createCollection({
      storeProjectId: "project-1",
      title: "",
      description: "x",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.SHOPIFY_VALIDATION_ERROR);
  });

  it("crée une page", async () => {
    const client = clientReturning({
      pageCreate: { page: { id: "gid://shopify/Page/1", title: "Accueil" }, userErrors: [] },
    });

    const result = await new ShopifyEcommercePlatform(client, baseConfig).createPage({
      storeProjectId: "project-1",
      title: "Accueil",
      type: "home",
      content: "<p>Bienvenue</p>",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.title).toBe("Accueil");
  });
});

describe("ShopifyEcommercePlatform — produits", () => {
  it("crée un produit et retourne son identifiant", async () => {
    const client = clientReturning({
      productCreate: {
        product: { id: "gid://shopify/Product/42", onlineStoreUrl: "https://shop.test/p/42" },
        userErrors: [],
      },
    });

    const result = await new ShopifyEcommercePlatform(client, baseConfig).createProduct({
      storeProjectId: "project-1",
      title: "Solaris Horizon",
      description: "<p>Montures</p>",
      images: [],
      price: 89.9,
      metaTitle: "Solaris Horizon | Solaris",
      metaDescription: "Montures en acétate bio.",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.platformProductId).toBe("gid://shopify/Product/42");
    expect(result.output.url).toBe("https://shop.test/p/42");
  });

  it("omet l'URL tant que le produit n'est pas publié sur le canal en ligne", async () => {
    const client = clientReturning({
      productCreate: {
        product: { id: "gid://shopify/Product/42", onlineStoreUrl: null },
        userErrors: [],
      },
    });

    const result = await new ShopifyEcommercePlatform(client, baseConfig).createProduct({
      storeProjectId: "project-1",
      title: "Solaris Horizon",
      description: "<p>Montures</p>",
      images: [],
      price: 89.9,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.url).toBeUndefined();
  });

  it("met à jour un produit existant en transmettant son identifiant", async () => {
    const requests: Record<string, unknown>[] = [];
    const client = {
      request: async (_query: string, variables: Record<string, unknown>) => {
        requests.push(variables);
        return agentOk({
          productUpdate: {
            product: { id: "gid://shopify/Product/42", onlineStoreUrl: null },
            userErrors: [],
          },
        });
      },
    } as unknown as ShopifyGraphQlClient;

    const result = await new ShopifyEcommercePlatform(client, baseConfig).updateProduct(
      "gid://shopify/Product/42",
      {
        storeProjectId: "project-1",
        title: "Solaris Horizon",
        description: "<p>Montures</p>",
        images: [],
        price: 89.9,
      },
    );

    expect(result.success).toBe(true);
    expect((requests[0]?.["input"] as { id: string }).id).toBe("gid://shopify/Product/42");
  });
});

describe("ShopifyEcommercePlatform — publication de la boutique", () => {
  it("retourne le domaine principal de la boutique", async () => {
    const client = clientReturning({
      shop: { name: "Solaris", primaryDomain: { url: "https://f992av-n1.myshopify.com" } },
    });

    const result = await new ShopifyEcommercePlatform(client, baseConfig).publishStore("project-1");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.storeUrl).toBe("https://f992av-n1.myshopify.com");
  });

  it("échoue si Shopify ne retourne aucun domaine", async () => {
    const client = clientReturning({ shop: { name: "Solaris" } });

    const result = await new ShopifyEcommercePlatform(client, baseConfig).publishStore("project-1");

    expect(result.success).toBe(false);
  });

  it("remonte les erreurs du client sans les réinterpréter", async () => {
    const platform = new ShopifyEcommercePlatform(
      clientFailing(ERROR_CODES.SHOPIFY_RATE_LIMIT),
      baseConfig,
    );

    const result = await platform.publishStore("project-1");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.SHOPIFY_RATE_LIMIT);
  });
});

describe("ShopifyEcommercePlatform — aucune fuite d'identifiants", () => {
  it("ne reçoit jamais le client secret : moindre privilège (ADR 0005)", () => {
    const platform = new ShopifyEcommercePlatform(clientReturning({}), {
      baseThemeUrl: "https://cdn.example.com/theme.zip",
    });

    // La classe ne prend que les réglages qui la concernent, pas la configuration
    // complète : aucun identifiant d'authentification ne transite par elle.
    expect(Object.keys(platform["options"] as object)).toEqual(["baseThemeUrl"]);
  });
});
