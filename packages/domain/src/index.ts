/**
 * Point d'entrée public de `@brandforge/domain`.
 *
 * Seul ce fichier expose le cœur métier vers l'extérieur (`apps/web`, `ai-agents`,
 * `infrastructure`) : les exports sont listés explicitement, aucun réexport en vrac
 * (CODING_STANDARDS.md §3).
 */

// ============================================================================
// Orchestration
// ============================================================================
export { PipelineStatus } from "./orchestration/value-objects/pipeline-status.vo.js";
export { AgentName, MVP_PIPELINE_SEQUENCE } from "./orchestration/value-objects/agent-name.vo.js";
export { StepStatus, isStepCompleted } from "./orchestration/value-objects/step-status.vo.js";

export { StoreProject } from "./orchestration/entities/store-project.entity.js";
export type {
  CreateStoreProjectProps,
  StoreProjectSnapshot,
} from "./orchestration/entities/store-project.entity.js";
export { PipelineRun } from "./orchestration/entities/pipeline-run.entity.js";
export type { PipelineRunSnapshot } from "./orchestration/entities/pipeline-run.entity.js";
export { PipelineStep } from "./orchestration/entities/pipeline-step.entity.js";
export type { PipelineStepSnapshot } from "./orchestration/entities/pipeline-step.entity.js";

export type { Agent } from "./orchestration/ports/agent.port.js";
export type {
  IAiProvider,
  AiRequestOptions,
  AiCompletionRequest,
  AiTextRequest,
} from "./orchestration/ports/ai-provider.port.js";
export type { IClock, IIdGenerator } from "./orchestration/ports/system.port.js";
export type { IStoreProjectRepository } from "./orchestration/ports/store-project-repository.port.js";
export type { IPipelineRepository } from "./orchestration/ports/pipeline-repository.port.js";
export type {
  IPipelineOrchestrator,
  PipelineExecutionState,
} from "./orchestration/ports/pipeline-orchestrator.port.js";

export { CreateStoreProject } from "./orchestration/use-cases/create-store-project.usecase.js";
export type {
  CreateStoreProjectInput,
  CreateStoreProjectOutput,
} from "./orchestration/use-cases/create-store-project.usecase.js";
export { GetStoreProjectDetail } from "./orchestration/use-cases/get-store-project-detail.usecase.js";
export type {
  GetStoreProjectDetailInput,
  StoreProjectDetail,
  LastKnownStep,
} from "./orchestration/use-cases/get-store-project-detail.usecase.js";
export { ListStoreProjects } from "./orchestration/use-cases/list-store-projects.usecase.js";
export type {
  ListStoreProjectsInput,
  StoreProjectSummary,
} from "./orchestration/use-cases/list-store-projects.usecase.js";
export { StartPipeline } from "./orchestration/use-cases/start-pipeline.usecase.js";
export type { StartPipelineInput } from "./orchestration/use-cases/start-pipeline.usecase.js";
export { ResumePipeline } from "./orchestration/use-cases/resume-pipeline.usecase.js";
export type { ResumePipelineInput } from "./orchestration/use-cases/resume-pipeline.usecase.js";
export { GetPipelineStatus } from "./orchestration/use-cases/get-pipeline-status.usecase.js";
export type {
  GetPipelineStatusInput,
  PipelineStatusView,
  PipelineStepSummary,
} from "./orchestration/use-cases/get-pipeline-status.usecase.js";

// ============================================================================
// Market Intelligence
// ============================================================================
export { PriceRange } from "./market-intelligence/value-objects/price-range.vo.js";
export { RelevanceScore } from "./market-intelligence/value-objects/relevance-score.vo.js";
export type { Competitor } from "./market-intelligence/value-objects/competitor.vo.js";
export type { NicheAnalysisSummary } from "./market-intelligence/value-objects/niche-analysis-summary.vo.js";

export { NicheAnalysis } from "./market-intelligence/entities/niche-analysis.entity.js";
export type {
  CreateNicheAnalysisProps,
  NicheAnalysisSnapshot,
} from "./market-intelligence/entities/niche-analysis.entity.js";

export type {
  IMarketAgent,
  MarketAgentInput,
  MarketAgentOutput,
} from "./market-intelligence/ports/market-agent.port.js";
export type { INicheAnalysisRepository } from "./market-intelligence/ports/niche-analysis-repository.port.js";

export { AnalyzeNiche } from "./market-intelligence/use-cases/analyze-niche.usecase.js";
export type { AnalyzeNicheInput } from "./market-intelligence/use-cases/analyze-niche.usecase.js";
export { ValidateNicheAnalysis } from "./market-intelligence/use-cases/validate-niche-analysis.usecase.js";
export type {
  ValidateNicheAnalysisInput,
  ValidateNicheAnalysisOutput,
} from "./market-intelligence/use-cases/validate-niche-analysis.usecase.js";

