# CODING_STANDARDS — BrandForge AI
Version : 1.0 (Draft initial)
Statut : En rédaction — dernier document avant développement
Basé sur : PRD.md, ARCHITECTURE.md, DATABASE.md, AI_AGENTS.md, API.md, WORKFLOWS.md (v1.0)

---

## 1. Objectif de ce document

Ce document fixe les règles que **Claude Code doit respecter à chaque implémentation**, sans exception, afin que le code produit reste cohérent quel que soit le module travaillé ou le moment du projet. En cas de doute pendant le développement, ce document fait référence — pas une convention "au feeling".

---

## 2. Langage et outillage

- **TypeScript strict** partout (`strict: true` dans `tsconfig.json`), aucun `any` toléré sauf justification explicite en commentaire (`// any justifié: ...`).
- **ESLint + Prettier** configurés au niveau du monorepo, une seule configuration partagée (pas de config différente par package).
- **Gestionnaire de paquets** : à fixer dès le setup (pnpm recommandé pour un monorepo par workspaces) — décision à documenter dans `/docs/DECISIONS/`.

---

## 3. Structure de fichiers (rappel + précisions)

- Un fichier = une responsabilité. Un use case = un fichier `*.usecase.ts`. Un agent = un fichier `*.agent.ts` (+ éventuellement des fichiers de support dans le même dossier).
- Les tests vivent à côté du fichier testé : `create-brand.usecase.ts` + `create-brand.usecase.test.ts`.
- Aucun fichier `index.ts` fourre-tout qui réexporte tout un dossier sans discernement — les exports publics d'un package sont explicites dans un seul `index.ts` à la racine du package, listant précisément ce qui est exposé à l'extérieur.

---

## 4. Nommage (complète les conventions d'ARCHITECTURE.md)

| Élément | Convention | Exemple |
|---|---|---|
| Fichiers | kebab-case | `analyze-niche.usecase.ts` |
| Classes / Types / Interfaces | PascalCase | `NicheAnalysis`, `IAiProvider` |
| Variables / fonctions | camelCase | `analyzeNiche()` |
| Constantes globales | UPPER_SNAKE_CASE | `DEFAULT_AI_TIMEOUT_MS` |
| Enums | PascalCase (nom) + UPPER_SNAKE_CASE (valeurs) | `enum PipelineStatus { RUNNING, FAILED }` |
| Dossiers de Bounded Context | kebab-case singulier métier | `market-intelligence`, `branding` |

---

## 5. Gestion des erreurs

- Toujours utiliser le type `AgentResult<T>` / `ActionResult<T>` définis dans `AI_AGENTS.md` / `API.md` — jamais de `throw` non typé remontant jusqu'au frontend.
- Les erreurs internes techniques (ex. exception Prisma) sont **catchées à la frontière infrastructure** et transformées en `AgentError`/erreur typée avant de remonter au domaine. Le domaine ne manipule jamais une exception brute d'une librairie externe.
- Chaque erreur porte un `code` stable (utilisé côté frontend pour l'affichage), un `message` lisible, et un flag `retryable`.

---

## 6. Timeouts et résilience (référencé depuis AI_AGENTS.md)

- **Timeout par défaut pour tout appel `IAiProvider` (Groq)** : 30 secondes. Configurable par variable d'environnement (`AI_PROVIDER_TIMEOUT_MS`), jamais codé en dur dans un agent.
- **Nombre de tentatives automatiques en cas d'erreur `retryable: true`** : 3, avec backoff exponentiel (1s, 3s, 9s).
- **Timeout pour les appels Shopify** : 15 secondes, avec gestion explicite du rate limit (`SHOPIFY_RATE_LIMIT`) via retry avec backoff.

---

## 7. Tests

- **Chaque agent** doit avoir des tests unitaires avec un `IAiProvider` mocké (jamais d'appel réseau réel en test).
- **Chaque use case du domaine** doit être testable sans base de données réelle (repositories mockés via les ports).
- **Chaque Server Action** est testée a minima sur : cas de succès, cas d'erreur `retryable`, cas d'erreur non-`retryable`.
- Pas d'obligation de couverture à 100 %, mais tout use case et tout agent doivent avoir au moins un test de succès et un test d'échec.
- Les tests d'intégration avec Shopify réel (sandbox) sont isolés dans un dossier dédié (`*.integration.test.ts`), non exécutés en CI par défaut (nécessitent des credentials).

---

## 8. Commits et branches (rappel + précisions)

- Convention de commit : **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
- Une branche `feature/*` = une fonctionnalité issue d'un document validé (PRD/ARCHITECTURE/AI_AGENTS/API/WORKFLOWS), jamais une branche "au fil de l'eau" sans spécification préalable.
- Aucune fusion dans `develop` sans que le code corresponde à ce qui est documenté dans `/docs`. Si une implémentation nécessite de s'écarter d'un document, le document est mis à jour **avant** la fusion (traçabilité).

---

## 9. Variables d'environnement

Toutes les clés/API tokens (Groq, Shopify, base de données) sont :
- Définies dans un `.env.example` versionné (sans valeurs réelles).
- Jamais commitées avec leur valeur réelle.
- Chargées uniquement côté `packages/infrastructure`, jamais lues directement dans `apps/web` ou dans un agent.

---

## 10. Ce que Claude Code ne doit jamais faire (rappel des interdictions du PRD, étendu au code)

- Ne jamais ajouter une dépendance interdite listée dans `ARCHITECTURE.md` (section 3).
- Ne jamais introduire de logique métier dans `apps/web`.
- Ne jamais appeler directement une API externe (Groq, Shopify, scraping) en dehors de `packages/infrastructure`.
- Ne jamais implémenter une fonctionnalité "hors MVP" (Image Agent, Blog Agent, Marketing Agent, multi-projets avancé) sans validation explicite préalable — même si le contrat existe déjà dans `AI_AGENTS.md`, l'implémentation n'est pas autorisée avant le feu vert.
- Ne jamais modifier un document `/docs` sans le signaler explicitement dans sa réponse (traçabilité des changements de spécification).

---

## 11. Bilan — fin de la phase de documentation

Avec ce document, les 6 documents fondateurs sont réunis :

1. ✅ PRD.md
2. ✅ ARCHITECTURE.md
3. ✅ DATABASE.md
4. ✅ AI_AGENTS.md
5. ✅ API.md
6. ✅ WORKFLOWS.md
7. ✅ CODING_STANDARDS.md

**Le développement peut maintenant commencer**, dans l'ordre défini précédemment :
1. Setup du monorepo + structure des dossiers (squelette vide)
2. `packages/domain` (entités, ports — sans implémentation)
3. `packages/infrastructure/database` (Prisma + repositories)
4. Market Agent
5. Brand Agent
6. Store Builder Agent + Shopify Agent
7. Product Agent + extension Chrome
8. SEO Agent
9. Orchestrateur
10. Frontend (dashboard de suivi du pipeline)

---

## 12. Prochaine étape

Une fois ce document validé, on rédige le **premier prompt d'implémentation pour Claude Code** : le setup du monorepo (structure de dossiers vide, configuration TypeScript/ESLint/Prettier, `package.json` workspaces, `.env.example`) — sans aucune logique métier, juste le squelette conforme à `ARCHITECTURE.md`.
