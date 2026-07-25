import type { ErrorCode } from "./error-codes.js";

/**
 * Erreur typée du système (AI_AGENTS.md §1, CODING_STANDARDS.md §5).
 *
 * Aucune exception brute d'une librairie externe ne doit franchir la frontière de
 * l'infrastructure : elle est catchée et convertie en `AgentError` avant de remonter
 * au domaine.
 */
export interface AgentError {
  /** Code stable, consommé par le frontend pour l'affichage. */
  readonly code: ErrorCode;
  /** Message lisible par un humain, expliquant l'action corrective attendue. */
  readonly message: string;
  /**
   * Indique si une nouvelle tentative a du sens (timeout, rate limit...).
   * L'Orchestrator s'en sert pour décider d'un retry automatique (WORKFLOWS.md §4).
   */
  readonly retryable: boolean;
  /**
   * Cause technique d'origine, conservée pour le diagnostic.
   * N'est jamais exposée telle quelle au frontend.
   */
  readonly cause?: unknown;
}

/** Construit une `AgentError`. La `cause` n'est attachée que si elle est fournie. */
export function createAgentError(
  code: ErrorCode,
  message: string,
  retryable: boolean,
  cause?: unknown,
): AgentError {
  return cause === undefined ? { code, message, retryable } : { code, message, retryable, cause };
}
