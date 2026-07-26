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
  type BrandSummary,
  type IAiProvider,
  type StoreBuilderAgentInput,
} from "@brandforge/domain";
import { StoreBuilderAgent } from "./store-builder.agent.js";
import { fakePlatform, failingPlatform } from "../test-support/platform-fakes.js";

const brand: BrandSummary = {
  name: "Solaris",
  positioning: "Lunettes premium fabriquées en France",
  tone: "premium, épuré, confiant",
  colorPalette: [{ hex: "#1A1A1A", role: "primary" }],
  typography: { heading: "Playfair Display", body: "Inter" },
};

const validInput: StoreBuilderAgentInput = {
  brand,
  niche: "lunettes de soleil",
  storeProjectId: "project-1",
};

/** Plan de boutique conforme au schéma attendu. */
function validPlan(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    collections: [
      { title: "Nouveautés", description: "Les dernières montures arrivées en boutique." },
      { title: "Best-sellers", description: "Les modèles les plus vendus de la collection." },
    ],
    pages: [
      {
        title: "Accueil",
        type: "home",
        content:
          "<p>Bienvenue chez Solaris. Des lunettes premium en acétate bio, façonnées en France.</p>",
      },
      {
        title: "À propos",
        type: "about",
        content:
          "<p>Notre histoire commence dans le Jura, où nos montures sont encore assemblées à la main.</p>",
      },
    ],
    ...overrides,
  };
}

function providerReturning(rawPayload: unknown): IAiProvider {
  return {
    generateStructured: async <T>(request: {
      parse: (raw: unknown) => T | null;
    }): Promise<AgentResult<T>> => {
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

function providerFailing(code: ErrorCodeValue): IAiProvider {
  return {
    generateStructured: vi
      .fn()
      .mockResolvedValue(agentFail(createAgentError(code, "échec simulé", true))),
    generateText: vi.fn(),
  };
}

type ErrorCodeValue = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

describe("StoreBuilderAgent", () => {
  it("porte le nom d'agent attendu", () => {
    expect(new StoreBuilderAgent(providerReturning(validPlan()), fakePlatform()).name).toBe(
      AgentName.STORE_BUILDER,
    );
  });

  it("crée le thème, les collections et les pages sur la plateforme", async () => {
    const platform = fakePlatform({ themeId: "gid://shopify/OnlineStoreTheme/7" });

    const result = await new StoreBuilderAgent(providerReturning(validPlan()), platform).execute(
      validInput,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.shopifyThemeId).toBe("gid://shopify/OnlineStoreTheme/7");
    expect(result.output.collectionsCreated).toHaveLength(2);
    expect(result.output.pagesCreated).toHaveLength(2);
    expect(platform.calls.themes).toBe(1);
  });

  it("transmet à la plateforme le contenu conçu par le modèle", async () => {
    const platform = fakePlatform();

    await new StoreBuilderAgent(providerReturning(validPlan()), platform).execute(validInput);

    expect(platform.calls.collections[0]?.title).toBe("Nouveautés");
    expect(platform.calls.pages[0]?.type).toBe("home");
    expect(platform.calls.pages[0]?.content).toContain("Solaris");
  });

  it("conserve le type de page dans la sortie, invariant du domaine", async () => {
    const result = await new StoreBuilderAgent(
      providerReturning(validPlan()),
      fakePlatform(),
    ).execute(validInput);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.pagesCreated.map((page) => page.type)).toContain("home");
  });

  it("transmet l'identité de marque au modèle", async () => {
    const platform = fakePlatform();
    const provider = providerReturning(validPlan());
    const spy = vi.spyOn(provider, "generateStructured");

    await new StoreBuilderAgent(provider, platform).execute(validInput);

    const prompt = (spy.mock.calls[0]?.[0] as { userPrompt: string }).userPrompt;
    expect(prompt).toContain("Solaris");
    expect(prompt).toContain("premium, épuré, confiant");
  });
});

describe("StoreBuilderAgent — plans non conformes", () => {
  it("rejette un plan sans page d'accueil", async () => {
    const plan = validPlan({
      pages: [
        {
          title: "À propos",
          type: "about",
          content: "<p>Notre histoire commence dans le Jura, à quelques kilomètres de Morez.</p>",
        },
      ],
    });

    const result = await new StoreBuilderAgent(providerReturning(plan), fakePlatform()).execute(
      validInput,
    );

    // Sans page d'accueil, `StoreStructure.isPublishable()` serait faux côté domaine.
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.AI_PROVIDER_INVALID_RESPONSE);
  });

  it("rejette un plan sans collection", async () => {
    const result = await new StoreBuilderAgent(
      providerReturning(validPlan({ collections: [] })),
      fakePlatform(),
    ).execute(validInput);

    expect(result.success).toBe(false);
  });

  it("rejette un type de page inconnu", async () => {
    const plan = validPlan({
      pages: [
        {
          title: "Blog",
          type: "blog",
          content:
            "<p>Un contenu de page suffisamment long pour passer la validation de schéma.</p>",
        },
      ],
    });

    expect(
      (await new StoreBuilderAgent(providerReturning(plan), fakePlatform()).execute(validInput))
        .success,
    ).toBe(false);
  });

  it("ne touche jamais à la plateforme si le plan est invalide", async () => {
    const platform = fakePlatform();

    await new StoreBuilderAgent(
      providerReturning(validPlan({ collections: [] })),
      platform,
    ).execute(validInput);

    expect(platform.calls.themes).toBe(0);
    expect(platform.calls.collections).toHaveLength(0);
  });
});

describe("StoreBuilderAgent — échecs de la plateforme", () => {
  it("s'arrête si le thème ne peut pas être appliqué", async () => {
    const platform = failingPlatform("applyTheme", ERROR_CODES.THEME_APPLICATION_FAILED, true);

    const result = await new StoreBuilderAgent(providerReturning(validPlan()), platform).execute(
      validInput,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.THEME_APPLICATION_FAILED);
    // Inutile de créer des collections sur un thème qui n'existe pas.
    expect(platform.calls.collections).toHaveLength(0);
  });

  it("remonte un refus de Shopify sur la création d'une collection", async () => {
    const platform = failingPlatform("createCollection", ERROR_CODES.SHOPIFY_VALIDATION_ERROR);

    const result = await new StoreBuilderAgent(providerReturning(validPlan()), platform).execute(
      validInput,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.SHOPIFY_VALIDATION_ERROR);
    expect(result.error.retryable).toBe(false);
  });

  it("remonte une erreur d'authentification comme non rejouable", async () => {
    const platform = failingPlatform("createPage", ERROR_CODES.SHOPIFY_AUTH_ERROR);

    const result = await new StoreBuilderAgent(providerReturning(validPlan()), platform).execute(
      validInput,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.retryable).toBe(false);
  });

  it("remonte un quota dépassé comme rejouable", async () => {
    const platform = failingPlatform("createCollection", ERROR_CODES.SHOPIFY_RATE_LIMIT, true);

    const result = await new StoreBuilderAgent(providerReturning(validPlan()), platform).execute(
      validInput,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.retryable).toBe(true);
  });

  it("remonte l'échec du modèle sans appeler la plateforme", async () => {
    const platform = fakePlatform();

    const result = await new StoreBuilderAgent(
      providerFailing(ERROR_CODES.AI_PROVIDER_TIMEOUT),
      platform,
    ).execute(validInput);

    expect(result.success).toBe(false);
    expect(platform.calls.themes).toBe(0);
  });
});
