import { describe, expect, it, vi } from "vitest";
import {
  ERROR_CODES,
  agentFail,
  agentOk,
  createAgentError,
  type AgentResult,
} from "@brandforge/shared";
import { AgentName, type IAiProvider, type MarketAgentOutput } from "@brandforge/domain";
import { MarketAgent } from "./market.agent.js";

/** Réponse valide typique du modèle. */
const validOutput: MarketAgentOutput = {
  keywords: ["lunettes de soleil polarisées", "lunettes premium", "monture acétate"],
  competitors: [
    {
      name: "Izipizi",
      url: "https://www.izipizi.com",
      positioning: "Lunettes colorées accessibles",
      estimatedPriceRange: { min: 30, max: 60 },
    },
  ],
  priceRange: { min: 80, max: 200 },
  relevanceScore: 0.82,
  differentiationAngle: "Montures françaises en acétate bio, fabriquées dans le Jura",
  rawAnalysis: { model: "test" },
};

/**
 * Fournisseur IA mocké.
 *
 * `generateStructured` applique réellement le `parse` fourni par l'agent sur la charge
 * simulée : c'est ainsi que l'on teste la validation de schéma sans appel réseau
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

/** Charge brute conforme au schéma attendu. */
function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    keywords: validOutput.keywords,
    competitors: validOutput.competitors,
    priceRange: validOutput.priceRange,
    relevanceScore: validOutput.relevanceScore,
    differentiationAngle: validOutput.differentiationAngle,
    ...overrides,
  };
}

const validInput = { niche: "lunettes de soleil", targetMarket: "France" };

describe("MarketAgent", () => {
  it("porte le nom d'agent attendu par le pipeline", () => {
    expect(new MarketAgent(providerReturning(validPayload())).name).toBe(AgentName.MARKET);
  });

  it("produit une analyse validée à partir de la réponse du modèle", async () => {
    const agent = new MarketAgent(providerReturning(validPayload()));

    const result = await agent.execute(validInput);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.keywords).toHaveLength(3);
    expect(result.output.priceRange).toEqual({ min: 80, max: 200 });
    expect(result.output.relevanceScore).toBe(0.82);
  });

  it("conserve la réponse brute du modèle pour la traçabilité", async () => {
    const payload = validPayload();
    const agent = new MarketAgent(providerReturning(payload));

    const result = await agent.execute(validInput);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.rawAnalysis).toEqual(payload);
  });

  it("transmet la niche et le marché cible au modèle", async () => {
    const provider = providerReturning(validPayload());

    await new MarketAgent(provider).execute(validInput);

    expect(provider.calls[0]?.userPrompt).toContain("lunettes de soleil");
    expect(provider.calls[0]?.userPrompt).toContain("France");
  });

  it("transmet le contexte additionnel quand il est fourni", async () => {
    const provider = providerReturning(validPayload());

    await new MarketAgent(provider).execute({
      ...validInput,
      additionalContext: "cible : femmes 25-40 ans",
    });

    expect(provider.calls[0]?.userPrompt).toContain("femmes 25-40 ans");
  });

  it("n'ajoute pas de ligne de contexte quand il est absent", async () => {
    const provider = providerReturning(validPayload());

    await new MarketAgent(provider).execute(validInput);

    expect(provider.calls[0]?.userPrompt).not.toContain("Précisions de l'utilisateur");
  });
});

describe("MarketAgent — niche trop vague", () => {
  it("refuse une niche trop courte sans appeler le modèle", async () => {
    const provider = providerReturning(validPayload());

    const result = await new MarketAgent(provider).execute({ ...validInput, niche: "ab" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.NICHE_TOO_VAGUE);
    // Économise un appel facturé : seule une reformulation peut débloquer la situation.
    expect(provider.calls).toHaveLength(0);
  });

  it("refuse un terme générique", async () => {
    const result = await new MarketAgent(providerReturning(validPayload())).execute({
      ...validInput,
      niche: "produits",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.NICHE_TOO_VAGUE);
  });

  it("ignore casse et accents pour détecter un terme générique", async () => {
    const result = await new MarketAgent(providerReturning(validPayload())).execute({
      ...validInput,
      niche: "  E-Commerce  ",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.NICHE_TOO_VAGUE);
  });

  it("refuse un marché cible vide", async () => {
    const result = await new MarketAgent(providerReturning(validPayload())).execute({
      ...validInput,
      targetMarket: "   ",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.NICHE_TOO_VAGUE);
  });

  it("marque NICHE_TOO_VAGUE comme non rejouable", async () => {
    const result = await new MarketAgent(providerReturning(validPayload())).execute({
      ...validInput,
      niche: "ab",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.retryable).toBe(false);
  });

  it("accepte une niche précise proche d'un terme générique", async () => {
    const result = await new MarketAgent(providerReturning(validPayload())).execute({
      ...validInput,
      niche: "produits de rasage traditionnel",
    });

    expect(result.success).toBe(true);
  });
});

describe("MarketAgent — réponses non conformes du modèle", () => {
  it("rejette une analyse comportant trop peu de mots-clés", async () => {
    const agent = new MarketAgent(providerReturning(validPayload({ keywords: ["lunettes"] })));

    const result = await agent.execute(validInput);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.AI_PROVIDER_INVALID_RESPONSE);
  });

  it("rejette une analyse sans aucun concurrent", async () => {
    const agent = new MarketAgent(providerReturning(validPayload({ competitors: [] })));

    expect((await agent.execute(validInput)).success).toBe(false);
  });

  it("rejette un score de pertinence hors bornes", async () => {
    const agent = new MarketAgent(providerReturning(validPayload({ relevanceScore: 42 })));

    expect((await agent.execute(validInput)).success).toBe(false);
  });

  it("rejette une fourchette de prix inversée avant qu'elle n'atteigne le domaine", async () => {
    const agent = new MarketAgent(
      providerReturning(validPayload({ priceRange: { min: 300, max: 100 } })),
    );

    expect((await agent.execute(validInput)).success).toBe(false);
  });

  it("rejette un angle différenciant réduit à une généralité", async () => {
    const agent = new MarketAgent(providerReturning(validPayload({ differentiationAngle: "top" })));

    expect((await agent.execute(validInput)).success).toBe(false);
  });

  it("rejette un prix renvoyé sous forme de chaîne", async () => {
    const agent = new MarketAgent(
      providerReturning(validPayload({ priceRange: { min: "80", max: "200" } })),
    );

    expect((await agent.execute(validInput)).success).toBe(false);
  });
});

describe("MarketAgent — erreurs du fournisseur", () => {
  it("remonte un timeout comme rejouable", async () => {
    const agent = new MarketAgent(providerFailing(ERROR_CODES.AI_PROVIDER_TIMEOUT, true));

    const result = await agent.execute(validInput);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.AI_PROVIDER_TIMEOUT);
    expect(result.error.retryable).toBe(true);
  });

  it("remonte une clé invalide comme non rejouable", async () => {
    const agent = new MarketAgent(providerFailing(ERROR_CODES.AI_PROVIDER_AUTH_ERROR, false));

    const result = await agent.execute(validInput);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.retryable).toBe(false);
  });

  it("ne lève jamais d'exception : tout échec est un AgentResult", async () => {
    const agent = new MarketAgent(providerFailing(ERROR_CODES.AI_PROVIDER_RATE_LIMIT, true));

    await expect(agent.execute(validInput)).resolves.toMatchObject({ success: false });
  });
});
