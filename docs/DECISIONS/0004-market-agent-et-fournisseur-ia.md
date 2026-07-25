# ADR 0004 — Market Agent et fournisseur IA

- Statut : Accepté
- Date : 2026-07-25
- Contexte : Module 3 (branche `feature/market-agent`) — premier agent du pipeline.
- Documents de référence : AI_AGENTS.md §2 et §9, CODING_STANDARDS.md §6 et §7,
  WORKFLOWS.md §4.1, ARCHITECTURE.md §10.

## Décisions

### 1. Le fournisseur Groq est livré avec le premier agent

Aucun module de la feuille de route ne porte `infrastructure/ai-provider` séparément, or
le Market Agent est inutilisable sans lui (AI_AGENTS.md §2 le liste comme sa seule
dépendance). Il est donc implémenté ici, une fois, et servira à tous les agents suivants.

### 2. La reprise appartient à l'Orchestrator, pas au fournisseur

`GroqAiProvider` applique le timeout et traduit les échecs, mais **ne rejoue jamais**.
WORKFLOWS.md §4.1 confie explicitement la reprise automatique avec backoff à
l'Orchestrator ; CODING_STANDARDS.md §6 en fixe les valeurs (3 tentatives, 1s/3s/9s).

Empiler un retry transport et un retry d'étape donnerait 9 appels réels pour 3 tentatives
affichées — coût facturé et latence hors de contrôle. Le point de reprise unique est
l'Orchestrator (module 8).

### 3. `fetch` injectable plutôt qu'un SDK

L'API Groq est compatible OpenAI Chat Completions : un appel `fetch` suffit. Injecter la
fonction `fetch` rend le client entièrement testable sans réseau et sans serveur simulé,
et évite une dépendance supplémentaire sur un SDK au cycle de publication propre.

### 4. Trois nouveaux codes d'erreur du fournisseur IA

AI_AGENTS.md ne prévoyait que `AI_PROVIDER_TIMEOUT` et `AI_PROVIDER_INVALID_RESPONSE`.
Trois situations réelles n'étaient pas couvertes, et les confondre aurait des conséquences
concrètes :

- `AI_PROVIDER_AUTH_ERROR` (401/403), **non rejouable** — c'est le point important : une
  clé révoquée traitée comme un timeout ferait consommer les 3 tentatives et le backoff à
  chaque étape du pipeline, avant d'afficher un message trompeur à l'utilisateur.
- `AI_PROVIDER_RATE_LIMIT` (429), rejouable.
- `AI_PROVIDER_UNAVAILABLE` (5xx, réseau), rejouable.

### 5. Validation de la sortie du modèle par schéma Zod

AI_AGENTS.md §9 (règle 4) impose de valider toute sortie d'agent avant persistance.
La validation vit dans l'agent (`market-agent.schema.ts`), pas dans le fournisseur : seul
l'agent connaît la forme attendue. Le fournisseur ne fait qu'appliquer le `parse` fourni.

Les seuils du schéma traduisent le critère d'acceptation n°2 du PRD (« une analyse
exploitable, pas un texte générique ») : au moins 3 mots-clés, au moins 1 concurrent, et
un angle différenciant d'au moins 20 caractères. Une fourchette de prix inversée est
rejetée dès le schéma, avant que le value object `PriceRange` du domaine ne la refuse.

### 6. `NICHE_TOO_VAGUE` est détecté avant l'appel au modèle

Une niche trop courte ou générique (« produits », « e-commerce ») ferait inventer au
modèle un marché plausible mais sans valeur. Le rejet en amont économise un appel facturé
et rend la main immédiatement à l'utilisateur — cohérent avec `retryable: false`, puisque
seule une reformulation peut débloquer la situation.

### 7. Nommage des fichiers d'agent

CODING_STANDARDS.md §3 impose le suffixe `*.agent.ts`, ARCHITECTURE.md §4 donne l'exemple
`market-agent.ts`. Le fichier est nommé `market-agent/market.agent.ts` : il satisfait le
suffixe imposé sans produire un redondant `market-agent.agent.ts`.

## Écarts par rapport aux documents (répercutés dans le même commit)

| # | Écart | Document mis à jour | Justification |
|---|---|---|---|
| 1 | Codes `AI_PROVIDER_RATE_LIMIT`, `AI_PROVIDER_UNAVAILABLE`, `AI_PROVIDER_AUTH_ERROR` | AI_AGENTS.md §2, API.md §12 | Cf. décision 4 — sans eux, une clé révoquée serait rejouée en boucle |
| 2 | Précision : le port IA ne rejoue pas, l'Orchestrator le fait | AI_AGENTS.md §9, règle 2 | Lève l'ambiguïté entre CODING_STANDARDS.md §6 et WORKFLOWS.md §4.1 |
| 3 | Variables `GROQ_MODEL` et `GROQ_BASE_URL` | `.env.example` | Changer de modèle ne doit pas demander de modifier le code (ARCHITECTURE.md §10) |

## Conséquences

- Les agents suivants (Brand, Store Builder, Product, SEO) réutilisent `GroqAiProvider`
  tel quel et n'ont qu'à fournir leurs prompts et leur schéma de validation.
- L'Orchestrator (module 8) devra implémenter le retry avec backoff 1s/3s/9s et **ne pas
  rejouer** les erreurs `retryable: false`, `AI_PROVIDER_AUTH_ERROR` en particulier.
- Aucun appel réel à Groq n'a été effectué : tous les tests injectent un `fetch` ou un
  `IAiProvider` simulé. La première exécution contre l'API réelle reste à faire.
