import type { NicheAnalysis } from "../entities/niche-analysis.entity.js";

/** Port de persistance de l'analyse de niche (relation 1-1 avec `StoreProject`). */
export interface INicheAnalysisRepository {
  save(analysis: NicheAnalysis): Promise<void>;
  findByStoreProjectId(storeProjectId: string): Promise<NicheAnalysis | null>;
}
