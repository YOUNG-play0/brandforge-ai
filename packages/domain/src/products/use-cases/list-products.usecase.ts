import { actionOk, type ActionResult } from "@brandforge/shared";
import type { ProductStatus } from "../value-objects/product-status.vo.js";
import type { IProductRepository } from "../ports/product-repository.port.js";

/** Entrée de `listProducts` (API.md §8). */
export interface ListProductsInput {
  readonly storeProjectId: string;
}

/** Vue allégée d'un produit pour l'affichage en liste. */
export interface ProductSummary {
  readonly productId: string;
  /** Titre réécrit s'il existe, sinon titre d'origine. */
  readonly title: string;
  readonly price: number;
  readonly status: ProductStatus;
  readonly imageUrl: string | null;
  readonly shopifyProductId: string | null;
}

/** Liste les produits d'un projet. */
export class ListProducts {
  constructor(private readonly products: IProductRepository) {}

  async execute(input: ListProductsInput): Promise<ActionResult<readonly ProductSummary[]>> {
    const products = await this.products.findByStoreProjectId(input.storeProjectId);

    return actionOk(
      products.map((product) => ({
        productId: product.id,
        title: product.effectiveTitle(),
        price: product.price.amount,
        status: product.status,
        imageUrl: product.images[0] ?? null,
        shopifyProductId: product.shopifyProductId,
      })),
    );
  }
}
