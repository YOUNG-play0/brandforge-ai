import type { Competitor } from "./competitor.vo.js";

/**
 * Sous-ensemble validé d'une analyse de niche, transmis au Brand Agent (AI_AGENTS.md §3).
 *
 * Exclut volontairement `rawAnalysis` : la sortie brute du modèle sert à la traçabilité,
 * pas à alimenter l'agent suivant.
 */
export interface NicheAnalysisSummary {
  readonly niche: string;
  readonly targetMarket: string;
  readonly keywords: readonly string[];
  readonly competitors: readonly Competitor[];
  readonly priceRange: { readonly min: number; readonly max: number };
  readonly differentiationAngle: string;
}
