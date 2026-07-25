import type { AgentResult } from "@brandforge/shared";
import type { RawProductInput } from "./product-agent.port.js";

/**
 * Port d'une source de produits externe (ARCHITECTURE.md §10).
 *
 * Implémenté par le module `infrastructure/scraping`, alimenté par l'extension Chrome
 * AliExpress. Distinct de `IProductRepository` (Interface Segregation, ARCHITECTURE.md
 * §11) : lire un catalogue externe et persister un produit sont deux responsabilités
 * différentes.
 *
 * Ajouter une autre source (autre marketplace) consiste à fournir une nouvelle
 * implémentation, sans modifier le Product Agent.
 */
export interface IProductSource {
  /** Récupère les données d'un produit depuis son URL sur la plateforme source. */
  fetchProduct(sourceUrl: string): Promise<AgentResult<RawProductInput>>;
}
