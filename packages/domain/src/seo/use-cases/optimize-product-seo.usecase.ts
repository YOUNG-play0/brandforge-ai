import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  type ActionResult,
} from "@brandforge/shared";
import { SeoContent } from "../entities/seo-content.entity.js";
import type { ISeoAgent } from "../ports/seo-agent.port.js";
import type { ISeoContentRepository } from "../ports/seo-content-repository.port.js";
import type { IProductRepository } from "../../products/ports/product-repository.port.js";
import type { INicheAnalysisRepository } from "../../market-intelligence/ports/niche-analysis-repository.port.js";
import type { IClock, IIdGenerator } from "../../orchestration/ports/system.port.js";

/** Entrée de `optimizeProductSeo` (API.md §9). */
export interface OptimizeProductSeoInput {
  readonly productId: string;
  readonly targetKeywords?: readonly string[];
}

/**
 * Optimise la fiche d'un produit pour le référencement.
 *
 * À défaut de mots-clés explicites, reprend ceux de l'analyse de niche du projet
 * (AI_AGENTS.md §6) : c'est ce qui garantit la cohérence sémantique entre le
 * positionnement validé et les fiches publiées.
 */
export class OptimizeProductSeo {
  constructor(
    private readonly products: IProductRepository,
    private readonly seoContents: ISeoContentRepository,
    private readonly nicheAnalyses: INicheAnalysisRepository,
    private readonly seoAgent: ISeoAgent,
    private readonly idGenerator: IIdGenerator,
    private readonly clock: IClock,
  ) {}

  async execute(input: OptimizeProductSeoInput): Promise<ActionResult<SeoContent>> {
    const product = await this.products.findById(input.productId);
    if (product === null) {
      return actionFail(
        createAgentError(ERROR_CODES.PRODUCT_NOT_FOUND, "Produit introuvable.", false),
      );
    }

    const targetKeywords =
      input.targetKeywords ?? (await this.inheritedKeywords(product.storeProjectId));

    const executed = await this.seoAgent.execute({
      productId: product.id,
      title: product.effectiveTitle(),
      description: product.effectiveDescription(),
      ...(targetKeywords.length === 0 ? {} : { targetKeywords }),
    });

    if (!executed.success) {
      return actionFail(executed.error);
    }

    const content = SeoContent.create(
      {
        id: this.idGenerator.generate(),
        productId: product.id,
        targetKeywords: executed.output.targetKeywords,
        metaTitle: executed.output.metaTitle,
        metaDescription: executed.output.metaDescription,
        optimizedContent: executed.output.optimizedContent,
      },
      this.clock.now(),
    );

    await this.seoContents.save(content);

    product.markSeoOptimized(this.clock.now());
    await this.products.save(product);

    return actionOk(content);
  }

  private async inheritedKeywords(storeProjectId: string): Promise<readonly string[]> {
    const analysis = await this.nicheAnalyses.findByStoreProjectId(storeProjectId);
    return analysis?.keywords ?? [];
  }
}
