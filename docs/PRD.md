# PRD — BrandForge AI
**Product Requirements Document**
Version : 1.0 (Draft initial)
Statut : En rédaction — à valider par le Product Owner avant passage à l'Architecture
Auteur : CTO/Architecte (Claude) — Product Owner : [ton nom]

---

## 1. Vision du projet

BrandForge AI est un SaaS personnel dont l'objectif est de remplacer et surpasser OneClickBrand en automatisant, via un système d'agents IA orchestrés, la création complète d'une marque e-commerce — de l'idée jusqu'à la boutique Shopify publiée et prête à vendre.

L'utilisateur exprime une intention en langage naturel :

> "Je veux créer une marque de lunettes premium destinée à la France."

Le système orchestre alors automatiquement : analyse de niche, création de la marque, génération du Brand Book, construction de la boutique Shopify, import et optimisation des produits, génération de contenu SEO, création des visuels, et publication.

**Ce que BrandForge AI n'est PAS :**
- Ce n'est pas un simple générateur de thème Shopify.
- Ce n'est pas un outil d'import de produits comme un plugin classique.
- Ce n'est pas une interface no-code parmi d'autres.

**Ce que BrandForge AI EST :**
Un moteur d'agents IA spécialisés, capable de raisonner sur une niche, de prendre des décisions de branding, et de produire une boutique cohérente de bout en bout, avec un minimum d'intervention humaine.

---

## 2. Objectifs

