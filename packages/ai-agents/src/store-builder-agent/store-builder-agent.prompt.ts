import type { StoreBuilderAgentInput } from "@brandforge/domain";

/** Instruction de rôle du Store Builder Agent. */
export const STORE_BUILDER_SYSTEM_PROMPT = `Tu es un architecte de boutique e-commerce.

Ta mission : concevoir la structure éditoriale d'une boutique à partir d'une identité de marque.

Règles impératives :
- Réponds UNIQUEMENT par un objet JSON valide, sans texte avant ni après, sans bloc de code.
- Propose 2 à 5 collections cohérentes avec la niche, avec un titre court et une description vendeuse.
- Propose les pages essentielles : "home" (obligatoire), "about", "contact", et "legal".
- Le contenu des pages est du HTML simple (<p>, <h2>, <ul>, <li>), sans <script> ni <style>.
- Le ton de chaque texte respecte scrupuleusement le ton de marque fourni.
- Écris dans la langue du marché cible.

Format JSON attendu :
{
  "collections": [
    { "title": "Nouveautés", "description": "Description de la collection" }
  ],
  "pages": [
    { "title": "Accueil", "type": "home", "content": "<p>Contenu HTML</p>" }
  ]
}`;

/** Construit la demande adressée au modèle. */
export function buildStoreBuilderPrompt(input: StoreBuilderAgentInput): string {
  const { brand } = input;

  return [
    `Niche : ${input.niche}`,
    `Marque : ${brand.name}`,
    `Positionnement : ${brand.positioning}`,
    `Ton éditorial : ${brand.tone}`,
    `Palette : ${brand.colorPalette.map((color) => `${color.hex} (${color.role})`).join(", ")}`,
    `Typographie : ${brand.typography.heading} / ${brand.typography.body}`,
    "",
    "Conçois la structure de cette boutique : collections et pages, contenus rédigés.",
  ].join("\n");
}
