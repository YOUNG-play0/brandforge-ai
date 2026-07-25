import type { AgentName, PipelineStatus, PipelineStep, StepStatus } from "@brandforge/domain";
import { PipelineRun } from "@brandforge/domain";
import { Prisma } from "@prisma/client";
import type {
  PipelineRun as PrismaPipelineRun,
  PipelineStep as PrismaPipelineStep,
} from "@prisma/client";

/** Ligne d'exécution accompagnée de ses étapes. */
export type PrismaPipelineRunWithSteps = PrismaPipelineRun & {
  steps: PrismaPipelineStep[];
};

/**
 * Conversion `PipelineRun` ↔ lignes Prisma.
 *
 * Les étapes sont triées par `position` : l'ordre est significatif — c'est lui qui
 * détermine la dernière étape connue et le point de reprise (WORKFLOWS.md §4.3).
 */
export function toPipelineRunDomain(row: PrismaPipelineRunWithSteps): PipelineRun {
  const orderedSteps = [...row.steps].sort((a, b) => a.position - b.position);

  return PipelineRun.reconstitute({
    id: row.id,
    storeProjectId: row.storeProjectId,
    status: row.status as PipelineStatus,
    steps: orderedSteps.map((step) => ({
      id: step.id,
      pipelineRunId: step.pipelineRunId,
      agentName: step.agentName as AgentName,
      status: step.status as StepStatus,
      input: step.input,
      output: step.output,
      errorMessage: step.errorMessage,
      startedAt: step.startedAt,
      finishedAt: step.finishedAt,
    })),
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  });
}

/** Champs persistés d'une exécution, hors étapes. */
export function toPipelineRunPersistence(run: PipelineRun): {
  storeProjectId: string;
  status: PipelineStatus;
  startedAt: Date;
  finishedAt: Date | null;
} {
  const snapshot = run.toSnapshot();
  return {
    storeProjectId: snapshot.storeProjectId,
    status: snapshot.status,
    startedAt: snapshot.startedAt,
    finishedAt: snapshot.finishedAt,
  };
}

/**
 * Champs persistés d'une étape.
 *
 * `position` est dérivée de l'index de l'étape dans l'agrégat : elle matérialise en base
 * l'ordre porté par `PipelineRun.steps`, qu'un `SELECT` sans `ORDER BY` ne garantirait pas.
 */
export function toPipelineStepPersistence(
  step: PipelineStep,
  position: number,
): {
  id: string;
  pipelineRunId: string;
  agentName: AgentName;
  status: StepStatus;
  input: Prisma.InputJsonValue;
  output: Prisma.InputJsonValue | typeof Prisma.DbNull;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  position: number;
} {
  const snapshot = step.toSnapshot();
  return {
    id: snapshot.id,
    pipelineRunId: snapshot.pipelineRunId,
    agentName: snapshot.agentName,
    status: snapshot.status,
    input: snapshot.input ?? {},
    // `Prisma.DbNull` écrit un NULL SQL. Un `null` littéral serait persisté comme la
    // valeur JSON `null`, ce qui est une donnée différente de « pas de sortie ».
    output: snapshot.output === null ? Prisma.DbNull : (snapshot.output as Prisma.InputJsonValue),
    errorMessage: snapshot.errorMessage,
    startedAt: snapshot.startedAt,
    finishedAt: snapshot.finishedAt,
    position,
  };
}
