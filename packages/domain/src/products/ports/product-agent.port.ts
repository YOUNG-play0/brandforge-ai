import type { Agent } from "../../orchestration/ports/agent.port.js";
import type { BrandSummary } from "../../branding/value-objects/brand-summary.vo.js";
import type { ProductSource } from "../value-objects/product-status.vo.js";

/** Produit brut, tel que capté par l'extension Chrome ou saisi manuellement. */
export interface RawProductInput {
  readonly sourceUrl?: string;
  readonly title: string;
  readonly description: string;
  readonly images: readonly string[];
  readonly price: number;
}

/** Entrée du Product Agent (AI_AGENTS.md §5). */
export interface ProductAgentInput {
  readonly storeProjectId: string;
  readonly source: ProductSource;
  readonly rawProduct: RawProductInput;
  /** Identité de marque, pour aligner le ton de la réécriture. */
  readonly brand: BrandSummary;
}

/** Sortie du Product Agent (AI_AGENTS.md §5). */
export interface ProductAgentOutput {
  readonly rewrittenTitle: string;
  readonly rewrittenDescription: string;
  readonly normalizedImages: readonly string[];
  /** Prix conseillé, marge incluse. */
  readonly suggestedPrice: number;
}

/** Port du Product Agent (ARCHITECTURE.md §7). */
export type IProductAgent = Agent<ProductAgentInput, ProductAgentOutput>;
