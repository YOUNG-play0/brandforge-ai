/**
 * Point d'entrée public de `@brandforge/shared`.
 *
 * Types, erreurs et constantes transverses uniquement — aucune logique métier et
 * aucune dépendance vers `@brandforge/domain` (ARCHITECTURE.md §2).
 * Les exports sont listés explicitement (CODING_STANDARDS.md §3).
 */

export { ERROR_CODES } from "./errors/error-codes.js";
export type { ErrorCode } from "./errors/error-codes.js";

export { createAgentError } from "./errors/agent-error.js";
export type { AgentError } from "./errors/agent-error.js";

export { InfrastructureError, isInfrastructureError } from "./errors/infrastructure-error.js";

export { agentOk, agentFail } from "./result/agent-result.js";
export type { AgentResult } from "./result/agent-result.js";

export { actionOk, actionFail } from "./result/action-result.js";
export type { ActionResult } from "./result/action-result.js";

export {
  isNonEmptyString,
  isFiniteNumber,
  isNumberWithin,
  isHexColor,
  isHttpUrl,
} from "./validation/guards.js";

export {
  DEFAULT_AI_TIMEOUT_MS,
  DEFAULT_SHOPIFY_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_BACKOFF_MS,
} from "./constants/resilience.js";
