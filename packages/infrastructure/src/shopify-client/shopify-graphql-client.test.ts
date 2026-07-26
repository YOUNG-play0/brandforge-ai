import { describe, expect, it, vi } from "vitest";
import { ERROR_CODES, agentOk, createAgentError, agentFail } from "@brandforge/shared";
import type { HttpFetch, HttpResponse } from "../http/http-fetch.js";
import { ShopifyGraphQlClient, rejectUserErrors } from "./shopify-graphql-client.js";
import type { IShopifyTokenProvider } from "./shopify-token-provider.js";
import type { ShopifyConfig } from "./shopify-config.js";

const config: ShopifyConfig = {
  storeDomain: "f992av-n1.myshopify.com",
  clientId: "id",
  clientSecret: "secret",
  apiVersion: "2025-01",
  timeoutMs: 15_000,
};

/** Fournisseur de token simulé, comptant les invalidations. */
function fakeTokenProvider(): IShopifyTokenProvider & { invalidations: number } {
  const state = { invalidations: 0 };
  return {
    get invalidations() {
      return state.invalidations;
    },
    getAccessToken: async () => agentOk("shpat_token"),
    invalidate: () => {
      state.invalidations += 1;
    },
  };
}

function jsonResponse(payload: unknown, status = 200): HttpResponse {
  return { ok: status < 400, status, text: async () => JSON.stringify(payload) };
}

function errorResponse(status: number): HttpResponse {
  return { ok: false, status, text: async () => "erreur" };
}

describe("ShopifyGraphQlClient", () => {
  it("appelle le point d'entrée GraphQL de la version configurée", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { shop: { name: "Solaris" } } }));

    await new ShopifyGraphQlClient(config, fakeTokenProvider(), fetchFn as HttpFetch).request(
      "query { shop { name } }",
    );

    const [url, init] = fetchFn.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe("https://f992av-n1.myshopify.com/admin/api/2025-01/graphql.json");
    expect(init.headers["X-Shopify-Access-Token"]).toBe("shpat_token");
  });

  it("retourne les données en cas de succès", async () => {
    const client = new ShopifyGraphQlClient(
      config,
      fakeTokenProvider(),
      vi.fn().mockResolvedValue(jsonResponse({ data: { shop: { name: "Solaris" } } })) as HttpFetch,
    );

    const result = await client.request<{ shop: { name: string } }>("query { shop { name } }");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output.shop.name).toBe("Solaris");
  });

  it("renouvelle le token et retente une seule fois après un 401", async () => {
    const tokenProvider = fakeTokenProvider();
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(401))
      .mockResolvedValueOnce(jsonResponse({ data: { shop: { name: "Solaris" } } }));

    const result = await new ShopifyGraphQlClient(
      config,
      tokenProvider,
      fetchFn as HttpFetch,
    ).request("query { shop { name } }");

    // Un token peut être révoqué avant son échéance : ce cas se résout sans intervention.
    expect(result.success).toBe(true);
    expect(tokenProvider.invalidations).toBe(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("ne retente pas indéfiniment sur des 401 répétés", async () => {
    const fetchFn = vi.fn().mockResolvedValue(errorResponse(401));

    const result = await new ShopifyGraphQlClient(
      config,
      fakeTokenProvider(),
      fetchFn as HttpFetch,
    ).request("query { shop { name } }");

    expect(result.success).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("remonte l'échec du fournisseur de token sans appeler l'API", async () => {
    const fetchFn = vi.fn();
    const tokenProvider: IShopifyTokenProvider = {
      getAccessToken: async () =>
        agentFail(createAgentError(ERROR_CODES.SHOPIFY_AUTH_ERROR, "identifiants refusés", false)),
      invalidate: () => undefined,
    };

    const result = await new ShopifyGraphQlClient(
      config,
      tokenProvider,
      fetchFn as HttpFetch,
    ).request("query { shop { name } }");

    expect(result.success).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("traduit un étranglement de quota GraphQL en erreur rejouable", async () => {
    const client = new ShopifyGraphQlClient(
      config,
      fakeTokenProvider(),
      vi.fn().mockResolvedValue(
        jsonResponse({
          errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }],
        }),
      ) as HttpFetch,
    );

    const result = await client.request("query { shop { name } }");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.SHOPIFY_RATE_LIMIT);
    expect(result.error.retryable).toBe(true);
  });

  it("traduit une erreur GraphQL quelconque en erreur de validation", async () => {
    const client = new ShopifyGraphQlClient(
      config,
      fakeTokenProvider(),
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ errors: [{ message: "Field 'nope' doesn't exist" }] }),
        ) as HttpFetch,
    );

    const result = await client.request("query { nope }");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.SHOPIFY_VALIDATION_ERROR);
    expect(result.error.message).toContain("nope");
  });

  it("traite une panne serveur comme rejouable", async () => {
    const client = new ShopifyGraphQlClient(
      config,
      fakeTokenProvider(),
      vi.fn().mockResolvedValue(errorResponse(503)) as HttpFetch,
    );

    const result = await client.request("query { shop { name } }");

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.SHOPIFY_UNAVAILABLE);
    expect(result.error.retryable).toBe(true);
  });

  it("rejette une réponse sans données", async () => {
    const client = new ShopifyGraphQlClient(
      config,
      fakeTokenProvider(),
      vi.fn().mockResolvedValue(jsonResponse({})) as HttpFetch,
    );

    expect((await client.request("query { shop { name } }")).success).toBe(false);
  });

  it("ne lève jamais d'exception sur panne réseau", async () => {
    const client = new ShopifyGraphQlClient(
      config,
      fakeTokenProvider(),
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as HttpFetch,
    );

    await expect(client.request("query { shop { name } }")).resolves.toMatchObject({
      success: false,
    });
  });
});

describe("rejectUserErrors", () => {
  it("laisse passer une mutation sans erreur métier", () => {
    expect(rejectUserErrors([], "collectionCreate")).toBeNull();
    expect(rejectUserErrors(undefined, "collectionCreate")).toBeNull();
  });

  it("transforme les userErrors en erreur de validation non rejouable", () => {
    // Shopify répond 200 même quand la mutation est refusée : sans cette vérification,
    // un échec passerait pour un succès.
    const error = rejectUserErrors(
      [{ field: ["title"], message: "can't be blank" }],
      "collectionCreate",
    );

    expect(error?.code).toBe(ERROR_CODES.SHOPIFY_VALIDATION_ERROR);
    expect(error?.retryable).toBe(false);
    expect(error?.message).toContain("title : can't be blank");
  });

  it("gère une erreur sans champ associé", () => {
    const error = rejectUserErrors([{ message: "quota atteint" }], "productCreate");

    expect(error?.message).toContain("quota atteint");
  });
});
