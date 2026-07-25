import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  type ActionResult,
} from "@brandforge/shared";
import type { AgentName } from "../value-objects/agent-name.vo.js";
import type { PipelineStatus } from "../value-objects/pipeline-status.vo.js";
import type { StepStatus } from "../value-objects/step-status.vo.js";
import type { IPipelineRepository } from "../ports/pipeline-repository.port.js";

/** Entrée de `getPipelineStatus` (API.md §4). */
export interface GetPipelineStatusInput {
  readonly pipelineRunId: string;
}

/**
 * Vue d'une étape pour le dashboard de suivi.
 *
 * Ne contient jamais `input`/`output` bruts : ces données de traçabilité peuvent être
 * volumineuses et ne sont pas destinées au polling du frontend (WORKFLOWS.md §6).
 */
export interface PipelineStepSummary {
  readonly agentName: AgentName;
  readonly status: StepStatus;
  readonly errorMessage: string | null;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
}

/** Sortie de `getPipelineStatus` (API.md §4). */
export interface PipelineStatusView {
  readonly pipelineRunId: string;
  readonly status: PipelineStatus;
  readonly steps: readonly PipelineStepSummary[];
}

/**
 * Restitue l'état d'une exécution pour le suivi du pipeline.
 *
 * Interrogé en polling par le frontend tant que le run est `RUNNING` (WORKFLOWS.md §6) :
 * volontairement en lecture seule et sans effet de bord.
 */
export class GetPipelineStatus {
  constructor(private readonly pipelines: IPipelineRepository) {}

  async execute(input: GetPipelineStatusInput): Promise<ActionResult<PipelineStatusView>> {
    const run = await this.pipelines.findById(input.pipelineRunId);

    if (run === null) {
      return actionFail(
        createAgentError(
          ERROR_CODES.PIPELINE_RUN_NOT_FOUND,
          "Exécution de pipeline introuvable.",
          false,
        ),
      );
    }

    return actionOk({
      pipelineRunId: run.id,
      status: run.status,
      steps: run.steps.map((step) => ({
        agentName: step.agentName,
        status: step.status,
        errorMessage: step.errorMessage,
        startedAt: step.startedAt,
        finishedAt: step.finishedAt,
      })),
    });
  }
}
