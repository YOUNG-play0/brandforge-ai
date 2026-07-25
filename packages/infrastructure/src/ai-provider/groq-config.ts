import { DEFAULT_AI_TIMEOUT_MS } from "@brandforge/shared";
import { optionalNumberEnv, requireEnv } from "../config/env.js";

/**
 * Modèle Groq par défaut.
 *
 * Configurable par `GROQ_MODEL` : changer de modèle ne doit jamais demander de toucher au
 * code d'un agent (ARCHITECTURE.md §10).
 */
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

/** Endpoint Groq, compatible avec le format OpenAI Chat Completions. */
const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";

/** Configuration du fournisseur IA, lue depuis l'environnement. */
export interface GroqConfig {
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;
}

/**
 * Charge la configuration Groq.
 *
 * Échoue immédiatement si `GROQ_API_KEY` est absente : mieux vaut un démarrage impossible
 * qu'un pipeline qui part et s'effondre à la première étape.
 */
export function loadGroqConfig(): GroqConfig {
  return {
    apiKey: requireEnv("GROQ_API_KEY"),
    model: process.env["GROQ_MODEL"]?.trim() || DEFAULT_GROQ_MODEL,
    baseUrl: process.env["GROQ_BASE_URL"]?.trim() || DEFAULT_GROQ_BASE_URL,
    timeoutMs: optionalNumberEnv("AI_PROVIDER_TIMEOUT_MS", DEFAULT_AI_TIMEOUT_MS),
  };
}
