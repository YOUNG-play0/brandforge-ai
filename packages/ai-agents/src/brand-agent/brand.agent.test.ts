import { describe, expect, it, vi } from "vitest";
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
  type IAiProvider,
  type NicheAnalysisSummary,
} from "@brandforge/domain";
import { BrandAgent } from "./brand.agent.js";

/** Analyse de niche validée, telle que transmise par le use case. */
const nicheAnalysis: NicheAnalysisSummary = {
  niche: "lunettes de soleil",
  targetMarket: "France",
  keywords: ["lunettes de soleil polarisées", "lunettes premium"],
  competitors: [
    {
      name: "Izipizi",
      url: "https://www.izipizi.com",
      positioning: "Lunettes colorées accessibles",
      estimatedPriceRange: { min: 30, max: 60 },
    },
  ],
  priceRange: { min: 80, max: 200 },
  differentiationAngle: "Montures françaises en acétate bio",
};

const validInput: BrandAgentInput = { nicheAnalysis };

/** Charge brute conforme au schéma attendu. */
function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nameOptions: ["Solaris", "Lumen", "Éclat"],
    positioning: "Lunettes premium fabriquées en France, en acétate bio",
    tone: "premium, épuré, confiant",
    colorPalette: [
      { hex: "#1A1A1A", role: "primary" },
      { hex: "#C9A227", role: "accent" },
    ],
    typography: { heading: "Playfair Display", body: "Inter" },
    logoBriefing: "Monogramme minimaliste doré sur fond noir profond",
    ...overrides,
  };
}

/**
 * Fournisseur IA mocké appliquant réellement le `parse` de l'agent.
 *
 * C'est ce qui permet de tester la validation de schéma sans appel réseau
 * (CODING_STANDARDS.md §7).
 */
function providerReturning(rawPayload: unknown): IAiProvider & {
  calls: { systemPrompt: string; userPrompt: string }[];
} {
  const calls: { systemPrompt: string; userPrompt: string }[] = [];

  return {
    calls,
    generateStructured: async <T>(request: {
      systemPrompt: string;
      userPrompt: string;
      parse: (raw: unknown) => T | null;
    }): Promise<AgentResult<T>> => {
      calls.push({ systemPrompt: request.systemPrompt, userPrompt: request.userPrompt });
      const parsed = request.parse(rawPayload);
      return parsed === null
        ? agentFail(
            createAgentError(ERROR_CODES.AI_PROVIDER_INVALID_RESPONSE, "schéma non respecté", true),
          )
        : agentOk(parsed);
    },
    generateText: vi.fn(),
  };
}

/** Fournisseur IA qui échoue systématiquement. */
function providerFailing(
  code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
  retryable: boolean,
): IAiProvider {
  return {
    generateStructured: vi
      .fn()
      .mockResolvedValue(agentFail(createAgentError(code, "échec simulé", retryable))),
    generateText: vi.fn(),
  };
}

describe("BrandAgent", () => {
  it("porte le nom d'agent attendu par le pipeline", () => {
    expect(new BrandAgent(providerReturning(validPayload())).name).toBe(AgentName.BRAND);
  });

  it("produit une identité de marque validée", async () => {
    const result = await new BrandAgent(providerReturning(validPayload())).execute(validInput);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.nameOptions).toEqual(["Solaris", "Lumen", "Éclat"]);
    expect(result.output.typography.heading).toBe("Playfair Display");
    expect(result.output.colorPalette).toContainEqual({ hex: "#1A1A1A", role: "primary" });
  });

  it("ne produit jamais de nom sélectionné : le choix appartient à l'utilisateur", async () => {
    const result = await new BrandAgent(providerReturning(validPayload())).execute(validInput);

    expect(result.success).toBe(true);
    if (!result.success) return;
    // WORKFLOWS.md §3 : la sélection est un point de validation utilisateur bloquant.
    expect(result.output).not.toHaveProperty("selectedName");
  });

  it("transmet l'angle différenciant et les concurrents au modèle", async () => {
    const provider = providerReturning(validPayload());

    await new BrandAgent(provider).execute(validInput);

    expect(provider.calls[0]?.userPrompt).toContain("Montures françaises en acétate bio");
    expect(provider.calls[0]?.userPrompt).toContain("Izipizi");
  });

  it("transmet le ton souhaité par l'utilisateur", async () => {
    const provider = providerReturning(validPayload());

    await new BrandAgent(provider).execute({
      nicheAnalysis,
      userPreferences: { desiredTone: "chaleureux et artisanal" },
    });

    expect(provider.calls[0]?.userPrompt).toContain("chaleureux et artisanal");
  });

  it("n'ajoute aucune ligne de préférence quand aucune n'est fournie", async () => {
    const provider = providerReturning(validPayload());

    await new BrandAgent(provider).execute(validInput);

    expect(provider.calls[0]?.userPrompt).not.toContain("Ton souhaité");
    expect(provider.calls[0]?.userPrompt).not.toContain("Noms déjà refusés");
  });
});

