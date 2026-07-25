import type { AgentResult } from "@brandforge/shared";

/**
 * Port du fournisseur IA (ARCHITECTURE.md §10).
 *
 * Volontairement générique et sans référence à Groq : changer de fournisseur consiste à
 * fournir une autre implémentation dans `infrastructure/ai-provider`, sans toucher aux
 * agents ni au domaine.
 *
 * L'implémentation est responsable du timeout (`AI_PROVIDER_TIMEOUT_MS`) et convertit
 * toute erreur technique en `AgentError` (`AI_PROVIDER_TIMEOUT`,
 * `AI_PROVIDER_INVALID_RESPONSE`) avant de la retourner.
 */
export interface IAiProvider {
  /**
   * Demande au modèle une réponse conforme à un schéma JSON attendu.
   *
   * La validation de la sortie est faite par l'implémentation : un agent ne doit jamais
   * recevoir une structure non conforme (AI_AGENTS.md §9, règle 4).
   */
  generateStructured<TOutput>(request: AiCompletionRequest<TOutput>): Promise<AgentResult<TOutput>>;

  /** Demande une génération de texte libre (usages non structurés). */
  generateText(request: AiTextRequest): Promise<AgentResult<string>>;
}

/** Paramètres communs à toute requête vers le fournisseur IA. */
export interface AiRequestOptions {
  /** Surcharge du timeout par défaut, en millisecondes. */
  readonly timeoutMs?: number;
  /** Créativité du modèle, de 0 (déterministe) à 1. */
  readonly temperature?: number;
}

/** Requête de génération structurée, validée contre `schema` avant retour. */
export interface AiCompletionRequest<TOutput> extends AiRequestOptions {
  /** Instruction de rôle donnée au modèle. */
  readonly systemPrompt: string;
  /** Demande concrète, construite par l'agent à partir de son entrée typée. */
  readonly userPrompt: string;
  /**
   * Valide et convertit la réponse brute du modèle en sortie typée.
   * Retourne `null` si la réponse est inexploitable.
   */
  readonly parse: (raw: unknown) => TOutput | null;
}

/** Requête de génération de texte libre. */
export interface AiTextRequest extends AiRequestOptions {
  readonly systemPrompt: string;
  readonly userPrompt: string;
}
