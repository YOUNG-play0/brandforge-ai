import { ERROR_CODES, InfrastructureError, createAgentError } from "@brandforge/shared";
import { Prisma } from "@prisma/client";

/**
 * Frontière d'erreurs de la couche base de données (CODING_STANDARDS.md §5).
 *
 * Toute exception Prisma est convertie en `InfrastructureError` porteuse d'une
 * `AgentError` typée : le domaine ne manipule jamais une exception de librairie externe.
 *
 * Le flag `retryable` est déterminé ici, car seule cette couche sait si l'échec est
 * transitoire (connexion perdue) ou définitif (contrainte d'unicité violée).
 */
export function toInfrastructureError(error: unknown, operation: string): InfrastructureError {
  if (error instanceof InfrastructureError) {
    return error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return new InfrastructureError(mapKnownRequestError(error, operation));
  }

  // Panne de connexion / base injoignable : réessayer a du sens.
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return new InfrastructureError(
      createAgentError(
        ERROR_CODES.DATABASE_UNAVAILABLE,
        `Base de données injoignable lors de l'opération « ${operation} ».`,
        true,
        error,
      ),
    );
  }

  // Requête malformée : bug de code, aucune tentative supplémentaire ne changera rien.
  if (error instanceof Prisma.PrismaClientValidationError) {
    return new InfrastructureError(
      createAgentError(
        ERROR_CODES.DATABASE_ERROR,
        `Requête invalide lors de l'opération « ${operation} ».`,
        false,
        error,
      ),
    );
  }

  return new InfrastructureError(
    createAgentError(
      ERROR_CODES.DATABASE_ERROR,
      `Erreur inattendue lors de l'opération « ${operation} ».`,
      false,
      error,
    ),
  );
}

function mapKnownRequestError(
  error: Prisma.PrismaClientKnownRequestError,
  operation: string,
): ReturnType<typeof createAgentError> {
  switch (error.code) {
    // P2002 — violation de contrainte d'unicité.
    case "P2002":
      return createAgentError(
        ERROR_CODES.DATABASE_CONFLICT,
        `Cette ressource existe déjà (opération « ${operation} »).`,
        false,
        error,
      );
    // P2003 — clé étrangère invalide ; P2025 — enregistrement requis introuvable.
    case "P2003":
    case "P2025":
      return createAgentError(
        ERROR_CODES.DATABASE_CONFLICT,
        `Ressource liée introuvable (opération « ${operation} »).`,
        false,
        error,
      );
    // P1001/P1002 — serveur injoignable ou délai dépassé.
    case "P1001":
    case "P1002":
      return createAgentError(
        ERROR_CODES.DATABASE_UNAVAILABLE,
        `Base de données injoignable lors de l'opération « ${operation} ».`,
        true,
        error,
      );
    default:
      return createAgentError(
        ERROR_CODES.DATABASE_ERROR,
        `Erreur base de données ${error.code} lors de l'opération « ${operation} ».`,
        false,
        error,
      );
  }
}

/** Exécute une opération Prisma en convertissant toute exception à la frontière. */
export async function runQuery<T>(operation: string, query: () => Promise<T>): Promise<T> {
  try {
    return await query();
  } catch (error) {
    throw toInfrastructureError(error, operation);
  }
}
