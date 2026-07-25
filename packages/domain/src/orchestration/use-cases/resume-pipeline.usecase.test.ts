import { describe, expect, it, vi } from "vitest";
import { ERROR_CODES, actionOk } from "@brandforge/shared";
import { ResumePipeline } from "./resume-pipeline.usecase.js";
import { PipelineRun } from "../entities/pipeline-run.entity.js";
import { PipelineStep } from "../entities/pipeline-step.entity.js";
import { AgentName } from "../value-objects/agent-name.vo.js";
import { PipelineStatus } from "../value-objects/pipeline-status.vo.js";
import type { IPipelineOrchestrator } from "../ports/pipeline-orchestrator.port.js";
import {
  InMemoryPipelineRepository,
  InMemoryStoreProjectRepository,
} from "../../test-support/fakes.js";
import { TEST_USER_ID, aStoreProject } from "../../test-support/builders.js";

function orchestratorStub(): IPipelineOrchestrator {
  return {
    start: vi.fn(),
    resume: vi.fn(async () =>
      actionOk({
        pipelineRunId: "run-1",
        status: PipelineStatus.RUNNING,
        currentStep: AgentName.BRAND,
      }),
    ),
  };
}

/** Construit un run avec une étape Market réussie puis une étape Brand en échec. */
function failedRun(): PipelineRun {
  const run = PipelineRun.start({ id: "run-1", storeProjectId: "project-1" });

  const marketStep = PipelineStep.schedule({
    id: "step-1",
    pipelineRunId: "run-1",
    agentName: AgentName.MARKET,
    input: {},
  });
  marketStep.markSuccess({});
  run.addStep(marketStep);

  const brandStep = PipelineStep.schedule({
    id: "step-2",
    pipelineRunId: "run-1",
    agentName: AgentName.BRAND,
    input: {},
  });
  brandStep.markFailed({
    code: ERROR_CODES.AI_PROVIDER_TIMEOUT,
    message: "Timeout",
    retryable: true,
  });
  run.addStep(brandStep);

  run.markFailed();
  return run;
}

async function setup(run: PipelineRun) {
  const pipelines = new InMemoryPipelineRepository();
  const storeProjects = new InMemoryStoreProjectRepository();
  await pipelines.save(run);
  await storeProjects.save(aStoreProject());
  return { pipelines, storeProjects };
}

describe("ResumePipeline", () => {
  it("reprend un run en échec à partir de la première étape non aboutie", async () => {
    const run = failedRun();
    const { pipelines, storeProjects } = await setup(run);
    const orchestrator = orchestratorStub();

    const result = await new ResumePipeline(pipelines, storeProjects, orchestrator).execute({
      pipelineRunId: "run-1",
      userId: TEST_USER_ID,
    });

    expect(result.success).toBe(true);
    expect(orchestrator.resume).toHaveBeenCalledWith("run-1");
    // L'étape Market déjà réussie ne doit pas être le point de reprise.
    expect(run.nextResumableStep()?.agentName).toBe(AgentName.BRAND);
  });

  it("refuse de reprendre un run encore en cours", async () => {
    const run = PipelineRun.start({ id: "run-1", storeProjectId: "project-1" });
    const { pipelines, storeProjects } = await setup(run);
    const orchestrator = orchestratorStub();

    const result = await new ResumePipeline(pipelines, storeProjects, orchestrator).execute({
      pipelineRunId: "run-1",
      userId: TEST_USER_ID,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.INVALID_PIPELINE_STATE);
    expect(orchestrator.resume).not.toHaveBeenCalled();
  });

  it("refuse la reprise quand toutes les étapes sont abouties", async () => {
    const run = PipelineRun.start({ id: "run-1", storeProjectId: "project-1" });
    const step = PipelineStep.schedule({
      id: "step-1",
      pipelineRunId: "run-1",
      agentName: AgentName.MARKET,
      input: {},
    });
    step.markSuccess({});
    run.addStep(step);
    run.markFailed();
    const { pipelines, storeProjects } = await setup(run);

    const result = await new ResumePipeline(pipelines, storeProjects, orchestratorStub()).execute({
      pipelineRunId: "run-1",
      userId: TEST_USER_ID,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.INVALID_PIPELINE_STATE);
  });

  it("échoue si le run n'existe pas", async () => {
    const { pipelines, storeProjects } = await setup(failedRun());

    const result = await new ResumePipeline(pipelines, storeProjects, orchestratorStub()).execute({
      pipelineRunId: "inconnu",
      userId: TEST_USER_ID,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.PIPELINE_RUN_NOT_FOUND);
  });

  it("traite une étape en succès partiel comme aboutie", async () => {
    const run = PipelineRun.start({ id: "run-1", storeProjectId: "project-1" });
    const step = PipelineStep.schedule({
      id: "step-1",
      pipelineRunId: "run-1",
      agentName: AgentName.PRODUCT,
      input: {},
    });
    // Import de masse partiellement réussi (WORKFLOWS.md §5) : ne doit pas être rejoué.
    step.markPartialSuccess({ importedCount: 3, failedCount: 1 });
    run.addStep(step);

    expect(run.nextResumableStep()).toBeNull();
  });
});
