import { describe, expect, it } from "vitest";
import {
  isFiniteNumber,
  isHexColor,
  isHttpUrl,
  isNonEmptyString,
  isNumberWithin,
} from "./guards.js";

describe("isNonEmptyString", () => {
  it("accepte une chaîne contenant au moins un caractère non blanc", () => {
    expect(isNonEmptyString("lunettes")).toBe(true);
  });

  it("refuse une chaîne vide ou composée d'espaces", () => {
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString("   ")).toBe(false);
  });

  it("refuse une valeur non textuelle", () => {
    expect(isNonEmptyString(42)).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
  });
});

describe("isFiniteNumber", () => {
  it("refuse NaN et l'infini, qu'un simple typeof laisserait passer", () => {
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isFiniteNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isFiniteNumber(0)).toBe(true);
  });
});

describe("isNumberWithin", () => {
  it("inclut les bornes de l'intervalle", () => {
    expect(isNumberWithin(0, 0, 1)).toBe(true);
    expect(isNumberWithin(1, 0, 1)).toBe(true);
  });

  it("exclut les valeurs hors intervalle", () => {
    expect(isNumberWithin(1.5, 0, 1)).toBe(false);
    expect(isNumberWithin(-0.1, 0, 1)).toBe(false);
  });
});

describe("isHexColor", () => {
  it("accepte les formes #RGB et #RRGGBB", () => {
    expect(isHexColor("#1A1A1A")).toBe(true);
    expect(isHexColor("#fff")).toBe(true);
  });

  it("refuse une couleur nommée ou une valeur malformée", () => {
    expect(isHexColor("noir")).toBe(false);
    expect(isHexColor("1A1A1A")).toBe(false);
    expect(isHexColor("#12345")).toBe(false);
  });
});

describe("isHttpUrl", () => {
  it("accepte une URL absolue http ou https", () => {
    expect(isHttpUrl("https://www.izipizi.com")).toBe(true);
    expect(isHttpUrl("http://localhost:3000/x")).toBe(true);
  });

  it("refuse une URL relative ou d'un autre protocole", () => {
    expect(isHttpUrl("/images/logo.png")).toBe(false);
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
  });
});
