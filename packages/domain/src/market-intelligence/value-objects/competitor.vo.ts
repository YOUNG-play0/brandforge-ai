/**
 * Concurrent identifié sur la niche (AI_AGENTS.md §2).
 *
 * Persisté en `Json` dans `NicheAnalysis.competitors` (DATABASE.md §3) : c'est une
 * donnée descriptive, sans identité propre ni cycle de vie — donc un value object.
 */
export interface Competitor {
  readonly name: string;
  readonly url: string;
  readonly positioning: string;
  readonly estimatedPriceRange: { readonly min: number; readonly max: number };
}
