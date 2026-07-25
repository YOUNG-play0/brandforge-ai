import {
  ERROR_CODES,
  actionFail,
  actionOk,
  createAgentError,
  type ActionResult,
} from "@brandforge/shared";
import type { IShopifyAgent } from "../ports/shopify-agent.port.js";
import type { IStoreProjectRepository } from "../../orchestration/ports/store-project-repository.port.js";

/** Entrée de `publishStore` (API.md §10). */
export interface PublishStoreInput {
  readonly storeProjectId: string;
}

/** Sortie de `publishStore` (API.md §10). */
export interface PublishStoreOutput {
  readonly status: "PUBLISHED";
  readonly storeUrl: string;
}

/** Publie la boutique et rend le projet accessible publiquement. */
export class PublishStore {
  constructor(
    private readonly storeProjects: IStoreProjectRepository,
    private readonly shopifyAgent: IShopifyAgent,
  ) {}

  async execute(input: PublishStoreInput): Promise<ActionResult<PublishStoreOutput>> {
    const project = await this.storeProjects.findById(input.storeProjectId);
    if (project === null) {
      return actionFail(
        createAgentError(ERROR_CODES.STORE_PROJECT_NOT_FOUND, "Projet introuvable.", false),
      );
    }

    const executed = await this.shopifyAgent.execute({
      storeProjectId: project.id,
      action: "PUBLISH_STORE",
    });

    if (!executed.success) {
      return actionFail(executed.error);
    }

    // Une boutique publiée sans URL publique ne satisfait pas le critère d'acceptation
    // n°6 du PRD (« accessible, pas seulement en preview »).
    const storeUrl = executed.output.url;
    if (storeUrl === undefined) {
      return actionFail(
        createAgentError(
          ERROR_CODES.SHOPIFY_VALIDATION_ERROR,
          "La boutique a été publiée sans URL publique exploitable.",
          false,
        ),
      );
    }

    return actionOk({ status: "PUBLISHED", storeUrl });
  }
}
