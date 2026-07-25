import { actionOk, type ActionResult } from "@brandforge/shared";
import type { ProductSource } from "../value-objects/product-status.vo.js";
import type { RawProductInput } from "../ports/product-agent.port.js";
import type { ImportProduct } from "./import-product.usecase.js";

/** Entrée de `importProductsBatch` (API.md §8). */
export interface ImportProductsBatchInput {
  readonly storeProjectId: string;
  readonly source: ProductSource;
  readonly products: readonly RawProductInput[];
}

/** Sortie de `importProductsBatch` (API.md §8). */
export interface ImportProductsBatchOutput {
  readonly importedCount: number;
  readonly failedCount: number;
  readonly productIds: readonly string[];
  /** Détail des échecs, pour affichage dans le dashboard sans bloquer la suite. */
  readonly failures: readonly BatchImportFailure[];
}

/** Échec d'import d'un produit du lot. */
export interface BatchImportFailure {
  /** Position du produit dans le lot soumis. */
  readonly index: number;
  readonly title: string;
  readonly errorCode: string;
  readonly errorMessage: string;
}

/**
 * Importe un lot de produits (cas d'usage n°3 du PRD).
 *
 * Chaque produit est traité indépendamment : un échec est collecté et n'interrompt jamais
 * le reste du lot (WORKFLOWS.md §5). Le résultat global est donc toujours un succès —
 * c'est l'Orchestrator qui traduira un lot partiellement échoué en
 * `StepStatus.PARTIAL_SUCCESS`.
 */
export class ImportProductsBatch {
  constructor(private readonly importProduct: ImportProduct) {}

  async execute(input: ImportProductsBatchInput): Promise<ActionResult<ImportProductsBatchOutput>> {
    const productIds: string[] = [];
    const failures: BatchImportFailure[] = [];

    // Traitement séquentiel volontaire : le fournisseur IA et l'API Shopify sont soumis à
    // des quotas, un envoi en parallèle déclencherait des erreurs de rate limit.
    for (const [index, rawProduct] of input.products.entries()) {
      const imported = await this.importProduct.execute({
        storeProjectId: input.storeProjectId,
        source: input.source,
        rawProduct,
      });

      if (imported.success) {
        productIds.push(imported.data.productId);
      } else {
        failures.push({
          index,
          title: rawProduct.title,
          errorCode: imported.error.code,
          errorMessage: imported.error.message,
        });
      }
    }

    return actionOk({
      importedCount: productIds.length,
      failedCount: failures.length,
      productIds,
      failures,
    });
  }
}
