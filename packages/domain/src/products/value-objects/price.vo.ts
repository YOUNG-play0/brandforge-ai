import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  isFiniteNumber,
  type ActionResult,
} from "@brandforge/shared";

/** Nombre de décimales conservées pour un montant. */
const PRICE_SCALE = 2;

/**
 * Montant d'un produit (DATABASE.md §3, persisté en `Decimal`).
 *
 * Arrondi systématiquement à deux décimales à la construction : la sortie d'un agent
 * génératif peut proposer un prix à la précision arbitraire, or un montant affiché en
 * boutique doit être exact.
 */
export class Price {
  private constructor(readonly amount: number) {}

  static create(amount: number): ActionResult<Price> {
    if (!isFiniteNumber(amount)) {
      return actionFail(
        createAgentError(ERROR_CODES.VALIDATION_ERROR, "Le prix doit être un nombre.", false),
      );
    }
    if (amount < 0) {
      return actionFail(
        createAgentError(ERROR_CODES.VALIDATION_ERROR, "Le prix ne peut pas être négatif.", false),
      );
    }

    return actionOk(new Price(roundToScale(amount)));
  }

  /** Applique une marge multiplicative (ex. `1.8` pour +80 %). */
  withMargin(multiplier: number): ActionResult<Price> {
    return Price.create(this.amount * multiplier);
  }
}

function roundToScale(amount: number): number {
  const factor = 10 ** PRICE_SCALE;
  return Math.round(amount * factor) / factor;
}
