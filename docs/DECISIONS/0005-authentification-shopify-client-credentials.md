# ADR 0005 — Authentification Shopify par « client credentials grant »

- Statut : Accepté
- Date : 2026-07-26
- Contexte : Shopify a supprimé les tokens d'API statiques. Les applications créées via le
  Dev Dashboard n'exposent plus de token à copier, mais un couple `client_id` /
  `client_secret` à échanger contre un token d'accès.
- Documents impactés : ARCHITECTURE.md §10, AI_AGENTS.md §7, API.md §12, `.env.example`.

## Contexte

Le document `.env.example` initial prévoyait un `SHOPIFY_ADMIN_API_TOKEN` fixe, lu depuis
l'environnement. Ce mode d'accès n'est plus disponible :

- Les tokens statiques et les anciennes « private apps » ont été retirés au 1er janvier 2026.
- L'administration Shopify n'affiche plus de token pour les applications personnalisées.
- Les intégrations serveur-à-serveur doivent obtenir un token par OAuth.

Le flux applicable ici est le **client credentials grant** : il est réservé aux
applications développées par sa propre organisation et installées sur des boutiques que
l'on possède — exactement le cas d'usage de BrandForge AI (PRD §3, persona « Entrepreneur
Solo »). Les applications publiques relèvent d'autres flux (token exchange, authorization
code), hors périmètre.

Caractéristiques du flux retenu :

| Élément | Valeur |
|---|---|
| Point d'échange | `POST https://{boutique}.myshopify.com/admin/oauth/access_token` |
| Encodage | `application/x-www-form-urlencoded` |
| Paramètres | `grant_type=client_credentials`, `client_id`, `client_secret` |
| Réponse | `{ "access_token": "...", "scope": "...", "expires_in": 86399 }` |
| Durée de vie | ~24 h — le token **expire**, contrairement à l'ancien token statique |
| Utilisation | En-tête `X-Shopify-Access-Token` |

## Décisions

### 1. Le port `IEcommercePlatform` n'est PAS modifié

C'est le constat central de cet ADR. Le port ne comportait **aucune notion de jeton, de
clé ou de session** : l'authentification était déjà, par construction, un détail
d'implémentation. Un changement majeur du mode d'authentification de Shopify n'a donc
impacté ni le port, ni le domaine, ni les agents, ni les use cases.

C'est la validation concrète du principe d'inversion de dépendance posé en
ARCHITECTURE.md §3. La section §10 (points d'extension) est complétée pour documenter ce
cas comme un point d'extension à part entière.

### 2. `ShopifyTokenProvider`, responsabilité isolée du client d'API

L'obtention du token est confiée à un composant dédié, derrière l'interface
`IShopifyTokenProvider`, plutôt qu'intégrée au futur client Admin API. Le client consomme
un token ; il n'a pas à savoir d'où il vient ni quand il est renouvelé.

### 3. Cache avec marge de sécurité de 60 s

Le token est mis en cache et réutilisé jusqu'à 60 secondes avant son échéance. Renouveler
exactement à l'expiration exposerait à un échec de course : un appel parti avec un token
encore valide peut atteindre Shopify après échéance.

Si Shopify omet `expires_in`, une durée de repli **courte** (5 min) est appliquée : mieux
vaut redemander un token trop souvent que d'en conserver un expiré et faire échouer une
étape du pipeline.

### 4. Déduplication des demandes concurrentes

Une seule requête d'échange est émise même si plusieurs appels demandent un token
simultanément. Le pipeline enchaîne des appels Shopify rapprochés (thème, collections,
pages, produits) : sans cela, le premier lot déclencherait autant d'échanges que d'appels.

### 5. Erreurs d'authentification non rejouables

Un `400`, `401` ou `403` sur l'échange de jeton produit un `SHOPIFY_AUTH_ERROR`
**non rejouable**. Réessayer avec des identifiants refusés consommerait le budget de
tentatives de l'Orchestrator sans aucune chance d'aboutir — même raisonnement que pour
`AI_PROVIDER_AUTH_ERROR` (ADR 0004, décision 4). Le message oriente vers la variable
d'environnement à corriger.

Un `404` est également traité comme une erreur d'authentification, mais oriente vers
`SHOPIFY_STORE_DOMAIN` : c'est la cause réelle la plus fréquente.

### 6. Normalisation du domaine de boutique

`SHOPIFY_STORE_DOMAIN` accepte le domaine `*.myshopify.com`, une URL d'administration
(`https://admin.shopify.com/store/<handle>/...`) ou un handle nu. Le domaine est en
pratique copié depuis la barre d'adresse de l'administration ; l'accepter tel quel
produirait une URL d'échange invalide et un échec difficile à diagnostiquer.

### 7. Le Storefront API reste sur un jeton distinct

Le client credentials grant couvre l'API Admin. `SHOPIFY_STOREFRONT_API_TOKEN` est
conservé, documenté comme optionnel et distinct.

## Changements

| Élément | Avant | Après |
|---|---|---|
| `.env.example` / `.env` | `SHOPIFY_ADMIN_API_TOKEN` | `SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET` |
| Nouveau code d'erreur | — | `SHOPIFY_UNAVAILABLE` (rejouable) |
| `IEcommercePlatform` | — | **inchangé** |

## Conséquences

- Le module « Store Builder Agent + Shopify Agent » consommera `IShopifyTokenProvider`
  pour authentifier chaque appel, sans jamais lire de variable d'environnement lui-même
  (CODING_STANDARDS.md §9).
- Sur un `401` en cours d'appel Admin API (token révoqué avant échéance), le client devra
  appeler `invalidate()` puis retenter **une** fois : c'est le seul cas où un
  `SHOPIFY_AUTH_ERROR` mérite une seconde tentative, et il est traité localement plutôt
  que remonté à l'Orchestrator.
- Aucun appel réel à Shopify n'a été effectué : les tests injectent un `HttpFetch` et une
  horloge simulés. La première authentification réelle reste à valider.

## Sources

- [Using the client credentials grant — shopify.dev](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant)
- [Generate access tokens for custom apps in the Shopify admin — shopify.dev](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/generate-app-access-tokens-admin)
- [How to get Admin API tokens using apps in Dev Dashboard — Shopify Developer Community](https://community.shopify.dev/t/how-to-get-admin-api-tokens-using-apps-in-dev-dashboard/29472)
