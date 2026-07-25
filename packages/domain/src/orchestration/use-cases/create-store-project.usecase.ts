import { actionOk, type ActionResult } from "@brandforge/shared";
import { StoreProject } from "../entities/store-project.entity.js";
import type { PipelineStatus } from "../value-objects/pipeline-status.vo.js";
import type { IStoreProjectRepository } from "../ports/store-project-repository.port.js";
import type { IClock, IIdGenerator } from "../ports/system.port.js";

/** Entrée de `createStoreProject` (API.md §3). */
export interface CreateStoreProjectInput {
  readonly userId: string;
  readonly name: string;
  readonly niche: string;
  readonly targetMarket: string;
}

/** Sortie de `createStoreProject` (API.md §3). */
export interface CreateStoreProjectOutput {
  readonly storeProjectId: string;
  readonly status: PipelineStatus;
}

/**
 * Crée un projet à partir de l'intention exprimée par l'utilisateur.
 *
 * Le projet naît en `DRAFT` : aucun agent n'est déclenché ici. Le pipeline ne démarre
 * qu'à l'appel explicite de `StartPipeline` (WORKFLOWS.md §2).
 */
export class CreateStoreProject {
  constructor(
    private readonly storeProjects: IStoreProjectRepository,
    private readonly idGenerator: IIdGenerator,
    private readonly clock: IClock,
  ) {}

  async execute(input: CreateStoreProjectInput): Promise<ActionResult<CreateStoreProjectOutput>> {
    const created = StoreProject.create(
      {
        id: this.idGenerator.generate(),
        userId: input.userId,
        name: input.name,
        niche: input.niche,
        targetMarket: input.targetMarket,
      },
      this.clock.now(),
    );

    if (!created.success) {
      return created;
    }

    const project = created.data;
    await this.storeProjects.save(project);

    return actionOk({ storeProjectId: project.id, status: project.status });
  }
}
