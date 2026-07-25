/**
 * Lecture des variables d'environnement.
 *
 * `packages/infrastructure` est la **seule** couche autorisée à lire l'environnement
 * (CODING_STANDARDS.md §9) : ni `apps/web` ni un agent ne doivent accéder à `process.env`.
 * Toute valeur manquante ou malformée échoue ici, au démarrage, plutôt qu'au premier appel.
 */

/** Lit une variable obligatoire, ou échoue avec un message actionnable. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Voir .env.example pour la renseigner.`,
    );
  }
  return value;
}

/** Lit une variable numérique optionnelle, en retombant sur la valeur par défaut. */
export function optionalNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Variable d'environnement invalide : ${name} doit être un nombre.`);
  }
  return parsed;
}

/** Configuration de la base de données. */
export interface DatabaseConfig {
  readonly url: string;
}

export function loadDatabaseConfig(): DatabaseConfig {
  return { url: requireEnv("DATABASE_URL") };
}
