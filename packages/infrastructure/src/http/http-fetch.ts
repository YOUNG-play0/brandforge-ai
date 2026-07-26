/**
 * Contrat HTTP minimal partagé par les clients d'API externes.
 *
 * Volontairement réduit à ce que les clients utilisent réellement. L'injecter (plutôt que
 * d'appeler `fetch` globalement) rend chaque client testable sans réseau ni serveur simulé
 * (CODING_STANDARDS.md §7).
 */
export type HttpFetch = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<HttpResponse>;

/** Réponse HTTP, réduite aux membres exploités par les clients. */
export interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  text: () => Promise<string>;
}

/** Implémentation par défaut, adossée au `fetch` global de Node. */
export const globalHttpFetch: HttpFetch = globalThis.fetch;

/** Lit le corps d'une réponse sans jamais masquer l'erreur en cours de traitement. */
export async function safeText(response: HttpResponse): Promise<string | undefined> {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}
