import { describe, expect, it, vi } from "vitest";
import { ERROR_CODES } from "@brandforge/shared";
import type { HttpFetch, HttpResponse } from "../http/http-fetch.js";
import { FakeClock } from "../test-support/fakes.js";
import { ShopifyTokenProvider } from "./shopify-token-provider.js";
import { normalizeStoreDomain, type ShopifyConfig } from "./shopify-config.js";

const config: ShopifyConfig = {
  storeDomain: "f992av-n1.myshopify.com",
  clientId: "client-id-de-test",
  clientSecret: "client-secret-de-test",
  apiVersion: "2025-01",
  timeoutMs: 15_000,
};

/** Réponse de succès du point d'échange de jeton. */
function tokenResponse(accessToken: string, expiresIn?: number): HttpResponse {
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        access_token: accessToken,
        scope: "write_products,write_themes",
        ...(expiresIn === undefined ? {} : { expires_in: expiresIn }),
      }),
  };
}

function errorResponse(status: number, body = "erreur"): HttpResponse {
  return { ok: false, status, text: async () => body };
}

describe("ShopifyTokenProvider — échange client credentials", () => {
  it("échange client_id et client_secret contre un token d'accès", async () => {
    const fetchFn = vi.fn().mockResolvedValue(tokenResponse("shpat_abc", 86_399));
    const provider = new ShopifyTokenProvider(config, new FakeClock(), fetchFn as HttpFetch);

    const result = await provider.getAccessToken();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output).toBe("shpat_abc");
  });

  it("appelle le point d'échange documenté par Shopify", async () => {
    const fetchFn = vi.fn().mockResolvedValue(tokenResponse("shpat_abc", 86_399));

    await new ShopifyTokenProvider(config, new FakeClock(), fetchFn as HttpFetch).getAccessToken();

    const [url, init] = fetchFn.mock.calls[0] as [
      string,
      { method: string; body: string; headers: Record<string, string> },
    ];
    expect(url).toBe("https://f992av-n1.myshopify.com/admin/oauth/access_token");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

    const body = new URLSearchParams(init.body);
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_id")).toBe("client-id-de-test");
    expect(body.get("client_secret")).toBe("client-secret-de-test");
  });
});

