import type { IProductRepository, Product } from "@brandforge/domain";
import type { PrismaDatabase } from "../prisma-client.js";
import { runQuery } from "../prisma-error-mapper.js";
import { toProductDomain, toProductPersistence } from "../mappers/product.mapper.js";

/** Implémentation Prisma de `IProductRepository`. */
export class PrismaProductRepository implements IProductRepository {
  constructor(private readonly prisma: PrismaDatabase) {}

  async save(product: Product): Promise<void> {
    const data = toProductPersistence(product);

    await runQuery("Product.save", () =>
      this.prisma.product.upsert({
        where: { id: product.id },
        create: { id: product.id, ...data },
        update: data,
      }),
    );
  }

  async findById(productId: string): Promise<Product | null> {
    const row = await runQuery("Product.findById", () =>
      this.prisma.product.findUnique({ where: { id: productId } }),
    );

    return row === null ? null : toProductDomain(row);
  }

  async findByStoreProjectId(storeProjectId: string): Promise<readonly Product[]> {
    const rows = await runQuery("Product.findByStoreProjectId", () =>
      this.prisma.product.findMany({
        where: { storeProjectId },
        orderBy: { createdAt: "asc" },
      }),
    );

    return rows.map(toProductDomain);
  }
}
