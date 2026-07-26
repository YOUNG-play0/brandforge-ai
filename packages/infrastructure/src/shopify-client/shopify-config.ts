import { DEFAULT_SHOPIFY_TIMEOUT_MS } from "@brandforge/shared";
import { optionalNumberEnv, requireEnv } from "../config/env.js";

/**
 * Version de l'API Admin ciblée par défaut.
 *
 * Shopify versionne son API trimestriellement ; figer la version évite qu'une évolution
 * côté Shopify ne casse silencieusement les appels.
 */
const DEFAULT_SHOPIFY_API_VERSION = "2025-01";

/**
 * Configuration du client Shopify.
 *
 * Depuis la suppression des tokens statiques (cf. docs/DECISIONS/0005), l'application ne
 * détient plus qu'un couple `clientId`/`clientSecret` : le token d'accès est obtenu à la
 * demande par le flux « client credentials grant ».
 */
export interface ShopifyConfig {
  /** Domaine `*.myshopify.com` de la boutique. */
  readonly storeDomain: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly apiVersion: string;
  readonly timeoutMs: number;
}

export function loadShopifyConfig(): ShopifyConfig {
  return {
    storeDomain: normalizeStoreDomain(requireEnv("SHOPIFY_STORE_DOMAIN")),
    clientId: requireEnv("SHOPIFY_CLIENT_ID"),
    clientSecret: requireEnv("SHOPIFY_CLIENT_SECRET"),
    apiVersion: process.env["SHOPIFY_API_VERSION"]?.trim() || DEFAULT_SHOPIFY_API_VERSION,
    timeoutMs: optionalNumberEnv("SHOPIFY_TIMEOUT_MS", DEFAULT_SHOPIFY_TIMEOUT_MS),
  };
}

/**
 * Ramène une valeur saisie librement au seul domaine `*.myshopify.com`.
 *
 * Le domaine est fréquemment copié depuis l'administration Shopify sous forme d'URL
 * complète (`https://admin.shopify.com/store/xxx/...`). L'accepter tel quel produirait une
 * URL de jeton invalide et un échec d'authentification difficile à diagnostiquer.
 */
export function normalizeStoreDomain(raw: string): string {
  const trimmed = raw.trim();

  // Forme « admin.shopify.com/store/<handle> » : le handle donne le domaine réel.
  const adminMatch = /admin\.shopify\.com\/store\/([A-Za-z0-9-]+)/.exec(trimmed);
  if (adminMatch?.[1] !== undefined) {
    return `${adminMatch[1]}.myshopify.com`;
  }

  const domainMatch = /([A-Za-z0-9-]+\.myshopify\.com)/.exec(trimmed);
  if (domainMatch?.[1] !== undefined) {
    return domainMatch[1];
  }

  // Handle nu (« ma-boutique ») : on complète le suffixe attendu par Shopify.
  if (/^[A-Za-z0-9-]+$/.test(trimmed)) {
    return `${trimmed}.myshopify.com`;
  }

  throw new Error(
    `SHOPIFY_STORE_DOMAIN invalide : « ${raw} ». Attendu : ma-boutique.myshopify.com`,
  );
}
