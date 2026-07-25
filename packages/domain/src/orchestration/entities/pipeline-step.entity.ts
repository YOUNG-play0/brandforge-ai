import type { AgentError } from "@brandforge/shared";
import type { AgentName } from "../value-objects/agent-name.vo.js";
import { StepStatus, isStepCompleted } from "../value-objects/step-status.vo.js";

/** État complet d'une étape, tel que persisté (DATABASE.md §3). */
export interface PipelineStepSnapshot {
  readonly id: string;
  readonly pipelineRunId: string;
  readonly agentName: AgentName;
  readonly status: StepStatus;
  /** Entrée exacte reçue par l'agent, journalisée pour rejouer/déboguer l'étape. */
  readonly input: unknown;
  /** Sortie produite ; `null` tant que l'étape n'a rien produit. */
  readonly output: unknown;
  readonly errorMessage: string | null;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
}

/**
 * Une exécution d'agent au sein d'un `PipelineRun` (DATABASE.md §3).
 *
 * `input`/`output` sont journalisés systématiquement : c'est ce qui permet de rejouer
 * une étape précise sans dépendre des logs applicatifs (DATABASE.md §5).
 */
export class PipelineStep {
  private constructor(
    readonly id: string,
    readonly pipelineRunId: string,
    readonly agentName: AgentName,
    private _status: StepStatus,
    private _input: unknown,
    private _output: unknown,
    private _errorMessage: string | null,
    private _startedAt: Date | null,
    private _finishedAt: Date | null,
  ) {}

  /** Planifie une étape, en attente d'exécution par l'Orchestrator. */
  static schedule(props: {
    readonly id: string;
    readonly pipelineRunId: string;
    readonly agentName: AgentName;
    readonly input: unknown;
  }): PipelineStep {
    return new PipelineStep(
      props.id,
      props.pipelineRunId,
      props.agentName,
      StepStatus.PENDING,
      props.input,
      null,
      null,
      null,
      null,
    );
  }

  static reconstitute(snapshot: PipelineStepSnapshot): PipelineStep {
    return new PipelineStep(
      snapshot.id,
      snapshot.pipelineRunId,
      snapshot.agentName,
      snapshot.status,
      snapshot.input,
      snapshot.output,
      snapshot.errorMessage,
      snapshot.startedAt,
      snapshot.finishedAt,
    );
  }

  get status(): StepStatus {
    return this._status;
  }

  get input(): unknown {
    return this._input;
  }

  get output(): unknown {
    return this._output;
  }

  get errorMessage(): string | null {
    return this._errorMessage;
  }

  get startedAt(): Date | null {
    return this._startedAt;
  }

  get finishedAt(): Date | null {
    return this._finishedAt;
  }

  /** Vrai si l'étape est aboutie et ne doit donc jamais être rejouée (WORKFLOWS.md §4.3). */
  isCompleted(): boolean {
    return isStepCompleted(this._status);
  }

  markRunning(now: Date = new Date()): void {
    this._status = StepStatus.RUNNING;
    this._startedAt = now;
    this._errorMessage = null;
  }

  markSuccess(output: unknown, now: Date = new Date()): void {
    this._status = StepStatus.SUCCESS;
    this._output = output;
    this._errorMessage = null;
    this._finishedAt = now;
  }

  /**
   * Succès partiel : utilisé par l'import de produits en masse, où l'échec d'un produit
   * ne bloque pas les autres ni la suite du pipeline (WORKFLOWS.md §5).
   */
  markPartialSuccess(output: unknown, now: Date = new Date()): void {
    this._status = StepStatus.PARTIAL_SUCCESS;
    this._output = output;
    this._finishedAt = now;
  }

  markFailed(error: AgentError, now: Date = new Date()): void {
    this._status = StepStatus.FAILED;
    this._errorMessage = `${error.code}: ${error.message}`;
    this._finishedAt = now;
  }

  markSkipped(now: Date = new Date()): void {
    this._status = StepStatus.SKIPPED;
    this._finishedAt = now;
  }

  /** Remet l'étape en attente avant une nouvelle tentative (reprise ou retry). */
  resetForRetry(input?: unknown): void {
    this._status = StepStatus.PENDING;
    this._output = null;
    this._errorMessage = null;
    this._startedAt = null;
    this._finishedAt = null;
    if (input !== undefined) {
      this._input = input;
    }
  }

  toSnapshot(): PipelineStepSnapshot {
    return {
      id: this.id,
      pipelineRunId: this.pipelineRunId,
      agentName: this.agentName,
      status: this._status,
      input: this._input,
      output: this._output,
      errorMessage: this._errorMessage,
      startedAt: this._startedAt,
      finishedAt: this._finishedAt,
    };
  }
}
