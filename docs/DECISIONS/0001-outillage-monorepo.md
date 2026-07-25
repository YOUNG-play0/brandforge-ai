# ADR 0001 — Outillage du monorepo (gestionnaire de paquets & runner de tests)

- Statut : Accepté
- Date : 2026-07-25
- Contexte : Setup initial du monorepo (feature/setup), avant tout développement métier.
- Documents de référence : ARCHITECTURE.md §2, CODING_STANDARDS.md §2 et §7.

## Décision

1. **Gestionnaire de paquets : `pnpm` (workspaces).**
   Recommandé par CODING_STANDARDS.md §2 pour un monorepo par workspaces. Les
   dépendances internes utilisent le protocole `workspace:*`. La configuration des
   workspaces vit dans `pnpm-workspace.yaml` (`apps/*`, `packages/*`).

2. **Runner de tests : `vitest`.**
   CODING_STANDARDS.md §7 impose des tests unitaires par agent et par use case
   (avec ports mockés), sans fixer d'outil. `vitest` est retenu pour son support
   TypeScript/ESM natif, sa rapidité et ses mocks intégrés. Les tests d'intégration
   Shopify réels seront isolés en `*.integration.test.ts`, hors CI par défaut.

3. **Build TypeScript : références de projet (`tsc -b`).**
   Les packages du cœur (`shared`, `domain`, `ai-agents`, `infrastructure`) forment
   un graphe composite typé strictement. `apps/web` est typé indépendamment par
   Next.js (règles JSX/bundler incompatibles avec le build composite) et n'est donc
   pas une référence du `tsconfig.json` racine.

## Conséquences

- Une seule configuration ESLint + Prettier partagée à la racine (pas de config par
  package), conformément à CODING_STANDARDS.md §2.
- `pnpm install` à la racine installe et lie tous les workspaces.
- Aucune logique métier n'est introduite à cette étape : uniquement le squelette.
