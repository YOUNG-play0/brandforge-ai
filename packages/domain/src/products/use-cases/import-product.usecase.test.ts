import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@brandforge/shared";
import { ImportProduct } from "./import-product.usecase.js";
import { ProductStatus, ProductSource } from "../value-objects/product-status.vo.js";
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
  stubAgentFail,
  stubAgentOk,
  type StubAgent,
} from "../../test-support/fakes.js";
import { aBrand } from "../../test-support/builders.js";
import { AgentName } from "../../orchestration/value-objects/agent-name.vo.js";

const rawProduct: RawProductInput = {
  sourceUrl: "https://www.aliexpress.com/item/123.html",
  title: "Sunglasses Polarized UV400 Men Women",
  description: "High quality polarized sunglasses for driving and fishing.",
  images: ["https://cdn.example.com/img-1.jpg"],
  price: 12.5,
};

const validOutput: ProductAgentOutput = {
  rewrittenTitle: "Solaris Horizon — Lunettes polarisées acétate",
  rewrittenDescription: "Des montures pensées pour durer, façonnées en acétate bio.",
  normalizedImages: ["https://cdn.example.com/img-1.jpg"],
  suggestedPrice: 89.9,
};

/** Retire `sourceUrl` sans l'assigner à `undefined` (exactOptionalPropertyTypes). */
function withoutSourceUrl(product: RawProductInput): RawProductInput {
  const { sourceUrl: _omitted, ...rest } = product;
  return rest;
}

function okAgent(
  output: ProductAgentOutput = validOutput,
): StubAgent<ProductAgentInput, ProductAgentOutput> {
  return stubAgentOk<ProductAgentInput, ProductAgentOutput>(AgentName.PRODUCT, output);
}

async function setup(
  agent: StubAgent<ProductAgentInput, ProductAgentOutput>,
  options: { brandNamed?: boolean; withBrand?: boolean } = {},
) {
  const products = new InMemoryProductRepository();
  const brands = new InMemoryBrandRepository();

  if (options.withBrand ?? true) {
    await brands.save(aBrand({ named: options.brandNamed ?? true }));
  }

  const useCase = new ImportProduct(
    products,
    brands,
    agent,
    new FakeIdGenerator("product"),
    new FakeClock(),
  );

  return { products, useCase };
}

describe("ImportProduct", () => {
  it("importe le produit et applique la réécriture de l'agent", async () => {
    const agent = okAgent();
    const { products, useCase } = await setup(agent);

    const result = await useCase.execute({
      storeProjectId: "project-1",
      source: ProductSource.ALIEXPRESS,
      rawProduct,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe(ProductStatus.REWRITTEN);

    const persisted = await products.findById(result.data.productId);
    expect(persisted?.effectiveTitle()).toBe(validOutput.rewrittenTitle);
    expect(persisted?.price.amount).toBe(89.9);
    // Le contenu d'origine reste disponible pour rejouer une réécriture.
    expect(persisted?.originalTitle).toBe(rawProduct.title);
    // L'agent reçoit le ton de la marque pour aligner la réécriture.
    expect(agent.calls[0]?.brand.tone).toBe("premium, épuré, confiant");
  });

  it("conserve le produit importé même si la réécriture échoue", async () => {
    const { products, useCase } = await setup(
      stubAgentFail<ProductAgentInput, ProductAgentOutput>(
        AgentName.PRODUCT,
        ERROR_CODES.AI_PROVIDER_TIMEOUT,
        true,
      ),
    );

    const result = await useCase.execute({
      storeProjectId: "project-1",
      source: ProductSource.ALIEXPRESS,
      rawProduct,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.AI_PROVIDER_TIMEOUT);

    // L'import ne doit pas être perdu : le produit reste rattrapable en IMPORTED.
    const persisted = await products.findByStoreProjectId("project-1");
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.status).toBe(ProductStatus.IMPORTED);
  });

  it("refuse l'import tant que le nom de marque n'est pas validé", async () => {
    const { products, useCase } = await setup(okAgent(), { brandNamed: false });

    const result = await useCase.execute({
      storeProjectId: "project-1",
      source: ProductSource.ALIEXPRESS,
      rawProduct,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.INVALID_PIPELINE_STATE);
    await expect(products.findByStoreProjectId("project-1")).resolves.toHaveLength(0);
  });

  it("échoue si aucune marque n'existe pour le projet", async () => {
    const { useCase } = await setup(okAgent(), { withBrand: false });

    const result = await useCase.execute({
      storeProjectId: "project-1",
      source: ProductSource.ALIEXPRESS,
      rawProduct,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.BRAND_NOT_FOUND);
  });

  it("rejette un produit AliExpress sans URL source", async () => {
    const { useCase } = await setup(okAgent());

    const result = await useCase.execute({
      storeProjectId: "project-1",
      source: ProductSource.ALIEXPRESS,
      rawProduct: withoutSourceUrl(rawProduct),
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.PRODUCT_DATA_INCOMPLETE);
  });

  it("rejette un produit sans image", async () => {
    const { useCase } = await setup(okAgent());

    const result = await useCase.execute({
      storeProjectId: "project-1",
      source: ProductSource.ALIEXPRESS,
      rawProduct: { ...rawProduct, images: [] },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.PRODUCT_DATA_INCOMPLETE);
  });

  it("accepte un produit manuel sans URL source", async () => {
    const { useCase } = await setup(okAgent());

    const result = await useCase.execute({
      storeProjectId: "project-1",
      source: ProductSource.MANUAL,
      rawProduct: withoutSourceUrl(rawProduct),
    });

    expect(result.success).toBe(true);
  });
});
