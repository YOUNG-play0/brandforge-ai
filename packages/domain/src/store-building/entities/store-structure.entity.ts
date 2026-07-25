import type { StorePageType } from "../../publishing/ports/ecommerce-platform.port.js";

/** Collection créée sur la boutique. */
export interface StoreCollection {
  readonly id: string;
  readonly title: string;
}

/** Page créée sur la boutique. */
export interface StorePage {
  readonly id: string;
  readonly title: string;
  readonly type: StorePageType;
}

/**
 * Structure de boutique générée par le Store Builder Agent (AI_AGENTS.md §4).
 *
 * Non persistée en table dédiée : elle est reconstituable depuis la plateforme et
 * journalisée dans l'`output` du `PipelineStep` correspondant (DATABASE.md §5). Elle
 * existe dans le domaine pour porter la règle de complétude ci-dessous.
 */
export class StoreStructure {
  private constructor(
    readonly storeProjectId: string,
    readonly themeId: string,
    readonly collections: readonly StoreCollection[],
    readonly pages: readonly StorePage[],
  ) {}

  static create(props: {
    readonly storeProjectId: string;
    readonly themeId: string;
    readonly collections: readonly StoreCollection[];
    readonly pages: readonly StorePage[];
  }): StoreStructure {
    return new StoreStructure(props.storeProjectId, props.themeId, props.collections, props.pages);
  }

  /**
   * Une boutique n'est publiable que si elle a une page d'accueil et au moins une
   * collection : sans cela, le visiteur arrive sur une vitrine vide (critère
   * d'acceptation n°6 du PRD, « boutique accessible et fonctionnelle »).
   */
  isPublishable(): boolean {
    return this.pages.some((page) => page.type === "home") && this.collections.length > 0;
  }
}
