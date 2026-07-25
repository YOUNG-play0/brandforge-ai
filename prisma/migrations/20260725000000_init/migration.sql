-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'FAILED', 'PAUSED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('LOGO', 'LOGO_VARIANT', 'BRAND_BOOK_PDF', 'COLOR_SWATCH');

-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('ALIEXPRESS', 'MANUAL');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('IMPORTED', 'REWRITTEN', 'SEO_OPTIMIZED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "AgentName" AS ENUM ('MARKET', 'BRAND', 'STORE_BUILDER', 'PRODUCT', 'SEO', 'IMAGE', 'SHOPIFY', 'BLOG', 'MARKETING');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "targetMarket" TEXT NOT NULL,
    "status" "PipelineStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NicheAnalysis" (
    "id" TEXT NOT NULL,
    "storeProjectId" TEXT NOT NULL,
    "keywords" TEXT[],
    "competitors" JSONB NOT NULL,
    "priceRangeMin" DECIMAL(12,2) NOT NULL,
    "priceRangeMax" DECIMAL(12,2) NOT NULL,
    "relevanceScore" DOUBLE PRECISION NOT NULL,
    "differentiationAngle" TEXT NOT NULL,
    "rawAnalysis" JSONB NOT NULL,
    "validatedByUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NicheAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "storeProjectId" TEXT NOT NULL,
    "nameOptions" TEXT[],
    "name" TEXT,
    "positioning" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "colorPalette" JSONB NOT NULL,
    "typography" JSONB NOT NULL,
    "logoBriefing" TEXT NOT NULL,
    "logoUrl" TEXT,
    "validatedByUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandAsset" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "storeProjectId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourcePlatform" "ProductSource" NOT NULL,
    "originalTitle" TEXT NOT NULL,
    "rewrittenTitle" TEXT,
    "originalDescription" TEXT NOT NULL,
    "rewrittenDescription" TEXT,
    "images" TEXT[],
    "price" DECIMAL(12,2) NOT NULL,
    "shopifyProductId" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'IMPORTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoContent" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "targetKeywords" TEXT[],
    "metaTitle" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "optimizedContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL,
    "storeProjectId" TEXT NOT NULL,
    "status" "PipelineStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStep" (
    "id" TEXT NOT NULL,
    "pipelineRunId" TEXT NOT NULL,
    "agentName" "AgentName" NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB NOT NULL,
    "output" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL,

    CONSTRAINT "PipelineStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "StoreProject_userId_updatedAt_idx" ON "StoreProject"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NicheAnalysis_storeProjectId_key" ON "NicheAnalysis"("storeProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_storeProjectId_key" ON "Brand"("storeProjectId");

-- CreateIndex
CREATE INDEX "BrandAsset_brandId_idx" ON "BrandAsset"("brandId");

-- CreateIndex
CREATE INDEX "Product_storeProjectId_idx" ON "Product"("storeProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SeoContent_productId_key" ON "SeoContent"("productId");

-- CreateIndex
CREATE INDEX "PipelineRun_storeProjectId_startedAt_idx" ON "PipelineRun"("storeProjectId", "startedAt");

-- CreateIndex
CREATE INDEX "PipelineStep_pipelineRunId_idx" ON "PipelineStep"("pipelineRunId");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStep_pipelineRunId_position_key" ON "PipelineStep"("pipelineRunId", "position");

-- AddForeignKey
ALTER TABLE "StoreProject" ADD CONSTRAINT "StoreProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NicheAnalysis" ADD CONSTRAINT "NicheAnalysis_storeProjectId_fkey" FOREIGN KEY ("storeProjectId") REFERENCES "StoreProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_storeProjectId_fkey" FOREIGN KEY ("storeProjectId") REFERENCES "StoreProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_storeProjectId_fkey" FOREIGN KEY ("storeProjectId") REFERENCES "StoreProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoContent" ADD CONSTRAINT "SeoContent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_storeProjectId_fkey" FOREIGN KEY ("storeProjectId") REFERENCES "StoreProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStep" ADD CONSTRAINT "PipelineStep_pipelineRunId_fkey" FOREIGN KEY ("pipelineRunId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

