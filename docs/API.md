# API — BrandForge AI
Version : 1.0 (Draft initial)
Statut : En rédaction — à valider avant développement
Basé sur : PRD.md, ARCHITECTURE.md, DATABASE.md, AI_AGENTS.md (v1.0)

---

## 1. Principe

`apps/web` n'accède **jamais** directement à `packages/infrastructure`. Toute interaction passe par des **Server Actions** (Next.js) qui appellent des **use cases** exposés par `packages/domain`.

```
Composant React → Server Action (fine, apps/web/server-actions) → Use Case (packages/domain) → Ports → Infrastructure/Agents
```

Une Server Action ne doit contenir **aucune logique métier** : elle valide le format de l'entrée (via un schéma, ex. Zod), appelle un use case, et retourne le résultat typé.

Cette liste n'est **pas** un ensemble d'endpoints REST classiques exposés publiquement : ce sont les points d'entrée internes utilisés par le frontend du SaaS. Une vraie API REST/publique n'est envisagée qu'en V3 si besoin (ex. intégration tierce).

---

## 2. Convention de nommage des Server Actions

- Fichier : `packages/domain/<context>/use-cases/<verbe-objet>.usecase.ts`
- Server Action correspondante : `apps/web/server-actions/<context>/<verbe-objet>.action.ts`
- Une Server Action = un seul use case appelé. Pas d'orchestration de plusieurs use cases dans une Server Action (cette responsabilité appartient à l'Orchestrator, pas au frontend).

---

## 3. Actions — Store Project

### `createStoreProject`
- **Entrée** : `{ userId: string; name: string; niche: string; targetMarket: string }`
- **Sortie** : `{ storeProjectId: string; status: PipelineStatus }`
- **Use case** : `CreateStoreProject`

### `getStoreProject`
- **Entrée** : `{ storeProjectId: string }`
- **Sortie** : `StoreProjectDetail` (projet + statut du pipeline + dernière étape connue)
- **Use case** : `GetStoreProjectDetail`

### `listStoreProjects`
- **Entrée** : `{ userId: string }`
- **Sortie** : `StoreProjectSummary[]`
- **Use case** : `ListStoreProjects`

---

## 4. Actions — Pipeline / Orchestration

