import {
  ERROR_CODES,
  agentFail,
  agentOk,
  createAgentError,
  type AgentError,
  type AgentResult,
} from "@brandforge/shared";
import {
  globalHttpFetch,
  safeText,
  type HttpFetch,
  type HttpResponse,
} from "../http/http-fetch.js";
import type { ShopifyConfig } from "./shopify-config.js";
import type { IShopifyTokenProvider } from "./shopify-token-provider.js";

/** Erreur applicative renvoyée dans le corps d'une réponse GraphQL. */
interface GraphQlError {
  readonly message?: unknown;
  readonly extensions?: { readonly code?: unknown };
}

/** Enveloppe de réponse GraphQL. */
interface GraphQlEnvelope<TData> {
  readonly data?: TData;
  readonly errors?: readonly GraphQlError[];
}

/**
 * Erreur métier renvoyée par une mutation Shopify (`userErrors`).
 *
 * Distincte des erreurs GraphQL : la requête est valide, mais les données refusées.
 */
export interface ShopifyUserError {
  readonly field?: readonly string[] | null;
  readonly message: string;
}

/**
 * Client GraphQL de l'API Admin Shopify.
 *
 * Responsabilités strictement techniques : authentifier, appeler, traduire les échecs.
 * Il ne connaît aucune entité métier — c'est l'implémentation d'`IEcommercePlatform` qui
 * traduit les concepts du domaine en requêtes.
 *
 * L'API REST Admin étant progressivement retirée au profit de GraphQL, tous les appels
 * passent par le point d'entrée GraphQL.
 */
export class ShopifyGraphQlClient {
  constructor(
    private readonly config: ShopifyConfig,
    private readonly tokenProvider: IShopifyTokenProvider,
    private readonly fetchFn: HttpFetch = globalHttpFetch,
  ) {}

