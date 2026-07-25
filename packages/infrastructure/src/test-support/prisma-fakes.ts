/**
 * Doublure minimale du client Prisma, réservée aux tests.
 *
 * Permet de vérifier les requêtes émises par les repositories et la conversion des
 * erreurs sans base de données réelle (CODING_STANDARDS.md §7). Les tests d'intégration
 * sur une vraie base sont isolés en `*.integration.test.ts` et hors CI par défaut.
 */
import { vi } from "vitest";
import type { PrismaDatabase } from "../database/prisma-client.js";

/** Ensemble des méthodes simulées pour un modèle Prisma. */
export interface FakeDelegate {
  findUnique: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
}

function fakeDelegate(): FakeDelegate {
  return {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
}

/** Client Prisma simulé, exposant les délégués utilisés par les repositories. */
export interface FakePrisma {
  storeProject: FakeDelegate;
  nicheAnalysis: FakeDelegate;
  brand: FakeDelegate;
  brandAsset: FakeDelegate;
  product: FakeDelegate;
  seoContent: FakeDelegate;
  pipelineRun: FakeDelegate;
  pipelineStep: FakeDelegate;
  $transaction: ReturnType<typeof vi.fn>;
}

/**
 * Crée un client Prisma simulé.
 *
 * `$transaction` exécute immédiatement la fonction reçue en lui passant le client
 * lui-même : les repositories sont ainsi testés avec leur logique transactionnelle réelle.
 */
export function createFakePrisma(): FakePrisma {
  const fake: FakePrisma = {
    storeProject: fakeDelegate(),
    nicheAnalysis: fakeDelegate(),
    brand: fakeDelegate(),
    brandAsset: fakeDelegate(),
    product: fakeDelegate(),
    seoContent: fakeDelegate(),
    pipelineRun: fakeDelegate(),
    pipelineStep: fakeDelegate(),
    $transaction: vi.fn(),
  };

  fake.$transaction.mockImplementation(async (callback: (tx: FakePrisma) => Promise<unknown>) =>
    callback(fake),
  );

  return fake;
}

/** Convertit la doublure au type attendu par les repositories. */
export function asPrisma(fake: FakePrisma): PrismaDatabase {
  return fake as unknown as PrismaDatabase;
}
