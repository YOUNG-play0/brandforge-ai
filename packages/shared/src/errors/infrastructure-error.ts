import type { AgentError } from "./agent-error.js";

/**
 * Erreur technique convertie à la frontière de l'infrastructure (CODING_STANDARDS.md §5).
 *
 * Les ports de repository du domaine retournent des entités, pas des `ActionResult` : une
 * panne d'infrastructure (base indisponible, contrainte violée) n'est pas un cas métier et
 * ne doit pas polluer la signature de chaque port. Elle est donc **levée**, mais sous une
 * forme déjà typée — le domaine ne voit jamais une exception Prisma brute.
 *
 * La couche de présentation la rattrape et la convertit en `ActionResult` d'échec via
 * `toActionResult`.
 */
export class InfrastructureError extends Error {
  constructor(readonly agentError: AgentError) {
    super(`${agentError.code}: ${agentError.message}`);
    this.name = "InfrastructureError";
  }
}

/** Vrai si la valeur levée est une `InfrastructureError`. */
export function isInfrastructureError(error: unknown): error is InfrastructureError {
  return error instanceof InfrastructureError;
}
