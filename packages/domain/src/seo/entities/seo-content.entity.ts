/** Données de création d'un contenu SEO. */
export interface CreateSeoContentProps {
  readonly id: string;
  /**
   * Produit optimisé. Nullable pour anticiper les articles de blog (V2), où le contenu
   * SEO n'est rattaché à aucun produit (DATABASE.md §3).
   */
  readonly productId: string | null;
  readonly targetKeywords: readonly string[];
  readonly metaTitle: string;
  readonly metaDescription: string;
  readonly optimizedContent: string;
}

/** État persisté d'un contenu SEO (DATABASE.md §3). */
export interface SeoContentSnapshot extends CreateSeoContentProps {
  readonly createdAt: Date;
}

/**
 * Contenu SEO produit par le SEO Agent (DATABASE.md §3).
 *
 * Entité immuable : réoptimiser une fiche produit crée un nouveau contenu plutôt que de
 * muter l'existant, ce qui préserve l'historique des optimisations.
 */
export class SeoContent {
  private constructor(
    readonly id: string,
    readonly productId: string | null,
    readonly targetKeywords: readonly string[],
    readonly metaTitle: string,
    readonly metaDescription: string,
    readonly optimizedContent: string,
    readonly createdAt: Date,
  ) {}

  static create(props: CreateSeoContentProps, now: Date = new Date()): SeoContent {
    return new SeoContent(
      props.id,
      props.productId,
      props.targetKeywords,
      props.metaTitle,
      props.metaDescription,
      props.optimizedContent,
      now,
    );
  }

  static reconstitute(snapshot: SeoContentSnapshot): SeoContent {
    return new SeoContent(
      snapshot.id,
      snapshot.productId,
      snapshot.targetKeywords,
      snapshot.metaTitle,
      snapshot.metaDescription,
      snapshot.optimizedContent,
      snapshot.createdAt,
    );
  }

  toSnapshot(): SeoContentSnapshot {
    return {
      id: this.id,
      productId: this.productId,
      targetKeywords: this.targetKeywords,
      metaTitle: this.metaTitle,
      metaDescription: this.metaDescription,
      optimizedContent: this.optimizedContent,
      createdAt: this.createdAt,
    };
  }
}
