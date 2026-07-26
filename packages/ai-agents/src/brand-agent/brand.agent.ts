import {
  ERROR_CODES,
  agentFail,
  agentOk,
  createAgentError,
  type AgentResult,
} from "@brandforge/shared";
import {
  AgentName,
  type BrandAgentInput,
  type BrandAgentOutput,
  type IAiProvider,
  type IBrandAgent,
} from "@brandforge/domain";
import { BRAND_AGENT_SYSTEM_PROMPT, buildBrandAgentPrompt } from "./brand-agent.prompt.js";
import { parseBrandProposal, toBrandAgentOutput } from "./brand-agent.schema.js";

/**
 * Brand Agent — produit une identité de marque à partir d'une analyse de niche validée
 * (AI_AGENTS.md §3).
 *
 * Produit **des propositions**, jamais une décision : le choix du nom définitif est un
 * point de validation utilisateur porté par `Brand.selectName` (WORKFLOWS.md §3).
 *
 * Stateless, sans effet de bord, et ne dépendant que du port `IAiProvider` : il est donc
 * testable sans appel réseau et n'appelle aucun autre agent (AI_AGENTS.md §9, règle 3).
 */
export class BrandAgent implements IBrandAgent {
  readonly name = AgentName.BRAND;

  constructor(private readonly aiProvider: IAiProvider) {}

  async execute(input: BrandAgentInput): Promise<AgentResult<BrandAgentOutput>> {
    const namesToAvoid = input.userPreferences?.namesToAvoid ?? [];

    const generated = await this.aiProvider.generateStructured({
      systemPrompt: BRAND_AGENT_SYSTEM_PROMPT,
      userPrompt: buildBrandAgentPrompt(input),
      // Création de marque : on assume davantage de créativité que pour l'analyse.
      temperature: 0.8,
      parse: parseBrandProposal,
    });

    if (!generated.success) {
      return agentFail(generated.error);
    }

    const output = toBrandAgentOutput(generated.output, namesToAvoid);

    // Le modèle a bien répondu, mais n'a proposé que des noms déjà refusés. Rejouable :
    // une nouvelle génération, avec ces noms transmis en contexte, peut aboutir.
    if (output.nameOptions.length === 0) {
      return agentFail(
        createAgentError(
          ERROR_CODES.BRAND_NAME_CONFLICT,
          "Toutes les propositions de nom figurent parmi celles déjà refusées.",
          true,
        ),
      );
    }

    return agentOk(output);
  }
}
