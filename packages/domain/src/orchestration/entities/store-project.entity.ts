import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  isNonEmptyString,
  type ActionResult,
} from "@brandforge/shared";
import { PipelineStatus } from "../value-objects/pipeline-status.vo.js";

/** Données nécessaires à la création d'un nouveau projet. */
export interface CreateStoreProjectProps {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly niche: string;
  readonly targetMarket: string;
}

/** État complet d'un projet, tel que restitué depuis la persistance. */
export interface StoreProjectSnapshot extends CreateStoreProjectProps {
  readonly status: PipelineStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Entité pivot du système (DATABASE.md §3) : un projet = une marque en cours de
 * création. Toutes les autres entités métier lui sont rattachées.
 *
 * Porte les règles de transition du statut global du pipeline ; le détail fin de
 * l'avancement vit dans les `PipelineStep` (WORKFLOWS.md §2).
 */
export class StoreProject {
  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly name: string,
    readonly niche: string,
    readonly targetMarket: string,
    private _status: PipelineStatus,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  /** Crée un projet en `DRAFT` après validation de l'intention utilisateur. */
  static create(
    props: CreateStoreProjectProps,
    now: Date = new Date(),
  ): ActionResult<StoreProject> {
    if (!isNonEmptyString(props.id) || !isNonEmptyString(props.userId)) {
      return actionFail(
        createAgentError(ERROR_CODES.VALIDATION_ERROR, "Identifiants de projet manquants.", false),
      );
    }
    if (!isNonEmptyString(props.name)) {
      return actionFail(
        createAgentError(
          ERROR_CODES.VALIDATION_ERROR,
          "Le nom de travail du projet est obligatoire.",
          false,
        ),
      );
    }
    if (!isNonEmptyString(props.niche)) {
      return actionFail(
        createAgentError(
          ERROR_CODES.VALIDATION_ERROR,
          "La niche est obligatoire (ex. « lunettes de soleil »).",
          false,
        ),
      );
    }
    if (!isNonEmptyString(props.targetMarket)) {
      return actionFail(
        createAgentError(
          ERROR_CODES.VALIDATION_ERROR,
          "Le marché cible est obligatoire (ex. « France »).",
          false,
        ),
      );
    }

    return actionOk(
      new StoreProject(
        props.id,
        props.userId,
        props.name.trim(),
        props.niche.trim(),
        props.targetMarket.trim(),
        PipelineStatus.DRAFT,
        now,
        now,
      ),
    );
  }

  /** Reconstruit une entité depuis la persistance, sans revalider (donnée déjà fiable). */
  static reconstitute(snapshot: StoreProjectSnapshot): StoreProject {
    return new StoreProject(
      snapshot.id,
      snapshot.userId,
      snapshot.name,
      snapshot.niche,
      snapshot.targetMarket,
      snapshot.status,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get status(): PipelineStatus {
    return this._status;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Vrai si le projet appartient à l'utilisateur donné. */
  belongsTo(userId: string): boolean {
    return this.userId === userId;
  }

  /**
   * Un pipeline ne peut démarrer que depuis un état stable : un projet déjà `RUNNING`
   * ne doit pas être relancé en parallèle, et un projet `COMPLETED` est terminé.
   */
  canStartPipeline(): boolean {
    return this._status === PipelineStatus.DRAFT || this._status === PipelineStatus.FAILED;
  }

  /** Seul un pipeline interrompu (`FAILED`/`PAUSED`) peut être repris (WORKFLOWS.md §4.3). */
  canResumePipeline(): boolean {
    return this._status === PipelineStatus.FAILED || this._status === PipelineStatus.PAUSED;
  }

  markRunning(now: Date = new Date()): void {
    this.transitionTo(PipelineStatus.RUNNING, now);
  }

  markCompleted(now: Date = new Date()): void {
    this.transitionTo(PipelineStatus.COMPLETED, now);
  }

  markFailed(now: Date = new Date()): void {
    this.transitionTo(PipelineStatus.FAILED, now);
  }

  markPaused(now: Date = new Date()): void {
    this.transitionTo(PipelineStatus.PAUSED, now);
  }

  private transitionTo(status: PipelineStatus, now: Date): void {
    this._status = status;
    this._updatedAt = now;
  }

  toSnapshot(): StoreProjectSnapshot {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      niche: this.niche,
      targetMarket: this.targetMarket,
      status: this._status,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
