import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  isHexColor,
  type ActionResult,
} from "@brandforge/shared";

/** Rôle d'une couleur dans l'identité visuelle (AI_AGENTS.md §3). */
export type ColorRole = "primary" | "secondary" | "accent";

/** Une couleur de la palette et son rôle. */
export interface PaletteColor {
  readonly hex: string;
  readonly role: ColorRole;
}

/**
 * Palette de couleurs de la marque (DATABASE.md §3, persistée en `Json`).
 *
 * Garantit la cohérence de marque exigée par le PRD (§2.1) : une palette sans couleur
 * primaire ne permettrait pas de décliner l'identité sur la boutique et les visuels, elle
 * est donc invalide par construction.
 */
export class ColorPalette {
  private constructor(readonly colors: readonly PaletteColor[]) {}

  static create(colors: readonly PaletteColor[]): ActionResult<ColorPalette> {
    if (colors.length === 0) {
      return actionFail(
        createAgentError(ERROR_CODES.VALIDATION_ERROR, "La palette est vide.", false),
      );
    }

    const invalid = colors.find((color) => !isHexColor(color.hex));
    if (invalid !== undefined) {
      return actionFail(
        createAgentError(
          ERROR_CODES.VALIDATION_ERROR,
          `Couleur hexadécimale invalide : « ${invalid.hex} ».`,
          false,
        ),
      );
    }

    if (!colors.some((color) => color.role === "primary")) {
      return actionFail(
        createAgentError(
          ERROR_CODES.VALIDATION_ERROR,
          "La palette doit comporter une couleur primaire.",
          false,
        ),
      );
    }

    return actionOk(new ColorPalette(colors));
  }

  /** Couleur primaire, garantie présente par la validation à la construction. */
  primary(): PaletteColor {
    const primary = this.colors.find((color) => color.role === "primary");
    if (primary === undefined) {
      // Inatteignable : `create` refuse toute palette sans couleur primaire.
      throw new Error("Palette invariant violé : aucune couleur primaire.");
    }
    return primary;
  }

  byRole(role: ColorRole): readonly PaletteColor[] {
    return this.colors.filter((color) => color.role === role);
  }
}
