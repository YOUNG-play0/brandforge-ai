import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@brandforge/shared";
import { PublishStore } from "./publish-store.usecase.js";
import type { ShopifyAgentInput, ShopifyAgentOutput } from "../ports/shopify-agent.port.js";
import {
  InMemoryStoreProjectRepository,
  stubAgentFail,
  stubAgentOk,
  type StubAgent,
} from "../../test-support/fakes.js";
import { aStoreProject } from "../../test-support/builders.js";
import { AgentName } from "../../orchestration/value-objects/agent-name.vo.js";

function okAgent(output: ShopifyAgentOutput): StubAgent<ShopifyAgentInput, ShopifyAgentOutput> {
  return stubAgentOk<ShopifyAgentInput, ShopifyAgentOutput>(AgentName.SHOPIFY, output);
}

async function repositoryWithProject() {
  const storeProjects = new InMemoryStoreProjectRepository();
  await storeProjects.save(aStoreProject());
  return storeProjects;
}

describe("PublishStore", () => {
  it("publie la boutique et retourne son URL publique", async () => {
    const storeProjects = await repositoryWithProject();

    const result = await new PublishStore(
      storeProjects,
      okAgent({
        shopifyResourceId: "shop-1",
        status: "PUBLISHED",
        url: "https://solaris.myshopify.com",
      }),
    ).execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.storeUrl).toBe("https://solaris.myshopify.com");
  });

  it("échoue si la publication ne fournit aucune URL exploitable", async () => {
    const storeProjects = await repositoryWithProject();

    // Sans URL publique, le critère d'acceptation n°6 du PRD n'est pas satisfait.
    const result = await new PublishStore(
      storeProjects,
      okAgent({ shopifyResourceId: "shop-1", status: "PUBLISHED" }),
    ).execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.SHOPIFY_VALIDATION_ERROR);
  });

  it("remonte une erreur d'authentification Shopify comme non rejouable", async () => {
    const storeProjects = await repositoryWithProject();

    const result = await new PublishStore(
      storeProjects,
      stubAgentFail<ShopifyAgentInput, ShopifyAgentOutput>(
        AgentName.SHOPIFY,
        ERROR_CODES.SHOPIFY_AUTH_ERROR,
      ),
    ).execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.SHOPIFY_AUTH_ERROR);
    expect(result.error.retryable).toBe(false);
  });

  it("échoue si le projet est introuvable", async () => {
    const result = await new PublishStore(
      new InMemoryStoreProjectRepository(),
      okAgent({ shopifyResourceId: "shop-1", status: "PUBLISHED", url: "https://x.test" }),
    ).execute({ storeProjectId: "inconnu" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.STORE_PROJECT_NOT_FOUND);
  });
});
