import { PipelineStatus } from "../value-objects/pipeline-status.vo.js";
import type { AgentName } from "../value-objects/agent-name.vo.js";
import { PipelineStep, type PipelineStepSnapshot } from "./pipeline-step.entity.js";

/** État complet d'une exécution de pipeline, tel que persisté (DATABASE.md §3). */
export interface PipelineRunSnapshot {
  readonly id: string;
  readonly storeProjectId: string;
  readonly status: PipelineStatus;
  readonly steps: readonly PipelineStepSnapshot[];
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
}

/**
 * Une exécution du pipeline pour un `StoreProject` (DATABASE.md §3).
 *
 * Agrégat racine des `PipelineStep` : c'est lui qui sait quelle étape doit être jouée
 * ensuite et si une reprise est possible. Il ne contient aucune règle de génération de
 * contenu — uniquement du séquencement et de l'état (WORKFLOWS.md §7).
 */
export class PipelineRun {
  private constructor(
    readonly id: string,
    readonly storeProjectId: string,
    private _status: PipelineStatus,
    private readonly _steps: PipelineStep[],
    readonly startedAt: Date,
    private _finishedAt: Date | null,
  ) {}

  /** Démarre une exécution : le run naît `RUNNING`, sans étape jouée. */
  static start(
    props: { readonly id: string; readonly storeProjectId: string },
    now: Date = new Date(),
  ): PipelineRun {
    return new PipelineRun(props.id, props.storeProjectId, PipelineStatus.RUNNING, [], now, null);
  }

  static reconstitute(snapshot: PipelineRunSnapshot): PipelineRun {
    return new PipelineRun(
      snapshot.id,
      snapshot.storeProjectId,
      snapshot.status,
      snapshot.steps.map((step) => PipelineStep.reconstitute(step)),
      snapshot.startedAt,
      snapshot.finishedAt,
    );
  }

  get status(): PipelineStatus {
    return this._status;
  }

  get steps(): readonly PipelineStep[] {
    return this._steps;
  }

  get finishedAt(): Date | null {
    return this._finishedAt;
  }

  /** Ajoute une étape planifiée à l'exécution courante. */
  addStep(step: PipelineStep): void {
    this._steps.push(step);
  }

  /** Dernière étape enregistrée : porte le détail fin de l'avancement (WORKFLOWS.md §2). */
  lastStep(): PipelineStep | null {
    return this._steps.at(-1) ?? null;
  }

  /** Étape la plus récente pour un agent donné. */
  stepFor(agentName: AgentName): PipelineStep | null {
    return this._steps.filter((step) => step.agentName === agentName).at(-1) ?? null;
  }

  /**
   * Première étape non aboutie — point de reprise du pipeline.
   *
   * Les étapes déjà abouties ne sont jamais recalculées, pour ne pas écraser une
   * validation déjà faite par l'utilisateur (WORKFLOWS.md §4.3).
   */
  nextResumableStep(): PipelineStep | null {
    return this._steps.find((step) => !step.isCompleted()) ?? null;
  }

  markCompleted(now: Date = new Date()): void {
    this._status = PipelineStatus.COMPLETED;
    this._finishedAt = now;
  }

  markFailed(now: Date = new Date()): void {
    this._status = PipelineStatus.FAILED;
    this._finishedAt = now;
  }

  /** Met le pipeline en attente d'une validation utilisateur (WORKFLOWS.md §3). */
  markPaused(now: Date = new Date()): void {
    this._status = PipelineStatus.PAUSED;
    this._finishedAt = now;
  }

  /** Relance une exécution interrompue : le run repart en `RUNNING`. */
  markResumed(): void {
    this._status = PipelineStatus.RUNNING;
    this._finishedAt = null;
  }

  toSnapshot(): PipelineRunSnapshot {
    return {
      id: this.id,
      storeProjectId: this.storeProjectId,
      status: this._status,
      steps: this._steps.map((step) => step.toSnapshot()),
      startedAt: this.startedAt,
      finishedAt: this._finishedAt,
    };
  }
}
