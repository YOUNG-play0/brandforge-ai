import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  type ActionResult,
} from "@brandforge/shared";
import { Brand } from "../entities/brand.entity.js";
import { ColorPalette } from "../value-objects/color-palette.vo.js";
import { Typography } from "../value-objects/typography.vo.js";
import type { BrandUserPreferences, IBrandAgent } from "../ports/brand-agent.port.js";
import type { IBrandRepository } from "../ports/brand-repository.port.js";
import type { INicheAnalysisRepository } from "../../market-intelligence/ports/niche-analysis-repository.port.js";
import type { IStoreProjectRepository } from "../../orchestration/ports/store-project-repository.port.js";
import type { IClock, IIdGenerator } from "../../orchestration/ports/system.port.js";

/** Entrée de `generateBrandOptions` (API.md §6). */
export interface GenerateBrandOptionsInput {
  readonly storeProjectId: string;
  readonly userPreferences?: BrandUserPreferences;
}

/**
 * Génère les propositions d'identité de marque à partir de l'analyse de niche validée.
 *
 * Exige une analyse **validée par l'utilisateur** : c'est ce qui matérialise le point de
 * validation bloquant entre l'étape Market et l'étape Branding (WORKFLOWS.md §3).
 */
export class GenerateBrandOptions {
  constructor(
    private readonly storeProjects: IStoreProjectRepository,
    private readonly nicheAnalyses: INicheAnalysisRepository,
    private readonly brands: IBrandRepository,
    private readonly brandAgent: IBrandAgent,
    private readonly idGenerator: IIdGenerator,
    private readonly clock: IClock,
  ) {}

  async execute(input: GenerateBrandOptionsInput): Promise<ActionResult<Brand>> {
    const project = await this.storeProjects.findById(input.storeProjectId);
    if (project === null) {
      return actionFail(
        createAgentError(ERROR_CODES.STORE_PROJECT_NOT_FOUND, "Projet introuvable.", false),
      );
    }

    const analysis = await this.nicheAnalyses.findByStoreProjectId(project.id);
    if (analysis === null) {
      return actionFail(
        createAgentError(
          ERROR_CODES.NICHE_ANALYSIS_NOT_FOUND,
          "L'analyse de niche doit être produite avant la génération de marque.",
          false,
        ),
      );
    }

    if (!analysis.validatedByUser) {
      return actionFail(
        createAgentError(
          ERROR_CODES.INVALID_PIPELINE_STATE,
          "L'analyse de niche doit être validée par l'utilisateur avant la génération de marque.",
          false,
        ),
      );
    }

    const executed = await this.brandAgent.execute({
      nicheAnalysis: {
        niche: project.niche,
        targetMarket: project.targetMarket,
        keywords: analysis.keywords,
        competitors: analysis.competitors,
        priceRange: { min: analysis.priceRange.min, max: analysis.priceRange.max },
        differentiationAngle: analysis.differentiationAngle,
      },
      ...(input.userPreferences === undefined ? {} : { userPreferences: input.userPreferences }),
    });

    if (!executed.success) {
      return actionFail(executed.error);
    }

    const output = executed.output;

    const palette = ColorPalette.create(output.colorPalette);
    if (!palette.success) {
      return palette;
    }

    const typography = Typography.create(output.typography.heading, output.typography.body);
    if (!typography.success) {
      return typography;
    }

    const brand = Brand.create(
      {
        id: this.idGenerator.generate(),
        storeProjectId: project.id,
        nameOptions: output.nameOptions,
        positioning: output.positioning,
        tone: output.tone,
        colorPalette: palette.data,
        typography: typography.data,
        logoBriefing: output.logoBriefing,
      },
      this.clock.now(),
    );

    if (!brand.success) {
      return brand;
    }

    await this.brands.save(brand.data);

    return actionOk(brand.data);
  }
}
