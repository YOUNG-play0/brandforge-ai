import type { StoreProject } from "../entities/store-project.entity.js";

/**
 * Port de persistance du `StoreProject` (ARCHITECTURE.md §12, Repository Pattern).
 *
 * Implémenté par Prisma dans `infrastructure/database`. Toute exception technique est
 * catchée à cette frontière et convertie en `AgentError` (CODING_STANDARDS.md §5) : ce
 * contrat ne laisse donc jamais fuiter une erreur Prisma vers le domaine.
 */
export interface IStoreProjectRepository {
  save(project: StoreProject): Promise<void>;
  findById(storeProjectId: string): Promise<StoreProject | null>;
  findByUserId(userId: string): Promise<readonly StoreProject[]>;
}