### `startPipeline`
Déclenche l'exécution du pipeline pour un projet (jusqu'au prochain point de validation utilisateur).
- **Entrée** : `{ storeProjectId: string }`
- **Sortie** : `{ pipelineRunId: string; status: PipelineStatus; currentStep: AgentName }`
- **Use case** : `StartPipeline` (délègue à l'Orchestrator)

### `getPipelineStatus`
- **Entrée** : `{ pipelineRunId: string }`
- **Sortie** : `{ status: PipelineStatus; steps: PipelineStepSummary[] }`
- **Use case** : `GetPipelineStatus`
- Utilisé par le frontend pour le polling de suivi (ou en V2, via un canal temps réel).

### `resumePipeline`
Reprend un pipeline en `FAILED` ou `PAUSED`, à partir de la dernière étape non réussie.
- **Entrée** : `{ pipelineRunId: string }`
- **Sortie** : `{ status: PipelineStatus; currentStep: AgentName }`
- **Use case** : `ResumePipeline`

---

## 5. Actions — Market Intelligence

### `analyzeNiche`
- **Entrée** : `{ storeProjectId: string }` (la niche est déjà stockée sur le `StoreProject`)
- **Sortie** : `NicheAnalysisResult` (cf. `MarketAgentOutput` dans AI_AGENTS.md)
- **Use case** : `AnalyzeNiche`

### `validateNicheAnalysis`
Point de validation utilisateur avant de passer à l'étape Branding.
- **Entrée** : `{ storeProjectId: string; approved: boolean; adjustments?: Partial<NicheAnalysisResult> }`
- **Sortie** : `{ confirmed: boolean }`
- **Use case** : `ValidateNicheAnalysis`

---

## 6. Actions — Branding

### `generateBrandOptions`
- **Entrée** : `{ storeProjectId: string; userPreferences?: BrandUserPreferences }`
- **Sortie** : `BrandAgentOutput` (cf. AI_AGENTS.md)
- **Use case** : `GenerateBrandOptions`

### `selectBrandName`
Point de validation utilisateur — choix définitif du nom parmi les propositions.
- **Entrée** : `{ storeProjectId: string; selectedName: string }`
- **Sortie** : `{ brandId: string; confirmed: true }`
- **Use case** : `SelectBrandName`

---

## 7. Actions — Store Building

### `buildStoreStructure`
- **Entrée** : `{ storeProjectId: string }`
- **Sortie** : `StoreBuilderAgentOutput` (cf. AI_AGENTS.md)
- **Use case** : `BuildStoreStructure`

---

## 8. Actions — Products

### `importProduct`
Appelée par l'extension Chrome (ou manuellement depuis le dashboard).
- **Entrée** : `{ storeProjectId: string; source: "ALIEXPRESS" | "MANUAL"; rawProduct: RawProductInput }`
- **Sortie** : `{ productId: string; status: ProductStatus }`
- **Use case** : `ImportProduct`

### `importProductsBatch`
- **Entrée** : `{ storeProjectId: string; products: RawProductInput[] }`
- **Sortie** : `{ importedCount: number; failedCount: number; productIds: string[] }`
- **Use case** : `ImportProductsBatch`

### `listProducts`
- **Entrée** : `{ storeProjectId: string }`
- **Sortie** : `ProductSummary[]`
- **Use case** : `ListProducts`

---

## 9. Actions — SEO

### `optimizeProductSeo`
- **Entrée** : `{ productId: string; targetKeywords?: string[] }`
- **Sortie** : `SeoAgentOutput` (cf. AI_AGENTS.md)
- **Use case** : `OptimizeProductSeo`

---

## 10. Actions — Publishing (Shopify)

### `publishStore`
- **Entrée** : `{ storeProjectId: string }`
- **Sortie** : `{ status: "PUBLISHED"; storeUrl: string }`
- **Use case** : `PublishStore`

### `publishProduct`
- **Entrée** : `{ productId: string }`
- **Sortie** : `{ shopifyProductId: string; status: "PUBLISHED" }`
- **Use case** : `PublishProduct`

### `syncProduct`
- **Entrée** : `{ productId: string }`
- **Sortie** : `{ status: "SYNCED" }`
- **Use case** : `SyncProduct`

---

## 11. Actions — Extension Chrome (point d'entrée spécifique)

L'extension Chrome ne peut pas appeler directement une Server Action Next.js de la même façon qu'un composant React interne. Elle communique via une **route API dédiée et authentifiée** :

### `POST /api/extension/import-product`
- **Auth** : token d'API généré depuis le dashboard (associé au `User`)
- **Entrée** : identique à `importProduct`
- **Sortie** : identique à `importProduct`
- Cette route est la **seule** route HTTP publique du MVP ; tout le reste passe par les Server Actions internes à Next.js.

---

## 12. Gestion des erreurs (contrat commun)

Toute Server Action retourne une forme homogène :

```ts
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; retryable: boolean } };
```

Les codes d'erreur reprennent ceux définis par agent dans `AI_AGENTS.md` (ex. `AI_PROVIDER_TIMEOUT`, `SHOPIFY_AUTH_ERROR`), plus des codes transverses :
- `UNAUTHORIZED`
- `STORE_PROJECT_NOT_FOUND`
- `INVALID_PIPELINE_STATE` (ex. tenter de publier un produit avant la validation de la marque)
- `VALIDATION_ERROR` (entrée invalide, ou sortie d'agent non conforme rejetée avant persistance)
- `BRAND_NOT_FOUND`
- `NICHE_ANALYSIS_NOT_FOUND`
- `PRODUCT_NOT_FOUND`
- `PIPELINE_RUN_NOT_FOUND`

Un projet appartenant à un autre utilisateur retourne `STORE_PROJECT_NOT_FOUND`, et non `UNAUTHORIZED` : cela évite de révéler l'existence d'un identifiant à un tiers.

---

## 13. Prochaines étapes

Une fois ce document validé :
1. Verrouillage de la version 1.0 (`/docs/API.md` + entrée dans `/docs/DECISIONS/`).
2. Rédaction du document **WORKFLOWS.md** (comportement précis de l'Orchestrator : séquencement des actions ci-dessus, gestion des états `INVALID_PIPELINE_STATE`, reprise sur erreur).
3. Puis **CODING_STANDARDS.md**, dernier document avant le début du développement.
