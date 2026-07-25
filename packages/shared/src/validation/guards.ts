/**
 * Primitives de validation pures et sans vocabulaire métier.
 *
 * Ce sont des prédicats techniques réutilisables (une chaîne est-elle vide ? un code
 * couleur est-il bien formé ?), pas des règles métier : la décision de ce qui est
 * valide *pour une entité donnée* appartient au domaine (ARCHITECTURE.md §2).
 */

/** Vrai si la valeur est une chaîne contenant au moins un caractère non blanc. */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Vrai si la valeur est un nombre fini (ni `NaN`, ni `Infinity`). */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Vrai si la valeur est un nombre fini compris dans l'intervalle fermé `[min, max]`. */
export function isNumberWithin(value: unknown, min: number, max: number): value is number {
  return isFiniteNumber(value) && value >= min && value <= max;
}

/** Vrai si la valeur est une couleur hexadécimale de la forme `#RGB` ou `#RRGGBB`. */
export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

/**
 * Vrai si la valeur est une URL absolue en `http`/`https`.
 *
 * Validation par expression régulière plutôt que via le global `URL` : `@brandforge/shared`
 * est consommé aussi bien côté Node que côté navigateur et ne doit donc dépendre d'aucun
 * type d'environnement (`lib: ES2022` seule).
 */
export function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(value);
}