### 2.1 Objectifs produit
- Réduire le temps de création d'une boutique e-commerce complète de plusieurs semaines à quelques heures.
- Garantir une cohérence de marque (nom, logo, palette, ton éditorial) sur tous les supports générés.
- Permettre de dupliquer le processus sur plusieurs niches sans repartir de zéro (le premier cas d'usage réel : lunettes de soleil).
- Construire un système modulaire où chaque agent peut évoluer indépendamment (changement de modèle IA, changement de plateforme e-commerce, etc.).

### 2.2 Objectifs techniques
- Architecture Clean/DDD/Vertical Slice, sans dette technique dès le départ.
- Agents IA testables individuellement, remplaçables sans casser le reste du système.
- Documentation vivante (`/docs`) servant de source de vérité tout au long du projet.

### 2.3 Objectifs business (pour toi, en tant que Product Owner)
- Lancer une première marque de lunettes de soleil comme preuve de concept réelle (pas seulement une démo).
- Pouvoir ensuite relancer le pipeline sur une deuxième niche en un minimum de configuration manuelle.

---

## 3. Personas

### Persona principal : "L'Entrepreneur Solo E-commerce" (toi-même, cas d'usage n°1)
- Gère seul ou en petite équipe des boutiques e-commerce de niche.
- Ne veut pas coder ni faire de design manuellement.
- Veut lancer une marque crédible (pas un dropshipping générique) rapidement.
- Compétence technique : faible à moyenne, à l'aise avec des outils SaaS.

### Persona secondaire (vision long terme, hors MVP) : "L'Agence / Consultant E-commerce"
- Lance des boutiques pour des clients.
- A besoin de gérer plusieurs projets en parallèle dans un même compte.
- Veut pouvoir exporter/justifier les choix de branding auprès du client.

*(Ce persona secondaire n'est pas prioritaire pour le MVP mais influence certains choix d'architecture — multi-projets dès le départ.)*

---

## 4. Cas d'utilisation

### Cas d'usage n°1 — Création d'une marque de A à Z (cas nominal)
1. L'utilisateur saisit une intention : niche + positionnement + marché cible.
2. Le Market Agent analyse la niche (demande, concurrence, mots-clés, prix moyens).
3. Le Brand Agent propose un nom de marque, une identité, un Brand Book.
4. L'utilisateur valide ou ajuste (nom, ton, palette).
5. Le Store Builder Agent génère la structure de la boutique Shopify (thème, collections, pages).
6. Le Product Agent importe des produits (via extension Chrome AliExpress ou upload manuel) et génère les fiches produits.
7. Le SEO Agent optimise les fiches et génère des articles de blog.
8. L'Image Agent génère ou retouche les visuels produits/marque.
9. Le Shopify Agent publie et synchronise la boutique.
10. L'utilisateur obtient une boutique fonctionnelle, prête à recevoir du trafic.

### Cas d'usage n°2 — Reprise d'un projet existant
L'utilisateur revient sur un projet en cours, modifie une étape (ex. régénérer le Brand Book), et le système ne recalcule que les étapes impactées en aval.

### Cas d'usage n°3 — Import de produits en masse
Via l'extension Chrome, l'utilisateur importe plusieurs produits AliExpress d'un coup ; le Product Agent et le Copywriter réécrivent titres/descriptions en masse.

### Cas d'usage n°4 — Génération de contenu marketing post-lancement
Une fois la boutique publiée, génération de campagnes Google Ads / Facebook Ads / séquences email à partir du Brand Book existant.

---

## 5. User Stories (MVP)

**En tant qu'utilisateur, je veux...**

- ...décrire ma niche et mon positionnement en langage naturel, afin de démarrer un projet sans remplir un formulaire complexe.
- ...voir un rapport d'analyse de niche (demande, concurrents, angle différenciant), afin de valider la pertinence du projet avant d'investir du temps.
- ...obtenir plusieurs propositions de nom de marque et d'identité visuelle, afin de choisir celle qui me convient.
- ...visualiser un Brand Book généré (logo, palette, typographie, ton éditorial), afin de garder une cohérence sur tous les supports.
- ...générer automatiquement une boutique Shopify avec thème, collections et pages de base, afin de ne pas configurer Shopify manuellement.
- ...importer des produits depuis AliExpress via une extension Chrome, afin de peupler rapidement ma boutique.
- ...obtenir des fiches produits réécrites et optimisées SEO, afin de ne pas publier du contenu dupliqué.
- ...suivre l'avancement du pipeline (quelle étape est en cours, terminée, en erreur), afin de garder le contrôle sur le processus.
- ...revenir en arrière sur une étape (ex. changer le nom de marque) sans tout recommencer.

---

## 6. Découpage des versions

### MVP (Version 1) — Objectif : prouver le pipeline complet sur UNE niche (lunettes de soleil)
- Market Agent (analyse de niche basique : mots-clés, concurrents, fourchette de prix)
- Brand Agent (nom, logo simple, palette, Brand Book minimal)
- Store Builder Agent (génération boutique Shopify avec thème + structure de base)
- Product Agent + extension Chrome AliExpress (import + réécriture)
- SEO Agent (fiches produits optimisées, pas encore de blog complet)
- Shopify Agent (publication + synchronisation)
- Dashboard basique (suivi du pipeline, statut de chaque agent)
- Authentification simple (mono-utilisateur ou multi-utilisateur basique)

**Hors périmètre MVP** : Image Agent avancé (génération IA de visuels), Google/Facebook Ads, Email Marketing, Analytics avancé, gestion multi-projets poussée.

### Version 2
- Image Agent (génération/retouche IA des visuels produits et marque)
- Blog Agent (articles SEO complets, calendrier éditorial)
- Marketing Agent — Google Ads & Facebook Ads (génération de campagnes)
- Amélioration du Market Agent (analyse concurrentielle approfondie, scraping avancé)
- Gestion multi-projets (plusieurs marques dans un même compte)

### Version 3
- Email Marketing (séquences automatisées liées au Brand Book)
- Dashboard Analytics avancé (ventes, trafic, performance des campagnes)
- Support d'autres plateformes e-commerce que Shopify (évolutivité de l'architecture)
- Possibilité d'onboarding pour d'autres utilisateurs / persona "Agence"

---

## 7. Contraintes

### Contraintes techniques
- Projet développé et maintenu par une seule personne (+ Claude Code comme "développeur") : la simplicité et la maintenabilité priment sur la sophistication.
- Dépendance à l'API Shopify (Admin + Storefront) : toute évolution de leurs limites/quotas impacte le Shopify Agent.
- Dépendance à l'API Groq pour l'IA : latence et coûts à surveiller, prévoir une abstraction permettant de changer de fournisseur IA sans réécrire les agents.
- Extension Chrome AliExpress : dépend de la structure du site AliExpress, fragile aux changements de leur DOM/HTML — prévoir un module isolé et facilement réparable.

