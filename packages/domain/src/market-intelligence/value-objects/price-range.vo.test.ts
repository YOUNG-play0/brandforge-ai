import { describe, expect, it } from "vitest";
import { PriceRange } from "./price-range.vo.js";
import { RelevanceScore } from "./relevance-score.vo.js";

describe("PriceRange", () => {
  it("accepte une fourchette cohérente et calcule son milieu", () => {
    const range = PriceRange.create(80, 200);

    expect(range.success).toBe(true);
    if (!range.success) return;
    expect(range.data.midpoint()).toBe(140);
    expect(range.data.contains(100)).toBe(true);
    expect(range.data.contains(500)).toBe(false);
  });

  it("accepte une fourchette réduite à un point", () => {
    expect(PriceRange.create(100, 100).success).toBe(true);
  });

  it("refuse une borne basse supérieure à la borne haute", () => {
    expect(PriceRange.create(300, 100).success).toBe(false);
  });

  it("refuse des montants négatifs", () => {
    expect(PriceRange.create(-10, 100).success).toBe(false);
  });

  it("refuse des valeurs non finies", () => {
    expect(PriceRange.create(Number.NaN, 100).success).toBe(false);
    expect(PriceRange.create(0, Number.POSITIVE_INFINITY).success).toBe(false);
  });
});

describe("RelevanceScore", () => {
  it("juge viable une niche au-dessus du seuil", () => {
    const score = RelevanceScore.create(0.82);

    expect(score.success).toBe(true);
    if (!score.success) return;
    expect(score.data.isViable()).toBe(true);
  });

  it("juge non viable une niche sous le seuil", () => {
    const score = RelevanceScore.create(0.2);

    expect(score.success).toBe(true);
    if (!score.success) return;
    expect(score.data.isViable()).toBe(false);
  });

  it("accepte les bornes 0 et 1", () => {
    expect(RelevanceScore.create(0).success).toBe(true);
    expect(RelevanceScore.create(1).success).toBe(true);
  });

  it("refuse un score hors de l'intervalle [0, 1]", () => {
    expect(RelevanceScore.create(-0.1).success).toBe(false);
    expect(RelevanceScore.create(1.5).success).toBe(false);
  });
});
