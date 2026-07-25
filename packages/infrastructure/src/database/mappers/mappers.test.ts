import { describe, expect, it } from "vitest";
import { AgentName, ProductSource, ProductStatus, StepStatus } from "@brandforge/domain";
import { InfrastructureError } from "@brandforge/shared";
import { Prisma } from "@prisma/client";
import { toStoreProjectDomain } from "./store-project.mapper.js";
import { toNicheAnalysisDomain } from "./niche-analysis.mapper.js";
import { toBrandDomain } from "./brand.mapper.js";
import { toProductDomain } from "./product.mapper.js";
import { toPipelineRunDomain, toPipelineStepPersistence } from "./pipeline.mapper.js";
import {
  aBrandRow,
  aNicheAnalysisRow,
  aPipelineRunRow,
  aPipelineStepRow,
  aProductRow,
  aStoreProjectRow,
} from "../../test-support/prisma-rows.js";

describe("toStoreProjectDomain", () => {
  it("reconstruit un projet depuis sa ligne", () => {
    const project = toStoreProjectDomain(aStoreProjectRow());

    expect(project.id).toBe("project-1");
    expect(project.niche).toBe("lunettes de soleil");
    expect(project.belongsTo("user-1")).toBe(true);
  });
});

describe("toNicheAnalysisDomain", () => {
  it("convertit les Decimal en value objects du domaine", () => {
    const analysis = toNicheAnalysisDomain(aNicheAnalysisRow());

    expect(analysis.priceRange.min).toBe(80);
    expect(analysis.priceRange.max).toBe(200);
    expect(analysis.relevanceScore.isViable()).toBe(true);
    expect(analysis.competitors[0]?.name).toBe("Izipizi");
    expect(analysis.validatedByUser).toBe(true);
  });

  it("échoue explicitement si la donnée persistée viole un invariant du domaine", () => {
    // Fourchette incohérente en base : signe d'une corruption, pas d'un cas métier.
    const corrupted = aNicheAnalysisRow({
      priceRangeMin: new Prisma.Decimal(300),
      priceRangeMax: new Prisma.Decimal(100),
    });

    expect(() => toNicheAnalysisDomain(corrupted)).toThrow(InfrastructureError);
  });
});

describe("toBrandDomain", () => {
  it("reconstruit la palette et la typographie depuis le JSON", () => {
    const brand = toBrandDomain(aBrandRow());

    expect(brand.name).toBe("Solaris");
    expect(brand.colorPalette.primary().hex).toBe("#1A1A1A");
    expect(brand.typography.heading).toBe("Playfair Display");
    expect(brand.isReadyForStoreBuilding()).toBe(true);
  });

  it("restitue une marque dont le nom n'est pas encore choisi", () => {
    const brand = toBrandDomain(aBrandRow({ name: null, validatedByUser: false }));

    expect(brand.name).toBeNull();
    expect(brand.isReadyForStoreBuilding()).toBe(false);
    expect(brand.toSummary()).toBeNull();
  });
});

describe("toProductDomain", () => {
  it("convertit le prix Decimal et restitue le statut", () => {
    const product = toProductDomain(aProductRow());

    expect(product.price.amount).toBe(12.5);
    expect(product.status).toBe(ProductStatus.IMPORTED);
    expect(product.sourcePlatform).toBe(ProductSource.ALIEXPRESS);
  });

  it("restitue un produit manuel sans URL source", () => {
    const product = toProductDomain(
      aProductRow({ sourceUrl: null, sourcePlatform: ProductSource.MANUAL }),
    );

    expect(product.sourceUrl).toBeNull();
  });
});

describe("toPipelineRunDomain", () => {
  it("trie les étapes par position, quel que soit l'ordre renvoyé par la base", () => {
    const run = toPipelineRunDomain(
      aPipelineRunRow({
        steps: [
          aPipelineStepRow({ id: "step-2", agentName: AgentName.BRAND, position: 1 }),
          aPipelineStepRow({
            id: "step-1",
            agentName: AgentName.MARKET,
            position: 0,
            status: StepStatus.SUCCESS,
          }),
        ],
      }),
    );

    expect(run.steps.map((step) => step.agentName)).toEqual([AgentName.MARKET, AgentName.BRAND]);
    // L'ordre conditionne le point de reprise : la première étape non aboutie.
    expect(run.nextResumableStep()?.agentName).toBe(AgentName.BRAND);
  });
});

describe("toPipelineStepPersistence", () => {
  it("écrit un NULL SQL plutôt qu'un JSON null quand l'étape n'a pas de sortie", () => {
    const run = toPipelineRunDomain(
      aPipelineRunRow({ steps: [aPipelineStepRow({ output: null })] }),
    );
    const step = run.steps[0];
    if (step === undefined) throw new Error("fixture invalide");

    expect(toPipelineStepPersistence(step, 0).output).toBe(Prisma.DbNull);
  });

  it("dérive la position de l'index de l'étape dans l'agrégat", () => {
    const run = toPipelineRunDomain(
      aPipelineRunRow({
        steps: [
          aPipelineStepRow({ id: "step-1", position: 0 }),
          aPipelineStepRow({ id: "step-2", position: 1 }),
        ],
      }),
    );
    const second = run.steps[1];
    if (second === undefined) throw new Error("fixture invalide");

    expect(toPipelineStepPersistence(second, 1).position).toBe(1);
  });
});
