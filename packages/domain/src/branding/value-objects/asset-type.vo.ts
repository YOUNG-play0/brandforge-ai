/**
 * Nature d'un asset de marque (DATABASE.md §4).
 *
 * Enum déjà dimensionné pour les besoins V2 (variantes de logo, Brand Book PDF) afin
 * d'éviter une migration lourde lors de l'ajout de l'Image Agent (DATABASE.md §5).
 */
export enum AssetType {
  LOGO = "LOGO",
  LOGO_VARIANT = "LOGO_VARIANT",
  BRAND_BOOK_PDF = "BRAND_BOOK_PDF",
  COLOR_SWATCH = "COLOR_SWATCH",
}
