import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@brandforge/shared";
import { ValidateNicheAnalysis } from "./validate-niche-analysis.usecase.js";
import { InMemoryNicheAnalysisRepository } from "../../test-support/fakes.js";
import { aNicheAnalysis } from "../../test-support/builders.js";

describe("ValidateNicheAnalysis", () => {
  it("marque l'analyse comme validée quand l'utilisateur approuve", async () => {
    const nicheAnalyses = new InMemoryNicheAnalysisRepository();
    await nicheAnalyses.save(aNicheAnalysis());

    const result = await new ValidateNicheAnalysis(nicheAnalyses).execute({
      storeProjectId: "project-1",
      approved: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.confirmed).toBe(true);
    const persisted = await nicheAnalyses.findByStoreProjectId("project-1");
    expect(persisted?.validatedByUser).toBe(true);
  });

  it("laisse l'analyse non validée quand l'utilisateur refuse", async () => {
    const nicheAnalyses = new InMemoryNicheAnalysisRepository();
    await nicheAnalyses.save(aNicheAnalysis());

    const result = await new ValidateNicheAnalysis(nicheAnalyses).execute({
      storeProjectId: "project-1",
      approved: false,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.confirmed).toBe(false);
    const persisted = await nicheAnalyses.findByStoreProjectId("project-1");
    expect(persisted?.validatedByUser).toBe(false);
  });

  it("échoue si aucune analyse n'existe pour le projet", async () => {
    const result = await new ValidateNicheAnalysis(new InMemoryNicheAnalysisRepository()).execute({
      storeProjectId: "project-1",
      approved: true,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.NICHE_ANALYSIS_NOT_FOUND);
  });
});
