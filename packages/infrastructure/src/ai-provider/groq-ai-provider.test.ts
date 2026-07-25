import { describe, expect, it, vi } from "vitest";
import { ERROR_CODES } from "@brandforge/shared";
import { GroqAiProvider, type FetchLike } from "./groq-ai-provider.js";
import type { GroqConfig } from "./groq-config.js";

const config: GroqConfig = {
  apiKey: "test-key",
  model: "llama-3.3-70b-versatile",
  baseUrl: "https://api.groq.test/openai/v1",
  timeoutMs: 30_000,
};

/** Réponse Chat Completions dont le contenu est `content`. */
function chatResponse(content: string): {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
} {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
  };
}

function errorResponse(
  status: number,
  body = "erreur",
): {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
} {
  return { ok: false, status, text: async () => body };
}

function fetchReturning(response: Awaited<ReturnType<FetchLike>>): FetchLike {
  return vi.fn().mockResolvedValue(response);
}

/** Parseur acceptant tout objet portant un champ `value` textuel. */
const parseValue = (raw: unknown): { value: string } | null => {
  if (typeof raw === "object" && raw !== null && "value" in raw) {
    const value = raw.value;
    return typeof value === "string" ? { value } : null;
  }
  return null;
};

describe("GroqAiProvider.generateStructured", () => {
  it("retourne la sortie validée quand le modèle répond correctement", async () => {
    const provider = new GroqAiProvider(
      config,
      fetchReturning(chatResponse('{"value":"lunettes"}')),
    );

    const result = await provider.generateStructured({
      systemPrompt: "sys",
      userPrompt: "user",
      parse: parseValue,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.output).toEqual({ value: "lunettes" });
  });

  it("demande explicitement une réponse JSON au modèle", async () => {
    const fetchFn = vi.fn().mockResolvedValue(chatResponse('{"value":"x"}'));
    const provider = new GroqAiProvider(config, fetchFn);

    await provider.generateStructured({
      systemPrompt: "sys",
      userPrompt: "user",
      parse: parseValue,
    });

    const body = JSON.parse((fetchFn.mock.calls[0]?.[1] as { body: string }).body) as {
      response_format?: { type: string };
      model: string;
    };
    expect(body.response_format?.type).toBe("json_object");
    expect(body.model).toBe("llama-3.3-70b-versatile");
  });

  it("transmet la clé d'API dans l'en-tête d'autorisation", async () => {
    const fetchFn = vi.fn().mockResolvedValue(chatResponse('{"value":"x"}'));
    const provider = new GroqAiProvider(config, fetchFn);

    await provider.generateStructured({
      systemPrompt: "sys",
      userPrompt: "user",
      parse: parseValue,
    });

    const headers = (fetchFn.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers;
    expect(headers["Authorization"]).toBe("Bearer test-key");
  });

  it("rejette une réponse qui n'est pas du JSON", async () => {
    const provider = new GroqAiProvider(config, fetchReturning(chatResponse("pas du json")));

    const result = await provider.generateStructured({
      systemPrompt: "sys",
      userPrompt: "user",
      parse: parseValue,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.AI_PROVIDER_INVALID_RESPONSE);
    expect(result.error.retryable).toBe(true);
  });

  it("rejette un JSON valide mais non conforme au schéma attendu", async () => {
    const provider = new GroqAiProvider(config, fetchReturning(chatResponse('{"autre":1}')));

    const result = await provider.generateStructured({
      systemPrompt: "sys",
      userPrompt: "user",
      parse: parseValue,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.AI_PROVIDER_INVALID_RESPONSE);
  });

  it("rejette une réponse sans contenu", async () => {
    const provider = new GroqAiProvider(config, fetchReturning(chatResponse("   ")));

    const result = await provider.generateStructured({
      systemPrompt: "sys",
      userPrompt: "user",
      parse: parseValue,
    });

    expect(result.success).toBe(false);
  });
});

describe("GroqAiProvider — traduction des erreurs HTTP", () => {
  it("traite une clé invalide comme NON rejouable", async () => {
    const provider = new GroqAiProvider(config, fetchReturning(errorResponse(401)));

    const result = await provider.generateText({ systemPrompt: "sys", userPrompt: "user" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.AI_PROVIDER_AUTH_ERROR);
    // Rejouer une clé révoquée épuiserait le budget de tentatives sans jamais aboutir.
    expect(result.error.retryable).toBe(false);
    expect(result.error.message).toContain("GROQ_API_KEY");
  });

  it("traite un quota dépassé comme rejouable", async () => {
    const provider = new GroqAiProvider(config, fetchReturning(errorResponse(429)));

    const result = await provider.generateText({ systemPrompt: "sys", userPrompt: "user" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.AI_PROVIDER_RATE_LIMIT);
    expect(result.error.retryable).toBe(true);
  });

  it("traite une panne serveur comme rejouable", async () => {
    const provider = new GroqAiProvider(config, fetchReturning(errorResponse(503)));

    const result = await provider.generateText({ systemPrompt: "sys", userPrompt: "user" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
    expect(result.error.retryable).toBe(true);
  });

  it("traite une requête refusée (400) comme non rejouable", async () => {
    const provider = new GroqAiProvider(config, fetchReturning(errorResponse(400)));

    const result = await provider.generateText({ systemPrompt: "sys", userPrompt: "user" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.retryable).toBe(false);
  });

  it("traduit une interruption par timeout en AI_PROVIDER_TIMEOUT rejouable", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    const provider = new GroqAiProvider(config, vi.fn().mockRejectedValue(abort));

    const result = await provider.generateText({ systemPrompt: "sys", userPrompt: "user" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.AI_PROVIDER_TIMEOUT);
    expect(result.error.retryable).toBe(true);
  });

  it("traduit une panne réseau en AI_PROVIDER_UNAVAILABLE", async () => {
    const provider = new GroqAiProvider(
      config,
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );

    const result = await provider.generateText({ systemPrompt: "sys", userPrompt: "user" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.AI_PROVIDER_UNAVAILABLE);
  });

  it("ne lève jamais d'exception : toute panne devient un AgentResult d'échec", async () => {
    const provider = new GroqAiProvider(config, vi.fn().mockRejectedValue("panne non-Error"));

    await expect(
      provider.generateText({ systemPrompt: "sys", userPrompt: "user" }),
    ).resolves.toMatchObject({ success: false });
  });
});

describe("GroqAiProvider — timeout", () => {
  it("interrompt l'appel au-delà du délai configuré", async () => {
    // `fetch` qui ne répond jamais : seul le signal d'abandon peut débloquer l'appel.
    const hangingFetch = ((_url: string, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const abort = new Error("aborted");
          abort.name = "AbortError";
          reject(abort);
        });
      })) as unknown as FetchLike;

    const provider = new GroqAiProvider({ ...config, timeoutMs: 10 }, hangingFetch);

    const result = await provider.generateText({ systemPrompt: "sys", userPrompt: "user" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.AI_PROVIDER_TIMEOUT);
  });
});
