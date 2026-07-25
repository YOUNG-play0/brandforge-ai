/**
 * Statut d'un `PipelineStep` (DATABASE.md §4).
 *
 * `PARTIAL_SUCCESS` est requis par le cas particulier de l'import de produits en masse
 * (WORKFLOWS.md §5) : un échec sur un produit ne bloque pas les autres, et l'étape doit
 * pouvoir refléter ce succès partiel sans être marquée `FAILED` (ce qui stopperait le
 * pipeline à tort).
 */
export enum StepStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  SUCCESS = "SUCCESS",
  PARTIAL_SUCCESS = "PARTIAL_SUCCESS",
  FAILED = "FAILED",
  SKIPPED = "SKIPPED",
}

/**
 * Une étape est considérée comme aboutie si elle a réussi, même partiellement.
 * Utilisé par la reprise : un `resumePipeline` ne rejoue jamais une étape aboutie
 * (WORKFLOWS.md §4.3).
 */
export function isStepCompleted(status: StepStatus): boolean {
  return (
    status === StepStatus.SUCCESS ||
    status === StepStatus.PARTIAL_SUCCESS ||
    status === StepStatus.SKIPPED
  );
}
