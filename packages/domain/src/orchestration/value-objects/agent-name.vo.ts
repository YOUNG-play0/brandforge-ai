/**
 * Identifiant métier de chaque agent du système (DATABASE.md §4).
 *
 * Les agents V2 (`IMAGE`, `BLOG`, `MARKETING`) figurent dans l'enum pour éviter une
 * migration lourde le jour de leur ajout, mais leur implémentation reste interdite
 * tant que le MVP n'est pas validé (CODING_STANDARDS.md §10).
 */
export enum AgentName {
  MARKET = "MARKET",
  BRAND = "BRAND",
  STORE_BUILDER = "STORE_BUILDER",
  PRODUCT = "PRODUCT",
  SEO = "SEO",
  IMAGE = "IMAGE",
  SHOPIFY = "SHOPIFY",
  BLOG = "BLOG",
  MARKETING = "MARKETING",
}

/** Séquence nominale des agents du pipeline MVP (ARCHITECTURE.md §8). */
export const MVP_PIPELINE_SEQUENCE: readonly AgentName[] = [
  AgentName.MARKET,
  AgentName.BRAND,
  AgentName.STORE_BUILDER,
  AgentName.PRODUCT,
  AgentName.SEO,
  AgentName.SHOPIFY,
];
