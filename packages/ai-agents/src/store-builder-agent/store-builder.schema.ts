import { z } from "zod";

/** Types de page attendus par le domaine (`StorePageType`). */
export const STORE_PAGE_TYPES = ["home", "about", "contact", "legal"] as const;

/**
 * Plan de boutique demandé au modèle.
 *
 * L'agent ne demande pas au modèle de *créer* les ressources — il lui demande d'en
 * concevoir le contenu. La création effective passe par `IEcommercePlatform` :
 * un modèle génératif ne doit jamais avoir la main sur des effets de bord (AI_AGENTS.md §1).
 */
export const storePlanSchema = z.object({
  collections: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        description: z.string().trim().min(20),
      }),
    )
    .min(1),
  pages: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        type: z.enum(STORE_PAGE_TYPES),
        content: z.string().trim().min(50),
      }),
    )
    // Sans page d'accueil, le visiteur arrive sur une vitrine vide : l'invariant
    // `StoreStructure.isPublishable()` du domaine serait immédiatement violé.
    .refine((pages) => pages.some((page) => page.type === "home"), {
      message: "Le plan doit comporter une page d'accueil.",
    }),
});

/** Plan de boutique validé. */
export type StorePlan = z.infer<typeof storePlanSchema>;

export function parseStorePlan(raw: unknown): StorePlan | null {
  const parsed = storePlanSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
