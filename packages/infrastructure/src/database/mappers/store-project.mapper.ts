import type { PipelineStatus } from "@brandforge/domain";
import { StoreProject, type StoreProjectSnapshot } from "@brandforge/domain";
import type { StoreProject as PrismaStoreProject } from "@prisma/client";

/**
 * Conversion `StoreProject` ↔ ligne Prisma.
 *
 * Les mappers sont des fonctions pures : ils ne font aucun accès base et sont donc
 * testables sans base de données (CODING_STANDARDS.md §7).
 */
export function toStoreProjectDomain(row: PrismaStoreProject): StoreProject {
  return StoreProject.reconstitute({
    id: row.id,
    userId: row.userId,
    name: row.name,
    niche: row.niche,
    targetMarket: row.targetMarket,
    status: row.status as PipelineStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/** Champs persistés d'un projet, hors identifiant et dates gérées par la base. */
export function toStoreProjectPersistence(project: StoreProject): {
  snapshot: StoreProjectSnapshot;
  data: {
    userId: string;
    name: string;
    niche: string;
    targetMarket: string;
    status: PipelineStatus;
  };
} {
  const snapshot = project.toSnapshot();
  return {
    snapshot,
    data: {
      userId: snapshot.userId,
      name: snapshot.name,
      niche: snapshot.niche,
      targetMarket: snapshot.targetMarket,
      status: snapshot.status,
    },
  };
}
