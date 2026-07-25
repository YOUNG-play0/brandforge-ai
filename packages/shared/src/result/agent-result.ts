import type { AgentError } from "../errors/agent-error.js";

/**
 * Résultat d'exécution d'un agent IA (AI_AGENTS.md §1).
 *
 * Un agent ne lève jamais d'exception vers l'appelant : il retourne toujours un
 * `AgentResult`. C'est ce qui permet à l'Orchestrator de décider d'un retry ou d'un
 * arrêt sans avoir à interpréter un `throw` non typé.
 */
export type AgentResult<T> =
  | { readonly success: true; readonly output: T }
  | { readonly success: false; readonly error: AgentError };

/** Construit un `AgentResult` de succès. */
export function agentOk<T>(output: T): AgentResult<T> {
  return { success: true, output };
}

/** Construit un `AgentResult` d'échec. */
export function agentFail<T = never>(error: AgentError): AgentResult<T> {
  return { success: false, error };
}
