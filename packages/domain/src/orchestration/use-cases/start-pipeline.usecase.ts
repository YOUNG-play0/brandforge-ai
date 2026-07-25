import { ERROR_CODES, actionFail, createAgentError, type ActionResult } from "@brandforge/shared";
import type {
  IPipelineOrchestrator,
  PipelineExecutionState,
} from "../ports/pipeline-orchestrator.port.js";
import type { IStoreProjectRepository } from "../ports/store-project-repository.port.js";

/** Entrée de `startPipeline` (API.md §4). */
export interface StartPipelineInput {
  readonly storeProjectId: string;
  readonly userId: string;
}

/**
 * Déclenche le pipeline jusqu'au prochain point de validation utilisateur.
 *
 * Ce use case ne séquence rien : il vérifie que la transition est légale puis délègue à
 * l'Orchestrator, seul module autorisé à enchaîner les agents (WORKFLOWS.md §1).
 */
export class StartPipeline {
  constructor(
    private readonly storeProjects: IStoreProjectRepository,
    private readonly orchestrator: IPipelineOrchestrator,
  ) {}

  async execute(input: StartPipelineInput): Promise<ActionResult<PipelineExecutionState>> {
    const project = await this.storeProjects.findById(input.storeProjectId);

    if (project === null || !project.belongsTo(input.userId)) {
      return actionFail(
        createAgentError(ERROR_CODES.STORE_PROJECT_NOT_FOUND, "Projet introuvable.", false),
      );
    }

    // Un projet déjà `RUNNING` ne doit pas être relancé en parallèle, et un projet
    // `COMPLETED` est terminé : dans les deux cas la reprise passe par `resumePipeline`.
    if (!project.canStartPipeline()) {
      return actionFail(
        createAgentError(
          ERROR_CODES.INVALID_PIPELINE_STATE,
          `Le pipeline ne peut pas démarrer depuis le statut « ${project.status} ».`,
          false,
        ),
      );
    }

    return this.orchestrator.start(project.id);
  }
}
