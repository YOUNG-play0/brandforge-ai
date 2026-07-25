import type { Agent } from "../../orchestration/ports/agent.port.js";
import type { BrandSummary } from "../../branding/value-objects/brand-summary.vo.js";
import type { StorePageType } from "../../publishing/ports/ecommerce-platform.port.js";

/** Entrée du Store Builder Agent (AI_AGENTS.md §4). */
export interface StoreBuilderAgentInput {
  readonly brand: BrandSummary;
  readonly niche: string;
  readonly storeProjectId: string;
}

/**
 * Sortie du Store Builder Agent (AI_AGENTS.md §4).
 *
 * `shopifyThemeId` conserve le nom du contrat documenté ; l'accès à la plateforme passe
 * néanmoins par le port neutre `IEcommercePlatform`.
 */
export interface StoreBuilderAgentOutput {
  readonly shopifyThemeId: string;
  readonly collectionsCreated: readonly { readonly id: string; readonly title: string }[];
  readonly pagesCreated: readonly {
    readonly id: string;
    readonly title: string;
    readonly type: StorePageType;
  }[];
}

/** Port du Store Builder Agent (ARCHITECTURE.md §7). */
export type IStoreBuilderAgent = Agent<StoreBuilderAgentInput, StoreBuilderAgentOutput>;
