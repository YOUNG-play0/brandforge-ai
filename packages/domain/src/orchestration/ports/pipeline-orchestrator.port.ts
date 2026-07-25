import type { ActionResult } from "@brandforge/shared";
import type { AgentName } from "../value-objects/agent-name.vo.js";
import type { PipelineStatus } from "../value-objects/pipeline-status.vo.js";

/**
 * Port de l'Orchestrator (WORKFLOWS.md §1).
 *
 * Seul module autorisé à séquencer les agents, à créer/mettre à jour les
 * `PipelineRun`/`PipelineStep` et à décider d'une reprise. Les use cases `StartPipeline`
 * et `ResumePipeline` valident l'état du projet puis délèguent ici : ils ne séquencent
 * jamais eux-mêmes.
 *
 * L'implémentation concrète est livrée au module « Orchestrator ».
 */
export interface IPipelineOrchestrator {
  /** Exécute le pipeline jusqu'au prochain point de validation utilisateur. */
  start(storeProjectId: string): Promise<ActionResult<PipelineExecutionState>>;

  /** Reprend une exécution interrompue à partir de la première étape non aboutie. */
  resume(pipelineRunId: string): Promise<ActionResult<PipelineExecutionState>>;
}

/** État renvoyé par l'Orchestrator après une exécution (API.md §4). */
export interface PipelineExecutionState {
  readonly pipelineRunId: string;
  readonly status: PipelineStatus;
  /** Agent sur lequel le pipeline s'est arrêté (validation attendue, échec, ou fin). */
  readonly currentStep: AgentName;
}
