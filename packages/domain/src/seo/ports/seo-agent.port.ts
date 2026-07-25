import type { Agent } from "../../orchestration/ports/agent.port.js";

/** Entrée du SEO Agent (AI_AGENTS.md §6). */
export interface SeoAgentInput {
  readonly productId: string;
  readonly title: string;
  readonly description: string;
  /** Hérités de la `NicheAnalysis` si non fournis explicitement. */
  readonly targetKeywords?: readonly string[];
}

/** Sortie du SEO Agent (AI_AGENTS.md §6). */
export interface SeoAgentOutput {
  readonly metaTitle: string;
  readonly metaDescription: string;
  readonly optimizedContent: string;
  readonly targetKeywords: readonly string[];
}

/** Port du SEO Agent (ARCHITECTURE.md §7). */
export type ISeoAgent = Agent<SeoAgentInput, SeoAgentOutput>;
