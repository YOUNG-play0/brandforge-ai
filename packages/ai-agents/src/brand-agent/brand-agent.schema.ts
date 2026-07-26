import { z } from "zod";
import type { BrandAgentOutput } from "@brandforge/domain";

/** Nombre minimal de propositions de nom exigé par AI_AGENTS.md §3. */
export const MIN_NAME_OPTIONS = 3;

/** Nombre maximal retenu : au-delà, le choix utilisateur devient confus. */
export const MAX_NAME_OPTIONS = 5;

/**
 * Schéma de la réponse attendue du modèle pour le Brand Agent.
 *
 * Les contraintes anticipent celles des value objects du domaine (`ColorPalette`,
 * `Typography`) : une réponse non conforme est rejetée ici, avant d'atteindre le use case
 * (AI_AGENTS.md §9, règle 4). Cela garantit aussi que l'erreur remontée est bien une
 * erreur de fournisseur, et non une erreur de validation métier.
 */
export const brandProposalSchema = z.object({
  nameOptions: z.array(z.string().trim().min(1)).min(MIN_NAME_OPTIONS),
  positioning: z.string().trim().min(20),
  tone: z.string().trim().min(3),
  colorPalette: z
    .array(
      z.object({
        // Même exigence que le value object `ColorPalette` du domaine.
        hex: z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
        role: z.enum(["primary", "secondary", "accent"]),
      }),
    )
    .min(1)
    // Sans couleur primaire, l'identité ne peut être déclinée nulle part.
    .refine((colors) => colors.some((color) => color.role === "primary"), {
      message: "La palette doit comporter une couleur primaire.",
    }),
  typography: z.object({
    heading: z.string().trim().min(1),
    body: z.string().trim().min(1),
  }),
  logoBriefing: z.string().trim().min(20),
});

/** Proposition de marque validée, avant filtrage des noms à éviter. */
export type BrandProposal = z.infer<typeof brandProposalSchema>;

/**
 * Valide la réponse brute du modèle.
 *
 * Retourne `null` si elle est inexploitable — le fournisseur la traduira alors en
 * `AI_PROVIDER_INVALID_RESPONSE`.
 */
export function parseBrandProposal(raw: unknown): BrandProposal | null {
  const parsed = brandProposalSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Convertit une proposition validée en sortie d'agent, en écartant les noms refusés.
 *
 * La comparaison ignore casse et espaces : un utilisateur qui refuse « Solaris » ne veut
 * pas se voir proposer « solaris » au tour suivant. Les doublons sont également retirés,
 * un modèle génératif pouvant répéter une même idée sous deux formes identiques.
 */
export function toBrandAgentOutput(
  proposal: BrandProposal,
  namesToAvoid: readonly string[] = [],
): BrandAgentOutput {
  const rejected = new Set(namesToAvoid.map(normalizeName));
  const seen = new Set<string>();
  const nameOptions: string[] = [];

  for (const name of proposal.nameOptions) {
    const key = normalizeName(name);
    if (rejected.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    nameOptions.push(name.trim());
  }

  return {
    nameOptions: nameOptions.slice(0, MAX_NAME_OPTIONS),
    positioning: proposal.positioning,
    tone: proposal.tone,
    colorPalette: proposal.colorPalette,
    typography: proposal.typography,
    logoBriefing: proposal.logoBriefing,
  };
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}
