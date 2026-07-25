import type { ISeoContentRepository, SeoContent } from "@brandforge/domain";
import type { PrismaDatabase } from "../prisma-client.js";
import { runQuery } from "../prisma-error-mapper.js";
import { toSeoContentDomain, toSeoContentPersistence } from "../mappers/seo-content.mapper.js";

/** Implémentation Prisma de `ISeoContentRepository`. */
export class PrismaSeoContentRepository implements ISeoContentRepository {
  constructor(private readonly prisma: PrismaDatabase) {}

  async save(content: SeoContent): Promise<void> {
    const data = toSeoContentPersistence(content);

    await runQuery("SeoContent.save", () =>
      this.prisma.seoContent.upsert({
        where: { id: content.id },
        create: { id: content.id, ...data },
        update: data,
      }),
    );
  }

  async findByProductId(productId: string): Promise<SeoContent | null> {
    const row = await runQuery("SeoContent.findByProductId", () =>
      this.prisma.seoContent.findUnique({ where: { productId } }),
    );

    return row === null ? null : toSeoContentDomain(row);
  }
}