describe("ShopifyTokenProvider — cache et renouvellement", () => {
  it("réutilise le token tant qu'il est valide", async () => {
    const fetchFn = vi.fn().mockResolvedValue(tokenResponse("shpat_abc", 86_399));
    const provider = new ShopifyTokenProvider(config, new FakeClock(), fetchFn as HttpFetch);

    await provider.getAccessToken();
    await provider.getAccessToken();
    await provider.getAccessToken();

    // Un seul échange : les tokens Shopify durent ~24 h, en redemander à chaque appel
    // consommerait le quota d'authentification pour rien.
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("renouvelle le token une fois la durée de vie écoulée", async () => {
    const clock = new FakeClock(new Date("2026-01-01T00:00:00.000Z"));
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse("shpat_premier", 3_600))
      .mockResolvedValueOnce(tokenResponse("shpat_second", 3_600));
    const provider = new ShopifyTokenProvider(config, clock, fetchFn as HttpFetch);

    const first = await provider.getAccessToken();
    clock.advanceTo(new Date("2026-01-01T02:00:00.000Z"));
    const second = await provider.getAccessToken();

    expect(first.success && first.output).toBe("shpat_premier");
    expect(second.success && second.output).toBe("shpat_second");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("renouvelle en avance, avant l'échéance exacte", async () => {
    const clock = new FakeClock(new Date("2026-01-01T00:00:00.000Z"));
    const fetchFn = vi.fn().mockResolvedValue(tokenResponse("shpat_abc", 120));
    const provider = new ShopifyTokenProvider(config, clock, fetchFn as HttpFetch);

    await provider.getAccessToken();
    // 90 s : le token est encore techniquement valide (120 s), mais dans la marge de
    // sécurité de 60 s — un appel parti maintenant pourrait arriver après expiration.
    clock.advanceTo(new Date("2026-01-01T00:01:30.000Z"));
    await provider.getAccessToken();

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("mutualise les demandes concurrentes en un seul échange", async () => {
    const fetchFn = vi.fn().mockResolvedValue(tokenResponse("shpat_abc", 86_399));
    const provider = new ShopifyTokenProvider(config, new FakeClock(), fetchFn as HttpFetch);

    const results = await Promise.all([
      provider.getAccessToken(),
      provider.getAccessToken(),
      provider.getAccessToken(),
    ]);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it("redemande un token après invalidation", async () => {
    const fetchFn = vi.fn().mockResolvedValue(tokenResponse("shpat_abc", 86_399));
    const provider = new ShopifyTokenProvider(config, new FakeClock(), fetchFn as HttpFetch);

    await provider.getAccessToken();
    provider.invalidate();
    await provider.getAccessToken();

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("applique une durée de vie courte quand Shopify omet expires_in", async () => {
    const clock = new FakeClock(new Date("2026-01-01T00:00:00.000Z"));
    const fetchFn = vi.fn().mockResolvedValue(tokenResponse("shpat_abc"));
    const provider = new ShopifyTokenProvider(config, clock, fetchFn as HttpFetch);

    await provider.getAccessToken();
    clock.advanceTo(new Date("2026-01-01T00:10:00.000Z"));
    await provider.getAccessToken();

    // Sans échéance connue, mieux vaut redemander trop tôt que d'utiliser un token expiré.
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe("ShopifyTokenProvider — erreurs", () => {
  it("traite des identifiants refusés comme NON rejouable", async () => {
    const provider = new ShopifyTokenProvider(
      config,
      new FakeClock(),
      vi.fn().mockResolvedValue(errorResponse(401)) as HttpFetch,
    );

    const result = await provider.getAccessToken();

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.SHOPIFY_AUTH_ERROR);
    expect(result.error.retryable).toBe(false);
    expect(result.error.message).toContain("SHOPIFY_CLIENT_ID");
  });

  it("traite un 400 comme un refus d'identifiants, non rejouable", async () => {
    const provider = new ShopifyTokenProvider(
      config,
      new FakeClock(),
      vi.fn().mockResolvedValue(errorResponse(400, "invalid_client")) as HttpFetch,
    );

    const result = await provider.getAccessToken();

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.retryable).toBe(false);
  });

  it("oriente vers SHOPIFY_STORE_DOMAIN quand la boutique est introuvable", async () => {
    const provider = new ShopifyTokenProvider(
      config,
      new FakeClock(),
      vi.fn().mockResolvedValue(errorResponse(404)) as HttpFetch,
    );

    const result = await provider.getAccessToken();

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.message).toContain("SHOPIFY_STORE_DOMAIN");
  });

  it("traite un quota dépassé comme rejouable", async () => {
    const provider = new ShopifyTokenProvider(
      config,
      new FakeClock(),
      vi.fn().mockResolvedValue(errorResponse(429)) as HttpFetch,
    );

    const result = await provider.getAccessToken();

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.SHOPIFY_RATE_LIMIT);
    expect(result.error.retryable).toBe(true);
  });

  it("traite une panne Shopify comme rejouable", async () => {
    const provider = new ShopifyTokenProvider(
      config,
      new FakeClock(),
      vi.fn().mockResolvedValue(errorResponse(503)) as HttpFetch,
    );

    const result = await provider.getAccessToken();

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.SHOPIFY_UNAVAILABLE);
    expect(result.error.retryable).toBe(true);
  });

  it("rejette une réponse sans token exploitable", async () => {
    const provider = new ShopifyTokenProvider(
      config,
      new FakeClock(),
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ scope: "write_products" }),
      }) as HttpFetch,
    );

    const result = await provider.getAccessToken();

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.SHOPIFY_AUTH_ERROR);
  });

  it("ne met rien en cache après un échec", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(tokenResponse("shpat_abc", 86_399));
    const provider = new ShopifyTokenProvider(config, new FakeClock(), fetchFn as HttpFetch);

    const failed = await provider.getAccessToken();
    const recovered = await provider.getAccessToken();

    expect(failed.success).toBe(false);
    expect(recovered.success).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("ne divulgue jamais le client secret dans un message d'erreur", async () => {
    const provider = new ShopifyTokenProvider(
      config,
      new FakeClock(),
      vi.fn().mockResolvedValue(errorResponse(401)) as HttpFetch,
    );

    const result = await provider.getAccessToken();

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.message).not.toContain(config.clientSecret);
  });

  it("ne lève jamais d'exception : toute panne devient un AgentResult", async () => {
    const provider = new ShopifyTokenProvider(
      config,
      new FakeClock(),
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as HttpFetch,
    );

    await expect(provider.getAccessToken()).resolves.toMatchObject({ success: false });
  });
});

describe("normalizeStoreDomain", () => {
  it("accepte un domaine myshopify complet", () => {
    expect(normalizeStoreDomain("f992av-n1.myshopify.com")).toBe("f992av-n1.myshopify.com");
  });

  it("extrait le domaine d'une URL d'administration copiée-collée", () => {
    // Cas réel : le domaine est souvent copié depuis la barre d'adresse de l'admin.
    expect(normalizeStoreDomain("https://admin.shopify.com/store/f992av-n1/settings/domains")).toBe(
      "f992av-n1.myshopify.com",
    );
  });

  it("complète un handle nu", () => {
    expect(normalizeStoreDomain("f992av-n1")).toBe("f992av-n1.myshopify.com");
  });

  it("retire le protocole et le chemin d'une URL de boutique", () => {
    expect(normalizeStoreDomain("https://f992av-n1.myshopify.com/admin")).toBe(
      "f992av-n1.myshopify.com",
    );
  });

  it("échoue explicitement sur une valeur inexploitable", () => {
    expect(() => normalizeStoreDomain("ceci n'est pas un domaine")).toThrow(/SHOPIFY_STORE_DOMAIN/);
  });
});
