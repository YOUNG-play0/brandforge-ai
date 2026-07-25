import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  isNonEmptyString,
  type ActionResult,
} from "@brandforge/shared";
import type { BrandSummary } from "../value-objects/brand-summary.vo.js";
import type { ColorPalette } from "../value-objects/color-palette.vo.js";
import type { Typography } from "../value-objects/typography.vo.js";

/** Données issues du Brand Agent, avant choix du nom par l'utilisateur. */
export interface CreateBrandProps {
  readonly id: string;
  readonly storeProjectId: string;
  /** 3 à 5 propositions de nom soumises à l'utilisateur (AI_AGENTS.md §3). */
  readonly nameOptions: readonly string[];
  readonly positioning: string;
  readonly tone: string;
  readonly colorPalette: ColorPalette;
  readonly typography: Typography;
  /** Brief textuel transmis au service de logo (MVP) ou à l'Image Agent (V2). */
  readonly logoBriefing: string;
}

/** État persisté d'une marque (DATABASE.md §3). */
export interface BrandSnapshot extends CreateBrandProps {
  readonly name: string | null;
  readonly logoUrl: string | null;
  readonly validatedByUser: boolean;
  readonly createdAt: Date;
}

/**
 * Marque produite par le Brand Agent (DATABASE.md §3, relation 1-1 avec `StoreProject`).
 *
 * Une marque naît **sans nom définitif** : l'agent ne produit que des propositions, et le
 * choix du nom est un point de validation utilisateur obligatoire (AI_AGENTS.md §3,
 * WORKFLOWS.md §3). C'est `selectName` qui fige l'identité du projet.
 */
export class Brand {
  private constructor(
    readonly id: string,
    readonly storeProjectId: string,
    readonly nameOptions: readonly string[],
    private _name: string | null,
    readonly positioning: string,
    readonly tone: string,
    readonly colorPalette: ColorPalette,
    readonly typography: Typography,
    readonly logoBriefing: string,
    private _logoUrl: string | null,
    private _validatedByUser: boolean,
    readonly createdAt: Date,
  ) {}

  static create(props: CreateBrandProps, now: Date = new Date()): ActionResult<Brand> {
    if (props.nameOptions.length === 0) {
      return actionFail(
        createAgentError(
          ERROR_CODES.VALIDATION_ERROR,
          "Le Brand Agent doit proposer au moins un nom de marque.",
          false,
        ),
      );
    }

    return actionOk(
      new Brand(
        props.id,
        props.storeProjectId,
        props.nameOptions,
        null,
        props.positioning,
        props.tone,
        props.colorPalette,
        props.typography,
        props.logoBriefing,
        null,
        false,
        now,
      ),
    );
  }

  static reconstitute(snapshot: BrandSnapshot): Brand {
    return new Brand(
      snapshot.id,
      snapshot.storeProjectId,
      snapshot.nameOptions,
      snapshot.name,
      snapshot.positioning,
      snapshot.tone,
      snapshot.colorPalette,
      snapshot.typography,
      snapshot.logoBriefing,
      snapshot.logoUrl,
      snapshot.validatedByUser,
      snapshot.createdAt,
    );
  }

  get name(): string | null {
    return this._name;
  }

  get logoUrl(): string | null {
    return this._logoUrl;
  }

  get validatedByUser(): boolean {
    return this._validatedByUser;
  }

  /**
   * Fige le nom de marque choisi par l'utilisateur.
   *
   * Le nom doit faire partie des propositions de l'agent : accepter un nom arbitraire
   * viderait de son sens le point de validation et casserait la traçabilité entre ce que
   * l'agent a proposé et ce qui a été retenu.
   */
  selectName(selectedName: string): ActionResult<void> {
    if (!isNonEmptyString(selectedName)) {
      return actionFail(
        createAgentError(ERROR_CODES.VALIDATION_ERROR, "Le nom sélectionné est vide.", false),
      );
    }

    const normalized = selectedName.trim();
    if (!this.nameOptions.includes(normalized)) {
      return actionFail(
        createAgentError(
          ERROR_CODES.VALIDATION_ERROR,
          `Le nom « ${normalized} » ne fait pas partie des propositions du Brand Agent.`,
          false,
        ),
      );
    }

    this._name = normalized;
    this._validatedByUser = true;

    return actionOk(undefined);
  }

  /** Rattache le logo une fois généré (service tiers en MVP, Image Agent en V2). */
  attachLogo(logoUrl: string): void {
    this._logoUrl = logoUrl;
  }

  /** Vrai si la marque est prête à alimenter la construction de la boutique. */
  isReadyForStoreBuilding(): boolean {
    return this._validatedByUser && this._name !== null;
  }

  /**
   * Vue réduite transmise aux agents en aval.
   *
   * Retourne `null` tant que le nom n'a pas été choisi : les agents Store Builder et
   * Product ne peuvent pas travailler sur une marque sans nom définitif.
   */
  toSummary(): BrandSummary | null {
    if (this._name === null) {
      return null;
    }

    return {
      name: this._name,
      positioning: this.positioning,
      tone: this.tone,
      colorPalette: this.colorPalette.colors,
      typography: { heading: this.typography.heading, body: this.typography.body },
    };
  }

  toSnapshot(): BrandSnapshot {
    return {
      id: this.id,
      storeProjectId: this.storeProjectId,
      nameOptions: this.nameOptions,
      name: this._name,
      positioning: this.positioning,
      tone: this.tone,
      colorPalette: this.colorPalette,
      typography: this.typography,
      logoBriefing: this.logoBriefing,
      logoUrl: this._logoUrl,
      validatedByUser: this._validatedByUser,
      createdAt: this.createdAt,
    };
  }
}
