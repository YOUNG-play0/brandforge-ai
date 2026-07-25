import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  type ActionResult,
} from "@brandforge/shared";
import type { IBrandRepository } from "../ports/brand-repository.port.js";

/** Entrée de `selectBrandName` (API.md §6). */
export interface SelectBrandNameInput {
  readonly storeProjectId: string;
  readonly selectedName: string;
}

/** Sortie de `selectBrandName` (API.md §6). */
export interface SelectBrandNameOutput {
  readonly brandId: string;
  readonly confirmed: true;
}

/**
 * Point de validation utilisateur : fige le nom de marque définitif (WORKFLOWS.md §3).
 *
 * C'est la seconde et dernière décision bloquante du pipeline — elle engage
 * irréversiblement l'identité du projet, d'où le passage obligatoire par l'utilisateur.
 */
export class SelectBrandName {
  constructor(private readonly brands: IBrandRepository) {}

  async execute(input: SelectBrandNameInput): Promise<ActionResult<SelectBrandNameOutput>> {
    const brand = await this.brands.findByStoreProjectId(input.storeProjectId);

    if (brand === null) {
      return actionFail(
        createAgentError(
          ERROR_CODES.BRAND_NOT_FOUND,
          "Aucune marque générée pour ce projet.",
          false,
        ),
      );
    }

    const selected = brand.selectName(input.selectedName);
    if (!selected.success) {
      return actionFail(selected.error);
    }

    await this.brands.save(brand);

    return actionOk({ brandId: brand.id, confirmed: true });
  }
}
