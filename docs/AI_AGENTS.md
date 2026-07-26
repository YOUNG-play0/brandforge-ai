# AI_AGENTS — BrandForge AI
Version : 1.0 (Draft initial)
Statut : En rédaction — à valider avant développement
Basé sur : PRD.md v1.0, ARCHITECTURE.md v1.0, DATABASE.md v1.0

---

## 1. Principe général

Chaque agent est un **use case du domaine** dont l'implémentation concrète vit dans `packages/ai-agents`. Un agent :

- Reçoit une entrée **strictement typée** (jamais un objet libre).
- Retourne une sortie **strictement typée**, ou une erreur explicite.
- N'a **aucun effet de bord caché** : toute écriture en base ou tout appel externe passe par un port injecté (`IAiProvider`, `IProductRepository`, etc.), jamais un appel direct.
- Est **stateless** : il ne conserve aucun état entre deux exécutions ; tout l'état vit dans `PipelineRun` / `PipelineStep` (cf. DATABASE.md).
- Doit pouvoir être testé isolément avec un `IAiProvider` mocké, sans appeler réellement Groq.

Le contrat générique d'un agent, au niveau du domaine :

```ts
interface Agent<TInput, TOutput> {
  readonly name: AgentName;
  execute(input: TInput): Promise<AgentResult<TOutput>>;
}

type AgentResult<T> =
  | { success: true; output: T }
  | { success: false; error: AgentError };

interface AgentError {
  code: string;        // ex. "NICHE_TOO_VAGUE", "AI_PROVIDER_TIMEOUT"
  message: string;
  retryable: boolean;
}
```

---

## 2. Market Agent

**Rôle** : produire une `NicheAnalysis` exploitable à partir d'une niche déclarée par l'utilisateur.

### Entrée
```ts
interface MarketAgentInput {
  niche: string;            // ex. "lunettes de soleil"
  targetMarket: string;     // ex. "France"
  additionalContext?: string; // précisions optionnelles de l'utilisateur
}
```

### Sortie
```ts
interface MarketAgentOutput {
  keywords: string[];
  competitors: Array<{
    name: string;
    url: string;
    positioning: string;
    estimatedPriceRange: { min: number; max: number };
  }>;
  priceRange: { min: number; max: number };
  relevanceScore: number; // 0 à 1
  differentiationAngle: string; // angle différenciant suggéré
  rawAnalysis: unknown; // sortie brute du modèle IA, pour traçabilité
}
```

### Erreurs possibles
- `NICHE_TOO_VAGUE` (retryable: false — nécessite une reformulation utilisateur)
- `AI_PROVIDER_TIMEOUT` (retryable: true)
- `AI_PROVIDER_INVALID_RESPONSE` (retryable: true)

Erreurs transverses remontées par tout `IAiProvider` (cf. §9) :
- `AI_PROVIDER_RATE_LIMIT` (retryable: true — quota dépassé, HTTP 429)
- `AI_PROVIDER_UNAVAILABLE` (retryable: true — panne du fournisseur ou réseau)
- `AI_PROVIDER_AUTH_ERROR` (retryable: **false** — clé invalide ou révoquée ; rejouer
  épuiserait le budget de tentatives sans jamais aboutir)

### Dépendances
- `IAiProvider` (Groq)
- Optionnel V2 : `IWebSearchProvider` pour enrichir l'analyse concurrentielle réelle (MVP : analyse basée sur les connaissances du modèle + mots-clés fournis).

---

## 3. Brand Agent

**Rôle** : produire une `Brand` (nom, positionnement, Brand Book) à partir d'une `NicheAnalysis` validée.

### Entrée
```ts
interface BrandAgentInput {
  nicheAnalysis: NicheAnalysisSummary; // sous-ensemble validé de MarketAgentOutput
  userPreferences?: {
    desiredTone?: string;       // ex. "premium, épuré"
    namesToAvoid?: string[];
  };
}
```

