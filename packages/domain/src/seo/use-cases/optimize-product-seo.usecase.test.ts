import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@brandforge/shared";
import { OptimizeProductSeo } from "./optimize-product-seo.usecase.js";
import type { SeoAgentInput, SeoAgentOutput } from "../ports/seo-agent.port.js";
import { ProductStatus } from "../../products/value-objects/product-status.vo.js";
import {
  FakeClock,
  FakeIdGenerator,
  InMemoryNicheAnalysisRepository,
  InMemoryProductRepository,
  InMemorySeoContentRepository,
  stubAgentFail,
  stubAgentOk,
  type StubAgent,
} from "../../test-support/fakes.js";
import { aNicheAnalysis, aProduct } from "../../test-support/builders.js";
import { AgentName } from "../../orchestration/value-objects/agent-name.vo.js";

const validOutput: SeoAgentOutput = {
  metaTitle: "Lunettes de soleil polarisées premium | Solaris",
  metaDescription: "Montures en acétate bio, verres polarisés. Fabriquées en France.",
  optimizedContent: "Contenu optimisé pour le référencement.",
  targetKeywords: ["lunettes de soleil polarisées"],
};

async function setup(
  agent: StubAgent<SeoAgentInput, SeoAgentOutput>,
  options: { withAnalysis?: boolean; withProduct?: boolean } = {},
) {
  const products = new InMemoryProductRepository();
  const seoContents = new InMemorySeoContentRepository();
  const nicheAnalyses = new InMemoryNicheAnalysisRepository();

  if (options.withProduct ?? true) {
    await products.save(aProduct());
  }
  if (options.withAnalysis ?? true) {
    await nicheAnalyses.save(aNicheAnalysis({ validated: true }));
  }

  const useCase = new OptimizeProductSeo(
    products,
    seoContents,
    nicheAnalyses,
    agent,
    new FakeIdGenerator("seo"),
    new FakeClock(),
  );

  return { products, seoContents, useCase };
}

describe("OptimizeProductSeo", () => {
  it("produit un contenu SEO et fait avancer le statut du produit", async () => {
    const agent = stubAgentOk<SeoAgentInput, SeoAgentOutput>(AgentName.SEO, validOutput);
    const { products, seoContents, useCase } = await setup(agent);

    const result = await useCase.execute({ productId: "product-1" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.metaTitle).toBe(validOutput.metaTitle);

    await expect(seoContents.findByProductId("product-1")).resolves.not.toBeNull();
    const product = await products.findById("product-1");
    expect(product?.status).toBe(ProductStatus.SEO_OPTIMIZED);
  });

  it("hérite des mots-clés de l'analyse de niche quand aucun n'est fourni", async () => {
    const agent = stubAgentOk<SeoAgentInput, SeoAgentOutput>(AgentName.SEO, validOutput);
    const { useCase } = await setup(agent);

    await useCase.execute({ productId: "product-1" });

    expect(agent.calls[0]?.targetKeywords).toEqual([
      "lunettes de soleil polarisées",
      "lunettes premium",
    ]);
  });

  it("privilégie les mots-clés explicitement fournis", async () => {
    const agent = stubAgentOk<SeoAgentInput, SeoAgentOutput>(AgentName.SEO, validOutput);
    const { useCase } = await setup(agent);

    await useCase.execute({ productId: "product-1", targetKeywords: ["monture acétate"] });

    expect(agent.calls[0]?.targetKeywords).toEqual(["monture acétate"]);
  });

  it("fonctionne sans analyse de niche disponible", async () => {
    const agent = stubAgentOk<SeoAgentInput, SeoAgentOutput>(AgentName.SEO, validOutput);
    const { useCase } = await setup(agent, { withAnalysis: false });

    const result = await useCase.execute({ productId: "product-1" });

    expect(result.success).toBe(true);
    expect(agent.calls[0]?.targetKeywords).toBeUndefined();
  });

  it("remonte l'erreur de l'agent sans rien persister", async () => {
    const { products, seoContents, useCase } = await setup(
      stubAgentFail<SeoAgentInput, SeoAgentOutput>(AgentName.SEO, ERROR_CODES.CONTENT_TOO_SHORT),
    );

    const result = await useCase.execute({ productId: "product-1" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.CONTENT_TOO_SHORT);
    await expect(seoContents.findByProductId("product-1")).resolves.toBeNull();
    const product = await products.findById("product-1");
    expect(product?.status).toBe(ProductStatus.IMPORTED);
  });

  it("échoue si le produit est introuvable", async () => {
    const { useCase } = await setup(
      stubAgentOk<SeoAgentInput, SeoAgentOutput>(AgentName.SEO, validOutput),
      { withProduct: false },
    );

    const result = await useCase.execute({ productId: "product-1" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.PRODUCT_NOT_FOUND);
  });
});
