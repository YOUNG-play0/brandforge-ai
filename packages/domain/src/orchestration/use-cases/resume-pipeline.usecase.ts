import { ERROR_CODES, actionFail, createAgentError, type ActionResult } from "@brandforge/shared";
import { PipelineStatus } from "../value-objects/pipeline-status.vo.js";
import type {
  IPipelineOrchestrator,
  PipelineExecutionState,
} from "../ports/pipeline-orchestrator.port.js";
import type { IPipelineRepository } from "../ports/pipeline-repository.port.js";
import type { IStoreProjectRepository } from "../ports/store-project-repository.port.js";

/** Entrée de `resumePipeline` (API.md §4). */
export interface ResumePipelineInput {
  readonly pipelineRunId: string;
  readonly userId: string;
}

/**
 * Reprend un pipeline `FAILED` ou `PAUSED` à partir de la dernière étape non aboutie.
 *
 * Ne réexécute jamais le pipeline depuis le début : les étapes déjà abouties sont
 * conservées telles quelles (WORKFLOWS.md §4.3).
 */
export class ResumePipeline {
  constructor(
    private readonly pipelines: IPipelineRepository,
    private readonly storeProjects: IStoreProjectRepository,
    private readonly orchestrator: IPipelineOrchestrator,
  ) {}

  async execute(input: ResumePipelineInput): Promise<ActionResult<PipelineExecutionState>> {
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

    const project = await this.storeProjects.findById(run.storeProjectId);
    if (project === null || !project.belongsTo(input.userId)) {
      return actionFail(
        createAgentError(ERROR_CODES.STORE_PROJECT_NOT_FOUND, "Projet introuvable.", false),
      );
    }

    if (run.status !== PipelineStatus.FAILED && run.status !== PipelineStatus.PAUSED) {
      return actionFail(
        createAgentError(
          ERROR_CODES.INVALID_PIPELINE_STATE,
          `Seule une exécution interrompue peut être reprise (statut actuel : « ${run.status} »).`,
          false,
        ),
      );
    }

    if (run.nextResumableStep() === null) {
      return actionFail(
        createAgentError(
          ERROR_CODES.INVALID_PIPELINE_STATE,
          "Aucune étape à reprendre : toutes les étapes sont abouties.",
          false,
        ),
      );
    }

    return this.orchestrator.resume(run.id);
  }
}
