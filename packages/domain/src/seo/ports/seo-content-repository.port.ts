import type { SeoContent } from "../entities/seo-content.entity.js";

/** Port de persistance du contenu SEO (DATABASE.md §3). */
export interface ISeoContentRepository {
  save(content: SeoContent): Promise<void>;
  findByProductId(productId: string): Promise<SeoContent | null>;
}
