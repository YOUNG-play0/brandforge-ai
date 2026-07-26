/**
 * Doublures des ports techniques, réservées aux tests de l'infrastructure.
 *
 * Le domaine dispose des siennes, mais elles ne font pas partie de son API publique :
 * chaque package embarque donc ses propres doublures plutôt que d'exporter du code de
 * test.
 */
import type { IClock } from "@brandforge/domain";

/**
 * Horloge pilotée manuellement.
 *
 * Indispensable pour tester l'expiration et le renouvellement d'un token sans attendre
 * réellement 24 heures.
 */
export class FakeClock implements IClock {
  constructor(private current: Date = new Date("2026-01-01T00:00:00.000Z")) {}

  now(): Date {
    return this.current;
  }

  advanceTo(date: Date): void {
    this.current = date;
  }

  /** Avance l'horloge d'une durée relative, en millisecondes. */
  advanceBy(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}
