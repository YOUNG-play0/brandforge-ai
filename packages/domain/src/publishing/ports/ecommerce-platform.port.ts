import type { AgentResult } from "@brandforge/shared";
import type { BrandSummary } from "../../branding/value-objects/brand-summary.vo.js";

/**
 * Port de la plateforme e-commerce (ARCHITECTURE.md §10, Adapter Pattern).
 *
 * Volontairement exempt de vocabulaire Shopify : supporter WooCommerce consistera à
 * fournir une autre implémentation de ce contrat, sans toucher au Store Builder Agent ni
 * au Shopify Agent.
 *
 * L'implémentation gère le timeout (`SHOPIFY_TIMEOUT_MS`) et le rate limit avec backoff,
 * et convertit toute erreur en `AgentError` (`SHOPIFY_AUTH_ERROR`, `SHOPIFY_RATE_LIMIT`,
 * `SHOPIFY_VALIDATION_ERROR`) — cf. CODING_STANDARDS.md §6.
 *
 * Ce port est défini dans `publishing`, contexte propriétaire de l'intégration
 * plateforme ; `store-building` le consomme comme contrat public (ARCHITECTURE.md §6).
 */
export interface IEcommercePlatform {
  /** Applique un thème cohérent avec l'identité de marque et retourne son identifiant. */
  applyTheme(input: ApplyThemeInput): Promise<AgentResult<{ readonly themeId: string }>>;

  createCollection(input: CreateCollectionInput): Promise<AgentResult<CreatedResource>>;

  createPage(input: CreatePageInput): Promise<AgentResult<CreatedResource>>;

  /** Rend la boutique publiquement accessible et retourne son URL. */
  publishStore(storeProjectId: string): Promise<AgentResult<{ readonly storeUrl: string }>>;

  /** Crée une fiche produit sur la plateforme. */
  createProduct(input: PlatformProductInput): Promise<AgentResult<PublishedProduct>>;

  /** Met à jour une fiche produit déjà publiée. */
  updateProduct(
    platformProductId: string,
    input: PlatformProductInput,
  ): Promise<AgentResult<PublishedProduct>>;
}

/** Type de page générée pour la boutique (AI_AGENTS.md §4). */
export type StorePageType = "home" | "about" | "contact" | "legal";

/** Ressource créée sur la plateforme. */
export interface CreatedResource {
  readonly id: string;
  readonly title: string;
}

export interface ApplyThemeInput {
  readonly storeProjectId: string;
  readonly brand: BrandSummary;
}

export interface CreateCollectionInput {
  readonly storeProjectId: string;
  readonly title: string;
  readonly description: string;
}

export interface CreatePageInput {
  readonly storeProjectId: string;
  readonly title: string;
  readonly type: StorePageType;
  readonly content: string;
}

/** Fiche produit telle qu'envoyée à la plateforme. */
export interface PlatformProductInput {
  readonly storeProjectId: string;
  readonly title: string;
  readonly description: string;
  readonly images: readonly string[];
  readonly price: number;
  readonly metaTitle?: string;
  readonly metaDescription?: string;
}

/** Produit publié sur la plateforme. */
export interface PublishedProduct {
  readonly platformProductId: string;
  readonly url?: string;
}
