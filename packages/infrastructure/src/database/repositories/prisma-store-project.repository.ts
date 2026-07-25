import type { IStoreProjectRepository, StoreProject } from "@brandforge/domain";
import type { PrismaDatabase } from "../prisma-client.js";
import { runQuery } from "../prisma-error-mapper.js";
import {
  toStoreProjectDomain,
  toStoreProjectPersistence,
} from "../mappers/store-project.mapper.js";

/**
 * Implémentation Prisma de `IStoreProjectRepository` (ARCHITECTURE.md §12).
 *
 * `save` est un `upsert` : l'identifiant est généré par le domaine (`IIdGenerator`), donc
 * une même entité peut être créée puis mise à jour par le même appel, ce qui évite au
 * domaine d'avoir à distinguer insertion et mise à jour.
 */
export class PrismaStoreProjectRepository implements IStoreProjectRepository {
  constructor(private readonly prisma: PrismaDatabase) {}

  async save(project: StoreProject): Promise<void> {
    const { snapshot, data } = toStoreProjectPersistence(project);

    await runQuery("StoreProject.save", () =>
      this.prisma.storeProject.upsert({
        where: { id: snapshot.id },
        create: { id: snapshot.id, ...data },
        update: data,
      }),
    );
  }

  async findById(storeProjectId: string): Promise<StoreProject | null> {
    const row = await runQuery("StoreProject.findById", () =>
      this.prisma.storeProject.findUnique({ where: { id: storeProjectId } }),
    );

    return row === null ? null : toStoreProjectDomain(row);
  }

  async findByUserId(userId: string): Promise<readonly StoreProject[]> {
    const rows = await runQuery("StoreProject.findByUserId", () =>
      this.prisma.storeProject.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      }),
    );

    return rows.map(toStoreProjectDomain);
  }
}
