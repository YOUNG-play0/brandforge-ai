import { describe, expect, it } from "vitest";
import { AgentName, PipelineRun, PipelineStep, StepStatus, StoreProject } from "@brandforge/domain";
import { InfrastructureError } from "@brandforge/shared";
import { Prisma } from "@prisma/client";
import { PrismaStoreProjectRepository } from "./prisma-store-project.repository.js";
import { PrismaBrandRepository } from "./prisma-brand.repository.js";
import { PrismaProductRepository } from "./prisma-product.repository.js";
import { PrismaPipelineRepository } from "./prisma-pipeline.repository.js";
import { asPrisma, createFakePrisma } from "../../test-support/prisma-fakes.js";
import { aBrandRow, aProductRow, aStoreProjectRow } from "../../test-support/prisma-rows.js";

function aProject(): StoreProject {
  const created = StoreProject.create({
    id: "project-1",
    userId: "user-1",
    name: "Projet lunettes",
    niche: "lunettes de soleil",
    targetMarket: "France",
  });
  if (!created.success) throw new Error("fixture invalide");
  return created.data;
}

describe("PrismaStoreProjectRepository", () => {
  it("enregistre un projet par upsert, en réutilisant l'identifiant du domaine", async () => {
    const prisma = createFakePrisma();

    await new PrismaStoreProjectRepository(asPrisma(prisma)).save(aProject());

    expect(prisma.storeProject.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.storeProject.upsert.mock.calls[0]?.[0] as {
      where: { id: string };
      create: { id: string; niche: string };
    };
    expect(call.where.id).toBe("project-1");
    expect(call.create.niche).toBe("lunettes de soleil");
  });

  it("retourne null quand le projet n'existe pas", async () => {
    const prisma = createFakePrisma();

    const found = await new PrismaStoreProjectRepository(asPrisma(prisma)).findById("inconnu");

    expect(found).toBeNull();
  });

  it("reconstruit l'entité depuis la ligne trouvée", async () => {
    const prisma = createFakePrisma();
    prisma.storeProject.findUnique.mockResolvedValue(aStoreProjectRow());

    const found = await new PrismaStoreProjectRepository(asPrisma(prisma)).findById("project-1");

    expect(found).toBeInstanceOf(StoreProject);
    expect(found?.niche).toBe("lunettes de soleil");
  });

  it("liste les projets d'un utilisateur, du plus récemment modifié au plus ancien", async () => {
    const prisma = createFakePrisma();
    prisma.storeProject.findMany.mockResolvedValue([
      aStoreProjectRow({ id: "project-1" }),
      aStoreProjectRow({ id: "project-2" }),
    ]);

    const found = await new PrismaStoreProjectRepository(asPrisma(prisma)).findByUserId("user-1");

    expect(found).toHaveLength(2);
    const call = prisma.storeProject.findMany.mock.calls[0]?.[0] as {
      orderBy: { updatedAt: string };
    };
    expect(call.orderBy.updatedAt).toBe("desc");
  });

  it("convertit une erreur Prisma en InfrastructureError typée", async () => {
    const prisma = createFakePrisma();
    prisma.storeProject.upsert.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("conflit", {
        code: "P2002",
        clientVersion: "6.19.3",
      }),
    );

    await expect(
      new PrismaStoreProjectRepository(asPrisma(prisma)).save(aProject()),
    ).rejects.toBeInstanceOf(InfrastructureError);
  });
});

describe("PrismaBrandRepository", () => {
  it("retrouve une marque par son projet", async () => {
    const prisma = createFakePrisma();
    prisma.brand.findUnique.mockResolvedValue(aBrandRow());

    const brand = await new PrismaBrandRepository(asPrisma(prisma)).findByStoreProjectId(
      "project-1",
    );

    expect(brand?.name).toBe("Solaris");
    const call = prisma.brand.findUnique.mock.calls[0]?.[0] as {
      where: { storeProjectId: string };
    };
    expect(call.where.storeProjectId).toBe("project-1");
  });
});