### Sortie
```ts
interface BrandAgentOutput {
  nameOptions: string[];       // 3 à 5 propositions de nom
  // `selectedName` n'appartient pas à la sortie de l'agent : le choix du nom est porté
  // par l'entité `Brand` lors du point de validation utilisateur (`selectBrandName`).
  positioning: string;
  tone: string;
  colorPalette: Array<{ hex: string; role: "primary" | "secondary" | "accent" }>;
  typography: { heading: string; body: string };
  logoBriefing: string;        // brief textuel transmis à l'Image Agent (V2) ou à un service logo (MVP)
}
```

### Erreurs possibles
- `BRAND_NAME_CONFLICT` (retryable: true — regénérer d'autres noms)
- `AI_PROVIDER_TIMEOUT` (retryable: true)

### Dépendances
- `IAiProvider`
- MVP : génération de logo via un service tiers simple ou un template ; V2 : `Image Agent`.

### Note importante
Le Brand Agent produit **des propositions**, jamais une décision finale seule. La sélection du nom (`selectedName`) est un point de validation utilisateur obligatoire dans l'Orchestrator (cf. WORKFLOWS.md à venir).

---

## 4. Store Builder Agent

**Rôle** : générer la structure de la boutique Shopify (thème, collections, pages) à partir d'une `Brand` validée.

### Entrée
```ts
interface StoreBuilderAgentInput {
  brand: BrandSummary; // nom, palette, typographie, ton
  niche: string;
  storeProjectId: string;
}
```

### Sortie
```ts
interface StoreBuilderAgentOutput {
  shopifyThemeId: string;
  collectionsCreated: Array<{ id: string; title: string }>;
  pagesCreated: Array<{ id: string; title: string; type: "home" | "about" | "contact" | "legal" }>;
}
```

### Erreurs possibles
- `SHOPIFY_AUTH_ERROR` (retryable: false — nécessite une reconnexion utilisateur)
- `SHOPIFY_RATE_LIMIT` (retryable: true, avec backoff)
- `THEME_APPLICATION_FAILED` (retryable: true)

### Dépendances
- `IEcommercePlatform` (implémenté par `shopify-client`)

---

## 5. Product Agent

**Rôle** : importer et normaliser des produits (source AliExpress via extension Chrome, ou saisie manuelle), et produire une réécriture initiale.

### Entrée
```ts
interface ProductAgentInput {
  storeProjectId: string;
  source: "ALIEXPRESS" | "MANUAL";
  rawProduct: {
    sourceUrl?: string;
    title: string;
    description: string;
    images: string[];
    price: number;
  };
  brand: BrandSummary; // pour aligner le ton de la réécriture
}
```

### Sortie
```ts
interface ProductAgentOutput {
  rewrittenTitle: string;
  rewrittenDescription: string;
  normalizedImages: string[];
  suggestedPrice: number; // avec marge suggérée
}
```

### Erreurs possibles
- `PRODUCT_SOURCE_UNREACHABLE` (retryable: true)
- `PRODUCT_DATA_INCOMPLETE` (retryable: false — nécessite complément manuel)
- `AI_PROVIDER_TIMEOUT` (retryable: true)

### Dépendances
- `IAiProvider`
- `IProductSource` (implémenté par le module `scraping`, alimenté par l'extension Chrome)
- `IProductRepository`

---

## 6. SEO Agent

**Rôle** : optimiser une fiche produit (ou un article, en V2) pour le référencement.

### Entrée
```ts
interface SeoAgentInput {
  productId: string;
  title: string;
  description: string;
  targetKeywords?: string[]; // hérités de NicheAnalysis si non fournis
}
```

### Sortie
```ts
interface SeoAgentOutput {
  metaTitle: string;
  metaDescription: string;
  optimizedContent: string;
  targetKeywords: string[];
}
```

### Erreurs possibles
- `CONTENT_TOO_SHORT` (retryable: false)
- `AI_PROVIDER_TIMEOUT` (retryable: true)

### Dépendances
- `IAiProvider`

---

## 7. Shopify Agent

**Rôle** : publier et synchroniser les entités (boutique, produits) sur Shopify.

### Entrée
```ts
// Union discriminée par `action` : la règle « entrée strictement typée » (§1) interdit
// un payload `unknown`, le type varie donc selon l'action demandée.
type ShopifyAgentInput =
  | { storeProjectId: string; action: "PUBLISH_STORE" }
  | {
      storeProjectId: string;
      action: "PUBLISH_PRODUCT" | "SYNC_PRODUCT";
      productId: string;
    };
```

### Sortie
```ts
interface ShopifyAgentOutput {
  shopifyResourceId: string;
  status: "PUBLISHED" | "SYNCED";
  url?: string; // URL publique si applicable
}
```

### Erreurs possibles
- `SHOPIFY_AUTH_ERROR` (retryable: false — identifiants client refusés, application désinstallée, ou portées insuffisantes)
- `SHOPIFY_RATE_LIMIT` (retryable: true, avec backoff)
- `SHOPIFY_VALIDATION_ERROR` (retryable: false — données invalides à corriger en amont)
- `SHOPIFY_UNAVAILABLE` (retryable: true — panne Shopify ou réseau injoignable)

**Authentification** : l'accès à l'API Admin passe par un token obtenu à la demande via le
flux OAuth « client credentials grant » et expirant sous ~24 h (cf. `/docs/DECISIONS/0005`).
L'obtention, la mise en cache et le renouvellement sont entièrement pris en charge par
`infrastructure/shopify-client` : l'agent n'en a aucune connaissance.

### Dépendances
- `IEcommercePlatform`
- `IProductRepository` et `ISeoContentRepository` : l'entrée ne transporte qu'un
  `productId`, l'agent doit donc lire le produit et son contenu SEO à publier. Le contenu
  SEO prime sur la description réécrite lorsqu'il existe (cf. `/docs/DECISIONS/0006`).

---

## 8. Agents hors MVP (contrats anticipés, non implémentés en V1)

### Image Agent (V2)
```ts
interface ImageAgentInput {
  briefing: string;      // ex. issu de BrandAgentOutput.logoBriefing
  type: "LOGO" | "PRODUCT_VISUAL" | "BANNER";
  referenceStyle?: { colorPalette: string[] };
}
interface ImageAgentOutput {
  imageUrl: string;
  variants?: string[];
}
```

### Blog Agent (V2)
```ts
interface BlogAgentInput {
  brand: BrandSummary;
  topic: string;
  targetKeywords: string[];
}
interface BlogAgentOutput {
  title: string;
  content: string;
  metaDescription: string;
}
```

### Marketing Agent (V2)
```ts
interface MarketingAgentInput {
  brand: BrandSummary;
  channel: "GOOGLE_ADS" | "FACEBOOK_ADS" | "EMAIL";
  objective: string;
}
interface MarketingAgentOutput {
  campaignAssets: unknown; // typé finement lors de la spécification V2
}
```

---

## 9. Règles transverses à tous les agents

1. **Idempotence autant que possible** : réexécuter un agent avec la même entrée doit produire un résultat cohérent (pas nécessairement identique pour les agents génératifs, mais toujours valide).
2. **Timeout obligatoire** : chaque appel à `IAiProvider` doit avoir un timeout configuré (valeur par défaut à fixer dans `CODING_STANDARDS.md`).
   L'implémentation du port applique le timeout et traduit les échecs en `AgentError`, mais
   **ne rejoue jamais** : le nombre de tentatives et le backoff appartiennent à
   l'Orchestrator (WORKFLOWS.md §4.1). Empiler un retry transport et un retry d'étape
   multiplierait les appels facturés sans que le total soit maîtrisé.
3. **Aucun agent n'appelle un autre agent directement.** Seul l'Orchestrator séquence les agents. Cela garantit qu'un agent reste testable isolément.
4. **Toute sortie d'agent est validée (schéma) avant d'être persistée**, pour éviter qu'une réponse IA malformée corrompe la base.
5. **Chaque exécution d'agent correspond à un `PipelineStep`** (cf. DATABASE.md), avec `input`/`output` journalisés.

---

## 10. Prochaines étapes

Une fois ce document validé :
1. Verrouillage de la version 1.0 (`/docs/AI_AGENTS.md` + entrée dans `/docs/DECISIONS/`).
2. Rédaction du document **API.md** (routes/server actions internes exposant ces use cases au frontend).
3. Rédaction du document **WORKFLOWS.md** (comportement précis de l'Orchestrator : séquencement, gestion d'erreur, reprise).
4. Toujours aucun code tant que API.md et WORKFLOWS.md ne sont pas validés.
