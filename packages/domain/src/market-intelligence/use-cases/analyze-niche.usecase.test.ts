import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@brandforge/shared";
import { AnalyzeNiche } from "./analyze-niche.usecase.js";
import type { MarketAgentInput, MarketAgentOutput } from "../ports/market-agent.port.js";
import {
  FakeClock,
  FakeIdGenerator,
  InMemoryNicheAnalysisRepository,
  InMemoryStoreProjectRepository,
  stubAgentFail,
  stubAgentOk,
  type StubAgent,
} from "../../test-support/fakes.js";
import { aStoreProject } from "../../test-support/builders.js";
import { AgentName } from "../../orchestration/value-objects/agent-name.vo.js";

const validOutput: MarketAgentOutput = {
  keywords: ["lunettes de soleil polarisées"],
  competitors: [
    {
      name: "Izipizi",
      url: "https://www.izipizi.com",
      positioning: "Accessible",
      estimatedPriceRange: { min: 30, max: 60 },
    },
  ],
  priceRange: { min: 80, max: 200 },
  relevanceScore: 0.82,
  differentiationAngle: "Montures françaises en acétate bio",
  rawAnalysis: { model: "test" },
};

async function setup(agent: StubAgent<MarketAgentInput, MarketAgentOutput>) {
  const storeProjects = new InMemoryStoreProjectRepository();
  const nicheAnalyses = new InMemoryNicheAnalysisRepository();
  await storeProjects.save(aStoreProject());

  const useCase = new AnalyzeNiche(
    storeProjects,
    nicheAnalyses,
    agent,
    new FakeIdGenerator("analysis"),
    new FakeClock(),
  );

  return { nicheAnalyses, useCase };
}

function okAgent(
  output: MarketAgentOutput = validOutput,
): StubAgent<MarketAgentInput, MarketAgentOutput> {
  return stubAgentOk<MarketAgentInput, MarketAgentOutput>(AgentName.MARKET, output);
}

describe("AnalyzeNiche", () => {
  it("produit et persiste une analyse à partir de la niche du projet", async () => {
    const agent = okAgent();
    const { nicheAnalyses, useCase } = await setup(agent);

    const result = await useCase.execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.priceRange.min).toBe(80);
    expect(result.data.relevanceScore.isViable()).toBe(true);
    // L'agent reçoit bien la niche portée par le projet, pas une valeur d'entrée libre.
    expect(agent.calls[0]?.niche).toBe("lunettes de soleil");
    await expect(nicheAnalyses.findByStoreProjectId("project-1")).resolves.not.toBeNull();
  });

  it("naît non validée : le point de validation utilisateur reste à franchir", async () => {
    const { useCase } = await setup(okAgent());

    const result = await useCase.execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.validatedByUser).toBe(false);
  });

  it("remonte l'erreur de l'agent sans rien persister", async () => {
    const { nicheAnalyses, useCase } = await setup(
      stubAgentFail<MarketAgentInput, MarketAgentOutput>(
        AgentName.MARKET,
        ERROR_CODES.NICHE_TOO_VAGUE,
      ),
    );

    const result = await useCase.execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.NICHE_TOO_VAGUE);
    await expect(nicheAnalyses.findByStoreProjectId("project-1")).resolves.toBeNull();
  });

  it("rejette une fourchette de prix incohérente produite par le modèle", async () => {
    const { nicheAnalyses, useCase } = await setup(
      okAgent({ ...validOutput, priceRange: { min: 300, max: 100 } }),
    );

    const result = await useCase.execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    await expect(nicheAnalyses.findByStoreProjectId("project-1")).resolves.toBeNull();
  });

  it("rejette un score de pertinence hors bornes", async () => {
    const { useCase } = await setup(okAgent({ ...validOutput, relevanceScore: 42 }));

    const result = await useCase.execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it("échoue si le projet est introuvable", async () => {
    const { useCase } = await setup(okAgent());

    const result = await useCase.execute({ storeProjectId: "inconnu" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.STORE_PROJECT_NOT_FOUND);
  });
});
