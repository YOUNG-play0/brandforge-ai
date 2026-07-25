// Point d'entrée public de @brandforge/infrastructure.
// Réexporte les implémentations concrètes des ports : repositories Prisma (database),
// client IA (ai-provider), client Shopify (shopify-client), source produits (scraping).
// C'est la seule couche autorisée à lire les variables d'environnement (CODING_STANDARDS.md §9).
// Squelette : implémenté à partir du module packages/infrastructure/database.
export {};
