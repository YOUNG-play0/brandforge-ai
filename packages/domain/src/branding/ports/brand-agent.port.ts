import type { Agent } from "../../orchestration/ports/agent.port.js";
import type { NicheAnalysisSummary } from "../../market-intelligence/value-objects/niche-analysis-summary.vo.js";
import type { ColorRole } from "../value-objects/color-palette.vo.js";

/** Préférences facultatives exprimées par l'utilisateur (AI_AGENTS.md §3). */
export interface BrandUserPreferences {
  readonly desiredTone?: string;
  readonly namesToAvoid?: readonly string[];
}

/** Entrée du Brand Agent (AI_AGENTS.md §3). */
export interface BrandAgentInput {
  readonly nicheAnalysis: NicheAnalysisSummary;
  readonly userPreferences?: BrandUserPreferences;
}

/**
 * Sortie du Brand Agent (AI_AGENTS.md §3).
 *
 * `selectedName` n'est pas produit par l'agent : le choix du nom appartient à
 * l'utilisateur et est porté par `Brand.selectName`.
 */
export interface BrandAgentOutput {
  readonly nameOptions: readonly string[];
  readonly positioning: string;
  readonly tone: string;
  readonly colorPalette: readonly { readonly hex: string; readonly role: ColorRole }[];
  readonly typography: { readonly heading: string; readonly body: string };
  readonly logoBriefing: string;
}

/** Port du Brand Agent (ARCHITECTURE.md §7). */
export type IBrandAgent = Agent<BrandAgentInput, BrandAgentOutput>;
