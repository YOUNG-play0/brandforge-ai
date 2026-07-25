import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../errors/error-codes.js";
import { createAgentError } from "../errors/agent-error.js";
import { InfrastructureError, isInfrastructureError } from "../errors/infrastructure-error.js";
import { agentFail, agentOk } from "./agent-result.js";
import { actionFail, actionOk } from "./action-result.js";

describe("createAgentError", () => {
  it("construit une erreur avec code, message et flag de reprise", () => {
    const error = createAgentError(ERROR_CODES.AI_PROVIDER_TIMEOUT, "Délai dépassé", true);

    expect(error.code).toBe(ERROR_CODES.AI_PROVIDER_TIMEOUT);
    expect(error.retryable).toBe(true);
  });

  it("n'attache pas de cause quand aucune n'est fournie", () => {
    const error = createAgentError(ERROR_CODES.NICHE_TOO_VAGUE, "Niche trop vague", false);

    expect("cause" in error).toBe(false);
  });

  it("conserve la cause technique quand elle est fournie", () => {
    const cause = new Error("socket fermé");
    const error = createAgentError(ERROR_CODES.DATABASE_ERROR, "Échec", false, cause);

    expect(error.cause).toBe(cause);
  });
});

describe("AgentResult", () => {
  it("discrimine succès et échec sur le champ success", () => {
    const ok = agentOk({ keywords: [] });
    const ko = agentFail(createAgentError(ERROR_CODES.NICHE_TOO_VAGUE, "trop vague", false));

    expect(ok.success && ok.output).toEqual({ keywords: [] });
    expect(!ko.success && ko.error.code).toBe(ERROR_CODES.NICHE_TOO_VAGUE);
  });
});

describe("ActionResult", () => {
  it("expose la donnée sous la clé data", () => {
    const ok = actionOk({ storeProjectId: "project-1" });
    const ko = actionFail(createAgentError(ERROR_CODES.UNAUTHORIZED, "non autorisé", false));

    expect(ok.success && ok.data.storeProjectId).toBe("project-1");
    expect(!ko.success && ko.error.retryable).toBe(false);
  });
});

describe("InfrastructureError", () => {
  it("porte l'AgentError typée et un message lisible", () => {
    const error = new InfrastructureError(
      createAgentError(ERROR_CODES.DATABASE_CONFLICT, "Ressource déjà existante", false),
    );

    expect(error.agentError.code).toBe(ERROR_CODES.DATABASE_CONFLICT);
    expect(error.message).toContain("DATABASE_CONFLICT");
    expect(isInfrastructureError(error)).toBe(true);
  });

  it("ne confond pas une erreur quelconque avec une erreur d'infrastructure", () => {
    expect(isInfrastructureError(new Error("boom"))).toBe(false);
  });
});