describe("PrismaProductRepository", () => {
  it("liste les produits d'un projet", async () => {
    const prisma = createFakePrisma();
    prisma.product.findMany.mockResolvedValue([aProductRow(), aProductRow({ id: "product-2" })]);

    const products = await new PrismaProductRepository(asPrisma(prisma)).findByStoreProjectId(
      "project-1",
    );

    expect(products).toHaveLength(2);
    expect(products[0]?.price.amount).toBe(12.5);
  });
});

describe("PrismaPipelineRepository", () => {
  function aRunWithTwoSteps(): PipelineRun {
    const run = PipelineRun.start({ id: "run-1", storeProjectId: "project-1" });

    const market = PipelineStep.schedule({
      id: "step-1",
      pipelineRunId: "run-1",
      agentName: AgentName.MARKET,
      input: { niche: "lunettes" },
    });
    market.markSuccess({ keywords: [] });
    run.addStep(market);

    run.addStep(
      PipelineStep.schedule({
        id: "step-2",
        pipelineRunId: "run-1",
        agentName: AgentName.BRAND,
        input: {},
      }),
    );

    return run;
  }

  it("écrit le run et toutes ses étapes dans une transaction unique", async () => {
    const prisma = createFakePrisma();

    await new PrismaPipelineRepository(asPrisma(prisma)).save(aRunWithTwoSteps());

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.pipelineRun.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.pipelineStep.upsert).toHaveBeenCalledTimes(2);
  });

  it("attribue à chaque étape sa position, pour un ordre de relecture stable", async () => {
    const prisma = createFakePrisma();

    await new PrismaPipelineRepository(asPrisma(prisma)).save(aRunWithTwoSteps());

    const positions = prisma.pipelineStep.upsert.mock.calls.map(
      (call) => (call[0] as { create: { position: number } }).create.position,
    );
    expect(positions).toEqual([0, 1]);
  });

  it("supprime les étapes qui ne font plus partie de l'agrégat", async () => {
    const prisma = createFakePrisma();

    await new PrismaPipelineRepository(asPrisma(prisma)).save(aRunWithTwoSteps());

    const call = prisma.pipelineStep.deleteMany.mock.calls[0]?.[0] as {
      where: { pipelineRunId: string; id: { notIn: string[] } };
    };
    expect(call.where.pipelineRunId).toBe("run-1");
    expect(call.where.id.notIn).toEqual(["step-1", "step-2"]);
  });

  it("recharge un run avec ses étapes et retrouve le point de reprise", async () => {
    const prisma = createFakePrisma();
    prisma.pipelineRun.findUnique.mockResolvedValue({
      id: "run-1",
      storeProjectId: "project-1",
      status: "FAILED",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      finishedAt: null,
      steps: [
        {
          id: "step-2",
          pipelineRunId: "run-1",
          agentName: AgentName.BRAND,
          status: StepStatus.FAILED,
          input: {},
          output: null,
          errorMessage: "AI_PROVIDER_TIMEOUT: délai dépassé",
          startedAt: null,
          finishedAt: null,
          position: 1,
        },
        {
          id: "step-1",
          pipelineRunId: "run-1",
          agentName: AgentName.MARKET,
          status: StepStatus.SUCCESS,
          input: {},
          output: {},
          errorMessage: null,
          startedAt: null,
          finishedAt: null,
          position: 0,
        },
      ],
    });

    const run = await new PrismaPipelineRepository(asPrisma(prisma)).findById("run-1");

    expect(run?.steps).toHaveLength(2);
    expect(run?.nextResumableStep()?.agentName).toBe(AgentName.BRAND);
  });

  it("retourne null quand aucune exécution n'existe pour le projet", async () => {
    const prisma = createFakePrisma();

    const run = await new PrismaPipelineRepository(asPrisma(prisma)).findLatestByStoreProjectId(
      "project-1",
    );

    expect(run).toBeNull();
  });
});
