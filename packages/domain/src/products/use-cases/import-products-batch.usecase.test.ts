import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@brandforge/shared";
import { ImportProduct } from "./import-product.usecase.js";
import { ImportProductsBatch } from "./import-products-batch.usecase.js";
import { ProductSource } from "../value-objects/product-status.vo.js";
import type {
  ProductAgentInput,
  ProductAgentOutput,
  RawProductInput,
} from "../ports/product-agent.port.js";
import {
  FakeClock,
  FakeIdGenerator,
  InMemoryBrandRepository,
  InMemoryProductRepository,
  stubAgentOk,
} from "../../test-support/fakes.js";
import { aBrand } from "../../test-support/builders.js";
import { AgentName } from "../../orchestration/value-objects/agent-name.vo.js";

function rawProduct(index: number, overrides: Partial<RawProductInput> = {}): RawProductInput {
  return {
    sourceUrl: `https://www.aliexpress.com/item/${String(index)}.html`,
    title: `Sunglasses model ${String(index)}`,
    description: "High quality polarized sunglasses.",
    images: ["https://cdn.example.com/img.jpg"],
    price: 12.5,
    ...overrides,
  };
}

async function setup() {
  const products = new InMemoryProductRepository();
  const brands = new InMemoryBrandRepository();
  await brands.save(aBrand());

  const agent = stubAgentOk<ProductAgentInput, ProductAgentOutput>(AgentName.PRODUCT, {
    rewrittenTitle: "Solaris Horizon",
    rewrittenDescription: "Des montures pensées pour durer.",
    normalizedImages: ["https://cdn.example.com/img.jpg"],
    suggestedPrice: 89.9,
  });

  const importProduct = new ImportProduct(
    products,
    brands,
    agent,
    new FakeIdGenerator("product"),
    new FakeClock(),
  );

  return { products, useCase: new ImportProductsBatch(importProduct) };
}

describe("ImportProductsBatch", () => {
  it("importe tous les produits valides d'un lot", async () => {
    const { useCase } = await setup();

    const result = await useCase.execute({
      storeProjectId: "project-1",
      source: ProductSource.ALIEXPRESS,
      products: [rawProduct(1), rawProduct(2), rawProduct(3)],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.importedCount).toBe(3);
    expect(result.data.failedCount).toBe(0);
    expect(result.data.productIds).toHaveLength(3);
  });

  it("n'interrompt pas le lot quand un produit échoue", async () => {
    const { products, useCase } = await setup();

    const result = await useCase.execute({
      storeProjectId: "project-1",
      source: ProductSource.ALIEXPRESS,
      // Le deuxième produit est invalide : aucune image.
      products: [rawProduct(1), rawProduct(2, { images: [] }), rawProduct(3)],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.importedCount).toBe(2);
    expect(result.data.failedCount).toBe(1);
    expect(result.data.failures[0]?.index).toBe(1);
    expect(result.data.failures[0]?.errorCode).toBe(ERROR_CODES.PRODUCT_DATA_INCOMPLETE);
    // Les produits sains sont bien persistés malgré l'échec du voisin.
    await expect(products.findByStoreProjectId("project-1")).resolves.toHaveLength(2);
  });

  it("retourne un lot vide sans erreur", async () => {
    const { useCase } = await setup();

    const result = await useCase.execute({
      storeProjectId: "project-1",
      source: ProductSource.ALIEXPRESS,
      products: [],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.importedCount).toBe(0);
    expect(result.data.failedCount).toBe(0);
  });
});
