import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  type ActionResult,
} from "@brandforge/shared";
import type { IShopifyAgent } from "../ports/shopify-agent.port.js";
import type { IProductRepository } from "../../products/ports/product-repository.port.js";
import type { IClock } from "../../orchestration/ports/system.port.js";

/** Entrée de `publishProduct` (API.md §10). */
export interface PublishProductInput {
  readonly productId: string;
}

/** Sortie de `publishProduct` (API.md §10). */
export interface PublishProductOutput {
  readonly shopifyProductId: string;
  readonly status: "PUBLISHED";
}

/**
 * Publie une fiche produit sur la boutique.
 *
 * Refuse un produit encore à l'état brut : publier un titre AliExpress non réécrit
 * produirait du contenu dupliqué, ce que le MVP cherche précisément à éviter
 * (PRD.md §5, user story « fiches réécrites et optimisées SEO »).
 */
export class PublishProduct {
  constructor(
    private readonly products: IProductRepository,
    private readonly shopifyAgent: IShopifyAgent,
    private readonly clock: IClock,
  ) {}

  async execute(input: PublishProductInput): Promise<ActionResult<PublishProductOutput>> {
    const product = await this.products.findById(input.productId);
    if (product === null) {
      return actionFail(
        createAgentError(ERROR_CODES.PRODUCT_NOT_FOUND, "Produit introuvable.", false),
      );
    }

    if (!product.isPublishable()) {
      return actionFail(
        createAgentError(
          ERROR_CODES.INVALID_PIPELINE_STATE,
          `Le produit doit être réécrit avant publication (statut actuel : « ${product.status} »).`,
          false,
        ),
      );
    }

    const executed = await this.shopifyAgent.execute({
      storeProjectId: product.storeProjectId,
      action: "PUBLISH_PRODUCT",
      productId: product.id,
    });

    if (!executed.success) {
      return actionFail(executed.error);
    }

    product.markPublished(executed.output.shopifyResourceId, this.clock.now());
    await this.products.save(product);

    return actionOk({ shopifyProductId: executed.output.shopifyResourceId, status: "PUBLISHED" });
  }
}
