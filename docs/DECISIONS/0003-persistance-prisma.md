# ADR 0003 — Persistance Prisma (`packages/infrastructure/database`)

- Statut : Accepté
- Date : 2026-07-25
- Contexte : Module 2 (branche `feature/infrastructure-database`) — schéma Prisma et
  implémentations concrètes des ports de repository.
- Documents de référence : DATABASE.md, ARCHITECTURE.md §12, CODING_STANDARDS.md §5 et §9.

## Décisions

### 1. Les erreurs d'infrastructure sont **levées**, sous forme typée

Les ports de repository du domaine retournent des entités (`Promise<Entity | null>`), pas
des `ActionResult`. Une panne de base n'est pas un cas métier : l'imposer dans la
signature de chaque port polluerait tous les use cases pour un événement exceptionnel.

Toute exception Prisma est donc convertie à la frontière en `InfrastructureError`, qui
porte une `AgentError` typée (`code`, `message`, `retryable`). Le domaine ne voit jamais
une exception Prisma brute — l'exigence de CODING_STANDARDS.md §5 est respectée. La
couche de présentation (module Frontend) rattrapera cette erreur pour la convertir en
`ActionResult` d'échec.

Le flag `retryable` est décidé ici, car seule cette couche sait distinguer un échec
transitoire (`P1001` base injoignable) d'un échec définitif (`P2002` unicité violée).

### 2. `save` est un `upsert`

Les identifiants sont générés par le domaine via `IIdGenerator`, jamais par la base. Un
`upsert` rend donc `save` idempotent et évite au domaine de distinguer création et mise à
jour — distinction qui n'a pas de sens métier.

### 3. `PipelineRun` est sauvegardé transactionnellement

Le run et ses étapes forment un agrégat. Ils sont écrits dans une transaction unique :
une panne au milieu de la sauvegarde laisserait sinon un run dont les étapes ne reflètent
pas l'état réel, et la reprise repartirait d'un point erroné (WORKFLOWS.md §4.3). Les
étapes retirées de l'agrégat sont supprimées dans la même transaction.

### 4. Mappers purs, séparés des repositories

La conversion ligne ↔ entité vit dans des fonctions pures (`mappers/`), testables sans
base. Les repositories ne font que combiner requête Prisma et mapper.

Un value object qui ne peut pas être reconstruit depuis la base (fourchette de prix
incohérente, palette invalide) lève une `InfrastructureError` : c'est le signe d'une
corruption ou d'une migration manquée, pas un cas métier à propager silencieusement.

### 5. Le CLI Prisma est piloté depuis la racine

Prisma résout la racine du projet à partir de l'emplacement du schéma. Comme
ARCHITECTURE.md §2 place `prisma/` à la racine du monorepo, `prisma` (CLI) et
`@prisma/client` y sont déclarés et les scripts `db:*` y vivent. `packages/infrastructure`
déclare `@prisma/client` comme dépendance puisque c'est lui qui l'importe.

### 6. Tests sans base de données réelle

Les repositories sont testés contre une doublure du client Prisma qui vérifie les
requêtes émises ; les mappers sont testés sur des fixtures reproduisant la forme exacte
des lignes (`Decimal`, `Json`). Aucun test n'ouvre de connexion (CODING_STANDARDS.md §7).
Les tests d'intégration sur base réelle restent à écrire en `*.integration.test.ts`, hors
CI par défaut.

## Écarts par rapport aux documents (répercutés dans le même commit)

| # | Écart | Document mis à jour | Justification |
|---|---|---|---|
| 1 | `PipelineStep` gagne `position` (unique par run) | DATABASE.md §3 et §4 | L'ordre des étapes détermine la dernière étape connue et le point de reprise ; un `SELECT` sans `ORDER BY` ne garantit aucun ordre |
| 2 | Nouveaux codes `DATABASE_ERROR`, `DATABASE_UNAVAILABLE`, `DATABASE_CONFLICT` | API.md §12 | Nécessaires pour typer les échecs de persistance sans exposer les codes Prisma |

Ajouts non contradictoires avec DATABASE.md, documentés dans sa nouvelle section 6 :
`onDelete: Cascade` sur les relations vers `StoreProject`, et les index correspondant aux
accès réellement effectués par les repositories.

## Conséquences

- Le module Orchestrator disposera d'un `IPipelineRepository` capable de sauvegarder
  l'agrégat complet, condition de la reprise sur erreur.
- Le module Frontend devra rattraper `InfrastructureError` dans ses Server Actions et la
  convertir en `ActionResult` — c'est le seul endroit où cette conversion doit avoir lieu.
- La migration initiale est versionnée mais **n'a jamais été appliquée** : aucune base
  PostgreSQL n'est disponible dans l'environnement de développement actuel.
