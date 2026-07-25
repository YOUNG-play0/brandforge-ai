import { describe, expect, it } from "vitest";
import { Price } from "../value-objects/price.vo.js";
import { ProductStatus } from "../value-objects/product-status.vo.js";
import { aProduct } from "../../test-support/builders.js";

function price(amount: number): Price {
  const result = Price.create(amount);
  if (!result.success) throw new Error("fixture invalide");
  return result.data;
}

describe("Price", () => {
  it("arrondit un montant à deux décimales", () => {
    const result = Price.create(12.3456);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.amount).toBe(12.35);
  });

  it("applique une marge multiplicative", () => {
    const result = price(50).withMargin(1.8);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.amount).toBe(90);
  });

  it("refuse un montant négatif", () => {
    expect(Price.create(-1).success).toBe(false);
  });
});

describe("Product", () => {
  it("expose le contenu d'origine tant qu'aucune réécriture n'a eu lieu", () => {
    const product = aProduct();

    expect(product.status).toBe(ProductStatus.IMPORTED);
    expect(product.effectiveTitle()).toBe("Sunglasses Polarized UV400 Men Women");
    expect(product.isPublishable()).toBe(false);
  });

  it("devient publiable une fois réécrit", () => {
    const product = aProduct();

    product.applyRewrite({
      title: "Solaris Horizon",
      description: "Montures en acétate bio.",
      images: ["https://cdn.example.com/img-2.jpg"],
      price: price(89.9),
    });

    expect(product.status).toBe(ProductStatus.REWRITTEN);
    expect(product.effectiveTitle()).toBe("Solaris Horizon");
    expect(product.isPublishable()).toBe(true);
  });

  it("ne régresse jamais de statut lors d'une réoptimisation après publication", () => {
    const product = aProduct();
    product.applyRewrite({
      title: "Solaris Horizon",
      description: "Montures en acétate bio.",
      images: ["https://cdn.example.com/img-2.jpg"],
      price: price(89.9),
    });
    product.markPublished("gid://shopify/Product/42");

    // Réoptimiser le SEO d'un produit publié ne doit pas le dépublier de fait.
    product.markSeoOptimized();

    expect(product.status).toBe(ProductStatus.PUBLISHED);
    expect(product.isSynchronizable()).toBe(true);
  });
});
