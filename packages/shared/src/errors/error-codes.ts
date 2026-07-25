/**
 * Codes d'erreur stables du système (CODING_STANDARDS.md §5).
 *
 * Un code est un identifiant **stable** consommé par le frontend pour décider de
 * l'affichage : il ne doit jamais être renommé sans migration côté présentation.
 *
 * Source : AI_AGENTS.md (codes par agent) et API.md §12 (codes transverses).
 */
export const ERROR_CODES = {
  // --- Transverses (API.md §12) ---
  UNAUTHORIZED: "UNAUTHORIZED",
  STORE_PROJECT_NOT_FOUND: "STORE_PROJECT_NOT_FOUND",
  INVALID_PIPELINE_STATE: "INVALID_PIPELINE_STATE",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BRAND_NOT_FOUND: "BRAND_NOT_FOUND",
  NICHE_ANALYSIS_NOT_FOUND: "NICHE_ANALYSIS_NOT_FOUND",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  PIPELINE_RUN_NOT_FOUND: "PIPELINE_RUN_NOT_FOUND",

  // --- Persistance (frontière infrastructure, CODING_STANDARDS.md §5) ---
  /** Échec technique non rejouable (requête invalide, erreur inattendue). */
  DATABASE_ERROR: "DATABASE_ERROR",
  /** Base injoignable ou délai dépassé : une nouvelle tentative a du sens. */
  DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
  /** Conflit de données (unicité violée, ressource liée absente). */
  DATABASE_CONFLICT: "DATABASE_CONFLICT",

  // --- Market Agent (AI_AGENTS.md §2) ---
  NICHE_TOO_VAGUE: "NICHE_TOO_VAGUE",

  // --- Fournisseur IA, transverse à tous les agents génératifs ---
  AI_PROVIDER_TIMEOUT: "AI_PROVIDER_TIMEOUT",
  AI_PROVIDER_INVALID_RESPONSE: "AI_PROVIDER_INVALID_RESPONSE",

  // --- Brand Agent (AI_AGENTS.md §3) ---
  BRAND_NAME_CONFLICT: "BRAND_NAME_CONFLICT",

  // --- Store Builder Agent (AI_AGENTS.md §4) ---
  THEME_APPLICATION_FAILED: "THEME_APPLICATION_FAILED",

  // --- Product Agent (AI_AGENTS.md §5) ---
  PRODUCT_SOURCE_UNREACHABLE: "PRODUCT_SOURCE_UNREACHABLE",
  PRODUCT_DATA_INCOMPLETE: "PRODUCT_DATA_INCOMPLETE",

  // --- SEO Agent (AI_AGENTS.md §6) ---
  CONTENT_TOO_SHORT: "CONTENT_TOO_SHORT",

  // --- Shopify Agent (AI_AGENTS.md §4 et §7) ---
  SHOPIFY_AUTH_ERROR: "SHOPIFY_AUTH_ERROR",
  SHOPIFY_RATE_LIMIT: "SHOPIFY_RATE_LIMIT",
  SHOPIFY_VALIDATION_ERROR: "SHOPIFY_VALIDATION_ERROR",
} as const;

/** Union de tous les codes d'erreur connus du système. */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
