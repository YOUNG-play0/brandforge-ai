import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@brandforge/shared";
import { GetStoreProjectDetail } from "./get-store-project-detail.usecase.js";
import { PipelineRun } from "../entities/pipeline-run.entity.js";
import { PipelineStep } from "../entities/pipeline-step.entity.js";
import { AgentName } from "../value-objects/agent-name.vo.js";
import { StepStatus } from "../value-objects/step-status.vo.js";
import {
  InMemoryPipelineRepository,
  InMemoryStoreProjectRepository,
} from "../../test-support/fakes.js";
import { TEST_USER_ID, aStoreProject } from "../../test-support/builders.js";

async function setup() {
  const storeProjects = new InMemoryStoreProjectRepository();
  const pipelines = new InMemoryPipelineRepository();
  await storeProjects.save(aStoreProject());
  return { storeProjects, pipelines, useCase: new GetStoreProjectDetail(storeProjects, pipelines) };
}

describe("GetStoreProjectDetail", () => {
  it("retourne le détail du projet et sa dernière étape connue", async () => {
    const { pipelines, useCase } = await setup();

    const run = PipelineRun.start({ id: "run-1", storeProjectId: "project-1" });
    const step = PipelineStep.schedule({
      id: "step-1",
      pipelineRunId: "run-1",
      agentName: AgentName.MARKET,
      input: {},
    });
    step.markSuccess({ keywords: [] });
    run.addStep(step);
    await pipelines.save(run);

    const result = await useCase.execute({ storeProjectId: "project-1", userId: TEST_USER_ID });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.pipelineRunId).toBe("run-1");
    expect(result.data.lastStep).toEqual({
      agentName: AgentName.MARKET,
      status: StepStatus.SUCCESS,
      errorMessage: null,
    });
  });

  it("retourne un détail sans étape quand aucun pipeline n'a encore tourné", async () => {
    const { useCase } = await setup();

    const result = await useCase.execute({ storeProjectId: "project-1", userId: TEST_USER_ID });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.pipelineRunId).toBeNull();
    expect(result.data.lastStep).toBeNull();
  });

  it("échoue si le projet n'existe pas", async () => {
    const { useCase } = await setup();

    const result = await useCase.execute({ storeProjectId: "inconnu", userId: TEST_USER_ID });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.STORE_PROJECT_NOT_FOUND);
  });

  it("masque le projet d'un autre utilisateur derrière une erreur « introuvable »", async () => {
    const { useCase } = await setup();

    const result = await useCase.execute({ storeProjectId: "project-1", userId: "autre-user" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.STORE_PROJECT_NOT_FOUND);
  });
});