  /**
   * Exécute une requête ou mutation GraphQL.
   *
   * Sur un `401`, le token en cache est invalidé et l'appel est retenté **une seule fois** :
   * un token peut être révoqué avant son échéance annoncée. Ce cas est traité ici plutôt
   * que remonté à l'Orchestrator, car il se résout sans intervention (ADR 0005).
   */
  async request<TData>(
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<AgentResult<TData>> {
    const first = await this.send<TData>(query, variables);

    if (!first.success && first.error.code === ERROR_CODES.SHOPIFY_AUTH_ERROR && first.retriable) {
      this.tokenProvider.invalidate();
      const second = await this.send<TData>(query, variables);
      return toResult(second);
    }

    return toResult(first);
  }

  private async send<TData>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<SendOutcome<TData>> {
    const token = await this.tokenProvider.getAccessToken();
    if (!token.success) {
      return { success: false, error: token.error, retriable: false };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.config.timeoutMs);

    try {
      const response = await this.fetchFn(
        `https://${this.config.storeDomain}/admin/api/${this.config.apiVersion}/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Shopify-Access-Token": token.output,
          },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        // Un 401 justifie une seconde tentative après renouvellement du token.
        return {
          success: false,
          error: await httpError(response),
          retriable: response.status === 401,
        };
      }

      return parseEnvelope<TData>(await response.text());
    } catch (error) {
      return {
        success: false,
        error: networkError(error, this.config.timeoutMs),
        retriable: false,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Résultat interne, enrichi de l'information « une seconde tentative a du sens ». */
type SendOutcome<TData> =
  { success: true; data: TData } | { success: false; error: AgentError; retriable: boolean };

function toResult<TData>(outcome: SendOutcome<TData>): AgentResult<TData> {
  return outcome.success ? agentOk(outcome.data) : agentFail(outcome.error);
}

/**
 * Convertit les `userErrors` d'une mutation en erreur typée.
 *
 * Shopify répond `200 OK` même lorsqu'une mutation est refusée : sans cette vérification,
 * un échec métier passerait pour un succès et le pipeline continuerait sur une ressource
 * qui n'existe pas.
 */
export function rejectUserErrors(
  userErrors: readonly ShopifyUserError[] | undefined,
  operation: string,
): AgentError | null {
  if (userErrors === undefined || userErrors.length === 0) {
    return null;
  }

  const details = userErrors
    .map((error) => {
      const field = error.field?.join(".") ?? "";
      return field.length > 0 ? `${field} : ${error.message}` : error.message;
    })
    .join(" ; ");

  return createAgentError(
    ERROR_CODES.SHOPIFY_VALIDATION_ERROR,
    `Shopify a refusé l'opération « ${operation} » — ${details}`,
    false,
  );
}

/** Analyse l'enveloppe GraphQL et distingue erreurs applicatives et données. */
function parseEnvelope<TData>(body: string): SendOutcome<TData> {
  let envelope: GraphQlEnvelope<TData>;
  try {
    envelope = JSON.parse(body) as GraphQlEnvelope<TData>;
  } catch (error) {
    return {
      success: false,
      error: createAgentError(
        ERROR_CODES.SHOPIFY_VALIDATION_ERROR,
        "Réponse illisible de l'API Shopify.",
        false,
        error,
      ),
      retriable: false,
    };
  }

  const errors = envelope.errors;
  if (errors !== undefined && errors.length > 0) {
    return { success: false, ...graphQlError(errors) };
  }

  if (envelope.data === undefined) {
    return {
      success: false,
      error: createAgentError(
        ERROR_CODES.SHOPIFY_VALIDATION_ERROR,
        "L'API Shopify n'a retourné aucune donnée.",
        false,
      ),
      retriable: false,
    };
  }

  return { success: true, data: envelope.data };
}

/** Traduit les erreurs GraphQL, en isolant l'étranglement de quota. */
function graphQlError(errors: readonly GraphQlError[]): { error: AgentError; retriable: boolean } {
  const messages = errors
    .map((error) => (typeof error.message === "string" ? error.message : "erreur inconnue"))
    .join(" ; ");

  // `THROTTLED` : le coût de la requête dépasse le crédit disponible. Réessayer après
  // temporisation est exactement la réponse attendue par Shopify.
  const throttled = errors.some((error) => error.extensions?.code === "THROTTLED");
  if (throttled) {
    return {
      error: createAgentError(
        ERROR_CODES.SHOPIFY_RATE_LIMIT,
        `Quota de requêtes Shopify dépassé — ${messages}`,
        true,
      ),
      retriable: false,
    };
  }

  const unauthenticated = errors.some(
    (error) =>
      error.extensions?.code === "UNAUTHENTICATED" ||
      (typeof error.message === "string" && /access token/i.test(error.message)),
  );
  if (unauthenticated) {
    return {
      error: createAgentError(
        ERROR_CODES.SHOPIFY_AUTH_ERROR,
        `Accès Shopify refusé — ${messages}`,
        false,
      ),
      retriable: true,
    };
  }

  return {
    error: createAgentError(
      ERROR_CODES.SHOPIFY_VALIDATION_ERROR,
      `Requête Shopify invalide — ${messages}`,
      false,
    ),
    retriable: false,
  };
}

/** Traduit un statut HTTP en erreur typée. */
async function httpError(response: HttpResponse): Promise<AgentError> {
  const detail = await safeText(response);

  if (response.status === 401 || response.status === 403) {
    return createAgentError(
      ERROR_CODES.SHOPIFY_AUTH_ERROR,
      "Accès Shopify refusé. Vérifiez les portées (scopes) accordées à l'application.",
      false,
      detail,
    );
  }

  if (response.status === 429) {
    return createAgentError(
      ERROR_CODES.SHOPIFY_RATE_LIMIT,
      "Quota de requêtes Shopify dépassé.",
      true,
      detail,
    );
  }

  if (response.status >= 500) {
    return createAgentError(
      ERROR_CODES.SHOPIFY_UNAVAILABLE,
      `Shopify est indisponible (HTTP ${String(response.status)}).`,
      true,
      detail,
    );
  }

  return createAgentError(
    ERROR_CODES.SHOPIFY_VALIDATION_ERROR,
    `Requête Shopify refusée (HTTP ${String(response.status)}).`,
    false,
    detail,
  );
}

function networkError(error: unknown, timeoutMs: number): AgentError {
  if (error instanceof Error && error.name === "AbortError") {
    return createAgentError(
      ERROR_CODES.SHOPIFY_UNAVAILABLE,
      `Shopify n'a pas répondu en moins de ${String(timeoutMs)} ms.`,
      true,
      error,
    );
  }

  return createAgentError(ERROR_CODES.SHOPIFY_UNAVAILABLE, "Shopify est injoignable.", true, error);
}