### Contraintes produit
- Le MVP doit être validé sur un cas réel (niche lunettes de soleil) avant toute généralisation à d'autres niches.
- Aucune fonctionnalité de la liste "hors MVP" ne doit être développée avant que le pipeline MVP fonctionne de bout en bout.

### Contraintes de méthode (rappel du fonctionnement d'équipe)
- Claude Code n'exécute que des tâches spécifiées explicitement, jamais de décision produit autonome.
- Chaque fonctionnalité suit le cycle : spécification → conception technique → implémentation → tests → revue → fusion.
- Rien n'est développé avant validation explicite du document concerné (PRD, puis Architecture, puis Base de données, etc.).

---

## 8. Stack technique (rappel, validé précédemment)

| Domaine | Choix |
|---|---|
| Frontend | Next.js 15, TypeScript, TailwindCSS, shadcn/ui |
| Backend | Node.js, API Routes / Server Actions |
| Base de données | PostgreSQL + Prisma |
| IA | API Groq |
| Infrastructure | Docker |
| Déploiement | Vercel |
| E-commerce | Shopify Admin API + Storefront API |

---

## 9. Roadmap indicative

| Phase | Livrable | Contenu |
|---|---|---|
| 1 | PRD | Ce document — validation du périmètre produit |
| 2 | Architecture (ADR) | Modules, Bounded Contexts, conventions, diagrammes |
| 3 | Base de données | Modèle de données, schéma Prisma |
| 4 | Spécification des agents IA | Contrats d'entrée/sortie de chaque agent, orchestration |
| 5 | API | Endpoints internes, contrats Shopify |
| 6 | Développement MVP | Module par module, en suivant le cycle de développement défini |
| 7 | Validation MVP | Test réel sur la niche lunettes de soleil |
| 8 | Version 2 | Image Agent, Blog Agent, Ads |
| 9 | Version 3 | Email Marketing, Analytics, multi-plateforme |

---

## 10. Critères d'acceptation du MVP

Le MVP sera considéré comme validé si et seulement si :

1. Un utilisateur peut décrire une intention de marque en langage naturel et déclencher le pipeline.
2. Le Market Agent produit une analyse de niche exploitable (pas un texte générique).
3. Le Brand Agent produit un nom + une identité visuelle cohérente (logo, palette).
4. Une boutique Shopify est effectivement créée/configurée automatiquement (thème + structure).
5. Au moins un produit peut être importé via l'extension Chrome AliExpress et republié avec une fiche réécrite et optimisée SEO.
6. La boutique publiée est accessible et fonctionnelle (pas seulement en preview).
   *Réserve technique* : Shopify n'expose aucune API permettant de lever la protection par
   mot de passe d'une boutique. Cette action reste **manuelle** dans l'administration et
   constitue donc un point de validation utilisateur supplémentaire. De même, l'application
   de la palette et de la typographie aux réglages du thème n'est pas automatisée à ce
   stade (cf. `/docs/DECISIONS/0006`).
7. L'utilisateur peut suivre visuellement l'état du pipeline (étape en cours/terminée/en erreur).
8. Le tout fonctionne sur le cas réel "lunettes de soleil" sans intervention manuelle en dehors des points de validation prévus (choix du nom, choix des produits à importer).

---

## 11. Prochaines étapes

Une fois ce PRD relu et validé par le Product Owner :
1. Verrouillage de la version 1.0 du PRD (archivage dans `/docs/PRD.md` + entrée dans `/docs/DECISIONS/`).
2. Passage à la rédaction du document **Architecture (ARCHITECTURE.md)** — arborescence, Bounded Contexts, Design Patterns, diagrammes Mermaid.
3. Aucun code ne sera écrit avant validation explicite de ce PRD et de l'Architecture qui en découlera.
