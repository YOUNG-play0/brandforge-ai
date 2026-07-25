import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  isNumberWithin,
  type ActionResult,
} from "@brandforge/shared";

/** En deçà de ce score, la niche est jugée trop peu porteuse pour engager un projet. */
const VIABILITY_THRESHOLD = 0.5;

/**
 * Score de pertinence d'une niche, normalisé entre 0 et 1 (AI_AGENTS.md §2).
 *
 * Le seuil de viabilité est une règle métier : il vit ici, pas dans l'agent, pour que le
 * Market Agent reste responsable de *produire* le score et le domaine de *l'interpréter*.
 */
export class RelevanceScore {
  private constructor(readonly value: number) {}

  static create(value: number): ActionResult<RelevanceScore> {
    if (!isNumberWithin(value, 0, 1)) {
      return actionFail(
        createAgentError(
          ERROR_CODES.VALIDATION_ERROR,
          "Le score de pertinence doit être compris entre 0 et 1.",
          false,
        ),
      );
    }

    return actionOk(new RelevanceScore(value));
  }

  /** Vrai si la niche est suffisamment porteuse pour justifier la suite du pipeline. */
  isViable(): boolean {
    return this.value >= VIABILITY_THRESHOLD;
  }
}
