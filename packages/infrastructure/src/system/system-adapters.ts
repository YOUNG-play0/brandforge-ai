import { randomUUID } from "node:crypto";
import type { IClock, IIdGenerator } from "@brandforge/domain";

/**
 * Implémentations réelles des ports techniques transverses du domaine.
 *
 * Le domaine ne dépend que des interfaces : c'est ce qui permet de les remplacer par des
 * doublures déterministes en test (CODING_STANDARDS.md §7).
 */

/** Génère des UUID v4, cohérents avec les identifiants attendus par le schéma Prisma. */
export class UuidGenerator implements IIdGenerator {
  generate(): string {
    return randomUUID();
  }
}

/** Horloge système. */
export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}
