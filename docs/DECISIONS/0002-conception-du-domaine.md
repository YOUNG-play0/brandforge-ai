# ADR 0002 — Conception de `packages/domain`

- Statut : Accepté
- Date : 2026-07-25
- Contexte : Module 1 (branche `feature/domain`) — entités, ports et use cases des
  7 Bounded Contexts, sans aucune implémentation d'infrastructure.
- Documents de référence : ARCHITECTURE.md, DATABASE.md, AI_AGENTS.md, API.md,
  WORKFLOWS.md, CODING_STANDARDS.md.

## Décisions

### 1. Entités en classes avec constructeur privé

Chaque entité expose `create(...)` (création validée, retournant un `ActionResult`),
`reconstitute(snapshot)` (réhydratation depuis la persistance, sans revalidation) et
`toSnapshot()`. Les invariants sont ainsi impossibles à contourner, et le repository
Prisma du module suivant n'a besoin que du couple snapshot/reconstitute — il ne
manipule jamais l'état interne d'une entité.

### 2. Les ports techniques transverses vivent dans `orchestration/ports`

`IAiProvider`, `IIdGenerator` et `IClock` sont utilisés par plusieurs contextes.
Plutôt que de les dupliquer ou d'inventer un dossier absent de l'arborescence
d'ARCHITECTURE.md §2, ils sont regroupés dans `orchestration` — le contexte qui pilote
l'exécution des agents et porte déjà le contrat générique `Agent<TInput, TOutput>`.

`IEcommercePlatform` est défini dans `publishing`, contexte propriétaire de
l'intégration plateforme ; `store-building` le consomme comme contrat public.

### 3. `IIdGenerator` / `IClock` injectés plutôt qu'appels directs

Les use cases n'appellent jamais `crypto.randomUUID()` ni `new Date()`. Cela les rend
déterministes en test (CODING_STANDARDS.md §7) sans recourir à des faux timers.

### 4. `StoreProject` appartient au contexte `orchestration`

ARCHITECTURE.md §6 ne rattache pas explicitement l'entité pivot à un contexte. Elle est
placée dans `orchestration` car son `status` est un `PipelineStatus` et que son cycle de
vie est celui du pipeline.

### 5. Pas d'entité `User` dans le domaine

Le MVP prévoit une authentification simple (PRD.md §6) et aucun contexte « Identité »
n'existe dans ARCHITECTURE.md §6. `userId` est traité comme une donnée de rattachement
(`StoreProject.userId` + `belongsTo`). La table `User` de DATABASE.md reste inchangée.

### 6. Un projet d'un autre utilisateur retourne « introuvable »

Les use cases de lecture retournent `STORE_PROJECT_NOT_FOUND` plutôt que `UNAUTHORIZED`
lorsqu'un projet existe mais appartient à un tiers, afin de ne pas révéler l'existence
d'un identifiant. API.md §12 a été mis à jour en conséquence.

### 7. `ImportProductsBatch` réutilise `ImportProduct` séquentiellement

Le use case de lot compose le use case unitaire et collecte les échecs sans jamais
interrompre le traitement (WORKFLOWS.md §5). Le traitement est séquentiel et non
parallèle : le fournisseur IA et l'API Shopify sont soumis à des quotas.

## Écarts par rapport aux documents (répercutés dans le même commit)

| # | Écart | Document mis à jour | Justification |
|---|---|---|---|
| 1 | `StepStatus` gagne `PARTIAL_SUCCESS` | DATABASE.md §3 et §4 | WORKFLOWS.md §5 l'exige pour l'import de masse ; l'enum ne le prévoyait pas |
| 2 | `NicheAnalysis` gagne `validatedByUser` | DATABASE.md §3 et §4 | Le point de validation de WORKFLOWS.md §3 doit être persisté |
| 3 | `NicheAnalysis` gagne `differentiationAngle` | DATABASE.md §3 et §4 | Produit par `MarketAgentOutput` et consommé par le Brand Agent, mais absent de la table |
| 4 | `Brand.name` et `Brand.logoUrl` deviennent nullables | DATABASE.md §3 et §4 | À la génération, le nom n'est pas encore choisi et le logo pas encore produit |
| 5 | `Brand` gagne `nameOptions` et `logoBriefing` | DATABASE.md §3 et §4 | Nécessaires pour présenter le choix à l'utilisateur et vérifier que le nom retenu vient bien de l'agent |
| 6 | `Product.sourceUrl` devient nullable | DATABASE.md §3 et §4 | Un produit `MANUAL` n'a pas d'URL source (déjà optionnelle dans AI_AGENTS.md §5) |
| 7 | `ShopifyAgentInput.payload: unknown` → union discriminée | AI_AGENTS.md §7 | Concrétise le « typé selon l'action » du document, conformément à la règle d'entrée strictement typée (§1) |
| 8 | `BrandAgentOutput.selectedName` retiré | AI_AGENTS.md §3 | Le champ n'est jamais produit par l'agent ; le choix est porté par `Brand.selectName` |

## Conséquences

- Le module suivant (`infrastructure/database`) implémente le schéma Prisma **tel que
  corrigé ci-dessus**, pas la version initiale de DATABASE.md.
- Aucun agent n'est implémenté à ce stade : seuls leurs ports existent.
- Aucune fonctionnalité hors MVP n'est développée. `AgentName` et `AssetType` conservent
  leurs valeurs V2 (IMAGE, BLOG, MARKETING…) car DATABASE.md les prévoit déjà, mais
  aucun code correspondant n'existe.
