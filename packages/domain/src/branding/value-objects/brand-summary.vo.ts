import type { PaletteColor } from "./color-palette.vo.js";

/**
 * Vue réduite d'une marque, transmise aux agents en aval (AI_AGENTS.md §4 et §5).
 *
 * Le Store Builder Agent et le Product Agent ont besoin de l'identité de marque pour
 * aligner le thème et le ton de la réécriture, mais pas de l'entité complète : ce DTO
 * évite de faire fuiter les internes du contexte Branding vers les autres contextes
 * (ARCHITECTURE.md §6).
 */
export interface BrandSummary {
  readonly name: string;
  readonly positioning: string;
  readonly tone: string;
  readonly colorPalette: readonly PaletteColor[];
  readonly typography: { readonly heading: string; readonly body: string };
}
