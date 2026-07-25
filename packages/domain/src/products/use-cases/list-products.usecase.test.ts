import { describe, expect, it } from "vitest";
import { ListProducts } from "./list-products.usecase.js";
import { ProductStatus } from "../value-objects/product-status.vo.js";
import { InMemoryProductRepository } from "../../test-support/fakes.js";
import { aProduct } from "../../test-support/builders.js";

describe("ListProducts", () => {
  it("liste les produits du projet avec leur titre effectif", async () => {
    const products = new InMemoryProductRepository();
    await products.save(aProduct({ id: "product-1" }));
    await products.save(aProduct({ id: "product-2" }));

    const result = await new ListProducts(products).execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.status).toBe(ProductStatus.IMPORTED);
    expect(result.data[0]?.imageUrl).toBe("https://cdn.example.com/img-1.jpg");
  });

  it("n'expose pas les produits d'un autre projet", async () => {
    const products = new InMemoryProductRepository();
    await products.save(aProduct({ id: "product-1" }));
    await products.save(aProduct({ id: "product-2", storeProjectId: "project-2" }));

    const result = await new ListProducts(products).execute({ storeProjectId: "project-1" });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
  });

  it("retourne une liste vide pour un projet sans produit", async () => {
    const result = await new ListProducts(new InMemoryProductRepository()).execute({
      storeProjectId: "project-1",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual([]);
  });
});
