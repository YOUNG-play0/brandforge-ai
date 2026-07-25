/**
 * Statut global persisté d'un `StoreProject` / `PipelineRun` (DATABASE.md §4).
 *
 * Volontairement grossier : le détail fin de l'avancement (`NICHE_ANALYSIS_RUNNING`,
 * `AWAITING_BRAND_VALIDATION`...) n'est pas persisté ici, il se déduit du dernier
 * `PipelineStep` du `PipelineRun` courant (WORKFLOWS.md §2).
 */
export enum PipelineStatus {
  DRAFT = "DRAFT",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  PAUSED = "PAUSED",
}
