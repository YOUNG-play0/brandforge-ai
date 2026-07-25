import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@brandforge/shared";
import { GetPipelineStatus } from "./get-pipeline-status.usecase.js";
import { PipelineRun } from "../entities/pipeline-run.entity.js";
import { PipelineStep } from "../entities/pipeline-step.entity.js";
import { AgentName } from "../value-objects/agent-name.vo.js";
import { PipelineStatus } from "../value-objects/pipeline-status.vo.js";
import { StepStatus } from "../value-objects/step-status.vo.js";
import { InMemoryPipelineRepository } from "../../test-support/fakes.js";

describe("GetPipelineStatus", () => {
  it("restitue le statut du run et le résumé de ses étapes", async () => {
    const pipelines = new InMemoryPipelineRepository();
    const run = PipelineRun.start({ id: "run-1", storeProjectId: "project-1" });

    const marketStep = PipelineStep.schedule({
      id: "step-1",
      pipelineRunId: "run-1",
      agentName: AgentName.MARKET,
      input: { niche: "lunettes" },
    });
    marketStep.markSuccess({ keywords: ["lunettes"] });
    run.addStep(marketStep);

    const brandStep = PipelineStep.schedule({
      id: "step-2",
      pipelineRunId: "run-1",
      agentName: AgentName.BRAND,
      input: {},
    });
    brandStep.markFailed({
      code: ERROR_CODES.AI_PROVIDER_TIMEOUT,
      message: "Délai dépassé",
      retryable: true,
    });
    run.addStep(brandStep);
    run.markFailed();
    await pipelines.save(run);

    const result = await new GetPipelineStatus(pipelines).execute({ pipelineRunId: "run-1" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe(PipelineStatus.FAILED);
    expect(result.data.steps).toHaveLength(2);
    expect(result.data.steps[0]?.status).toBe(StepStatus.SUCCESS);
    expect(result.data.steps[1]?.errorMessage).toContain(ERROR_CODES.AI_PROVIDER_TIMEOUT);
  });

  it("n'expose jamais les input/output bruts des étapes au frontend", async () => {
    const pipelines = new InMemoryPipelineRepository();
    const run = PipelineRun.start({ id: "run-1", storeProjectId: "project-1" });
    const step = PipelineStep.schedule({
      id: "step-1",
      pipelineRunId: "run-1",
      agentName: AgentName.MARKET,
      input: { secret: "données volumineuses" },
    });
    step.markSuccess({ raw: "sortie brute du modèle" });
    run.addStep(step);
    await pipelines.save(run);

    const result = await new GetPipelineStatus(pipelines).execute({ pipelineRunId: "run-1" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(JSON.stringify(result.data)).not.toContain("sortie brute");
  });

  it("échoue si le run est introuvable", async () => {
    const result = await new GetPipelineStatus(new InMemoryPipelineRepository()).execute({
      pipelineRunId: "inconnu",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.PIPELINE_RUN_NOT_FOUND);
  });
});
