import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@brandforge/shared";
import {
  AgentName,
  Price,
  Product,
  ProductSource,
  SeoContent,
  type ShopifyAgentInput,
} from "@brandforge/domain";
import { ShopifyAgent } from "./shopify.agent.js";
import {
  fakePlatform,
  fakeProductRepository,
  fakeSeoRepository,
  failingPlatform,
} from "../test-support/platform-fakes.js";

function price(amount: number): Price {
  const result = Price.create(amount);
  if (!result.success) throw new Error("fixture invalide");
  return result.data;
}

/** Produit réécrit, donc publiable. */
function aRewrittenProduct(options: { published?: boolean } = {}): Product {
  const created = Product.create({
    id: "product-1",
    storeProjectId: "project-1",
    sourceUrl: "https://www.aliexpress.com/item/1.html",
    sourcePlatform: ProductSource.ALIEXPRESS,
    originalTitle: "Sunglasses Polarized UV400",
    originalDescription: "High quality polarized sunglasses.",
    images: ["https://cdn.example.com/img-1.jpg"],
    price: price(12.5),
  });
  if (!created.success) throw new Error("fixture invalide");

  const product = created.data;
  product.applyRewrite({
    title: "Solaris Horizon",
    description: "Montures en acétate bio.",
    images: ["https://cdn.example.com/img-1.jpg"],
    price: price(89.9),
  });

  if (options.published ?? false) {
    product.markPublished("gid://shopify/Product/42");
  }

  return product;
}

function aSeoContent(): SeoContent {
  return SeoContent.create({
    id: "seo-1",
    productId: "product-1",
    targetKeywords: ["lunettes de soleil polarisées"],
    metaTitle: "Lunettes polarisées premium | Solaris",
    metaDescription: "Montures en acétate bio, verres polarisés.",
    optimizedContent: "<p>Contenu optimisé pour le référencement.</p>",
  });
}

const publishStoreInput: ShopifyAgentInput = {
  storeProjectId: "project-1",
  action: "PUBLISH_STORE",
};

describe("ShopifyAgent", () => {
  it("porte le nom d'agent attendu", () => {
    const agent = new ShopifyAgent(
      fakePlatform(),
      fakeProductRepository(null),
      fakeSeoRepository(null),
    );

    expect(agent.name).toBe(AgentName.SHOPIFY);
  });
});

describe("ShopifyAgent — publication de la boutique", () => {
  it("retourne l'URL publique de la boutique", async () => {
    const agent = new ShopifyAgent(
      fakePlatform({ storeUrl: "https://solaris.myshopify.com" }),
      fakeProductRepository(null),
      fakeSeoRepository(null),
    );

    const result = await agent.execute(publishStoreInput);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.status).toBe("PUBLISHED");
    expect(result.output.url).toBe("https://solaris.myshopify.com");
  });

  it("remonte une erreur d'authentification comme non rejouable", async () => {
    const agent = new ShopifyAgent(
      failingPlatform("publishStore", ERROR_CODES.SHOPIFY_AUTH_ERROR),
      fakeProductRepository(null),
      fakeSeoRepository(null),
    );

    const result = await agent.execute(publishStoreInput);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.SHOPIFY_AUTH_ERROR);
    expect(result.error.retryable).toBe(false);
  });
});

describe("ShopifyAgent — publication d'un produit", () => {
  const input: ShopifyAgentInput = {
    storeProjectId: "project-1",
    action: "PUBLISH_PRODUCT",
    productId: "product-1",
  };

  it("publie le produit et retourne son identifiant Shopify", async () => {
    const platform = fakePlatform({ productId: "gid://shopify/Product/99" });
    const agent = new ShopifyAgent(
      platform,
      fakeProductRepository(aRewrittenProduct()),
      fakeSeoRepository(null),
    );

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.shopifyResourceId).toBe("gid://shopify/Product/99");
    expect(result.output.status).toBe("PUBLISHED");
  });

  it("publie le titre réécrit, jamais le titre d'origine AliExpress", async () => {
    const platform = fakePlatform();
    const agent = new ShopifyAgent(
      platform,
      fakeProductRepository(aRewrittenProduct()),
      fakeSeoRepository(null),
    );

    await agent.execute(input);

    // Publier le titre d'origine produirait du contenu dupliqué (PRD.md §5).
    expect(platform.calls.createdProducts[0]?.title).toBe("Solaris Horizon");
  });

  it("privilégie le contenu SEO quand il existe", async () => {
    const platform = fakePlatform();
    const agent = new ShopifyAgent(
      platform,
      fakeProductRepository(aRewrittenProduct()),
      fakeSeoRepository(aSeoContent()),
    );

    await agent.execute(input);

    expect(platform.calls.createdProducts[0]?.metaTitle).toBe(
      "Lunettes polarisées premium | Solaris",
    );
  });

  it("publie sans métadonnées SEO quand aucune n'a été générée", async () => {
    const platform = fakePlatform();
    const agent = new ShopifyAgent(
      platform,
      fakeProductRepository(aRewrittenProduct()),
      fakeSeoRepository(null),
    );

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    expect(platform.calls.createdProducts[0]?.metaTitle).toBeUndefined();
  });

  it("échoue si le produit est introuvable", async () => {
    const agent = new ShopifyAgent(
      fakePlatform(),
      fakeProductRepository(null),
      fakeSeoRepository(null),
    );

    const result = await agent.execute(input);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.PRODUCT_NOT_FOUND);
  });

  it("remonte un refus de validation Shopify", async () => {
    const agent = new ShopifyAgent(
      failingPlatform("createProduct", ERROR_CODES.SHOPIFY_VALIDATION_ERROR),
      fakeProductRepository(aRewrittenProduct()),
      fakeSeoRepository(null),
    );

    const result = await agent.execute(input);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.SHOPIFY_VALIDATION_ERROR);
  });
});

describe("ShopifyAgent — synchronisation d'un produit", () => {
  const input: ShopifyAgentInput = {
    storeProjectId: "project-1",
    action: "SYNC_PRODUCT",
    productId: "product-1",
  };

  it("met à jour la fiche déjà publiée", async () => {
    const platform = fakePlatform();
    const agent = new ShopifyAgent(
      platform,
      fakeProductRepository(aRewrittenProduct({ published: true })),
      fakeSeoRepository(aSeoContent()),
    );

    const result = await agent.execute(input);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.status).toBe("SYNCED");
    expect(platform.calls.updatedProducts[0]?.id).toBe("gid://shopify/Product/42");
  });

  it("refuse de synchroniser un produit jamais publié", async () => {
    const platform = fakePlatform();
    const agent = new ShopifyAgent(
      platform,
      fakeProductRepository(aRewrittenProduct()),
      fakeSeoRepository(null),
    );

    const result = await agent.execute(input);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.INVALID_PIPELINE_STATE);
    // Sans identifiant plateforme, la mise à jour n'aurait aucune cible.
    expect(platform.calls.updatedProducts).toHaveLength(0);
  });

  it("remonte un quota dépassé comme rejouable", async () => {
    const agent = new ShopifyAgent(
      failingPlatform("updateProduct", ERROR_CODES.SHOPIFY_RATE_LIMIT, true),
      fakeProductRepository(aRewrittenProduct({ published: true })),
      fakeSeoRepository(null),
    );

    const result = await agent.execute(input);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.retryable).toBe(true);
  });
});
