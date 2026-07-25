/**
 * Fixtures de lignes Prisma pour les tests.
 *
 * Reproduisent la forme exacte renvoyée par le client généré (`Decimal`, `Json`, dates)
 * afin que les mappers soient testés sur des données réalistes, sans base réelle.
 */
import {
  AgentName,
  AssetType,
  PipelineStatus,
  ProductSource,
  ProductStatus,
  StepStatus,
} from "@brandforge/domain";
import { Prisma } from "@prisma/client";
import type {
  Brand as PrismaBrand,
  BrandAsset as PrismaBrandAsset,
  NicheAnalysis as PrismaNicheAnalysis,
  PipelineStep as PrismaPipelineStep,
  Product as PrismaProduct,
  SeoContent as PrismaSeoContent,
  StoreProject as PrismaStoreProject,
} from "@prisma/client";
import type { PrismaPipelineRunWithSteps } from "../database/mappers/pipeline.mapper.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

export function aStoreProjectRow(overrides: Partial<PrismaStoreProject> = {}): PrismaStoreProject {
  return {
    id: "project-1",
    userId: "user-1",
    name: "Projet lunettes",
    niche: "lunettes de soleil",
    targetMarket: "France",
    status: PipelineStatus.DRAFT,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function aNicheAnalysisRow(
  overrides: Partial<PrismaNicheAnalysis> = {},
): PrismaNicheAnalysis {
  return {
    id: "analysis-1",
    storeProjectId: "project-1",
    keywords: ["lunettes de soleil polarisées"],
    competitors: [
      {
        name: "Izipizi",
        url: "https://www.izipizi.com",
        positioning: "Accessible",
        estimatedPriceRange: { min: 30, max: 60 },
      },
    ],
    priceRangeMin: new Prisma.Decimal(80),
    priceRangeMax: new Prisma.Decimal(200),
    relevanceScore: 0.82,
    differentiationAngle: "Montures françaises en acétate bio",
    rawAnalysis: { model: "test" },
    validatedByUser: true,
    createdAt: NOW,
    ...overrides,
  };
}

export function aBrandRow(overrides: Partial<PrismaBrand> = {}): PrismaBrand {
  return {
    id: "brand-1",
    storeProjectId: "project-1",
    nameOptions: ["Solaris", "Lumen", "Éclat"],
    name: "Solaris",
    positioning: "Lunettes premium fabriquées en France",
    tone: "premium, épuré, confiant",
    colorPalette: [
      { hex: "#1A1A1A", role: "primary" },
      { hex: "#C9A227", role: "accent" },
    ],
    typography: {
      heading: "Playfair Display",
      body: "Inter",
    },
    logoBriefing: "Monogramme minimaliste doré",
    logoUrl: null,
    validatedByUser: true,
    createdAt: NOW,
    ...overrides,
  };
}

export function aBrandAssetRow(overrides: Partial<PrismaBrandAsset> = {}): PrismaBrandAsset {
  return {
    id: "asset-1",
    brandId: "brand-1",
    type: AssetType.LOGO,
    url: "https://cdn.example.com/logo.png",
    createdAt: NOW,
    ...overrides,
  };
}

export function aProductRow(overrides: Partial<PrismaProduct> = {}): PrismaProduct {
  return {
    id: "product-1",
    storeProjectId: "project-1",
    sourceUrl: "https://www.aliexpress.com/item/123.html",
    sourcePlatform: ProductSource.ALIEXPRESS,
    originalTitle: "Sunglasses Polarized UV400",
    rewrittenTitle: null,
    originalDescription: "High quality polarized sunglasses.",
    rewrittenDescription: null,
    images: ["https://cdn.example.com/img-1.jpg"],
    price: new Prisma.Decimal(12.5),
    shopifyProductId: null,
    status: ProductStatus.IMPORTED,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function aSeoContentRow(overrides: Partial<PrismaSeoContent> = {}): PrismaSeoContent {
  return {
    id: "seo-1",
    productId: "product-1",
    targetKeywords: ["lunettes de soleil polarisées"],
    metaTitle: "Lunettes polarisées premium | Solaris",
    metaDescription: "Montures en acétate bio, verres polarisés.",
    optimizedContent: "Contenu optimisé.",
    createdAt: NOW,
    ...overrides,
  };
}

export function aPipelineStepRow(overrides: Partial<PrismaPipelineStep> = {}): PrismaPipelineStep {
  return {
    id: "step-1",
    pipelineRunId: "run-1",
    agentName: AgentName.MARKET,
    status: StepStatus.PENDING,
    input: { niche: "lunettes de soleil" },
    output: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    position: 0,
    ...overrides,
  };
}

export function aPipelineRunRow(
  overrides: Partial<PrismaPipelineRunWithSteps> = {},
): PrismaPipelineRunWithSteps {
  return {
    id: "run-1",
    storeProjectId: "project-1",
    status: PipelineStatus.RUNNING,
    startedAt: NOW,
    finishedAt: null,
    steps: [aPipelineStepRow()],
    ...overrides,
  };
}
