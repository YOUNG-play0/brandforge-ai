import { PrismaClient } from "@prisma/client";

/**
 * Client Prisma partagé.
 *
 * Réutilisé via un singleton attaché au scope global : en développement, le rechargement
 * à chaud de Next.js réévalue les modules et créerait sinon un nouveau pool de connexions
 * à chaque changement, jusqu'à saturer la base.
 */
const globalForPrisma = globalThis as unknown as { brandforgePrisma?: PrismaClient };

export function getPrismaClient(): PrismaClient {
  const existing = globalForPrisma.brandforgePrisma;
  if (existing !== undefined) {
    return existing;
  }

  const client = new PrismaClient();
  if (process.env["NODE_ENV"] !== "production") {
    globalForPrisma.brandforgePrisma = client;
  }
  return client;
}

/** Type minimal attendu par les repositories, pour faciliter le test avec une doublure. */
export type PrismaDatabase = PrismaClient;
