import { z } from "zod";
import type { MarketAgentOutput } from "@brandforge/domain";

/**
 * Schéma de la réponse attendue du modèle pour le Market Agent.
 *
 * Toute sortie d'agent est validée avant d'être persistée (AI_AGENTS.md §9, règle 4) :
 * une réponse malformée est rejetée ici et ne peut pas corrompre la base.
 *
 * Les contraintes reflètent les critères d'acceptation du PRD (§10, critère 2 :
 * « une analyse exploitable, pas un texte générique ») — d'où les minimums sur le nombre
 * de mots-clés et la longueur de l'angle différenciant.
 */
export const marketAnalysisSchema = z.object({
  keywords: z.array(z.string().trim().min(1)).min(3),
  competitors: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        url: z.string().trim().min(1),
        positioning: z.string().trim().min(1),
        estimatedPriceRange: z.object({
          min: z.number().nonnegative(),
          max: z.number().nonnegative(),
        }),
      }),
    )
    .min(1),
  priceRange: z.object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
  }),
  relevanceScore: z.number().min(0).max(1),
  differentiationAngle: z.string().trim().min(20),
});

/** Sortie du modèle, avant enrichissement par la trace brute. */
export type MarketAnalysisPayload = z.infer<typeof marketAnalysisSchema>;

/**
 * Valide la réponse brute du modèle et la convertit en `MarketAgentOutput`.
 *
 * Retourne `null` si la réponse est inexploitable — le fournisseur la traduira alors en
 * `AI_PROVIDER_INVALID_RESPONSE`.
 */
export function parseMarketAnalysis(raw: unknown): MarketAgentOutput | null {
  const parsed = marketAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  const payload = parsed.data;

  // Une fourchette inversée passerait le schéma mais serait rejetée par le value object
  // `PriceRange` du domaine : autant l'écarter tout de suite.
  if (payload.priceRange.min > payload.priceRange.max) {
    return null;
  }

  return {
    keywords: payload.keywords,
    competitors: payload.competitors,
    priceRange: payload.priceRange,
    relevanceScore: payload.relevanceScore,
    differentiationAngle: payload.differentiationAngle,
    // Trace brute conservée telle quelle pour le débogage (DATABASE.md §5).
    rawAnalysis: raw,
  };
}
