import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@brandforge/shared";
import { PublishProduct } from "./publish-product.usecase.js";
import { SyncProduct } from "./sync-product.usecase.js";
import type { ShopifyAgentInput, ShopifyAgentOutput } from "../ports/shopify-agent.port.js";
import { Price } from "../../products/value-objects/price.vo.js";
import { ProductStatus } from "../../products/value-objects/product-status.vo.js";
import {
  FakeClock,
  InMemoryProductRepository,
  stubAgentFail,
  stubAgentOk,
  type StubAgent,
} from "../../test-support/fakes.js";
import { aProduct } from "../../test-support/builders.js";
import { AgentName } from "../../orchestration/value-objects/agent-name.vo.js";
import type { Product } from "../../products/entities/product.entity.js";

const publishedOutput: ShopifyAgentOutput = {
  shopifyResourceId: "gid://shopify/Product/42",
  status: "PUBLISHED",
};

function okAgent(
  output: ShopifyAgentOutput = publishedOutput,
): StubAgent<ShopifyAgentInput, ShopifyAgentOutput> {
  return stubAgentOk<ShopifyAgentInput, ShopifyAgentOutput>(AgentName.SHOPIFY, output);
}

/** Produit réécrit, donc publiable. */
function rewrittenProduct(): Product {
  const product = aProduct();
  const price = Price.create(89.9);
  if (!price.success) throw new Error("fixture invalide");
  product.applyRewrite({
    title: "Solaris Horizon",
    description: "Montures en acétate bio.",
    images: ["https://cdn.example.com/img-1.jpg"],
    price: price.data,
  });
  return product;
}

describe("PublishProduct", () => {
  it("publie un produit réécrit et mémorise son identifiant plateforme", async () => {
    const products = new InMemoryProductRepository();
    await products.save(rewrittenProduct());
    const agent = okAgent();

    const result = await new PublishProduct(products, agent, new FakeClock()).execute({
      productId: "product-1",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.shopifyProductId).toBe("gid://shopify/Product/42");

    const persisted = await products.findById("product-1");
    expect(persisted?.status).toBe(ProductStatus.PUBLISHED);
    expect(persisted?.shopifyProductId).toBe("gid://shopify/Product/42");
  });

  it("refuse de publier un produit encore à l'état brut", async () => {
    const products = new InMemoryProductRepository();
    await products.save(aProduct());
    const agent = okAgent();

    const result = await new PublishProduct(products, agent, new FakeClock()).execute({
      productId: "product-1",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.INVALID_PIPELINE_STATE);
    // Publier un titre AliExpress non réécrit produirait du contenu dupliqué.
    expect(agent.calls).toHaveLength(0);
  });

  it("laisse le produit non publié si Shopify rejette la fiche", async () => {
    const products = new InMemoryProductRepository();
    await products.save(rewrittenProduct());

    const result = await new PublishProduct(
      products,
      stubAgentFail<ShopifyAgentInput, ShopifyAgentOutput>(
        AgentName.SHOPIFY,
        ERROR_CODES.SHOPIFY_RATE_LIMIT,
        true,
      ),
      new FakeClock(),
    ).execute({ productId: "product-1" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.retryable).toBe(true);
    const persisted = await products.findById("product-1");
    expect(persisted?.status).toBe(ProductStatus.REWRITTEN);
  });

  it("échoue si le produit est introuvable", async () => {
    const result = await new PublishProduct(
      new InMemoryProductRepository(),
      okAgent(),
      new FakeClock(),
    ).execute({ productId: "inconnu" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.PRODUCT_NOT_FOUND);
  });
});

describe("SyncProduct", () => {
  it("synchronise un produit déjà publié", async () => {
    const products = new InMemoryProductRepository();
    const product = rewrittenProduct();
    product.markPublished("gid://shopify/Product/42");
    await products.save(product);

    const result = await new SyncProduct(
      products,
      okAgent({ shopifyResourceId: "gid://shopify/Product/42", status: "SYNCED" }),
    ).execute({ productId: "product-1" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("SYNCED");
  });

  it("refuse de synchroniser un produit jamais publié", async () => {
    const products = new InMemoryProductRepository();
    await products.save(rewrittenProduct());

    const result = await new SyncProduct(products, okAgent()).execute({ productId: "product-1" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.INVALID_PIPELINE_STATE);
  });
});
