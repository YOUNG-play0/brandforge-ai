/**
 * Point d'entrée public de `@brandforge/infrastructure`.
 *
 * Implémentations concrètes des ports du domaine. Seule couche autorisée à lire les
 * variables d'environnement (CODING_STANDARDS.md §9) et à convertir les erreurs
 * techniques en erreurs typées (CODING_STANDARDS.md §5).
 *
 * Les exports sont listés explicitement (CODING_STANDARDS.md §3).
 */

// --- Configuration ---
export { requireEnv, optionalNumberEnv, loadDatabaseConfig } from "./config/env.js";
export type { DatabaseConfig } from "./config/env.js";

// --- Base de données ---
export { getPrismaClient } from "./database/prisma-client.js";
export type { PrismaDatabase } from "./database/prisma-client.js";
export { toInfrastructureError, runQuery } from "./database/prisma-error-mapper.js";

export { PrismaStoreProjectRepository } from "./database/repositories/prisma-store-project.repository.js";
export { PrismaPipelineRepository } from "./database/repositories/prisma-pipeline.repository.js";
export { PrismaNicheAnalysisRepository } from "./database/repositories/prisma-niche-analysis.repository.js";
export { PrismaBrandRepository } from "./database/repositories/prisma-brand.repository.js";
export { PrismaProductRepository } from "./database/repositories/prisma-product.repository.js";
export { PrismaSeoContentRepository } from "./database/repositories/prisma-seo-content.repository.js";

// --- Fournisseur IA ---
export { GroqAiProvider } from "./ai-provider/groq-ai-provider.js";
export type { FetchLike } from "./ai-provider/groq-ai-provider.js";
export { loadGroqConfig } from "./ai-provider/groq-config.js";
export type { GroqConfig } from "./ai-provider/groq-config.js";

// --- Ports techniques transverses ---
export { UuidGenerator, SystemClock } from "./system/system-adapters.js";
