import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@brandforge/shared";
import { GenerateBrandOptions } from "./generate-brand-options.usecase.js";
import type { BrandAgentInput, BrandAgentOutput } from "../ports/brand-agent.port.js";
import {
  FakeClock,
  FakeIdGenerator,
  InMemoryBrandRepository,
  InMemoryNicheAnalysisRepository,
  InMemoryStoreProjectRepository,
  stubAgentFail,
  stubAgentOk,
  type StubAgent,
} from "../../test-support/fakes.js";
import { aNicheAnalysis, aStoreProject } from "../../test-support/builders.js";
import { AgentName } from "../../orchestration/value-objects/agent-name.vo.js";

const validOutput: BrandAgentOutput = {
  nameOptions: ["Solaris", "Lumen", "Éclat"],
  positioning: "Lunettes premium fabriquées en France",
  tone: "premium, épuré, confiant",
  colorPalette: [
    { hex: "#1A1A1A", role: "primary" },
    { hex: "#C9A227", role: "accent" },
  ],
  typography: { heading: "Playfair Display", body: "Inter" },
  logoBriefing: "Monogramme minimaliste doré",
};

function okAgent(
  output: BrandAgentOutput = validOutput,
): StubAgent<BrandAgentInput, BrandAgentOutput> {
  return stubAgentOk<BrandAgentInput, BrandAgentOutput>(AgentName.BRAND, output);
}

async function setup(
  agent: StubAgent<BrandAgentInput, BrandAgentOutput>,
  options: { analysisValidated: boolean; withAnalysis?: boolean } = { analysisValidated: true },
) {
  const storeProjects = new InMemoryStoreProjectRepository();
  const nicheAnalyses = new InMemoryNicheAnalysisRepository();
  const brands = new InMemoryBrandRepository();

  await storeProjects.save(aStoreProject());
  if (options.withAnalysis ?? true) {
    await nicheAnalyses.save(aNicheAnalysis({ validated: options.analysisValidated }));
  }

  const useCase = new GenerateBrandOptions(
    storeProjects,
    nicheAnalyses,
    brands,
    agent,
    new FakeIdGenerator("brand"),
    new FakeClock(),
  );

  return { brands, useCase };
}

describe("GenerateBrandOptions", () => {
  it("génère une marque sans nom figé à partir d'une analyse validée", async () => {
    const agent = okAgent();
    const { brands, useCase } = await setup(agent);

    const result = await useCase.execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.nameOptions).toEqual(["Solaris", "Lumen", "Éclat"]);
    // Le nom reste à choisir : c'est un point de validation utilisateur (WORKFLOWS.md §3).
    expect(result.data.name).toBeNull();
    expect(result.data.validatedByUser).toBe(false);
    await expect(brands.findByStoreProjectId("project-1")).resolves.not.toBeNull();
    expect(agent.calls[0]?.nicheAnalysis.niche).toBe("lunettes de soleil");
  });

  it("bloque tant que l'analyse de niche n'est pas validée par l'utilisateur", async () => {
    const { brands, useCase } = await setup(okAgent(), { analysisValidated: false });

    const result = await useCase.execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.INVALID_PIPELINE_STATE);
    await expect(brands.findByStoreProjectId("project-1")).resolves.toBeNull();
  });

  it("échoue si aucune analyse de niche n'a été produite", async () => {
    const { useCase } = await setup(okAgent(), { analysisValidated: true, withAnalysis: false });

    const result = await useCase.execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.NICHE_ANALYSIS_NOT_FOUND);
  });

  it("remonte l'erreur de l'agent", async () => {
    const { useCase } = await setup(
      stubAgentFail<BrandAgentInput, BrandAgentOutput>(
        AgentName.BRAND,
        ERROR_CODES.BRAND_NAME_CONFLICT,
        true,
      ),
    );

    const result = await useCase.execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.BRAND_NAME_CONFLICT);
    expect(result.error.retryable).toBe(true);
  });

  it("rejette une palette sans couleur primaire", async () => {
    const { brands, useCase } = await setup(
      okAgent({ ...validOutput, colorPalette: [{ hex: "#C9A227", role: "accent" }] }),
    );

    const result = await useCase.execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    await expect(brands.findByStoreProjectId("project-1")).resolves.toBeNull();
  });

  it("rejette une couleur hexadécimale malformée", async () => {
    const { useCase } = await setup(
      okAgent({ ...validOutput, colorPalette: [{ hex: "noir", role: "primary" }] }),
    );

    const result = await useCase.execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });
});
