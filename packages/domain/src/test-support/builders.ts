/**
 * Constructeurs d'entités valides pour les tests.
 *
 * Évitent de répéter la construction des value objects dans chaque test et garantissent
 * que les fixtures respectent bien les invariants du domaine.
 */
import { Brand } from "../branding/entities/brand.entity.js";
import { ColorPalette } from "../branding/value-objects/color-palette.vo.js";
import { Typography } from "../branding/value-objects/typography.vo.js";
import { NicheAnalysis } from "../market-intelligence/entities/niche-analysis.entity.js";
import { PriceRange } from "../market-intelligence/value-objects/price-range.vo.js";
import { RelevanceScore } from "../market-intelligence/value-objects/relevance-score.vo.js";
import { StoreProject } from "../orchestration/entities/store-project.entity.js";
import { Product } from "../products/entities/product.entity.js";
import { Price } from "../products/value-objects/price.vo.js";
import { ProductSource } from "../products/value-objects/product-status.vo.js";

/** Déballe un `ActionResult` attendu comme succès, ou échoue bruyamment. */
function expectOk<T>(result: { success: true; data: T } | { success: false; error: unknown }): T {
  if (!result.success) {
    throw new Error(`Fixture invalide : ${JSON.stringify(result.error)}`);
  }
  return result.data;
}

export const TEST_USER_ID = "user-1";

/** Projet « lunettes de soleil » — le cas d'usage réel du MVP (PRD.md §2.3). */
export function aStoreProject(
  overrides: Partial<{ id: string; userId: string; niche: string; targetMarket: string }> = {},
): StoreProject {
  return expectOk(
    StoreProject.create({
      id: overrides.id ?? "project-1",
      userId: overrides.userId ?? TEST_USER_ID,
      name: "Projet lunettes",
      niche: overrides.niche ?? "lunettes de soleil",
      targetMarket: overrides.targetMarket ?? "France",
    }),
  );
}

export function aNicheAnalysis(
  overrides: Partial<{ id: string; storeProjectId: string; validated: boolean }> = {},
): NicheAnalysis {
  const analysis = NicheAnalysis.create({
    id: overrides.id ?? "analysis-1",
    storeProjectId: overrides.storeProjectId ?? "project-1",
    keywords: ["lunettes de soleil polarisées", "lunettes premium"],
    competitors: [
      {
        name: "Izipizi",
        url: "https://www.izipizi.com",
        positioning: "Lunettes colorées accessibles",
        estimatedPriceRange: { min: 30, max: 60 },
      },
    ],
    priceRange: expectOk(PriceRange.create(80, 200)),
    relevanceScore: expectOk(RelevanceScore.create(0.82)),
    differentiationAngle: "Montures françaises en acétate bio",
    rawAnalysis: { model: "test" },
  });

  if (overrides.validated ?? false) {
    analysis.approve();
  }

  return analysis;
}

/** Marque générée ; `named: true` simule le nom déjà validé par l'utilisateur. */
export function aBrand(
  overrides: Partial<{ id: string; storeProjectId: string; named: boolean }> = {},
): Brand {
  const brand = expectOk(
    Brand.create({
      id: overrides.id ?? "brand-1",
      storeProjectId: overrides.storeProjectId ?? "project-1",
      nameOptions: ["Solaris", "Lumen", "Éclat"],
      positioning: "Lunettes premium fabriquées en France",
      tone: "premium, épuré, confiant",
      colorPalette: expectOk(
        ColorPalette.create([
          { hex: "#1A1A1A", role: "primary" },
          { hex: "#C9A227", role: "accent" },
        ]),
      ),
      typography: expectOk(Typography.create("Playfair Display", "Inter")),
      logoBriefing: "Monogramme minimaliste doré sur fond noir",
    }),
  );

  if (overrides.named ?? true) {
    expectOk(brand.selectName("Solaris"));
  }

  return brand;
}

export function aProduct(
  overrides: Partial<{ id: string; storeProjectId: string; price: number }> = {},
): Product {
  return expectOk(
    Product.create({
      id: overrides.id ?? "product-1",
      storeProjectId: overrides.storeProjectId ?? "project-1",
      sourceUrl: "https://www.aliexpress.com/item/123.html",
      sourcePlatform: ProductSource.ALIEXPRESS,
      originalTitle: "Sunglasses Polarized UV400 Men Women",
      originalDescription: "High quality polarized sunglasses for driving and fishing.",
      images: ["https://cdn.example.com/img-1.jpg"],
      price: expectOk(Price.create(overrides.price ?? 12.5)),
    }),
  );
}
