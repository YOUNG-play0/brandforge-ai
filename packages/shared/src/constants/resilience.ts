/**
 * Valeurs par défaut de timeout et de résilience (CODING_STANDARDS.md §6).
 *
 * Ce sont des **valeurs par défaut**, pas des valeurs codées en dur dans les agents :
 * l'infrastructure les surcharge depuis les variables d'environnement
 * (`AI_PROVIDER_TIMEOUT_MS`, `SHOPIFY_TIMEOUT_MS`, `AI_PROVIDER_MAX_RETRIES`).
 */

/** Timeout par défaut de tout appel `IAiProvider` (Groq) : 30 s. */
export const DEFAULT_AI_TIMEOUT_MS = 30_000;

/** Timeout par défaut des appels Shopify : 15 s. */
export const DEFAULT_SHOPIFY_TIMEOUT_MS = 15_000;

/** Nombre de tentatives automatiques sur une erreur `retryable: true`. */
export const DEFAULT_MAX_RETRIES = 3;

/** Délais du backoff exponentiel entre deux tentatives, en millisecondes. */
export const DEFAULT_RETRY_BACKOFF_MS: readonly number[] = [1_000, 3_000, 9_000];
