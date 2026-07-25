import { SeoContent } from "@brandforge/domain";
import type { SeoContent as PrismaSeoContent } from "@prisma/client";

/** Conversion `SeoContent` ↔ ligne Prisma. */
export function toSeoContentDomain(row: PrismaSeoContent): SeoContent {
  return SeoContent.reconstitute({
    id: row.id,
    productId: row.productId,
    targetKeywords: row.targetKeywords,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    optimizedContent: row.optimizedContent,
    createdAt: row.createdAt,
  });
}

/** Champs persistés d'un contenu SEO. */
export function toSeoContentPersistence(content: SeoContent): {
  productId: string | null;
  targetKeywords: string[];
  metaTitle: string;
  metaDescription: string;
  optimizedContent: string;
} {
  const snapshot = content.toSnapshot();
  return {
    productId: snapshot.productId,
    targetKeywords: [...snapshot.targetKeywords],
    metaTitle: snapshot.metaTitle,
    metaDescription: snapshot.metaDescription,
    optimizedContent: snapshot.optimizedContent,
  };
}
