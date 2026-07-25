/**
 * Doublures en mémoire des ports du domaine, réservées aux tests.
 *
 * Permettent de tester chaque use case sans base de données ni appel réseau
 * (CODING_STANDARDS.md §7). Ce module n'est jamais exporté par `index.ts` : il ne fait
 * pas partie de l'API publique du package.
 */
import {
  agentFail,
  agentOk,
  createAgentError,
  type AgentResult,
  type ErrorCode,
} from "@brandforge/shared";
import type { Brand } from "../branding/entities/brand.entity.js";
import type { BrandAsset } from "../branding/entities/brand-asset.entity.js";
import type { IBrandRepository } from "../branding/ports/brand-repository.port.js";
import type { NicheAnalysis } from "../market-intelligence/entities/niche-analysis.entity.js";
import type { INicheAnalysisRepository } from "../market-intelligence/ports/niche-analysis-repository.port.js";
import type { PipelineRun } from "../orchestration/entities/pipeline-run.entity.js";
import type { StoreProject } from "../orchestration/entities/store-project.entity.js";
import type { Agent } from "../orchestration/ports/agent.port.js";
import type { AgentName } from "../orchestration/value-objects/agent-name.vo.js";
import type { IPipelineRepository } from "../orchestration/ports/pipeline-repository.port.js";
import type { IStoreProjectRepository } from "../orchestration/ports/store-project-repository.port.js";
import type { IClock, IIdGenerator } from "../orchestration/ports/system.port.js";
import type { Product } from "../products/entities/product.entity.js";
import type { IProductRepository } from "../products/ports/product-repository.port.js";
import type { SeoContent } from "../seo/entities/seo-content.entity.js";
import type { ISeoContentRepository } from "../seo/ports/seo-content-repository.port.js";

/** Horloge figée : rend les assertions sur les dates déterministes. */
export class FakeClock implements IClock {
  constructor(private current: Date = new Date("2026-01-01T00:00:00.000Z")) {}

  now(): Date {
    return this.current;
  }

  advanceTo(date: Date): void {
    this.current = date;
  }
}

/** Générateur d'identifiants séquentiels et prévisibles. */
export class FakeIdGenerator implements IIdGenerator {
  private counter = 0;

  constructor(private readonly prefix = "id") {}

  generate(): string {
    this.counter += 1;
    return `${this.prefix}-${String(this.counter)}`;
  }
}

export class InMemoryStoreProjectRepository implements IStoreProjectRepository {
  private readonly items = new Map<string, StoreProject>();

  async save(project: StoreProject): Promise<void> {
    this.items.set(project.id, project);
  }

  async findById(storeProjectId: string): Promise<StoreProject | null> {
    return this.items.get(storeProjectId) ?? null;
  }

  async findByUserId(userId: string): Promise<readonly StoreProject[]> {
    return [...this.items.values()].filter((project) => project.belongsTo(userId));
  }
}

export class InMemoryPipelineRepository implements IPipelineRepository {
  private readonly items = new Map<string, PipelineRun>();

  async save(run: PipelineRun): Promise<void> {
    this.items.set(run.id, run);
  }

  async findById(pipelineRunId: string): Promise<PipelineRun | null> {
    return this.items.get(pipelineRunId) ?? null;
  }

  async findLatestByStoreProjectId(storeProjectId: string): Promise<PipelineRun | null> {
    return (
      [...this.items.values()]
        .filter((run) => run.storeProjectId === storeProjectId)
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
        .at(-1) ?? null
    );
  }
}

export class InMemoryNicheAnalysisRepository implements INicheAnalysisRepository {
  private readonly items = new Map<string, NicheAnalysis>();

  async save(analysis: NicheAnalysis): Promise<void> {
    this.items.set(analysis.storeProjectId, analysis);
  }

  async findByStoreProjectId(storeProjectId: string): Promise<NicheAnalysis | null> {
    return this.items.get(storeProjectId) ?? null;
  }
}

export class InMemoryBrandRepository implements IBrandRepository {
  private readonly items = new Map<string, Brand>();
  private readonly assets: BrandAsset[] = [];

  async save(brand: Brand): Promise<void> {
    this.items.set(brand.id, brand);
  }

  async findById(brandId: string): Promise<Brand | null> {
    return this.items.get(brandId) ?? null;
  }

  async findByStoreProjectId(storeProjectId: string): Promise<Brand | null> {
    return (
      [...this.items.values()].find((brand) => brand.storeProjectId === storeProjectId) ?? null
    );
  }

  async saveAsset(asset: BrandAsset): Promise<void> {
    this.assets.push(asset);
  }

  async findAssetsByBrandId(brandId: string): Promise<readonly BrandAsset[]> {
    return this.assets.filter((asset) => asset.brandId === brandId);
  }
}

export class InMemoryProductRepository implements IProductRepository {
  private readonly items = new Map<string, Product>();

  async save(product: Product): Promise<void> {
    this.items.set(product.id, product);
  }

  async findById(productId: string): Promise<Product | null> {
    return this.items.get(productId) ?? null;
  }

  async findByStoreProjectId(storeProjectId: string): Promise<readonly Product[]> {
    return [...this.items.values()].filter((product) => product.storeProjectId === storeProjectId);
  }
}

export class InMemorySeoContentRepository implements ISeoContentRepository {
  private readonly items = new Map<string, SeoContent>();

  async save(content: SeoContent): Promise<void> {
    if (content.productId !== null) {
      this.items.set(content.productId, content);
    }
  }

  async findByProductId(productId: string): Promise<SeoContent | null> {
    return this.items.get(productId) ?? null;
  }
}

/** Agent de test, doublure complète du port `Agent` avec journal des appels. */
export interface StubAgent<TInput, TOutput> extends Agent<TInput, TOutput> {
  /** Entrées successivement reçues, pour vérifier ce que le use case transmet. */
  readonly calls: TInput[];
}

/** Agent de test qui retourne toujours la sortie fournie. */
export function stubAgentOk<TInput, TOutput>(
  name: AgentName,
  output: TOutput,
): StubAgent<TInput, TOutput> {
  const calls: TInput[] = [];
  return {
    name,
    calls,
    execute: async (input: TInput): Promise<AgentResult<TOutput>> => {
      calls.push(input);
      return agentOk(output);
    },
  };
}

/** Agent de test qui échoue systématiquement avec l'erreur donnée. */
export function stubAgentFail<TInput, TOutput>(
  name: AgentName,
  code: ErrorCode,
  retryable = false,
): StubAgent<TInput, TOutput> {
  const calls: TInput[] = [];
  return {
    name,
    calls,
    execute: async (input: TInput): Promise<AgentResult<TOutput>> => {
      calls.push(input);
      return agentFail<TOutput>(createAgentError(code, `Échec simulé : ${code}`, retryable));
    },
  };
}
