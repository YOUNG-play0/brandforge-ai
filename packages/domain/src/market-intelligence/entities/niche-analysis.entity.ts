import type { Competitor } from "../value-objects/competitor.vo.js";
import type { PriceRange } from "../value-objects/price-range.vo.js";
import type { RelevanceScore } from "../value-objects/relevance-score.vo.js";

/** Données de création d'une analyse de niche. */
export interface CreateNicheAnalysisProps {
  readonly id: string;
  readonly storeProjectId: string;
  readonly keywords: readonly string[];
  readonly competitors: readonly Competitor[];
  readonly priceRange: PriceRange;
  readonly relevanceScore: RelevanceScore;
  readonly differentiationAngle: string;
  /** Sortie brute du modèle, conservée pour la traçabilité (DATABASE.md §5). */
  readonly rawAnalysis: unknown;
}

/** État persisté d'une analyse de niche. */
export interface NicheAnalysisSnapshot extends CreateNicheAnalysisProps {
  readonly validatedByUser: boolean;
  readonly createdAt: Date;
}

/**
 * Résultat produit par le Market Agent (DATABASE.md §3, relation 1-1 avec `StoreProject`).
 *
 * Porte le point de validation utilisateur qui conditionne le passage à l'étape Branding
 * (WORKFLOWS.md §3) : tant que l'analyse n'est pas validée, le pipeline ne progresse pas.
 */
export class NicheAnalysis {
  private constructor(
    readonly id: string,
    readonly storeProjectId: string,
    readonly keywords: readonly string[],
    readonly competitors: readonly Competitor[],
    readonly priceRange: PriceRange,
    readonly relevanceScore: RelevanceScore,
    readonly differentiationAngle: string,
    readonly rawAnalysis: unknown,
    private _validatedByUser: boolean,
    readonly createdAt: Date,
  ) {}

  static create(props: CreateNicheAnalysisProps, now: Date = new Date()): NicheAnalysis {
    return new NicheAnalysis(
      props.id,
      props.storeProjectId,
      props.keywords,
      props.competitors,
      props.priceRange,
      props.relevanceScore,
      props.differentiationAngle,
      props.rawAnalysis,
      false,
      now,
    );
  }

  static reconstitute(snapshot: NicheAnalysisSnapshot): NicheAnalysis {
    return new NicheAnalysis(
      snapshot.id,
      snapshot.storeProjectId,
      snapshot.keywords,
      snapshot.competitors,
      snapshot.priceRange,
      snapshot.relevanceScore,
      snapshot.differentiationAngle,
      snapshot.rawAnalysis,
      snapshot.validatedByUser,
      snapshot.createdAt,
    );
  }

  get validatedByUser(): boolean {
    return this._validatedByUser;
  }

  /** L'utilisateur valide l'analyse : le pipeline peut passer au Brand Agent. */
  approve(): void {
    this._validatedByUser = true;
  }

  toSnapshot(): NicheAnalysisSnapshot {
    return {
      id: this.id,
      storeProjectId: this.storeProjectId,
      keywords: this.keywords,
      competitors: this.competitors,
      priceRange: this.priceRange,
      relevanceScore: this.relevanceScore,
      differentiationAngle: this.differentiationAngle,
      rawAnalysis: this.rawAnalysis,
      validatedByUser: this._validatedByUser,
      createdAt: this.createdAt,
    };
  }
}
