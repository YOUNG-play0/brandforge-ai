import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  type ActionResult,
} from "@brandforge/shared";
import type { INicheAnalysisRepository } from "../ports/niche-analysis-repository.port.js";

/** Entrée de `validateNicheAnalysis` (API.md §5). */
export interface ValidateNicheAnalysisInput {
  readonly storeProjectId: string;
  readonly approved: boolean;
}

/** Sortie de `validateNicheAnalysis` (API.md §5). */
export interface ValidateNicheAnalysisOutput {
  readonly confirmed: boolean;
}

/**
 * Point de validation utilisateur obligatoire avant l'étape Branding (WORKFLOWS.md §3).
 *
 * Un refus (`approved: false`) ne marque pas l'analyse comme validée : le pipeline
 * repassera par une nouvelle analyse de niche plutôt que de continuer.
 */
export class ValidateNicheAnalysis {
  constructor(private readonly nicheAnalyses: INicheAnalysisRepository) {}

  async execute(
    input: ValidateNicheAnalysisInput,
  ): Promise<ActionResult<ValidateNicheAnalysisOutput>> {
    const analysis = await this.nicheAnalyses.findByStoreProjectId(input.storeProjectId);

    if (analysis === null) {
      return actionFail(
        createAgentError(
          ERROR_CODES.NICHE_ANALYSIS_NOT_FOUND,
          "Aucune analyse de niche à valider pour ce projet.",
          false,
        ),
      );
    }

    if (!input.approved) {
      return actionOk({ confirmed: false });
    }

    analysis.approve();
    await this.nicheAnalyses.save(analysis);

    return actionOk({ confirmed: true });
  }
}
