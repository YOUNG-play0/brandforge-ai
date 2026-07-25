import { afterEach, describe, expect, it } from "vitest";
import { loadDatabaseConfig, optionalNumberEnv, requireEnv } from "./env.js";

const TOUCHED = ["TEST_REQUIRED", "TEST_NUMBER", "DATABASE_URL"];

afterEach(() => {
  for (const key of TOUCHED) {
    delete process.env[key];
  }
});

describe("requireEnv", () => {
  it("retourne la valeur définie", () => {
    process.env["TEST_REQUIRED"] = "valeur";

    expect(requireEnv("TEST_REQUIRED")).toBe("valeur");
  });

  it("échoue avec un message actionnable si la variable manque", () => {
    expect(() => requireEnv("TEST_REQUIRED")).toThrow(/\.env\.example/);
  });

  it("traite une variable vide comme manquante", () => {
    process.env["TEST_REQUIRED"] = "   ";

    expect(() => requireEnv("TEST_REQUIRED")).toThrow();
  });
});

describe("optionalNumberEnv", () => {
  it("retombe sur la valeur par défaut quand la variable est absente", () => {
    expect(optionalNumberEnv("TEST_NUMBER", 30_000)).toBe(30_000);
  });

  it("convertit une valeur numérique valide", () => {
    process.env["TEST_NUMBER"] = "15000";

    expect(optionalNumberEnv("TEST_NUMBER", 30_000)).toBe(15_000);
  });

  it("échoue plutôt que de retomber silencieusement sur le défaut si la valeur est invalide", () => {
    process.env["TEST_NUMBER"] = "beaucoup";

    expect(() => optionalNumberEnv("TEST_NUMBER", 30_000)).toThrow();
  });
});

describe("loadDatabaseConfig", () => {
  it("charge l'URL de connexion", () => {
    process.env["DATABASE_URL"] = "postgresql://u:p@localhost:5432/db";

    expect(loadDatabaseConfig().url).toBe("postgresql://u:p@localhost:5432/db");
  });

  it("échoue au démarrage si DATABASE_URL n'est pas renseignée", () => {
    expect(() => loadDatabaseConfig()).toThrow(/DATABASE_URL/);
  });
});
