import type { PipelineRun } from "../entities/pipeline-run.entity.js";

/**
 * Port de persistance des exécutions de pipeline (DATABASE.md §3).
 *
 * `save` persiste l'agrégat complet (run + étapes) : les `PipelineStep` n'ont pas de
 * repository dédié, ils ne vivent jamais indépendamment de leur `PipelineRun`.
 */
export interface IPipelineRepository {
  save(run: PipelineRun): Promise<void>;
  findById(pipelineRunId: string): Promise<PipelineRun | null>;
  /** Dernière exécution en date pour un projet, tous statuts confondus. */
  findLatestByStoreProjectId(storeProjectId: string): Promise<PipelineRun | null>;
}
