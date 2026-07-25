import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  type ActionResult,
} from "@brandforge/shared";
import { NicheAnalysis } from "../entities/niche-analysis.entity.js";
import { PriceRange } from "../value-objects/price-range.vo.js";
import { RelevanceScore } from "../value-objects/relevance-score.vo.js";
import type { IMarketAgent } from "../ports/market-agent.port.js";
import type { INicheAnalysisRepository } from "../ports/niche-analysis-repository.port.js";
import type { IStoreProjectRepository } from "../../orchestration/ports/store-project-repository.port.js";
import type { IClock, IIdGenerator } from "../../orchestration/ports/system.port.js";

/** Entrée de `analyzeNiche` (API.md §5) : la niche est déjà portée par le projet. */
export interface AnalyzeNicheInput {
  readonly storeProjectId: string;
  readonly additionalContext?: string;
}

/**
 * Produit l'analyse de niche d'un projet via le Market Agent, puis la persiste.
 *
 * La sortie de l'agent est convertie en value objects validés avant persistance : une
 * réponse IA malformée est rejetée ici et ne peut pas corrompre la base
 * (AI_AGENTS.md §9, règle 4).
 */
export class AnalyzeNiche {
  constructor(
    private readonly storeProjects: IStoreProjectRepository,
    private readonly nicheAnalyses: INicheAnalysisRepository,
    private readonly marketAgent: IMarketAgent,
    private readonly idGenerator: IIdGenerator,
    private readonly clock: IClock,
  ) {}

  async execute(input: AnalyzeNicheInput): Promise<ActionResult<NicheAnalysis>> {
    const project = await this.storeProjects.findById(input.storeProjectId);
    if (project === null) {
      return actionFail(
        createAgentError(ERROR_CODES.STORE_PROJECT_NOT_FOUND, "Projet introuvable.", false),
      );
    }

    const executed = await this.marketAgent.execute({
      niche: project.niche,
      targetMarket: project.targetMarket,
      ...(input.additionalContext === undefined
        ? {}
        : { additionalContext: input.additionalContext }),
    });

    if (!executed.success) {
      return actionFail(executed.error);
    }

    const output = executed.output;

    const priceRange = PriceRange.create(output.priceRange.min, output.priceRange.max);
    if (!priceRange.success) {
      return priceRange;
    }

    const relevanceScore = RelevanceScore.create(output.relevanceScore);
    if (!relevanceScore.success) {
      return relevanceScore;
    }

    const analysis = NicheAnalysis.create(
      {
        id: this.idGenerator.generate(),
        storeProjectId: project.id,
        keywords: output.keywords,
        competitors: output.competitors,
        priceRange: priceRange.data,
        relevanceScore: relevanceScore.data,
        differentiationAngle: output.differentiationAngle,
        rawAnalysis: output.rawAnalysis,
      },
      this.clock.now(),
    );

    await this.nicheAnalyses.save(analysis);

    return actionOk(analysis);
  }
}
