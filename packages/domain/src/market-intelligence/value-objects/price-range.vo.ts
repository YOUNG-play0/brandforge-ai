import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  isFiniteNumber,
  type ActionResult,
} from "@brandforge/shared";

/**
 * Fourchette de prix constatée sur une niche (ARCHITECTURE.md §5).
 *
 * Immuable et toujours cohérente : une fourchette dont la borne basse dépasse la borne
 * haute ne peut pas exister, ce qui évite de propager une analyse IA incohérente jusqu'à
 * la base (AI_AGENTS.md §9, règle 4).
 */
export class PriceRange {
  private constructor(
    readonly min: number,
    readonly max: number,
  ) {}

  static create(min: number, max: number): ActionResult<PriceRange> {
    if (!isFiniteNumber(min) || !isFiniteNumber(max)) {
      return actionFail(
        createAgentError(
          ERROR_CODES.VALIDATION_ERROR,
          "Les bornes de la fourchette de prix doivent être des nombres.",
          false,
        ),
      );
    }
    if (min < 0 || max < 0) {
      return actionFail(
        createAgentError(
          ERROR_CODES.VALIDATION_ERROR,
          "Une fourchette de prix ne peut pas être négative.",
          false,
        ),
      );
    }
    if (min > max) {
      return actionFail(
        createAgentError(
          ERROR_CODES.VALIDATION_ERROR,
          "La borne basse de la fourchette de prix ne peut pas dépasser la borne haute.",
          false,
        ),
      );
    }

    return actionOk(new PriceRange(min, max));
  }

  /** Prix moyen de la fourchette, utilisé comme repère de positionnement tarifaire. */
  midpoint(): number {
    return (this.min + this.max) / 2;
  }

  contains(price: number): boolean {
    return price >= this.min && price <= this.max;
  }
}
