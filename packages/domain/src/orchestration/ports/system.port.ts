/**
 * Ports techniques transverses, utilisés par les use cases de tous les Bounded Contexts.
 *
 * Ils sont regroupés dans `orchestration` — le contexte qui pilote l'exécution — plutôt
 * que dupliqués dans chaque contexte. Les injecter (au lieu d'appeler `crypto.randomUUID()`
 * ou `new Date()` directement) rend les use cases déterministes en test, conformément à
 * CODING_STANDARDS.md §7.
 */

/** Génère les identifiants des entités du domaine. */
export interface IIdGenerator {
  generate(): string;
}

/** Fournit l'heure courante. */
export interface IClock {
  now(): Date;
}
