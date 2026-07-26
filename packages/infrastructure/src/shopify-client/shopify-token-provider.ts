import {
  ERROR_CODES,
  agentFail,
  agentOk,
  createAgentError,
  type AgentError,
  type AgentResult,
} from "@brandforge/shared";
import type { IClock } from "@brandforge/domain";
import {
  globalHttpFetch,
  safeText,
  type HttpFetch,
  type HttpResponse,
} from "../http/http-fetch.js";
import type { ShopifyConfig } from "./shopify-config.js";

/**
 * Marge de sécurité avant expiration.
 *
 * Un token renouvelé uniquement à l'expiration exacte peut être refusé : l'appel qui
 * l'utilise part avec un jeton valide et arrive chez Shopify après échéance. On renouvelle
 * donc 60 s en avance.
 */
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

/**
 * Durée de repli si Shopify omet `expires_in`.
 *
 * Volontairement courte : mieux vaut redemander un token trop souvent que d'en conserver
 * un expiré et faire échouer une étape du pipeline.
 */
const FALLBACK_TOKEN_LIFETIME_MS = 5 * 60_000;

/** Réponse du point d'échange de jeton Shopify. */
interface TokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
}

/**
 * Port de fourniture du token d'accès Shopify.
 *
 * Isolé du client d'API : le client consomme un token, il n'a pas à savoir comment il est
 * obtenu ni renouvelé.
 */
export interface IShopifyTokenProvider {
  /** Retourne un token valide, en le renouvelant si nécessaire. */
  getAccessToken(): Promise<AgentResult<string>>;
  /** Invalide le token en cache, après un 401 par exemple. */
  invalidate(): void;
}

/**
 * Obtient un token d'accès Shopify par le flux OAuth « client credentials grant ».
 *
 * Depuis la suppression des tokens statiques (cf. docs/DECISIONS/0005), une application du
 * Dev Dashboard n'expose plus qu'un `client_id` et un `client_secret` : le token est
 * échangé programmatiquement et **expire** (~24 h). Ce fournisseur encapsule cet échange,
 * la mise en cache et le renouvellement.
 *
 * Le token n'est jamais journalisé ni exposé dans un message d'erreur.
 */
export class ShopifyTokenProvider implements IShopifyTokenProvider {
  private cached: { token: string; expiresAtMs: number } | null = null;

  /**
   * Requête d'échange en cours.
   *
   * Le pipeline enchaîne plusieurs appels Shopify rapprochés : sans cette déduplication,
   * chacun déclencherait son propre échange au premier appel, consommant inutilement le
   * quota d'authentification.
   */
  private inFlight: Promise<AgentResult<string>> | null = null;

  constructor(
    private readonly config: ShopifyConfig,
    private readonly clock: IClock,
    private readonly fetchFn: HttpFetch = globalHttpFetch,
  ) {}

  async getAccessToken(): Promise<AgentResult<string>> {
    const cached = this.cached;
    if (cached !== null && this.clock.now().getTime() < cached.expiresAtMs) {
      return agentOk(cached.token);
    }

    this.inFlight ??= this.requestToken().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  invalidate(): void {
    this.cached = null;
  }

  private async requestToken(): Promise<AgentResult<string>> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.config.timeoutMs);

    try {
      const response = await this.fetchFn(
        `https://${this.config.storeDomain}/admin/oauth/access_token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
          }).toString(),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        return agentFail(await tokenHttpError(response));
      }

      return this.storeToken(await response.text());
    } catch (error) {
      return agentFail(networkError(error, this.config.timeoutMs));
    } finally {
      clearTimeout(timer);
    }
  }

  private storeToken(body: string): AgentResult<string> {
    let parsed: TokenResponse;
    try {
      parsed = JSON.parse(body) as TokenResponse;
    } catch (error) {
      return agentFail(
        createAgentError(
          ERROR_CODES.SHOPIFY_AUTH_ERROR,
          "Réponse illisible du point d'échange de jeton Shopify.",
          false,
          error,
        ),
      );
    }

    const token = parsed.access_token;
    if (typeof token !== "string" || token.trim().length === 0) {
      return agentFail(
        createAgentError(
          ERROR_CODES.SHOPIFY_AUTH_ERROR,
          "Shopify n'a retourné aucun token d'accès exploitable.",
          false,
        ),
      );
    }

    const lifetimeMs =
      typeof parsed.expires_in === "number" && Number.isFinite(parsed.expires_in)
        ? parsed.expires_in * 1_000
        : FALLBACK_TOKEN_LIFETIME_MS;

    // La marge est retranchée de la durée de vie, sans jamais produire d'échéance passée.
    const usableMs = Math.max(lifetimeMs - EXPIRY_SAFETY_MARGIN_MS, 0);
    this.cached = { token, expiresAtMs: this.clock.now().getTime() + usableMs };

    return agentOk(token);
  }
}

/** Traduit un échec HTTP de l'échange de jeton en erreur typée. */
async function tokenHttpError(response: HttpResponse): Promise<AgentError> {
  const detail = await safeText(response);

  // Identifiants refusés : réessayer ne changera rien tant que l'application n'est pas
  // reconfigurée ou réinstallée sur la boutique.
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    return createAgentError(
      ERROR_CODES.SHOPIFY_AUTH_ERROR,
      "Identifiants Shopify refusés. Vérifiez SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET, " +
        "et que l'application est bien installée sur la boutique.",
      false,
      detail,
    );
  }

  if (response.status === 404) {
    return createAgentError(
      ERROR_CODES.SHOPIFY_AUTH_ERROR,
      "Boutique Shopify introuvable. Vérifiez SHOPIFY_STORE_DOMAIN.",
      false,
      detail,
    );
  }

  if (response.status === 429) {
    return createAgentError(
      ERROR_CODES.SHOPIFY_RATE_LIMIT,
      "Quota Shopify dépassé lors de l'obtention du token.",
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
    ERROR_CODES.SHOPIFY_AUTH_ERROR,
    `Échec de l'obtention du token Shopify (HTTP ${String(response.status)}).`,
    false,
    detail,
  );
}

/** Distingue un dépassement de délai d'une panne réseau. */
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