describe("BrandAgent — noms à éviter", () => {
  it("écarte de la sortie les noms déjà refusés", async () => {
    const result = await new BrandAgent(providerReturning(validPayload())).execute({
      nicheAnalysis,
      userPreferences: { namesToAvoid: ["Solaris"] },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.nameOptions).toEqual(["Lumen", "Éclat"]);
  });

  it("ignore la casse et les espaces pour comparer les noms refusés", async () => {
    const result = await new BrandAgent(providerReturning(validPayload())).execute({
      nicheAnalysis,
      userPreferences: { namesToAvoid: ["  solaris  "] },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.nameOptions).not.toContain("Solaris");
  });

  it("transmet aussi les noms refusés au modèle pour éviter de gaspiller des propositions", async () => {
    const provider = providerReturning(validPayload());

    await new BrandAgent(provider).execute({
      nicheAnalysis,
      userPreferences: { namesToAvoid: ["Solaris"] },
    });

    expect(provider.calls[0]?.userPrompt).toContain("Noms déjà refusés");
    expect(provider.calls[0]?.userPrompt).toContain("Solaris");
  });

  it("signale BRAND_NAME_CONFLICT quand toutes les propositions sont refusées", async () => {
    const result = await new BrandAgent(providerReturning(validPayload())).execute({
      nicheAnalysis,
      userPreferences: { namesToAvoid: ["Solaris", "Lumen", "Éclat"] },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.BRAND_NAME_CONFLICT);
  });

  it("marque BRAND_NAME_CONFLICT comme rejouable : une regénération peut aboutir", async () => {
    const result = await new BrandAgent(providerReturning(validPayload())).execute({
      nicheAnalysis,
      userPreferences: { namesToAvoid: ["Solaris", "Lumen", "Éclat"] },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.retryable).toBe(true);
  });

  it("supprime les doublons proposés par le modèle", async () => {
    const result = await new BrandAgent(
      providerReturning(validPayload({ nameOptions: ["Solaris", "solaris", "Lumen"] })),
    ).execute(validInput);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.nameOptions).toEqual(["Solaris", "Lumen"]);
  });

  it("plafonne le nombre de propositions retenues", async () => {
    const result = await new BrandAgent(
      providerReturning(validPayload({ nameOptions: ["A1", "B2", "C3", "D4", "E5", "F6", "G7"] })),
    ).execute(validInput);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.nameOptions).toHaveLength(5);
  });
});

describe("BrandAgent — réponses non conformes du modèle", () => {
  it("rejette moins de trois propositions de nom", async () => {
    const result = await new BrandAgent(
      providerReturning(validPayload({ nameOptions: ["Solaris", "Lumen"] })),
    ).execute(validInput);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.AI_PROVIDER_INVALID_RESPONSE);
  });

  it("rejette une palette sans couleur primaire", async () => {
    const result = await new BrandAgent(
      providerReturning(validPayload({ colorPalette: [{ hex: "#C9A227", role: "accent" }] })),
    ).execute(validInput);

    expect(result.success).toBe(false);
  });

  it("rejette une couleur hexadécimale malformée", async () => {
    const result = await new BrandAgent(
      providerReturning(validPayload({ colorPalette: [{ hex: "noir", role: "primary" }] })),
    ).execute(validInput);

    expect(result.success).toBe(false);
  });

  it("rejette un rôle de couleur inconnu", async () => {
    const result = await new BrandAgent(
      providerReturning(validPayload({ colorPalette: [{ hex: "#1A1A1A", role: "tertiary" }] })),
    ).execute(validInput);

    expect(result.success).toBe(false);
  });

  it("rejette une typographie incomplète", async () => {
    const result = await new BrandAgent(
      providerReturning(validPayload({ typography: { heading: "Playfair Display" } })),
    ).execute(validInput);

    expect(result.success).toBe(false);
  });

  it("rejette un brief de logo réduit à une généralité", async () => {
    const result = await new BrandAgent(
      providerReturning(validPayload({ logoBriefing: "un beau logo" })),
    ).execute(validInput);

    expect(result.success).toBe(false);
  });

  it("rejette un positionnement trop court pour être exploitable", async () => {
    const result = await new BrandAgent(
      providerReturning(validPayload({ positioning: "premium" })),
    ).execute(validInput);

    expect(result.success).toBe(false);
  });
});

describe("BrandAgent — erreurs du fournisseur", () => {
  it("remonte un timeout comme rejouable", async () => {
    const result = await new BrandAgent(
      providerFailing(ERROR_CODES.AI_PROVIDER_TIMEOUT, true),
    ).execute(validInput);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.AI_PROVIDER_TIMEOUT);
    expect(result.error.retryable).toBe(true);
  });

  it("remonte une clé invalide comme non rejouable", async () => {
    const result = await new BrandAgent(
      providerFailing(ERROR_CODES.AI_PROVIDER_AUTH_ERROR, false),
    ).execute(validInput);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.retryable).toBe(false);
  });

  it("ne lève jamais d'exception : tout échec est un AgentResult", async () => {
    await expect(
      new BrandAgent(providerFailing(ERROR_CODES.AI_PROVIDER_RATE_LIMIT, true)).execute(validInput),
    ).resolves.toMatchObject({ success: false });
  });
});
