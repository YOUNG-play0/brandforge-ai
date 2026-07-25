import type { IPipelineRepository, PipelineRun } from "@brandforge/domain";
import type { PrismaDatabase } from "../prisma-client.js";
import { runQuery } from "../prisma-error-mapper.js";
import {
  toPipelineRunDomain,
  toPipelineRunPersistence,
  toPipelineStepPersistence,
} from "../mappers/pipeline.mapper.js";

/**
 * Implémentation Prisma de `IPipelineRepository`.
 *
 * `PipelineRun` est un agrégat : le run et ses étapes sont écrits dans une **transaction
 * unique**. Sans cela, une panne au milieu de la sauvegarde laisserait un run dont les
 * étapes ne reflètent pas l'état réel, et la reprise repartirait d'un point erroné
 * (WORKFLOWS.md §4.3).
 */
export class PrismaPipelineRepository implements IPipelineRepository {
  constructor(private readonly prisma: PrismaDatabase) {}

  async save(run: PipelineRun): Promise<void> {
    const runData = toPipelineRunPersistence(run);
    const steps = run.steps.map((step, index) => toPipelineStepPersistence(step, index));
    const keptStepIds = steps.map((step) => step.id);

    await runQuery("PipelineRun.save", () =>
      this.prisma.$transaction(async (tx) => {
        await tx.pipelineRun.upsert({
          where: { id: run.id },
          create: { id: run.id, ...runData },
          update: { status: runData.status, finishedAt: runData.finishedAt },
        });

        // Une étape retirée de l'agrégat doit disparaître de la base, sinon elle
        // réapparaîtrait à la relecture et fausserait le point de reprise.
        await tx.pipelineStep.deleteMany({
          where: { pipelineRunId: run.id, id: { notIn: keptStepIds } },
        });

        for (const step of steps) {
          const { id, pipelineRunId: _runId, ...stepData } = step;
          await tx.pipelineStep.upsert({
            where: { id },
            create: { id, pipelineRunId: run.id, ...stepData },
            update: stepData,
          });
        }
      }),
    );
  }

  async findById(pipelineRunId: string): Promise<PipelineRun | null> {
    const row = await runQuery("PipelineRun.findById", () =>
      this.prisma.pipelineRun.findUnique({
        where: { id: pipelineRunId },
        include: { steps: true },
      }),
    );

    return row === null ? null : toPipelineRunDomain(row);
  }

  async findLatestByStoreProjectId(storeProjectId: string): Promise<PipelineRun | null> {
    const row = await runQuery("PipelineRun.findLatestByStoreProjectId", () =>
      this.prisma.pipelineRun.findFirst({
        where: { storeProjectId },
        orderBy: { startedAt: "desc" },
        include: { steps: true },
      }),
    );

    return row === null ? null : toPipelineRunDomain(row);
  }
}
