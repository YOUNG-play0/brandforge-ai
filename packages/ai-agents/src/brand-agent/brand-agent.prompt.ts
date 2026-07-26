import type { BrandAgentInput } from "@brandforge/domain";
import { MAX_NAME_OPTIONS, MIN_NAME_OPTIONS } from "./brand-agent.schema.js";

/**
 * Instruction de rôle du Brand Agent.
 *
 * Insiste sur le fait que l'agent produit des **propositions** : la décision finale du nom
 * appartient à l'utilisateur (AI_AGENTS.md §3, WORKFLOWS.md §3).
 */
export const BRAND_AGENT_SYSTEM_PROMPT = `Tu es un directeur de création spécialisé dans l'identité de marque e-commerce.

Ta mission : proposer une identité de marque cohérente à partir d'une analyse de niche.

Règles impératives :
- Réponds UNIQUEMENT par un objet JSON valide, sans texte avant ni après, sans bloc de code.
- Propose ${String(MIN_NAME_OPTIONS)} à ${String(MAX_NAME_OPTIONS)} noms de marque : courts, prononçables, mémorisables, et disponibles en apparence (évite les marques existantes connues).
- Les noms doivent convenir au marché cible indiqué et se démarquer des concurrents listés.
- La palette doit comporter exactement une couleur de rôle "primary", et peut inclure "secondary" et "accent".
- Les couleurs sont au format hexadécimal (#RRGGBB).
- La typographie cite des polices réelles et largement disponibles (Google Fonts de préférence).
- "logoBriefing" décrit un logo concret et réalisable, pas une intention vague.

Format JSON attendu :
{
  "nameOptions": ["Nom1", "Nom2", "Nom3"],
  "positioning": "Positionnement de marque en une ou deux phrases",
  "tone": "premium, épuré, confiant",
  "colorPalette": [
    { "hex": "#1A1A1A", "role": "primary" },
    { "hex": "#C9A227", "role": "accent" }
  ],
  "typography": { "heading": "Playfair Display", "body": "Inter" },
  "logoBriefing": "Description concrète du logo à produire"
}`;

/** Construit la demande adressée au modèle à partir de l'entrée typée de l'agent. */
export function buildBrandAgentPrompt(input: BrandAgentInput): string {
  const { nicheAnalysis } = input;

  const lines = [
    `Niche : ${nicheAnalysis.niche}`,
    `Marché cible : ${nicheAnalysis.targetMarket}`,
    `Angle différenciant retenu : ${nicheAnalysis.differentiationAngle}`,
    `Fourchette de prix : ${String(nicheAnalysis.priceRange.min)}–${String(nicheAnalysis.priceRange.max)} €`,
    `Mots-clés de la niche : ${nicheAnalysis.keywords.join(", ")}`,
  ];

  if (nicheAnalysis.competitors.length > 0) {
    lines.push(
      "",
      "Concurrents à ne pas imiter :",
      ...nicheAnalysis.competitors.map(
        (competitor) => `- ${competitor.name} — ${competitor.positioning}`,
      ),
    );
  }

  const preferences = input.userPreferences;
  if (preferences?.desiredTone !== undefined && preferences.desiredTone.trim().length > 0) {
    lines.push("", `Ton souhaité par l'utilisateur : ${preferences.desiredTone.trim()}`);
  }

  // Les noms déjà refusés sont transmis au modèle en plus d'être filtrés en sortie :
  // le lui dire évite de gaspiller des propositions qui seraient écartées ensuite.
  if (preferences?.namesToAvoid !== undefined && preferences.namesToAvoid.length > 0) {
    lines.push(`Noms déjà refusés, à ne pas reproposer : ${preferences.namesToAvoid.join(", ")}`);
  }

  lines.push("", "Produis l'identité de marque correspondante.");

  return lines.join("\n");
}
