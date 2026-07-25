import type { Brand, BrandAsset, IBrandRepository } from "@brandforge/domain";
import type { PrismaDatabase } from "../prisma-client.js";
import { runQuery } from "../prisma-error-mapper.js";
import { toBrandAssetDomain, toBrandDomain, toBrandPersistence } from "../mappers/brand.mapper.js";

/** Implémentation Prisma de `IBrandRepository` (marque + assets). */
export class PrismaBrandRepository implements IBrandRepository {
  constructor(private readonly prisma: PrismaDatabase) {}

  async save(brand: Brand): Promise<void> {
    const data = toBrandPersistence(brand);

    await runQuery("Brand.save", () =>
      this.prisma.brand.upsert({
        where: { id: brand.id },
        create: { id: brand.id, storeProjectId: brand.storeProjectId, ...data },
        update: data,
      }),
    );
  }

  async findById(brandId: string): Promise<Brand | null> {
    const row = await runQuery("Brand.findById", () =>
      this.prisma.brand.findUnique({ where: { id: brandId } }),
    );

    return row === null ? null : toBrandDomain(row);
  }

  async findByStoreProjectId(storeProjectId: string): Promise<Brand | null> {
    const row = await runQuery("Brand.findByStoreProjectId", () =>
      this.prisma.brand.findUnique({ where: { storeProjectId } }),
    );

    return row === null ? null : toBrandDomain(row);
  }

  async saveAsset(asset: BrandAsset): Promise<void> {
    const snapshot = asset.toSnapshot();

    await runQuery("BrandAsset.save", () =>
      this.prisma.brandAsset.upsert({
        where: { id: snapshot.id },
        create: {
          id: snapshot.id,
          brandId: snapshot.brandId,
          type: snapshot.type,
          url: snapshot.url,
        },
        update: { type: snapshot.type, url: snapshot.url },
      }),
    );
  }

  async findAssetsByBrandId(brandId: string): Promise<readonly BrandAsset[]> {
    const rows = await runQuery("BrandAsset.findByBrandId", () =>
      this.prisma.brandAsset.findMany({
        where: { brandId },
        orderBy: { createdAt: "asc" },
      }),
    );

    return rows.map(toBrandAssetDomain);
  }
}
