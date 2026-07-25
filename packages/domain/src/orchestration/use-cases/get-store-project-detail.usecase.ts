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
import type { IStoreProjectRepository } from "../ports/store-project-repository.port.js";

/** Entrée de `getStoreProject` (API.md §3). */
export interface GetStoreProjectDetailInput {
  readonly storeProjectId: string;
  /** Utilisateur demandeur, pour vérifier qu'il est bien propriétaire du projet. */
  readonly userId: string;
}

/** Dernière étape connue du pipeline, telle qu'affichée par le dashboard. */
export interface LastKnownStep {
  readonly agentName: AgentName;
  readonly status: StepStatus;
  readonly errorMessage: string | null;
}

/** Sortie de `getStoreProject` : projet + statut du pipeline + dernière étape (API.md §3). */
export interface StoreProjectDetail {
  readonly storeProjectId: string;
  readonly name: string;
  readonly niche: string;
  readonly targetMarket: string;
  readonly status: PipelineStatus;
  readonly pipelineRunId: string | null;
  readonly lastStep: LastKnownStep | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Restitue le détail d'un projet et l'état de sa dernière exécution de pipeline. */
export class GetStoreProjectDetail {
  constructor(
    private readonly storeProjects: IStoreProjectRepository,
    private readonly pipelines: IPipelineRepository,
  ) {}

  async execute(input: GetStoreProjectDetailInput): Promise<ActionResult<StoreProjectDetail>> {
    const project = await this.storeProjects.findById(input.storeProjectId);

    // Un projet appartenant à un autre utilisateur est traité comme inexistant : cela
    // évite de révéler l'existence d'un identifiant à un tiers.
    if (project === null || !project.belongsTo(input.userId)) {
      return actionFail(
        createAgentError(ERROR_CODES.STORE_PROJECT_NOT_FOUND, "Projet introuvable.", false),
      );
    }

    const run = await this.pipelines.findLatestByStoreProjectId(project.id);
    const lastStep = run?.lastStep() ?? null;

    return actionOk({
      storeProjectId: project.id,
      name: project.name,
      niche: project.niche,
      targetMarket: project.targetMarket,
      status: project.status,
      pipelineRunId: run?.id ?? null,
      lastStep:
        lastStep === null
          ? null
          : {
              agentName: lastStep.agentName,
              status: lastStep.status,
              errorMessage: lastStep.errorMessage,
            },
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  }
}
