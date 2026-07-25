import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  type ActionResult,
} from "@brandforge/shared";
import type { IShopifyAgent } from "../ports/shopify-agent.port.js";
import type { IProductRepository } from "../../products/ports/product-repository.port.js";

/** Entrée de `syncProduct` (API.md §10). */
export interface SyncProductInput {
  readonly productId: string;
}

/** Sortie de `syncProduct` (API.md §10). */
export interface SyncProductOutput {
  readonly status: "SYNCED";
}

/**
 * Resynchronise une fiche produit déjà publiée (ex. après une réoptimisation SEO).
 *
 * Ne s'applique qu'à un produit publié : synchroniser un produit sans identifiant
 * plateforme n'aurait aucune cible.
 */
export class SyncProduct {
  constructor(
    private readonly products: IProductRepository,
    private readonly shopifyAgent: IShopifyAgent,
  ) {}

  async execute(input: SyncProductInput): Promise<ActionResult<SyncProductOutput>> {
    const product = await this.products.findById(input.productId);
    if (product === null) {
      return actionFail(
        createAgentError(ERROR_CODES.PRODUCT_NOT_FOUND, "Produit introuvable.", false),
      );
    }

    if (!product.isSynchronizable()) {
      return actionFail(
        createAgentError(
          ERROR_CODES.INVALID_PIPELINE_STATE,
          "Le produit doit avoir été publié avant de pouvoir être synchronisé.",
          false,
        ),
      );
    }

    const executed = await this.shopifyAgent.execute({
      storeProjectId: product.storeProjectId,
      action: "SYNC_PRODUCT",
      productId: product.id,
    });

    if (!executed.success) {
      return actionFail(executed.error);
    }

    return actionOk({ status: "SYNCED" });
  }
}
