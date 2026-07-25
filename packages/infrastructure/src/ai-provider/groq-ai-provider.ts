import {
  ERROR_CODES,
  agentFail,
  agentOk,
  createAgentError,
  type AgentError,
  type AgentResult,
} from "@brandforge/shared";
import type { AiCompletionRequest, AiTextRequest, IAiProvider } from "@brandforge/domain";
import type { GroqConfig } from "./groq-config.js";

/** Sous-ensemble de `fetch` utilisé ici — injectable pour tester sans réseau. */
export type FetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

/** Réponse Chat Completions exploitée par ce client. */
interface GroqChatResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * Implémentation Groq du port `IAiProvider` (ARCHITECTURE.md §10).
 *
 * Responsabilités confinées au transport : appliquer le timeout, appeler l'API, et
 * convertir tout échec en `AgentError` typée. Cette classe ne connaît aucun agent et
 * aucune règle métier — c'est ce qui permet de changer de fournisseur sans toucher au
 * domaine ni aux agents.
 *
 * **Aucune reprise automatique ici** : le nombre de tentatives et le backoff sont pilotés
 * par l'Orchestrator (WORKFLOWS.md §4.1). Empiler un retry transport et un retry d'étape
 * multiplierait les appels facturés sans que personne ne maîtrise le total.
 */
export class GroqAiProvider implements IAiProvider {
  constructor(
    private readonly config: GroqConfig,
    private readonly fetchFn: FetchLike = globalThis.fetch,
  ) {}

  async generateStructured<TOutput>(
    request: AiCompletionRequest<TOutput>,
  ): Promise<AgentResult<TOutput>> {
    const completion = await this.complete(request.systemPrompt, request.userPrompt, {
      json: true,
      ...(request.timeoutMs === undefined ? {} : { timeoutMs: request.timeoutMs }),
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
    });

    if (!completion.success) {
      return agentFail(completion.error);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(completion.output);
    } catch (error) {
      return agentFail(
        createAgentError(
          ERROR_CODES.AI_PROVIDER_INVALID_RESPONSE,
          "Le modèle n'a pas renvoyé de JSON exploitable.",
          true,
          error,
        ),
      );
    }

    // La validation de forme appartient à l'appelant : lui seul connaît la structure
    // attendue. Une réponse non conforme est rejetée ici et n'atteint jamais la base
    // (AI_AGENTS.md §9, règle 4).
    const validated = request.parse(parsedJson);
    if (validated === null) {
      return agentFail(
        createAgentError(
          ERROR_CODES.AI_PROVIDER_INVALID_RESPONSE,
          "La réponse du modèle ne respecte pas le schéma attendu.",
          true,
        ),
      );
    }

    return agentOk(validated);
  }

  async generateText(request: AiTextRequest): Promise<AgentResult<string>> {
    return this.complete(request.systemPrompt, request.userPrompt, {
      json: false,
      ...(request.timeoutMs === undefined ? {} : { timeoutMs: request.timeoutMs }),
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
    });
  }

  private async complete(
    systemPrompt: string,
    userPrompt: string,
    options: { json: boolean; timeoutMs?: number; temperature?: number },
  ): Promise<AgentResult<string>> {
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await this.fetchFn(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
          ...(options.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return agentFail(await httpError(response));
      }

      const body = await response.text();
      const content = extractContent(body);
      if (content === null) {
        return agentFail(
          createAgentError(
            ERROR_CODES.AI_PROVIDER_INVALID_RESPONSE,
            "Réponse du fournisseur IA sans contenu exploitable.",
            true,
          ),
        );
      }

      return agentOk(content);
    } catch (error) {
      return agentFail(networkError(error, timeoutMs));
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Traduit un statut HTTP en erreur typée, en décidant si une reprise a du sens. */
async function httpError(response: {
  status: number;
  text: () => Promise<string>;
}): Promise<AgentError> {
  const detail = await safeText(response);

  // Clé invalide ou révoquée : rejouer épuiserait le budget de tentatives pour rien.
  if (response.status === 401 || response.status === 403) {
    return createAgentError(
      ERROR_CODES.AI_PROVIDER_AUTH_ERROR,
      "Clé d'API du fournisseur IA invalide ou révoquée. Vérifiez GROQ_API_KEY.",
      false,
      detail,
    );
  }

  if (response.status === 429) {
    return createAgentError(
      ERROR_CODES.AI_PROVIDER_RATE_LIMIT,
      "Quota du fournisseur IA dépassé.",
      true,
      detail,
    );
  }

  if (response.status >= 500) {
    return createAgentError(
      ERROR_CODES.AI_PROVIDER_UNAVAILABLE,
      `Le fournisseur IA est indisponible (HTTP ${String(response.status)}).`,
      true,
      detail,
    );
  }

  // 4xx restants : requête mal formée de notre côté, réessayer ne corrigerait rien.
  return createAgentError(
    ERROR_CODES.AI_PROVIDER_INVALID_RESPONSE,
    `Requête refusée par le fournisseur IA (HTTP ${String(response.status)}).`,
    false,
    detail,
  );
}

/** Distingue un dépassement de délai d'une panne réseau. */
function networkError(error: unknown, timeoutMs: number): AgentError {
  if (error instanceof Error && error.name === "AbortError") {
    return createAgentError(
      ERROR_CODES.AI_PROVIDER_TIMEOUT,
      `Le fournisseur IA n'a pas répondu en moins de ${String(timeoutMs)} ms.`,
      true,
      error,
    );
  }

  return createAgentError(
    ERROR_CODES.AI_PROVIDER_UNAVAILABLE,
    "Le fournisseur IA est injoignable.",
    true,
    error,
  );
}

/** Extrait le contenu du premier choix, ou `null` si la réponse est inexploitable. */
function extractContent(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as GroqChatResponse;
    const content = parsed.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim().length > 0 ? content : null;
  } catch {
    return null;
  }
}

/** Lit le corps d'une réponse en erreur sans jamais masquer l'erreur d'origine. */
async function safeText(response: { text: () => Promise<string> }): Promise<string | undefined> {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}
