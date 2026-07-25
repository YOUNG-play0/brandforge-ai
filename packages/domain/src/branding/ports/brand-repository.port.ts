import type { BrandAsset } from "../entities/brand-asset.entity.js";
import type { Brand } from "../entities/brand.entity.js";

/** Port de persistance de la marque et de ses assets (DATABASE.md §3). */
export interface IBrandRepository {
  save(brand: Brand): Promise<void>;
  findById(brandId: string): Promise<Brand | null>;
  findByStoreProjectId(storeProjectId: string): Promise<Brand | null>;
  saveAsset(asset: BrandAsset): Promise<void>;
  findAssetsByBrandId(brandId: string): Promise<readonly BrandAsset[]>;
}
