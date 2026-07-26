import {
  ERROR_CODES,
  agentFail,
  agentOk,
  createAgentError,
  type AgentResult,
} from "@brandforge/shared";
import {
  AgentName,
  type IEcommercePlatform,
  type IProductRepository,
  type ISeoContentRepository,
  type IShopifyAgent,
  type PlatformProductInput,
  type Product,
  type ShopifyAgentInput,
  type ShopifyAgentOutput,
} from "@brandforge/domain";

/**
 * Shopify Agent — publie et synchronise les ressources sur la boutique (AI_AGENTS.md §7).
 *
 * Ne contient aucune génération de contenu : il transpose vers la plateforme ce que les
 * agents amont ont produit. C'est ce qui permet de le remplacer par un agent WooCommerce
 * sans toucher au pipeline.
 *
 * Lit le produit et son contenu SEO via leurs ports respectifs : l'entrée ne transporte
 * qu'un identifiant, conformément au contrat documenté.
 */
export class ShopifyAgent implements IShopifyAgent {
  readonly name = AgentName.SHOPIFY;

  constructor(
    private readonly platform: IEcommercePlatform,
    private readonly products: IProductRepository,
    private readonly seoContents: ISeoContentRepository,
  ) {}

  async execute(input: ShopifyAgentInput): Promise<AgentResult<ShopifyAgentOutput>> {
    if (input.action === "PUBLISH_STORE") {
      return this.publishStore(input.storeProjectId);
    }

    const product = await this.products.findById(input.productId);
    if (product === null) {
      return agentFail(
        createAgentError(ERROR_CODES.PRODUCT_NOT_FOUND, "Produit introuvable.", false),
      );
    }

    const payload = await this.toPlatformProduct(product);

    return input.action === "PUBLISH_PRODUCT"
      ? this.publishProduct(payload)
      : this.syncProduct(product, payload);
  }

  private async publishStore(storeProjectId: string): Promise<AgentResult<ShopifyAgentOutput>> {
    const published = await this.platform.publishStore(storeProjectId);
    if (!published.success) {
      return agentFail(published.error);
    }

    return agentOk({
      // La boutique n'a pas d'identifiant de ressource : son URL en tient lieu.
      shopifyResourceId: published.output.storeUrl,
      status: "PUBLISHED",
      url: published.output.storeUrl,
    });
  }

  private async publishProduct(
    payload: PlatformProductInput,
  ): Promise<AgentResult<ShopifyAgentOutput>> {
    const created = await this.platform.createProduct(payload);
    if (!created.success) {
      return agentFail(created.error);
    }

    const url = created.output.url;
    return agentOk({
      shopifyResourceId: created.output.platformProductId,
      status: "PUBLISHED",
      ...(url === undefined ? {} : { url }),
    });
  }

  private async syncProduct(
    product: Product,
    payload: PlatformProductInput,
  ): Promise<AgentResult<ShopifyAgentOutput>> {
    const platformProductId = product.shopifyProductId;

    // Synchroniser suppose une ressource existante côté Shopify : sans identifiant, il n'y
    // a rien à mettre à jour.
    if (platformProductId === null) {
      return agentFail(
        createAgentError(
          ERROR_CODES.INVALID_PIPELINE_STATE,
          "Le produit n'a jamais été publié : rien à synchroniser.",
          false,
        ),
      );
    }

    const updated = await this.platform.updateProduct(platformProductId, payload);
    if (!updated.success) {
      return agentFail(updated.error);
    }

    const url = updated.output.url;
    return agentOk({
      shopifyResourceId: updated.output.platformProductId,
      status: "SYNCED",
      ...(url === undefined ? {} : { url }),
    });
  }

  /**
   * Construit la charge envoyée à la plateforme.
   *
   * Le contenu SEO, s'il existe, prime sur la description réécrite : c'est la version la
   * plus aboutie de la fiche (critère d'acceptation n°5 du PRD).
   */
  private async toPlatformProduct(product: Product): Promise<PlatformProductInput> {
    const seo = await this.seoContents.findByProductId(product.id);

    return {
      storeProjectId: product.storeProjectId,
      title: product.effectiveTitle(),
      description: seo?.optimizedContent ?? product.effectiveDescription(),
      images: product.images,
      price: product.price.amount,
      ...(seo === null ? {} : { metaTitle: seo.metaTitle, metaDescription: seo.metaDescription }),
    };
  }
}
