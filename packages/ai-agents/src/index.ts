/**
 * Point d'entrée public de `@brandforge/ai-agents`.
 *
 * Implémentations concrètes des agents IA. Chaque agent implémente un port défini par
 * `@brandforge/domain` et ne dépend que de ports injectés — jamais d'un autre agent
 * (AI_AGENTS.md §9, règle 3).
 *
 * Les exports sont listés explicitement (CODING_STANDARDS.md §3).
 */

export { MarketAgent } from "./market-agent/market.agent.js";
export {
  MARKET_AGENT_SYSTEM_PROMPT,
  buildMarketAgentPrompt,
} from "./market-agent/market-agent.prompt.js";
export { parseMarketAnalysis, marketAnalysisSchema } from "./market-agent/market-agent.schema.js";

export { BrandAgent } from "./brand-agent/brand.agent.js";
export {
  BRAND_AGENT_SYSTEM_PROMPT,
  buildBrandAgentPrompt,
} from "./brand-agent/brand-agent.prompt.js";
export {
  parseBrandProposal,
  toBrandAgentOutput,
  brandProposalSchema,
  MIN_NAME_OPTIONS,
  MAX_NAME_OPTIONS,
} from "./brand-agent/brand-agent.schema.js";
