import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  type ActionResult,
} from "@brandforge/shared";
import { Product } from "../entities/product.entity.js";
import { Price } from "../value-objects/price.vo.js";
import type { ProductStatus, ProductSource } from "../value-objects/product-status.vo.js";
import type { IProductAgent, RawProductInput } from "../ports/product-agent.port.js";
import type { IProductRepository } from "../ports/product-repository.port.js";
import type { IBrandRepository } from "../../branding/ports/brand-repository.port.js";
import type { IClock, IIdGenerator } from "../../orchestration/ports/system.port.js";

/** Entrée de `importProduct` (API.md §8). */
export interface ImportProductInput {
  readonly storeProjectId: string;
  readonly source: ProductSource;
  readonly rawProduct: RawProductInput;
}

/** Sortie de `importProduct` (API.md §8). */
export interface ImportProductOutput {
  readonly productId: string;
  readonly status: ProductStatus;
}

/**
 * Importe un produit et lui applique la réécriture du Product Agent.
 *
 * Le produit est persisté **avant** l'appel à l'agent : si la réécriture échoue, l'import
 * n'est pas perdu et le produit reste rattrapable en `IMPORTED` (WORKFLOWS.md §5, un
 * échec sur un produit ne bloque pas les autres).
 */
export class ImportProduct {
  constructor(
    private readonly products: IProductRepository,
    private readonly brands: IBrandRepository,
    private readonly productAgent: IProductAgent,
    private readonly idGenerator: IIdGenerator,
    private readonly clock: IClock,
  ) {}

  async execute(input: ImportProductInput): Promise<ActionResult<ImportProductOutput>> {
    const brand = await this.brands.findByStoreProjectId(input.storeProjectId);
    if (brand === null) {
      return actionFail(
        createAgentError(
          ERROR_CODES.BRAND_NOT_FOUND,
          "Aucune marque générée pour ce projet.",
          false,
        ),
      );
    }

    const brandSummary = brand.toSummary();
    if (brandSummary === null) {
      return actionFail(
        createAgentError(
          ERROR_CODES.INVALID_PIPELINE_STATE,
          "Le nom de marque doit être validé avant l'import de produits.",
          false,
        ),
      );
    }

    const price = Price.create(input.rawProduct.price);
    if (!price.success) {
      return price;
    }

    const created = Product.create(
      {
        id: this.idGenerator.generate(),
        storeProjectId: input.storeProjectId,
        sourceUrl: input.rawProduct.sourceUrl ?? null,
        sourcePlatform: input.source,
        originalTitle: input.rawProduct.title,
        originalDescription: input.rawProduct.description,
        images: input.rawProduct.images,
        price: price.data,
      },
      this.clock.now(),
    );

    if (!created.success) {
      return created;
    }

    const product = created.data;
    await this.products.save(product);

    const rewritten = await this.productAgent.execute({
      storeProjectId: input.storeProjectId,
      source: input.source,
      rawProduct: input.rawProduct,
      brand: brandSummary,
    });

    if (!rewritten.success) {
      return actionFail(rewritten.error);
    }

    const suggestedPrice = Price.create(rewritten.output.suggestedPrice);
    if (!suggestedPrice.success) {
      return suggestedPrice;
    }

    product.applyRewrite(
      {
        title: rewritten.output.rewrittenTitle,
        description: rewritten.output.rewrittenDescription,
        images: rewritten.output.normalizedImages,
        price: suggestedPrice.data,
      },
      this.clock.now(),
    );

    await this.products.save(product);

    return actionOk({ productId: product.id, status: product.status });
  }
}