// ============================================================================
// Branding
// ============================================================================
export { ColorPalette } from "./branding/value-objects/color-palette.vo.js";
export type { ColorRole, PaletteColor } from "./branding/value-objects/color-palette.vo.js";
export { Typography } from "./branding/value-objects/typography.vo.js";
export { AssetType } from "./branding/value-objects/asset-type.vo.js";
export type { BrandSummary } from "./branding/value-objects/brand-summary.vo.js";

export { Brand } from "./branding/entities/brand.entity.js";
export type { CreateBrandProps, BrandSnapshot } from "./branding/entities/brand.entity.js";
export { BrandAsset } from "./branding/entities/brand-asset.entity.js";
export type { BrandAssetSnapshot } from "./branding/entities/brand-asset.entity.js";

export type {
  IBrandAgent,
  BrandAgentInput,
  BrandAgentOutput,
  BrandUserPreferences,
} from "./branding/ports/brand-agent.port.js";
export type { IBrandRepository } from "./branding/ports/brand-repository.port.js";

export { GenerateBrandOptions } from "./branding/use-cases/generate-brand-options.usecase.js";
export type { GenerateBrandOptionsInput } from "./branding/use-cases/generate-brand-options.usecase.js";
export { SelectBrandName } from "./branding/use-cases/select-brand-name.usecase.js";
export type {
  SelectBrandNameInput,
  SelectBrandNameOutput,
} from "./branding/use-cases/select-brand-name.usecase.js";

// ============================================================================
// Store Building
// ============================================================================
export { StoreStructure } from "./store-building/entities/store-structure.entity.js";
export type {
  StoreCollection,
  StorePage,
} from "./store-building/entities/store-structure.entity.js";
export type {
  IStoreBuilderAgent,
  StoreBuilderAgentInput,
  StoreBuilderAgentOutput,
} from "./store-building/ports/store-builder-agent.port.js";
export { BuildStoreStructure } from "./store-building/use-cases/build-store-structure.usecase.js";
export type { BuildStoreStructureInput } from "./store-building/use-cases/build-store-structure.usecase.js";

// ============================================================================
// Products
// ============================================================================
export { ProductStatus, ProductSource } from "./products/value-objects/product-status.vo.js";
export { Price } from "./products/value-objects/price.vo.js";

export { Product } from "./products/entities/product.entity.js";
export type { CreateProductProps, ProductSnapshot } from "./products/entities/product.entity.js";

export type {
  IProductAgent,
  ProductAgentInput,
  ProductAgentOutput,
  RawProductInput,
} from "./products/ports/product-agent.port.js";
export type { IProductSource } from "./products/ports/product-source.port.js";
export type { IProductRepository } from "./products/ports/product-repository.port.js";

export { ImportProduct } from "./products/use-cases/import-product.usecase.js";
export type {
  ImportProductInput,
  ImportProductOutput,
} from "./products/use-cases/import-product.usecase.js";
export { ImportProductsBatch } from "./products/use-cases/import-products-batch.usecase.js";
export type {
  ImportProductsBatchInput,
  ImportProductsBatchOutput,
  BatchImportFailure,
} from "./products/use-cases/import-products-batch.usecase.js";
export { ListProducts } from "./products/use-cases/list-products.usecase.js";
export type {
  ListProductsInput,
  ProductSummary,
} from "./products/use-cases/list-products.usecase.js";

// ============================================================================
// SEO
// ============================================================================
export { SeoContent } from "./seo/entities/seo-content.entity.js";
export type {
  CreateSeoContentProps,
  SeoContentSnapshot,
} from "./seo/entities/seo-content.entity.js";
export type { ISeoAgent, SeoAgentInput, SeoAgentOutput } from "./seo/ports/seo-agent.port.js";
export type { ISeoContentRepository } from "./seo/ports/seo-content-repository.port.js";
export { OptimizeProductSeo } from "./seo/use-cases/optimize-product-seo.usecase.js";
export type { OptimizeProductSeoInput } from "./seo/use-cases/optimize-product-seo.usecase.js";

// ============================================================================
// Publishing
// ============================================================================
export type {
  IEcommercePlatform,
  StorePageType,
  CreatedResource,
  ApplyThemeInput,
  CreateCollectionInput,
  CreatePageInput,
  PlatformProductInput,
  PublishedProduct,
} from "./publishing/ports/ecommerce-platform.port.js";
export type {
  IShopifyAgent,
  ShopifyAgentInput,
  ShopifyAgentOutput,
  ShopifyAgentAction,
} from "./publishing/ports/shopify-agent.port.js";

export { PublishStore } from "./publishing/use-cases/publish-store.usecase.js";
export type {
  PublishStoreInput,
  PublishStoreOutput,
} from "./publishing/use-cases/publish-store.usecase.js";
export { PublishProduct } from "./publishing/use-cases/publish-product.usecase.js";
export type {
  PublishProductInput,
  PublishProductOutput,
} from "./publishing/use-cases/publish-product.usecase.js";
export { SyncProduct } from "./publishing/use-cases/sync-product.usecase.js";
export type {
  SyncProductInput,
  SyncProductOutput,
} from "./publishing/use-cases/sync-product.usecase.js";
