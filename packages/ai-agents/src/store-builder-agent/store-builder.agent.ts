import { agentFail, agentOk, type AgentResult } from "@brandforge/shared";
import {
  AgentName,
  type IAiProvider,
  type IEcommercePlatform,
  type IStoreBuilderAgent,
  type StoreBuilderAgentInput,
  type StoreBuilderAgentOutput,
  type StorePageType,
} from "@brandforge/domain";
import {
  STORE_BUILDER_SYSTEM_PROMPT,
  buildStoreBuilderPrompt,
} from "./store-builder-agent.prompt.js";
import { parseStorePlan } from "./store-builder.schema.js";

/**
 * Store Builder Agent — génère la structure de la boutique (AI_AGENTS.md §4).
 *
 * Combine deux ports : le modèle **conçoit** le contenu (collections, pages), la plateforme
 * le **crée** réellement. Un modèle génératif n'a jamais la main sur les effets de bord.
 *
 * En cas d'échec après création partielle, l'agent s'arrête net : une boutique à moitié
 * construite avec une erreur explicite vaut mieux qu'une structure incohérente présentée
 * comme un succès. Shopify n'offrant pas de transaction, une reprise peut recréer les
 * ressources déjà présentes (cf. docs/DECISIONS/0006).
 */
export class StoreBuilderAgent implements IStoreBuilderAgent {
  readonly name = AgentName.STORE_BUILDER;

  constructor(
    private readonly aiProvider: IAiProvider,
    private readonly platform: IEcommercePlatform,
  ) {}

  async execute(input: StoreBuilderAgentInput): Promise<AgentResult<StoreBuilderAgentOutput>> {
    const plan = await this.aiProvider.generateStructured({
      systemPrompt: STORE_BUILDER_SYSTEM_PROMPT,
      userPrompt: buildStoreBuilderPrompt(input),
      temperature: 0.7,
      parse: parseStorePlan,
    });

    if (!plan.success) {
      return agentFail(plan.error);
    }

    // Le thème conditionne l'apparence de tout le reste : sans lui, inutile de créer
    // collections et pages.
    const theme = await this.platform.applyTheme({
      storeProjectId: input.storeProjectId,
      brand: input.brand,
    });
    if (!theme.success) {
      return agentFail(theme.error);
    }

    const collectionsCreated: { id: string; title: string }[] = [];
    for (const collection of plan.output.collections) {
      const created = await this.platform.createCollection({
        storeProjectId: input.storeProjectId,
        title: collection.title,
        description: collection.description,
      });
      if (!created.success) {
        return agentFail(created.error);
      }
      collectionsCreated.push({ id: created.output.id, title: created.output.title });
    }

    const pagesCreated: { id: string; title: string; type: StorePageType }[] = [];
    for (const page of plan.output.pages) {
      const created = await this.platform.createPage({
        storeProjectId: input.storeProjectId,
        title: page.title,
        type: page.type,
        content: page.content,
      });
      if (!created.success) {
        return agentFail(created.error);
      }
      pagesCreated.push({ id: created.output.id, title: created.output.title, type: page.type });
    }

    return agentOk({
      shopifyThemeId: theme.output.themeId,
      collectionsCreated,
      pagesCreated,
    });
  }
}
