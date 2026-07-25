import type { Agent } from "../../orchestration/ports/agent.port.js";
import type { Competitor } from "../value-objects/competitor.vo.js";

/** Entrée du Market Agent (AI_AGENTS.md §2). */
export interface MarketAgentInput {
  readonly niche: string;
  readonly targetMarket: string;
  readonly additionalContext?: string;
}

/** Sortie du Market Agent (AI_AGENTS.md §2). */
export interface MarketAgentOutput {
  readonly keywords: readonly string[];
  readonly competitors: readonly Competitor[];
  readonly priceRange: { readonly min: number; readonly max: number };
  /** Score de pertinence brut, de 0 à 1 — converti en `RelevanceScore` par le domaine. */
  readonly relevanceScore: number;
  readonly differentiationAngle: string;
  readonly rawAnalysis: unknown;
}

/**
 * Port du Market Agent (ARCHITECTURE.md §7).
 *
 * L'implémentation vit dans `ai-agents/market-agent` ; le domaine ne connaît que ce
 * contrat, ce qui permet de remplacer l'agent sans toucher au use case (Strategy Pattern).
 */
export type IMarketAgent = Agent<MarketAgentInput, MarketAgentOutput>;
