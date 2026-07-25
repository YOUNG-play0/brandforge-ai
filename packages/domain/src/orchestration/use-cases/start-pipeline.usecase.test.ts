import { describe, expect, it, vi } from "vitest";
import { ERROR_CODES, actionOk } from "@brandforge/shared";
import { StartPipeline } from "./start-pipeline.usecase.js";
import { AgentName } from "../value-objects/agent-name.vo.js";
import { PipelineStatus } from "../value-objects/pipeline-status.vo.js";
import type { IPipelineOrchestrator } from "../ports/pipeline-orchestrator.port.js";
import { InMemoryStoreProjectRepository } from "../../test-support/fakes.js";
import { TEST_USER_ID, aStoreProject } from "../../test-support/builders.js";

function orchestratorStub(): IPipelineOrchestrator {
  return {
    start: vi.fn(async () =>
      actionOk({
        pipelineRunId: "run-1",
        status: PipelineStatus.RUNNING,
        currentStep: AgentName.MARKET,
      }),
    ),
    resume: vi.fn(),
  };
}

describe("StartPipeline", () => {
  it("délègue à l'Orchestrator quand le projet est en DRAFT", async () => {
    const storeProjects = new InMemoryStoreProjectRepository();
    await storeProjects.save(aStoreProject());
    const orchestrator = orchestratorStub();

    const result = await new StartPipeline(storeProjects, orchestrator).execute({
      storeProjectId: "project-1",
      userId: TEST_USER_ID,
    });

    expect(result.success).toBe(true);
    expect(orchestrator.start).toHaveBeenCalledWith("project-1");
  });

  it("refuse de démarrer un pipeline déjà en cours", async () => {
    const storeProjects = new InMemoryStoreProjectRepository();
    const project = aStoreProject();
    project.markRunning();
    await storeProjects.save(project);
    const orchestrator = orchestratorStub();

    const result = await new StartPipeline(storeProjects, orchestrator).execute({
      storeProjectId: "project-1",
      userId: TEST_USER_ID,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.INVALID_PIPELINE_STATE);
    // Le garde-fou doit empêcher toute exécution concurrente.
    expect(orchestrator.start).not.toHaveBeenCalled();
  });

  it("autorise un redémarrage après un échec", async () => {
    const storeProjects = new InMemoryStoreProjectRepository();
    const project = aStoreProject();
    project.markFailed();
    await storeProjects.save(project);

    const result = await new StartPipeline(storeProjects, orchestratorStub()).execute({
      storeProjectId: "project-1",
      userId: TEST_USER_ID,
    });

    expect(result.success).toBe(true);
  });

  it("échoue si le projet appartient à un autre utilisateur", async () => {
    const storeProjects = new InMemoryStoreProjectRepository();
    await storeProjects.save(aStoreProject());

    const result = await new StartPipeline(storeProjects, orchestratorStub()).execute({
      storeProjectId: "project-1",
      userId: "autre-user",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.STORE_PROJECT_NOT_FOUND);
  });
});
