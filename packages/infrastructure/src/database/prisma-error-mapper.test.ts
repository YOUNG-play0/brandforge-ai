import { describe, expect, it } from "vitest";
import { ERROR_CODES, InfrastructureError, createAgentError } from "@brandforge/shared";
import { Prisma } from "@prisma/client";
import { runQuery, toInfrastructureError } from "./prisma-error-mapper.js";

function knownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("échec simulé", {
    code,
    clientVersion: "6.19.3",
  });
}

describe("toInfrastructureError", () => {
  it("traduit une violation d'unicité en conflit non rejouable", () => {
    const error = toInfrastructureError(knownError("P2002"), "Brand.save");

    expect(error).toBeInstanceOf(InfrastructureError);
    expect(error.agentError.code).toBe(ERROR_CODES.DATABASE_CONFLICT);
    expect(error.agentError.retryable).toBe(false);
    expect(error.agentError.message).toContain("Brand.save");
  });

  it("traduit une clé étrangère invalide en conflit", () => {
    expect(toInfrastructureError(knownError("P2003"), "Product.save").agentError.code).toBe(
      ERROR_CODES.DATABASE_CONFLICT,
    );
  });

  it("traduit une base injoignable en erreur rejouable", () => {
    const error = toInfrastructureError(knownError("P1001"), "StoreProject.findById");

    expect(error.agentError.code).toBe(ERROR_CODES.DATABASE_UNAVAILABLE);
    expect(error.agentError.retryable).toBe(true);
  });

  it("traduit un code Prisma inconnu en erreur technique non rejouable", () => {
    const error = toInfrastructureError(knownError("P9999"), "Product.save");

    expect(error.agentError.code).toBe(ERROR_CODES.DATABASE_ERROR);
    expect(error.agentError.retryable).toBe(false);
  });

  it("traduit une exception quelconque en erreur technique", () => {
    const error = toInfrastructureError(new Error("boom"), "Product.findById");

    expect(error.agentError.code).toBe(ERROR_CODES.DATABASE_ERROR);
    // La cause d'origine reste disponible pour le diagnostic.
    expect(error.agentError.cause).toBeInstanceOf(Error);
  });

  it("laisse passer une InfrastructureError déjà typée sans la réemballer", () => {
    const original = new InfrastructureError(
      createAgentError(ERROR_CODES.DATABASE_CONFLICT, "déjà typée", false),
    );

    expect(toInfrastructureError(original, "Brand.save")).toBe(original);
  });
});

describe("runQuery", () => {
  it("retourne le résultat de la requête en cas de succès", async () => {
    await expect(runQuery("Product.findById", async () => "ok")).resolves.toBe("ok");
  });

  it("convertit toute exception en InfrastructureError", async () => {
    const failing = runQuery("Product.findById", () => {
      throw knownError("P2002");
    });

    await expect(failing).rejects.toBeInstanceOf(InfrastructureError);
  });

  it("ne laisse jamais fuiter une exception Prisma brute vers l'appelant", async () => {
    // Garantie centrale de CODING_STANDARDS.md §5 : le domaine ne voit que des erreurs typées.
    await expect(
      runQuery("Product.save", () => {
        throw knownError("P2002");
      }),
    ).rejects.not.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });
});
