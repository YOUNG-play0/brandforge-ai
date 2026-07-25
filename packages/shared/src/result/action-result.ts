import type { AgentError } from "../errors/agent-error.js";

/**
 * Résultat d'un use case du domaine et, par extension, d'une Server Action (API.md §12).
 *
 * Même contrat que `AgentResult` mais avec la clé `data` : un use case ne retourne pas
 * la sortie brute d'un agent, il retourne le résultat métier de l'opération.
 */
export type ActionResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: AgentError };

/** Construit un `ActionResult` de succès. */
export function actionOk<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

/** Construit un `ActionResult` d'échec. */
export function actionFail<T = never>(error: AgentError): ActionResult<T> {
  return { success: false, error };
}
