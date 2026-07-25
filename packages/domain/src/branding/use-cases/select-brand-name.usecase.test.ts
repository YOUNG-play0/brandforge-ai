import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@brandforge/shared";
import { SelectBrandName } from "./select-brand-name.usecase.js";
import { InMemoryBrandRepository } from "../../test-support/fakes.js";
import { aBrand } from "../../test-support/builders.js";

async function setup() {
  const brands = new InMemoryBrandRepository();
  await brands.save(aBrand({ named: false }));
  return { brands, useCase: new SelectBrandName(brands) };
}

describe("SelectBrandName", () => {
  it("fige le nom choisi parmi les propositions et marque la marque comme validée", async () => {
    const { brands, useCase } = await setup();

    const result = await useCase.execute({ storeProjectId: "project-1", selectedName: "Lumen" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.confirmed).toBe(true);

    const persisted = await brands.findByStoreProjectId("project-1");
    expect(persisted?.name).toBe("Lumen");
    expect(persisted?.validatedByUser).toBe(true);
    expect(persisted?.isReadyForStoreBuilding()).toBe(true);
  });

  it("refuse un nom absent des propositions de l'agent", async () => {
    const { brands, useCase } = await setup();

    const result = await useCase.execute({
      storeProjectId: "project-1",
      selectedName: "NomInventé",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    const persisted = await brands.findByStoreProjectId("project-1");
    expect(persisted?.name).toBeNull();
  });

  it("refuse un nom vide", async () => {
    const { useCase } = await setup();

    const result = await useCase.execute({ storeProjectId: "project-1", selectedName: "   " });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it("échoue si aucune marque n'a été générée", async () => {
    const result = await new SelectBrandName(new InMemoryBrandRepository()).execute({
      storeProjectId: "project-1",
      selectedName: "Solaris",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe(ERROR_CODES.BRAND_NOT_FOUND);
  });
});
