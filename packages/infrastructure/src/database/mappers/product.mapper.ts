import type { ProductSource, ProductStatus } from "@brandforge/domain";
import { Price, Product } from "@brandforge/domain";
import {
  ERROR_CODES,
  InfrastructureError,
  createAgentError,
  type ActionResult,
} from "@brandforge/shared";
import type { Product as PrismaProduct } from "@prisma/client";

/** Conversion `Product` ↔ ligne Prisma. */
export function toProductDomain(row: PrismaProduct): Product {
  const price = unwrap(Price.create(row.price.toNumber()), "Product.price");

  return Product.reconstitute({
    id: row.id,
    storeProjectId: row.storeProjectId,
    sourceUrl: row.sourceUrl,
    sourcePlatform: row.sourcePlatform as ProductSource,
    originalTitle: row.originalTitle,
    originalDescription: row.originalDescription,
    images: row.images,
    price,
    rewrittenTitle: row.rewrittenTitle,
    rewrittenDescription: row.rewrittenDescription,
    shopifyProductId: row.shopifyProductId,
    status: row.status as ProductStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/** Champs persistés d'un produit. */
export function toProductPersistence(product: Product): {
  storeProjectId: string;
  sourceUrl: string | null;
  sourcePlatform: ProductSource;
  originalTitle: string;
  originalDescription: string;
  rewrittenTitle: string | null;
  rewrittenDescription: string | null;
  images: string[];
  price: number;
  shopifyProductId: string | null;
  status: ProductStatus;
} {
  const snapshot = product.toSnapshot();
  return {
    storeProjectId: snapshot.storeProjectId,
    sourceUrl: snapshot.sourceUrl,
    sourcePlatform: snapshot.sourcePlatform,
    originalTitle: snapshot.originalTitle,
    originalDescription: snapshot.originalDescription,
    rewrittenTitle: snapshot.rewrittenTitle,
    rewrittenDescription: snapshot.rewrittenDescription,
    images: [...snapshot.images],
    price: snapshot.price.amount,
    shopifyProductId: snapshot.shopifyProductId,
    status: snapshot.status,
  };
}

function unwrap<T>(result: ActionResult<T>, field: string): T {
  if (!result.success) {
    throw new InfrastructureError(
      createAgentError(
        ERROR_CODES.DATABASE_ERROR,
        `Donnée persistée incohérente pour ${field} : ${result.error.message}`,
        false,
      ),
    );
  }
  return result.data;
}
