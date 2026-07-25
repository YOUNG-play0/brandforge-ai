import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  type ActionResult,
} from "@brandforge/shared";
import { StoreStructure } from "../entities/store-structure.entity.js";
import type { IStoreBuilderAgent } from "../ports/store-builder-agent.port.js";
import type { IBrandRepository } from "../../branding/ports/brand-repository.port.js";
import type { IStoreProjectRepository } from "../../orchestration/ports/store-project-repository.port.js";

/** Entrée de `buildStoreStructure` (API.md §7). */
export interface BuildStoreStructureInput {
  readonly storeProjectId: string;
}

/**
 * Génère la structure de la boutique (thème, collections, pages) à partir de la marque.
 *
 * Exige un nom de marque validé : construire une boutique sur une marque non figée
 * produirait un thème et des pages à renommer intégralement ensuite (WORKFLOWS.md §3).
 */
export class BuildStoreStructure {
  constructor(
    private readonly storeProjects: IStoreProjectRepository,
    private readonly brands: IBrandRepository,
    private readonly storeBuilderAgent: IStoreBuilderAgent,
  ) {}

  async execute(input: BuildStoreStructureInput): Promise<ActionResult<StoreStructure>> {
    const project = await this.storeProjects.findById(input.storeProjectId);
    if (project === null) {
      return actionFail(
        createAgentError(ERROR_CODES.STORE_PROJECT_NOT_FOUND, "Projet introuvable.", false),
      );
    }

    const brand = await this.brands.findByStoreProjectId(project.id);
    if (brand === null) {
      return actionFail(
        createAgentError(
          ERROR_CODES.BRAND_NOT_FOUND,
          "Aucune marque générée pour ce projet.",
          false,
        ),
      );
    }

    const brandSummary = brand.toSummary();
    if (brandSummary === null || !brand.isReadyForStoreBuilding()) {
      return actionFail(
        createAgentError(
          ERROR_CODES.INVALID_PIPELINE_STATE,
          "Le nom de marque doit être validé avant la construction de la boutique.",
          false,
        ),
      );
    }

    const executed = await this.storeBuilderAgent.execute({
      brand: brandSummary,
      niche: project.niche,
      storeProjectId: project.id,
    });

    if (!executed.success) {
      return actionFail(executed.error);
    }

    const structure = StoreStructure.create({
      storeProjectId: project.id,
      themeId: executed.output.shopifyThemeId,
      collections: executed.output.collectionsCreated,
      pages: executed.output.pagesCreated,
    });

    return actionOk(structure);
  }
}
