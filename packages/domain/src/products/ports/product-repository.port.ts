import type { Product } from "../entities/product.entity.js";

/** Port de persistance des produits (DATABASE.md §3). */
export interface IProductRepository {
  save(product: Product): Promise<void>;
  findById(productId: string): Promise<Product | null>;
  findByStoreProjectId(storeProjectId: string): Promise<readonly Product[]>;
}
