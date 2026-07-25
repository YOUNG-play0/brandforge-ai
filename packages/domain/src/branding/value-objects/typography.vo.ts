import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  isNonEmptyString,
  type ActionResult,
} from "@brandforge/shared";

/**
 * Couple de polices retenu pour la marque (AI_AGENTS.md §3).
 *
 * Persisté en `Json` dans `Brand.typography` (DATABASE.md §3).
 */
export class Typography {
  private constructor(
    readonly heading: string,
    readonly body: string,
  ) {}

  static create(heading: string, body: string): ActionResult<Typography> {
    if (!isNonEmptyString(heading) || !isNonEmptyString(body)) {
      return actionFail(
        createAgentError(
          ERROR_CODES.VALIDATION_ERROR,
          "La typographie doit définir une police de titre et une police de corps de texte.",
          false,
        ),
      );
    }

    return actionOk(new Typography(heading.trim(), body.trim()));
  }
}
