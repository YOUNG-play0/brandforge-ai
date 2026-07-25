import type { MarketAgentInput } from "@brandforge/domain";

/**
 * Instruction de rôle du Market Agent.
 *
 * Impose une sortie strictement JSON : le fournisseur demande déjà le mode JSON, mais le
 * rappeler dans le prompt réduit nettement les réponses enrobées de texte.
 */
export const MARKET_AGENT_SYSTEM_PROMPT = `Tu es un analyste de marché e-commerce spécialisé dans les niches de produits.

Ta mission : produire une analyse de niche EXPLOITABLE, jamais un texte générique.

Règles impératives :
- Réponds UNIQUEMENT par un objet JSON valide, sans texte avant ni après, sans bloc de code.
- Les concurrents doivent être des marques réellement existantes sur le marché cible.
- Les prix sont exprimés en euros, hors taxes, sous forme de nombres (jamais de chaînes).
- "relevanceScore" est un nombre entre 0 et 1 évaluant le potentiel commercial de la niche.
- "differentiationAngle" est un angle concret et actionnable, pas une généralité marketing.

Format JSON attendu :
{
  "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3"],
  "competitors": [
    {
      "name": "Nom de la marque",
      "url": "https://exemple.com",
      "positioning": "Positionnement en une phrase",
      "estimatedPriceRange": { "min": 30, "max": 60 }
    }
  ],
  "priceRange": { "min": 80, "max": 200 },
  "relevanceScore": 0.82,
  "differentiationAngle": "Angle différenciant concret et actionnable"
}`;

/** Construit la demande adressée au modèle à partir de l'entrée typée de l'agent. */
export function buildMarketAgentPrompt(input: MarketAgentInput): string {
  const lines = [`Niche : ${input.niche}`, `Marché cible : ${input.targetMarket}`];

  if (input.additionalContext !== undefined && input.additionalContext.trim().length > 0) {
    lines.push(`Précisions de l'utilisateur : ${input.additionalContext.trim()}`);
  }

  lines.push(
    "",
    "Produis l'analyse de cette niche pour ce marché : au moins 5 mots-clés de recherche",
    "réellement utilisés par les acheteurs, au moins 3 concurrents identifiés, la fourchette",
    "de prix de vente constatée, un score de pertinence et un angle différenciant.",
  );

  return lines.join("\n");
}
