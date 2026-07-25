# BrandForge AI

SaaS d'agents IA orchestrés qui automatise la création complète d'une marque
e-commerce — de l'intention en langage naturel jusqu'à la boutique Shopify
publiée. Voir [`docs/PRD.md`](docs/PRD.md) pour la vision produit.

> Ce dépôt suit une **documentation vivante** : `/docs` est la source de vérité.
> Aucun code n'est écrit sans document validé correspondant, et tout écart d'une
> implémentation par rapport à un document met ce document à jour dans le même commit
> (CODING_STANDARDS.md §8).

## Architecture

Clean Architecture / DDD / Vertical Slice. Le cœur métier ne dépend d'aucun
framework. Détails dans [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

```
apps/
  web/                     # Next.js — présentation uniquement (aucune logique métier)
packages/
  domain/                  # Cœur métier : entités, use cases, ports (interfaces)
  ai-agents/               # Implémentations concrètes des agents IA
  infrastructure/          # Implémentations des ports : Prisma, Groq, Shopify, scraping
  shared/                  # Types, erreurs, constantes transverses (sans logique métier)
extension-chrome/          # Extension d'import AliExpress (isolée)
prisma/                    # Schéma de base de données
docker/                    # Configuration Docker
docs/                      # Documentation vivante + DECISIONS (ADR)
```

Règle de dépendances (ARCHITECTURE.md §3) : `apps/web` et `packages/*` dépendent
de `packages/domain` ; `domain` ne connaît jamais l'infrastructure ni le frontend.

## Stack

Next.js 15 · TypeScript strict · TailwindCSS · shadcn/ui · PostgreSQL + Prisma ·
API Groq · Shopify Admin/Storefront API · Docker · Vercel.

## Prérequis

- Node.js ≥ 22 (voir `.nvmrc`)
- pnpm ≥ 10

## Démarrage

```bash
pnpm install
cp .env.example .env      # renseigner les valeurs (jamais commitées)
```

## Scripts (racine)

| Script           | Rôle                                                   |
| ---------------- | ------------------------------------------------------ |
| `pnpm typecheck` | Vérification TypeScript stricte (références de projet) |
| `pnpm lint`      | ESLint sur tout le monorepo (config partagée unique)   |
| `pnpm format`    | Formatage Prettier                                     |
| `pnpm test`      | Tests (vitest) de chaque package                       |
| `pnpm build`     | Build de tous les packages                             |

## Workflow Git

- `main` : versions stables. `develop` : intégration. `feature/*` : une fonctionnalité
  issue d'un document validé.
- Convention de commits : [Conventional Commits](https://www.conventionalcommits.org/).
- Détails : CODING_STANDARDS.md §8.

## Documentation

| Document                                        | Contenu                                       |
| ----------------------------------------------- | --------------------------------------------- |
| [PRD.md](docs/PRD.md)                           | Vision, périmètre MVP, critères d'acceptation |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)         | Bounded Contexts, dépendances, patterns       |
| [DATABASE.md](docs/DATABASE.md)                 | Modèle de données, schéma Prisma              |
| [AI_AGENTS.md](docs/AI_AGENTS.md)               | Contrats d'entrée/sortie des agents           |
| [API.md](docs/API.md)                           | Server Actions internes                       |
| [WORKFLOWS.md](docs/WORKFLOWS.md)               | Orchestrateur, machine à états du pipeline    |
| [CODING_STANDARDS.md](docs/CODING_STANDARDS.md) | Règles de code impératives                    |
| [DECISIONS/](docs/DECISIONS/)                   | Journal des décisions (ADR)                   |
