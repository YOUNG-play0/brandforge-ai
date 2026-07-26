# ADR 0006 — Store Builder Agent et Shopify Agent

- Statut : Accepté
- Date : 2026-07-26
- Contexte : Module 5 (branche `feature/store-builder-shopify-agent`) — premier module
  produisant des effets réels sur une plateforme externe.
- Documents de référence : AI_AGENTS.md §4 et §7, ARCHITECTURE.md §7, PRD.md §10.

## Décisions

### 1. GraphQL Admin API, pas REST

L'API REST Admin est progressivement retirée au profit de GraphQL. Tous les appels passent
par `POST /admin/api/{version}/graphql.json`, via un `ShopifyGraphQlClient` dédié qui ne
connaît aucune entité métier.

### 2. Les `userErrors` sont traitées comme des échecs

Shopify répond `200 OK` même lorsqu'une mutation est refusée : le détail figure dans
`userErrors`. Sans vérification explicite, un échec passerait pour un succès et le pipeline
continuerait sur une ressource inexistante. `rejectUserErrors` les convertit en
`SHOPIFY_VALIDATION_ERROR` non rejouable.

### 3. Une seule nouvelle tentative sur `401`

Un token peut être révoqué avant l'échéance annoncée. Le client invalide alors le cache et
retente **une fois**. Ce cas se résout sans intervention, il est donc traité localement
plutôt que remonté à l'Orchestrator (prolonge l'ADR 0005).

### 4. Le modèle conçoit, la plateforme crée

Le Store Builder Agent demande au modèle un **plan** de boutique (collections, pages,
contenus), puis crée les ressources via `IEcommercePlatform`. Un modèle génératif n'a
jamais la main sur les effets de bord (AI_AGENTS.md §1). Le schéma impose la présence
d'une page d'accueil, sans quoi l'invariant `StoreStructure.isPublishable()` du domaine
serait immédiatement violé.

### 5. Arrêt net en cas d'échec partiel

Shopify n'offre pas de transaction. Si une collection échoue après la création du thème,
l'agent s'arrête et remonte l'erreur : une boutique à moitié construite avec une erreur
explicite vaut mieux qu'une structure incohérente présentée comme un succès.

**Conséquence assumée** : une reprise peut recréer des ressources déjà présentes. Un
dédoublonnage (recherche par titre avant création) est un candidat pour un module ultérieur.

### 6. Moindre privilège pour `ShopifyEcommercePlatform`

Cette classe ne reçoit que `baseThemeUrl`, jamais la configuration complète : le
`clientSecret` n'a rien à y faire. Un test vérifie que seule cette clé lui est transmise.

### 7. Le Shopify Agent lit produit et contenu SEO

L'entrée documentée ne transporte qu'un `productId`. L'agent lit donc le produit via
`IProductRepository` et son contenu SEO via `ISeoContentRepository`. Le contenu SEO, s'il
existe, prime sur la description réécrite : c'est la version la plus aboutie de la fiche
(critère d'acceptation n°5 du PRD).

## Limitations réelles identifiées

Ces points sont des écarts entre l'ambition du PRD et ce que Shopify permet réellement.
Ils sont documentés plutôt que masqués.

### A. La publication de la boutique n'est pas entièrement automatisable

Shopify n'expose **aucune API** pour lever la protection par mot de passe d'une boutique.
`publishStore` retourne l'URL publique, mais la levée du mot de passe reste une action
manuelle dans l'administration.

**Impact** : le critère d'acceptation n°6 du PRD (« la boutique publiée est accessible et
fonctionnelle, pas seulement en preview ») n'est pas atteignable sans une intervention
manuelle, à ajouter aux points de validation utilisateur de WORKFLOWS.md §3.

### B. L'identité de marque n'est pas injectée dans le thème

`applyTheme` fixe *quel* thème est utilisé, pas son apparence :

- avec `SHOPIFY_BASE_THEME_URL` : un thème est créé depuis l'archive. Shopify le crée avec
  le rôle `UNPUBLISHED` — sa publication reste manuelle ;
- sans : le thème déjà publié est réutilisé.

Appliquer la palette et la typographie suppose d'écrire `settings_data.json` via l'API
Asset, avec une structure propre à chaque thème. Hors périmètre de ce module.

**Impact** : la cohérence de marque visuelle (objectif PRD §2.1) n'est pas encore assurée
sur la boutique elle-même, seulement dans le Brand Book et les contenus rédigés.

### C. Les documents GraphQL ne sont pas validés contre une boutique réelle

`shopify.dev` renvoie `403` aux requêtes automatisées : les mutations ont été écrites
d'après la documentation consultée indirectement. Les noms d'arguments (`input:` contre
`page:`/`product:` selon la version d'API) peuvent différer sur la version `2025-01`.

**Impact** : le premier appel réel est le point de validation. Une erreur d'argument
remonterait proprement en `SHOPIFY_VALIDATION_ERROR` avec le message de Shopify, sans
comportement silencieux.

## Écarts par rapport aux documents (répercutés dans le même commit)

| # | Écart | Document mis à jour | Justification |
|---|---|---|---|
| 1 | Le Shopify Agent dépend aussi de `IProductRepository` et `ISeoContentRepository` | AI_AGENTS.md §7 | L'entrée ne porte qu'un identifiant : l'agent doit lire les données à publier |
| 2 | Variable `SHOPIFY_BASE_THEME_URL` | `.env.example` | Rend le thème de base configurable sans toucher au code |
| 3 | Limitations A et B ci-dessus | PRD.md §10 (critère 6) | Une contrainte de la plateforme, pas un choix d'implémentation |

## Conséquences

- L'Orchestrator (module 8) devra présenter la levée du mot de passe boutique comme une
  action manuelle avant de considérer le pipeline abouti.
- Aucun appel réel à Shopify n'a été effectué : tous les tests injectent un client simulé.
