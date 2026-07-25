import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@brandforge/shared";
import { BuildStoreStructure } from "./build-store-structure.usecase.js";
import type {
  StoreBuilderAgentInput,
  StoreBuilderAgentOutput,
} from "../ports/store-builder-agent.port.js";
import {
  InMemoryBrandRepository,
  InMemoryStoreProjectRepository,
  stubAgentFail,
  stubAgentOk,
  type StubAgent,
} from "../../test-support/fakes.js";
import { aBrand, aStoreProject } from "../../test-support/builders.js";
import { AgentName } from "../../orchestration/value-objects/agent-name.vo.js";

const validOutput: StoreBuilderAgentOutput = {
  shopifyThemeId: "theme-123",
  collectionsCreated: [{ id: "col-1", title: "Nouveautés" }],
  pagesCreated: [
    { id: "page-1", title: "Accueil", type: "home" },
    { id: "page-2", title: "À propos", type: "about" },
  ],
};

async function setup(
  agent: StubAgent<StoreBuilderAgentInput, StoreBuilderAgentOutput>,
  options: { brandNamed?: boolean; withBrand?: boolean } = {},
) {
  const storeProjects = new InMemoryStoreProjectRepository();
  const brands = new InMemoryBrandRepository();
  await storeProjects.save(aStoreProject());
  if (options.withBrand ?? true) {
    await brands.save(aBrand({ named: options.brandNamed ?? true }));
  }
  return { useCase: new BuildStoreStructure(storeProjects, brands, agent) };
}

describe("BuildStoreStructure", () => {
  it("génère une structure de boutique publiable à partir de la marque validée", async () => {
    const agent = stubAgentOk<StoreBuilderAgentInput, StoreBuilderAgentOutput>(
      AgentName.STORE_BUILDER,
      validOutput,
    );
    const { useCase } = await setup(agent);

    const result = await useCase.execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.themeId).toBe("theme-123");
    expect(result.data.isPublishable()).toBe(true);
    expect(agent.calls[0]?.brand.name).toBe("Solaris");
    expect(agent.calls[0]?.niche).toBe("lunettes de soleil");
  });

  it("signale une structure non publiable s'il manque la page d'accueil", async () => {
    const { useCase } = await setup(
      stubAgentOk<StoreBuilderAgentInput, StoreBuilderAgentOutput>(AgentName.STORE_BUILDER, {
        ...validOutput,
        pagesCreated: [{ id: "page-2", title: "À propos", type: "about" }],
      }),
    );

    const result = await useCase.execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.isPublishable()).toBe(false);
  });

  it("refuse de construire tant que le nom de marque n'est pas validé", async () => {
    const { useCase } = await setup(
      stubAgentOk<StoreBuilderAgentInput, StoreBuilderAgentOutput>(
        AgentName.STORE_BUILDER,
        validOutput,
      ),
      { brandNamed: false },
    );

    const result = await useCase.execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.INVALID_PIPELINE_STATE);
  });

  it("remonte une erreur Shopify non rejouable de l'agent", async () => {
    const { useCase } = await setup(
      stubAgentFail<StoreBuilderAgentInput, StoreBuilderAgentOutput>(
        AgentName.STORE_BUILDER,
        ERROR_CODES.SHOPIFY_AUTH_ERROR,
      ),
    );

    const result = await useCase.execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.SHOPIFY_AUTH_ERROR);
    expect(result.error.retryable).toBe(false);
  });

  it("échoue si aucune marque n'existe", async () => {
    const { useCase } = await setup(
      stubAgentOk<StoreBuilderAgentInput, StoreBuilderAgentOutput>(
        AgentName.STORE_BUILDER,
        validOutput,
      ),
      { withBrand: false },
    );

    const result = await useCase.execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.BRAND_NOT_FOUND);
  });
});
