import type { AssetType } from "@brandforge/domain";
import { Brand, BrandAsset, ColorPalette, Typography, type PaletteColor } from "@brandforge/domain";
import {
  ERROR_CODES,
  InfrastructureError,
  createAgentError,
  type ActionResult,
} from "@brandforge/shared";
import type { Prisma, Brand as PrismaBrand, BrandAsset as PrismaBrandAsset } from "@prisma/client";

/** Forme JSON persistée de la typographie. */
interface TypographyJson {
  readonly heading: string;
  readonly body: string;
}

/** Conversion `Brand` ↔ ligne Prisma. */
export function toBrandDomain(row: PrismaBrand): Brand {
  const palette = unwrap(
    ColorPalette.create(row.colorPalette as unknown as readonly PaletteColor[]),
    "Brand.colorPalette",
  );
  const typographyJson = row.typography as unknown as TypographyJson;
  const typography = unwrap(
    Typography.create(typographyJson.heading, typographyJson.body),
    "Brand.typography",
  );

  return Brand.reconstitute({
    id: row.id,
    storeProjectId: row.storeProjectId,
    nameOptions: row.nameOptions,
    name: row.name,
    positioning: row.positioning,
    tone: row.tone,
    colorPalette: palette,
    typography,
    logoBriefing: row.logoBriefing,
    logoUrl: row.logoUrl,
    validatedByUser: row.validatedByUser,
    createdAt: row.createdAt,
  });
}

/** Champs persistés d'une marque. */
export function toBrandPersistence(brand: Brand): {
  nameOptions: string[];
  name: string | null;
  positioning: string;
  tone: string;
  colorPalette: Prisma.InputJsonValue;
  typography: Prisma.InputJsonValue;
  logoBriefing: string;
  logoUrl: string | null;
  validatedByUser: boolean;
} {
  const snapshot = brand.toSnapshot();
  return {
    nameOptions: [...snapshot.nameOptions],
    name: snapshot.name,
    positioning: snapshot.positioning,
    tone: snapshot.tone,
    colorPalette: snapshot.colorPalette.colors as unknown as Prisma.InputJsonValue,
    typography: {
      heading: snapshot.typography.heading,
      body: snapshot.typography.body,
    },
    logoBriefing: snapshot.logoBriefing,
    logoUrl: snapshot.logoUrl,
    validatedByUser: snapshot.validatedByUser,
  };
}

/** Conversion `BrandAsset` ↔ ligne Prisma. */
export function toBrandAssetDomain(row: PrismaBrandAsset): BrandAsset {
  return BrandAsset.reconstitute({
    id: row.id,
    brandId: row.brandId,
    type: row.type as AssetType,
    url: row.url,
    createdAt: row.createdAt,
  });
}

function unwrap<T>(result: ActionResult<T>, field: string): T {
  if (!result.success) {
    throw new InfrastructureError(
      createAgentError(
        ERROR_CODES.DATABASE_ERROR,
        `Donnée persistée incohérente pour ${field} : ${result.error.message}`,
        false,
      ),
    );
  }
  return result.data;
}
