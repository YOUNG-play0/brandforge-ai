import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  isHttpUrl,
  type ActionResult,
} from "@brandforge/shared";
import type { AssetType } from "../value-objects/asset-type.vo.js";

/** État persisté d'un asset de marque (DATABASE.md §3). */
export interface BrandAssetSnapshot {
  readonly id: string;
  readonly brandId: string;
  readonly type: AssetType;
  readonly url: string;
  readonly createdAt: Date;
}

/**
 * Fichier ou visuel rattaché à une marque (logo, variante, Brand Book).
 *
 * Séparé de `Brand` pour supporter plusieurs assets sans alourdir la table principale
 * (DATABASE.md §3).
 */
export class BrandAsset {
  private constructor(
    readonly id: string,
    readonly brandId: string,
    readonly type: AssetType,
    readonly url: string,
    readonly createdAt: Date,
  ) {}

  static create(
    props: {
      readonly id: string;
      readonly brandId: string;
      readonly type: AssetType;
      readonly url: string;
    },
    now: Date = new Date(),
  ): ActionResult<BrandAsset> {
    if (!isHttpUrl(props.url)) {
      return actionFail(
        createAgentError(
          ERROR_CODES.VALIDATION_ERROR,
          "L'URL de l'asset de marque doit être une URL http(s) absolue.",
          false,
        ),
      );
    }

    return actionOk(new BrandAsset(props.id, props.brandId, props.type, props.url, now));
  }

  static reconstitute(snapshot: BrandAssetSnapshot): BrandAsset {
    return new BrandAsset(
      snapshot.id,
      snapshot.brandId,
      snapshot.type,
      snapshot.url,
      snapshot.createdAt,
    );
  }

  toSnapshot(): BrandAssetSnapshot {
    return {
      id: this.id,
      brandId: this.brandId,
      type: this.type,
      url: this.url,
      createdAt: this.createdAt,
    };
  }
}
