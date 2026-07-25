import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@brandforge/shared";
import { CreateStoreProject } from "./create-store-project.usecase.js";
import { PipelineStatus } from "../value-objects/pipeline-status.vo.js";
import {
  FakeClock,
  FakeIdGenerator,
  InMemoryStoreProjectRepository,
} from "../../test-support/fakes.js";
import { TEST_USER_ID } from "../../test-support/builders.js";

function setup() {
  const storeProjects = new InMemoryStoreProjectRepository();
  const useCase = new CreateStoreProject(
    storeProjects,
    new FakeIdGenerator("project"),
    new FakeClock(),
  );
  return { storeProjects, useCase };
}

const validInput = {
  userId: TEST_USER_ID,
  name: "Projet lunettes",
  niche: "lunettes de soleil",
  targetMarket: "France",
};

describe("CreateStoreProject", () => {
  it("crée un projet en DRAFT et le persiste", async () => {
    const { storeProjects, useCase } = setup();

    const result = await useCase.execute(validInput);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe(PipelineStatus.DRAFT);

    const persisted = await storeProjects.findById(result.data.storeProjectId);
    expect(persisted?.niche).toBe("lunettes de soleil");
  });

  it("refuse une niche vide sans rien persister", async () => {
    const { storeProjects, useCase } = setup();

    const result = await useCase.execute({ ...validInput, niche: "   " });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(result.error.retryable).toBe(false);
    await expect(storeProjects.findByUserId(TEST_USER_ID)).resolves.toHaveLength(0);
  });

  it("normalise les espaces superflus autour des champs saisis", async () => {
    const { storeProjects, useCase } = setup();

    const result = await useCase.execute({ ...validInput, niche: "  lunettes de soleil  " });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const persisted = await storeProjects.findById(result.data.storeProjectId);
    expect(persisted?.niche).toBe("lunettes de soleil");
  });
});
