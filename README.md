# BeYours

Tout ce qui compose l'offre restauration **BeYours** : le site qui la vend, le
moteur qui la fait tourner, et le gabarit qui la livre chez chaque client.

Monorepo pnpm + Turborepo. Next.js 16 · React 19 · Convex · TypeScript strict.

**En ligne : https://beyours.fr**

![Catalogue de démos](docs/captures/demos-catalogue.png)

> **BeYours est le produit vendu aux restaurateurs. BeInDigital est l'agence.**
> Deux marques, deux activités. La règle et ses exceptions sont détaillées dans
> [Marque](#marque--ce-quon-renomme-et-ce-quon-ne-renomme-jamais) — à lire avant
> tout rechercher-remplacer.

---

## En une minute

| | |
| --- | --- |
| **Ce qu'on vend** | Un site de commande en ligne clé en main pour restaurateurs, sans commission sur les ventes directes |
| **Modèle** | Vente unique du site + 1 an de maintenance incluse, puis renouvellement annuel |
| **Multi-établissement** | 1 restaurateur = 1 à N adresses, illimité |
| **Comment on vend** | 50 démos navigables, panier réel, paiement Stripe en mode test — le prospect essaie avant d'acheter |
| **Comment on livre** | 1 dépôt et 1 backend Convex par client, clonés depuis `apps/boilerplate` |
| **Qui amène les clients** | Des apporteurs d'affaires indépendants, contrat signé en ligne, commission suivie |

---

## Les trois applications

C'est la chose à comprendre en premier : ce dépôt contient **trois applications
Next.js distinctes**, qui ne se déploient pas au même endroit et ne servent pas
le même public.

| App | Workspace | Public | Où ça tourne |
| --- | --- | --- | --- |
| [`apps/site`](apps/site) | `@beyours/site` | Prospects, apporteurs, équipe interne | Vercel → **beyours.fr** |
| [`apps/reference`](apps/reference) | `@beyours/reference` | Personne — c'est le banc d'essai du moteur | Local / preview |
| [`apps/boilerplate`](apps/boilerplate) | `@beyours/boilerplate` | Chaque restaurant client, après clonage | Vercel, 1 projet par client |

**`apps/site` — le site commercial.** Vitrine, catalogue de 52 templates,
tunnel de paiement Stripe, portail apporteurs d'affaires et console
d'exploitation interne, en 37 routes. Il ne dépend d'**aucun** paquet du
moteur : c'est un site, pas une instance du produit.

**`apps/reference` — l'application de référence.** 98 routes, l'assemblage
complet des dix paquets : storefront, dashboard admin, CMS, écran cuisine, jeux
QR. C'est là qu'une fonctionnalité du moteur se développe et se prouve avant
d'être publiée. Elle n'est vendue à personne.

**`apps/boilerplate` — le gabarit client.** Le miroir livrable de
`apps/reference`, plus ce que le moteur ne peut pas porter : la zone client, les
51 templates design, les scripts de création de site, les 50 démos
commerciales.

![Démo storefront](docs/captures/demo-storefront.png)

![Démo back-office](docs/captures/demo-admin.png)

---

## Un push ne construit que ce qu'il touche

C'est la raison d'être de la fusion. Chaque app porte son `vercel.json` :

```json
{ "ignoreCommand": "npx turbo-ignore @beyours/<app>" }
```

Turbo suit le **graphe de dépendances**, pas l'arborescence :

| Ce qu'on modifie | site | reference | boilerplate |
| --- | --- | --- | --- |
| `apps/site/**` | ✓ construit | ⏭ ignoré | ⏭ ignoré |
| `packages/ui/**` | ⏭ ignoré | ✓ construit | ✓ construit |
| `apps/boilerplate/**` | ⏭ ignoré | ⏭ ignoré | ✓ construit |

Le site est épargné par un changement dans `packages/ui` parce qu'il n'en
dépend pas — et ça, seul le graphe le sait. Une règle sur les chemins ne
l'aurait pas deviné.

⚠️ Un changement à la **racine** (`package.json`, `pnpm-lock.yaml`,
`turbo.json`) invalide tout le monde, par construction. C'est correct, mais ça
veut dire qu'un bump de dépendance reconstruit les trois apps.

---

## Structure

```
apps/
  site/          Site commercial — vitrine, catalogue, checkout, apporteurs, console
  reference/     Application de référence du moteur (98 routes)
  boilerplate/   Gabarit cloné pour chaque client + templates + démos
  docs/          31 pages de documentation produit (markdown, pas un workspace)

packages/        Les 10 paquets publiés — voir ci-dessous

.changeset/      Versioning des paquets (les apps en sont exclues)
_project/        Notes d'architecture et de design historiques
tasks/           Runbooks : go-live Uber Eats, rotation des secrets, audit prod
docs/captures/   Captures de ce README
```

---

## Les paquets du moteur

Dix paquets publiés sur **GitHub Packages** sous le scope `@be-in-digital/*`,
versionnés ensemble par changesets.

| Paquet | Contenu | Volume | Livré en |
| --- | --- | --- | --- |
| `admin` | Pages et composants d'administration | 170 fichiers · 31 500 l. | source TS |
| `convex-functions` | Fonctions backend Convex | 65 fichiers · 17 500 l. | source TS |
| `core` | Auth, i18n, AWS (S3/SES), env, Sentry | 41 fichiers · 8 100 l. | `dist/` (tsup) |
| `integrations` | Uber Eats, Deliveroo | 28 fichiers · 6 200 l. | `dist/` |
| `convex-schema` | Tables et validateurs Convex | 32 fichiers · 5 800 l. | source TS |
| `ui` | Composants React, design system | 57 fichiers · 4 300 l. | `dist/` |
| `marketing` | Email, campagnes, segments | 13 fichiers · 3 400 l. | `dist/` |
| `restaurant` | Logique métier, hooks, stores Zustand | 25 fichiers · 3 100 l. | `dist/` |
| `cms` | Registre de blocs, validation, sanitisation | 14 fichiers · 2 400 l. | `dist/` |
| `mcp-server` | Serveur MCP exposant le registre des paquets | 3 fichiers · 1 600 l. | `dist/` |

**Trois paquets sont livrés en TypeScript brut** — `admin`, `convex-functions`
et `convex-schema` pointent leur `main` sur `./src/index.ts`. C'est délibéré :
le schéma et les fonctions doivent être lus par le compilateur Convex du client,
et `admin` embarque des Server Components que transpiler casserait. Conséquence
pratique : **ces trois-là n'ont pas de tâche `build`**, une erreur de type chez
eux ne se révèle qu'au `type-check` ou au build de l'app qui les consomme.

### Le scope reste `@be-in-digital`

Les dépôts ont été renommés en `beyours-*`, pas le scope npm. Le changer
casserait chaque site client à la prochaine installation. Il reste donc
`@be-in-digital/*` — c'est un identifiant de registre, pas un nom de marque.

---

## Comment un site client prend vie

```
packages/*                      publiés en @be-in-digital/* (changesets)
    │
    ├──► apps/reference         le banc d'essai — on y prouve la feature
    │
    └──► apps/boilerplate       le gabarit livrable
              │  clone git (remote `template`)
              ▼
         dépôt du client        1 repo + 1 backend Convex + 1 projet Vercel
```

Création d'un site, depuis un terminal :

```bash
beyours create client-luigi --name "Chez Luigi" --template pizzeria --repo be-in-digital/client-luigi
```

La commande enchaîne clone → remote `template` → création du dépôt privé →
`pnpm install` → configuration (`site.config.ts`, secrets, `.env.local`) →
commit initial → push. Détail dans
[`apps/boilerplate/README.md`](apps/boilerplate/README.md).

### Deux canaux de mise à jour, jamais un seul

| Canal | Commande | Ce qui remonte |
| --- | --- | --- |
| **npm** | `pnpm update:engine` | La logique métier — les paquets `@be-in-digital/*`, en semver |
| **git** | `pnpm update:template` | Le shell applicatif — routes, wrappers Convex, scripts, configs |

Ils sont séparés parce qu'ils ont des rythmes différents : un correctif de
logique se diffuse par un bump de version, une nouvelle route exige un merge
git. Un site peut prendre l'un sans l'autre.

---

## Le modèle de maintenance

Le site est vendu une fois, avec **un an de maintenance incluse**, puis
renouvelé annuellement. Tant que le contrat couvre, le client reçoit toutes les
mises à jour. À l'expiration, son déploiement **reste figé sur la dernière
version publiée avant `coveredUntil`**, et il peut demander la migration
complète du site vers l'hébergeur ou l'équipe de son choix.

La logique est dans
[`packages/convex-functions/src/maintenance.ts`](packages/convex-functions/src/maintenance.ts) :

```ts
export function isReleaseCovered(contract, releasedAt) {
  return releasedAt <= contract.coveredUntil
}
```

⚠️ **Le gel n'est pas appliqué côté client.** `update-template.mjs` fait un
`git fetch template` nu : rien ne vérifie l'état du contrat avant de tirer les
commits. Un site expiré qui lance la commande reçoit tout. Le modèle économique
est écrit, sa garde ne l'est pas.

---

## Marque : ce qu'on renomme, et ce qu'on ne renomme jamais

Trois niveaux, à ne pas confondre :

| | |
| --- | --- |
| **BeYours** | Le produit restauration. Interfaces, emails, démos, documentation |
| **Be in Digital** | La marque commerciale de l'agence, exploitée par la société |
| **TUUM AGENCY SAS** | L'entité juridique — SIREN 930 817 697, RCS Paris |

**Ne jamais faire de rechercher-remplacer global.** Ces occurrences de
`beindigital` doivent survivre :

| Identifiant | Pourquoi il ne bouge pas |
| --- | --- |
| `@be-in-digital/*` | Scope du registre npm — le changer casse chaque site client |
| `.beindigital-site.json` | Sentinelle d'init présente dans tous les sites déployés |
| `beindigital-addresses` · `beindigital-favorites` | Clés `localStorage` — les renommer vide les adresses et les favoris des clients finaux |
| `beindigital-email-tracking` | Configuration Set qui existe côté AWS SES |
| `integrator_brand_id: "beindigital"` | Identifiant déclaré chez Uber Eats |
| `utm_source=beindigital` | L'attribution Unsplash doit correspondre au nom de l'app enregistrée chez eux |
| `com.beindigital.<slug>` | Bundle identifier — figé une fois l'app publiée sur les stores |
| `beindigital.fr` | Le domaine appartient bien à l'agence |

Et **`apps/site` est hors périmètre** : « Be in Digital » y est la marque sur
laquelle des contrats d'apporteur sont **déjà signés**, dont la clause 5.2
interdit précisément d'en altérer le nom. Tout part de
[`apps/site/lib/legal/company.ts`](apps/site/lib/legal/company.ts) — ne jamais
dupliquer ces informations ailleurs.

---

## Démarrer

```bash
pnpm install
```

Pré-requis : **Node 20+**, **pnpm 10.4.1**.

Aucun `NODE_AUTH_TOKEN` n'est nécessaire ici : dans le monorepo, les apps
consomment les paquets en `workspace:^`, pas depuis le registre. Le token n'est
requis que dans un **dépôt client**, qui installe depuis GitHub Packages.

```bash
pnpm dev:site          # site commercial
pnpm dev:reference     # application de référence
pnpm dev:boilerplate   # gabarit client
```

Les apps à backend Convex ont besoin d'un second terminal (`convex dev` depuis
le dossier de l'app). Chaque app documente son propre démarrage :

- [`apps/site/README.md`](apps/site/README.md)
- [`apps/boilerplate/README.md`](apps/boilerplate/README.md)
- [`apps/docs/`](apps/docs) — 31 pages : guides produit, référence API, déploiement

---

## Commandes

| Commande | Effet |
| --- | --- |
| `pnpm build` | Construit tout, dans l'ordre du graphe |
| `pnpm lint` · `pnpm type-check` | Qualité, sur les 13 workspaces |
| `pnpm test` | Vitest — 56 fichiers : 48 dans les paquets, 6 sur le site, 2 sur l'app de référence |
| `pnpm test:e2e` | Playwright — 43 specs sur l'app de référence, 43 sur le gabarit, 1 sur le site |
| `pnpm changeset` | Déclare une évolution de paquet (obligatoire pour publier) |
| `pnpm format` | Prettier |

Turbo met en cache : une seconde exécution sans changement ne relance rien.

---

## Publier les paquets

1. `pnpm changeset` — décrire l'évolution, choisir patch / minor / major
2. Committer le fichier généré dans `.changeset/`
3. Merger sur `main`

Le workflow `release.yml` ouvre alors une PR « chore(release): version
packages ». **La merger publie** sur GitHub Packages et met à jour les
`CHANGELOG.md`.

Les trois apps sont exclues du versioning (`.changeset/config.json`) : elles ne
sont pas publiées, elles se déploient.

---

## CI

| Workflow | Ce qu'il fait |
| --- | --- |
| `ci.yml` | lint · type-check · test · build, sur PR et push `main` |
| `e2e.yml` | Playwright sur l'app de référence, si les secrets `E2E_*` existent |
| `release.yml` | changesets — PR de version, puis publication |
| `security.yml` | gitleaks sur l'historique complet + `pnpm audit`, plus un passage quotidien |

⚠️ **Les minutes GitHub Actions du plan Free (2 000/mois sur dépôts privés) sont
épuisées** — le quota a été dépassé en juillet et en août 2026. Les jobs
échouent en quelques secondes sans exécuter la moindre étape : une croix rouge
sur une PR ne dit donc rien du code. Vérifier en local (`pnpm lint`,
`pnpm type-check`, `pnpm test`, `pnpm build`) jusqu'à la remise à zéro mensuelle
ou au relèvement du plafond de dépenses.

---

## Déploiement

| Projet Vercel | Team | Source |
| --- | --- | --- |
| `beindigital-restaurant` | `be-in-digital` | `apps/site` → **beyours.fr** |
| 1 projet par client | `be-in-digital` | Le dépôt cloné du client |

Convex se pousse séparément, depuis le dossier de l'app : `npx convex deploy`.
Chaque client a **son propre déploiement Convex** — l'isolation des données est
structurelle, pas applicative.

---

## Points de vigilance

**Le storefront de démo du site est une réimplémentation.**
`apps/site/lib/template-storefront.ts` ne partage aucun code avec
`apps/boilerplate`. Un prospect essaie donc autre chose que ce qu'il achète, et
les deux dérivent à chaque évolution. C'est le chantier d'architecture principal
ouvert sur ce dépôt.

**Le catalogue existe en trois exemplaires.** 52 entrées dans
`apps/site/lib/templates-data.ts`, 51 dossiers dans
`apps/boilerplate/templates/`, 50 démos dans `apps/boilerplate/demos/`. Trois
listes qu'aucun test ne réconcilie.

**Le boilerplate a un miroir de distribution.** Les sites clients se créent
depuis `be-in-digital/beyours-boilerplate`, pas depuis ce dépôt. Les dépendances
y sont en versions publiées (`^2.0.2`), ici en `workspace:^`. Tant qu'un job ne
pousse pas `apps/boilerplate` vers ce miroir en réécrivant les versions, **les
deux divergent** — et `sync-engine.yml` / `sync-from-engine.mjs` restent en
place, bien que la fusion les ait rendus sans objet.

**11 tests d'intégration Deliveroo ne s'exécutent jamais.** Les fichiers
`apps/reference/e2e/deliveroo/**/*.test.ts` tombent dans un angle mort : Vitest
exclut `**/e2e/**`, et les projets Playwright ne matchent que `*.spec.ts`.
Aucun des deux runners ne les voit. Vérifié : `playwright test --list` ne
retourne aucun d'entre eux. Les renommer en `.spec.ts` et les câbler à un
projet, ou les déplacer hors de `e2e/`.

**32 routes de `apps/reference/app/(admin)/` sont des redirections** vers
`/dashboard/*`. Ce sont des alias historiques, pas des doublons : ne pas
chercher à les fusionner.

---

## Historique

Ce dépôt s'appelait `beindigital`, puis `beyours-engine`. Il a hébergé jusqu'en
août 2026 le moteur **et** les deux sites web de l'entreprise.

Le découpage d'août 2026 a d'abord sorti les quatre projets dans quatre dépôts,
puis regroupé les trois qui relèvent de BeYours — le site, le moteur, le gabarit
— dans celui-ci, avec leur historique complet (`git subtree`). Le site de
l'agence est parti de son côté, dans
[`beindigital.fr`](https://github.com/be-in-digital/beindigital.fr) : autre
marque, autre activité, aucune dépendance de code.

⚠️ **Trois noms de dépôts ont été libérés par ces renommages :** `beindigital`,
`beindigital-engine`, `beindigital-boilerplate`. Des scripts en production
dépendent des redirections GitHub associées. **N'en recréez aucun** — créer un
dépôt portant l'un de ces noms détruit silencieusement la redirection.

---

## Pour reprendre le projet

Dans l'ordre, en arrivant sans contexte :

1. Ce README, puis [`apps/docs/getting-started/introduction.md`](apps/docs/getting-started/introduction.md).
2. La section [Marque](#marque--ce-quon-renomme-et-ce-quon-ne-renomme-jamais), avant de toucher à quoi que ce soit de nommé.
3. `pnpm install && pnpm dev:reference` — l'app de référence est le chemin le plus court pour voir le produit entier tourner.
4. `packages/convex-schema/src/` pour le modèle de données, `packages/convex-functions/src/` pour ce qui agit dessus.
5. Ouvrir `apps/boilerplate/demos/index.html` dans un navigateur : c'est ce qu'un prospect voit, et c'est navigable hors ligne.
