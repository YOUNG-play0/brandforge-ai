import { actionOk, type ActionResult } from "@brandforge/shared";
import type { PipelineStatus } from "../value-objects/pipeline-status.vo.js";
import type { IStoreProjectRepository } from "../ports/store-project-repository.port.js";

/** Entrée de `listStoreProjects` (API.md §3). */
export interface ListStoreProjectsInput {
  readonly userId: string;
}

/** Vue allégée d'un projet pour l'affichage en liste. */
export interface StoreProjectSummary {
  readonly storeProjectId: string;
  readonly name: string;
  readonly niche: string;
  readonly targetMarket: string;
  readonly status: PipelineStatus;
  readonly updatedAt: Date;
}

/** Liste les projets d'un utilisateur (le multi-projets est déjà supporté, cf. DATABASE.md §5). */
export class ListStoreProjects {
  constructor(private readonly storeProjects: IStoreProjectRepository) {}

  async execute(
    input: ListStoreProjectsInput,
  ): Promise<ActionResult<readonly StoreProjectSummary[]>> {
    const projects = await this.storeProjects.findByUserId(input.userId);

    return actionOk(
      projects.map((project) => ({
        storeProjectId: project.id,
        name: project.name,
        niche: project.niche,
        targetMarket: project.targetMarket,
        status: project.status,
        updatedAt: project.updatedAt,
      })),
    );
  }
}
