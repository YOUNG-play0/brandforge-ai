import type { Agent } from "../../orchestration/ports/agent.port.js";

/** Action demandée au Shopify Agent (AI_AGENTS.md §7). */
export type ShopifyAgentAction = "PUBLISH_STORE" | "PUBLISH_PRODUCT" | "SYNC_PRODUCT";

/**
 * Entrée du Shopify Agent (AI_AGENTS.md §7).
 *
 * Le `payload` est une union discriminée par `action` plutôt qu'un `unknown` : cela
 * respecte l'exigence d'entrée strictement typée (AI_AGENTS.md §1) tout en couvrant les
 * trois actions du contrat documenté.
 */
export type ShopifyAgentInput =
  | { readonly storeProjectId: string; readonly action: "PUBLISH_STORE" }
  | {
      readonly storeProjectId: string;
      readonly action: "PUBLISH_PRODUCT" | "SYNC_PRODUCT";
      readonly productId: string;
    };

/** Sortie du Shopify Agent (AI_AGENTS.md §7). */
export interface ShopifyAgentOutput {
  readonly shopifyResourceId: string;
  readonly status: "PUBLISHED" | "SYNCED";
  readonly url?: string;
}

/** Port du Shopify Agent (ARCHITECTURE.md §7). */
export type IShopifyAgent = Agent<ShopifyAgentInput, ShopifyAgentOutput>;
