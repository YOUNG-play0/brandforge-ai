/**
 * Cycle de vie d'un produit importé (DATABASE.md §4).
 *
 * Progression strictement croissante : un produit passe de l'import à la réécriture, puis
 * à l'optimisation SEO, puis à la publication.
 */
export enum ProductStatus {
  IMPORTED = "IMPORTED",
  REWRITTEN = "REWRITTEN",
  SEO_OPTIMIZED = "SEO_OPTIMIZED",
  PUBLISHED = "PUBLISHED",
}

/** Plateforme d'origine d'un produit (DATABASE.md §4). */
export enum ProductSource {
  ALIEXPRESS = "ALIEXPRESS",
  MANUAL = "MANUAL",
}
