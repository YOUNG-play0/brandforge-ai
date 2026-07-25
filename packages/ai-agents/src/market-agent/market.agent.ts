import {
  ERROR_CODES,
  agentFail,
  createAgentError,
  isNonEmptyString,
  type AgentError,
  type AgentResult,
} from "@brandforge/shared";
import {
  AgentName,
  type IAiProvider,
  type IMarketAgent,
  type MarketAgentInput,
  type MarketAgentOutput,
} from "@brandforge/domain";
import { MARKET_AGENT_SYSTEM_PROMPT, buildMarketAgentPrompt } from "./market-agent.prompt.js";
import { parseMarketAnalysis } from "./market-agent.schema.js";

/** Longueur minimale d'une niche pour être analysable. */
const MIN_NICHE_LENGTH = 3;

/**
 * Termes trop génériques pour produire une analyse exploitable.
 *
 * Le PRD (§10, critère 2) exige « une analyse de niche exploitable, pas un texte
 * générique » : lancer le modèle sur « produits » lui ferait inventer un marché
 * plausible mais sans valeur. Mieux vaut rendre la main tout de suite.
 */
const TOO_GENERIC_NICHES = new Set([
  "produit",
  "produits",
  "objet",
  "objets",
  "article",
  "articles",
  "truc",
  "trucs",
  "divers",
  "ecommerce",
  "e-commerce",
  "boutique",
  "business",
  "vente",
  "shopping",
]);

/**
 * Market Agent — produit une `NicheAnalysis` exploitable (AI_AGENTS.md §2).
 *
 * Stateless et sans effet de bord : il ne persiste rien et n'appelle aucun autre agent.
 * Toute écriture appartient au use case `AnalyzeNiche` qui l'invoque.
 *
 * Ne dépend que du port `IAiProvider` : il est donc testable sans appel réseau, et changer
 * de fournisseur IA ne demande aucune modification ici (ARCHITECTURE.md §10).
 */
export class MarketAgent implements IMarketAgent {
  readonly name = AgentName.MARKET;

  constructor(private readonly aiProvider: IAiProvider) {}

  async execute(input: MarketAgentInput): Promise<AgentResult<MarketAgentOutput>> {
    const rejection = rejectVagueNiche(input);
    if (rejection !== null) {
      return agentFail(rejection);
    }

    return this.aiProvider.generateStructured<MarketAgentOutput>({
      systemPrompt: MARKET_AGENT_SYSTEM_PROMPT,
      userPrompt: buildMarketAgentPrompt(input),
      // Analyse factuelle : on privilégie la stabilité des résultats à la créativité.
      temperature: 0.3,
      parse: parseMarketAnalysis,
    });
  }
}

/**
 * Vérifie que la niche est assez précise pour être analysée.
 *
 * `NICHE_TOO_VAGUE` est volontairement non rejouable (AI_AGENTS.md §2) : seule une
 * reformulation par l'utilisateur peut débloquer la situation, pas une nouvelle tentative.
 */
function rejectVagueNiche(input: MarketAgentInput): AgentError | null {
  if (!isNonEmptyString(input.niche) || input.niche.trim().length < MIN_NICHE_LENGTH) {
    return createAgentError(
      ERROR_CODES.NICHE_TOO_VAGUE,
      "Précisez la niche : elle est trop courte pour être analysée (ex. « lunettes de soleil »).",
      false,
    );
  }

  if (!isNonEmptyString(input.targetMarket)) {
    return createAgentError(
      ERROR_CODES.NICHE_TOO_VAGUE,
      "Précisez le marché cible (ex. « France »).",
      false,
    );
  }

  if (TOO_GENERIC_NICHES.has(normalize(input.niche))) {
    return createAgentError(
      ERROR_CODES.NICHE_TOO_VAGUE,
      `« ${input.niche.trim()} » est trop générique. Décrivez un type de produit précis (ex. « lunettes de soleil polarisées »).`,
      false,
    );
  }

  return null;
}

/** Normalise pour comparer une niche aux termes génériques (casse et accents ignorés). */
function normalize(niche: string): string {
  return niche.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
