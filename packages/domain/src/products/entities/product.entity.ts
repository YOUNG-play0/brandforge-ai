import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  isNonEmptyString,
  type ActionResult,
} from "@brandforge/shared";
import type { Price } from "../value-objects/price.vo.js";
import { ProductSource, ProductStatus } from "../value-objects/product-status.vo.js";

/** Données d'import d'un produit. */
export interface CreateProductProps {
  readonly id: string;
  readonly storeProjectId: string;
  readonly sourceUrl: string | null;
  readonly sourcePlatform: ProductSource;
  readonly originalTitle: string;
  readonly originalDescription: string;
  readonly images: readonly string[];
  readonly price: Price;
}

/** État persisté d'un produit (DATABASE.md §3). */
export interface ProductSnapshot extends CreateProductProps {
  readonly rewrittenTitle: string | null;
  readonly rewrittenDescription: string | null;
  readonly shopifyProductId: string | null;
  readonly status: ProductStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Produit importé puis enrichi par le Product Agent (DATABASE.md §3).
 *
 * Conserve toujours le contenu d'origine à côté du contenu réécrit : c'est ce qui permet
 * de rejouer une réécriture (nouveau ton de marque, autre modèle) sans réimporter le
 * produit depuis sa source.
 */
export class Product {
  private constructor(
    readonly id: string,
    readonly storeProjectId: string,
    readonly sourceUrl: string | null,
    readonly sourcePlatform: ProductSource,
    readonly originalTitle: string,
    readonly originalDescription: string,
    private _images: readonly string[],
    private _price: Price,
    private _rewrittenTitle: string | null,
    private _rewrittenDescription: string | null,
    private _shopifyProductId: string | null,
    private _status: ProductStatus,
    readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static create(props: CreateProductProps, now: Date = new Date()): ActionResult<Product> {
    if (!isNonEmptyString(props.originalTitle)) {
      return actionFail(
        createAgentError(
          ERROR_CODES.PRODUCT_DATA_INCOMPLETE,
          "Le titre du produit source est manquant.",
          false,
        ),
      );
    }
    if (!isNonEmptyString(props.originalDescription)) {
      return actionFail(
        createAgentError(
          ERROR_CODES.PRODUCT_DATA_INCOMPLETE,
          "La description du produit source est manquante.",
          false,
        ),
      );
    }
    if (props.images.length === 0) {
      return actionFail(
        createAgentError(
          ERROR_CODES.PRODUCT_DATA_INCOMPLETE,
          "Au moins une image produit est requise.",
          false,
        ),
      );
    }
    // Un produit AliExpress sans URL source serait intraçable et non resynchronisable.
    if (props.sourcePlatform === ProductSource.ALIEXPRESS && !isNonEmptyString(props.sourceUrl)) {
      return actionFail(
        createAgentError(
          ERROR_CODES.PRODUCT_DATA_INCOMPLETE,
          "Un produit importé depuis AliExpress doit porter son URL source.",
          false,
        ),
      );
    }

    return actionOk(
      new Product(
        props.id,
        props.storeProjectId,
        props.sourceUrl,
        props.sourcePlatform,
        props.originalTitle.trim(),
        props.originalDescription,
        props.images,
        props.price,
        null,
        null,
        null,
        ProductStatus.IMPORTED,
        now,
        now,
      ),
    );
  }

  static reconstitute(snapshot: ProductSnapshot): Product {
    return new Product(
      snapshot.id,
      snapshot.storeProjectId,
      snapshot.sourceUrl,
      snapshot.sourcePlatform,
      snapshot.originalTitle,
      snapshot.originalDescription,
      snapshot.images,
      snapshot.price,
      snapshot.rewrittenTitle,
      snapshot.rewrittenDescription,
      snapshot.shopifyProductId,
      snapshot.status,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  get images(): readonly string[] {
    return this._images;
  }

  get price(): Price {
    return this._price;
  }

  get rewrittenTitle(): string | null {
    return this._rewrittenTitle;
  }

  get rewrittenDescription(): string | null {
    return this._rewrittenDescription;
  }

  get shopifyProductId(): string | null {
    return this._shopifyProductId;
  }

  get status(): ProductStatus {
    return this._status;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Titre effectivement publié : la réécriture prime sur l'original. */
  effectiveTitle(): string {
    return this._rewrittenTitle ?? this.originalTitle;
  }

  /** Description effectivement publiée : la réécriture prime sur l'original. */
  effectiveDescription(): string {
    return this._rewrittenDescription ?? this.originalDescription;
  }

  /** Applique la réécriture produite par le Product Agent. */
  applyRewrite(
    props: {
      readonly title: string;
      readonly description: string;
      readonly images: readonly string[];
      readonly price: Price;
    },
    now: Date = new Date(),
  ): void {
    this._rewrittenTitle = props.title;
    this._rewrittenDescription = props.description;
    this._images = props.images;
    this._price = props.price;
    this.advanceTo(ProductStatus.REWRITTEN, now);
  }

  /** Marque le produit comme optimisé par le SEO Agent. */
  markSeoOptimized(now: Date = new Date()): void {
    this.advanceTo(ProductStatus.SEO_OPTIMIZED, now);
  }

  /** Enregistre la publication du produit sur la plateforme e-commerce. */
  markPublished(platformProductId: string, now: Date = new Date()): void {
    this._shopifyProductId = platformProductId;
    this.advanceTo(ProductStatus.PUBLISHED, now);
  }

  /** Vrai si le produit dispose des données nécessaires à une publication. */
  isPublishable(): boolean {
    return this._status === ProductStatus.REWRITTEN || this._status === ProductStatus.SEO_OPTIMIZED;
  }

  /** Vrai si le produit a déjà été publié et peut donc être resynchronisé. */
  isSynchronizable(): boolean {
    return this._status === ProductStatus.PUBLISHED && this._shopifyProductId !== null;
  }

  /**
   * N'avance jamais le statut vers l'arrière : réoptimiser le SEO d'un produit déjà
   * publié ne doit pas le faire régresser à `SEO_OPTIMIZED` et le dépublier de fait.
   */
  private advanceTo(status: ProductStatus, now: Date): void {
    const order = [
      ProductStatus.IMPORTED,
      ProductStatus.REWRITTEN,
      ProductStatus.SEO_OPTIMIZED,
      ProductStatus.PUBLISHED,
    ];
    if (order.indexOf(status) > order.indexOf(this._status)) {
      this._status = status;
    }
    this._updatedAt = now;
  }

  toSnapshot(): ProductSnapshot {
    return {
      id: this.id,
      storeProjectId: this.storeProjectId,
      sourceUrl: this.sourceUrl,
      sourcePlatform: this.sourcePlatform,
      originalTitle: this.originalTitle,
      originalDescription: this.originalDescription,
      images: this._images,
      price: this._price,
      rewrittenTitle: this._rewrittenTitle,
      rewrittenDescription: this._rewrittenDescription,
      shopifyProductId: this._shopifyProductId,
      status: this._status,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
