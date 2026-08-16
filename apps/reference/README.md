# `apps/reference` — l'application de référence du moteur

L'assemblage complet des dix paquets `@be-in-digital/*` en une application qui
tourne : storefront, dashboard admin, CMS, écran cuisine, jeux QR, i18n.

**Elle n'est vendue à personne et ne se déploie nulle part en production.**
C'est le banc d'essai : une fonctionnalité du moteur se développe ici, s'y
prouve, puis part en paquet publié.

---

## Pourquoi elle existe

Les paquets ne sont pas exécutables seuls. `@be-in-digital/admin` fournit des
pages, `convex-schema` des tables, `ui` des composants — mais rien de tout ça ne
se lance. Il faut une app qui les câble ensemble pour voir ce qu'on écrit.

Cette app joue trois rôles :

| Rôle | Concrètement |
| --- | --- |
| **Banc d'essai** | `pnpm dev:reference` fait tourner le produit entier depuis les sources du moteur, sans publier |
| **Filet de type** | Trois paquets (`admin`, `convex-functions`, `convex-schema`) sont livrés en TypeScript brut et n'ont pas de tâche `build` — leurs erreurs de type n'apparaissent qu'ici |
| **Base des e2e** | Les 43 specs Playwright du dépôt visent cette app |

Elle ne se confond pas avec `apps/boilerplate`, qui est le **livrable** : le
gabarit y ajoute la zone client, les templates design, les scripts de création
de site et les démos commerciales.

---

## Volumes

| | |
| --- | --- |
| **Routes** | 98 pages, 6 routes API |
| **Paquets moteur consommés** | 9 sur 10 (tous sauf `mcp-server`) |
| **Tests** | 2 fichiers Vitest, 43 specs Playwright — plus 11 fichiers orphelins, voir ci-dessous |

Les surfaces, par route group :

| Route group | Contenu |
| --- | --- |
| `(storefront)` | Menu, produit, panier, checkout, compte, commandes, blog |
| `(admin)` | Dashboard, produits, catégories, commandes, cuisine, stocks, clients, équipe, email, jeux, langues, CMS, abonnement |
| `(auth)` | Connexion, inscription, mot de passe oublié |
| `game/[qrCodeId]` | Parcours de gamification — QR de table → actions sociales → jeu → lot |
| `display/[storeId]` | Écran cuisine (KDS) |
| `preview/` | Prévisualisation des pages et articles CMS |

⚠️ **32 pages de `(admin)/` sont des redirections** vers `/dashboard/*` :

```tsx
export default function Page() {
  redirect("/dashboard/products")
}
```

Ce sont des alias historiques, conservés pour ne pas casser de liens. Ne pas
chercher à les fusionner avec les pages qu'elles visent.

---

## 11 tests d'intégration ne s'exécutent jamais

Les scénarios Deliveroo de `e2e/deliveroo/**/*.test.ts` tombent dans un angle
mort entre les deux runners :

| Runner | Pourquoi il les ignore |
| --- | --- |
| **Vitest** | `vitest.config.ts` exclut `**/e2e/**` |
| **Playwright** | Les projets de `playwright.config.ts` ne matchent que `*.spec.ts` |

Vérifiable : `npx playwright test --list` n'en retourne aucun, et `pnpm test`
n'exécute que les 2 fichiers de `lib/`.

Onze scénarios — commandes refaites, programmées, annulées, remboursées, titres
restaurant, articles manquants — écrits puis jamais lancés. Les renommer en
`.spec.ts` et les rattacher à un projet Playwright, ou les sortir de `e2e/`
pour que Vitest les voie.

---

## Démarrer

Depuis la racine du monorepo :

```bash
pnpm install
pnpm dev:reference
```

Le backend Convex a besoin d'un second terminal, depuis ce dossier :

```bash
npx convex dev
```

Copier `.env.example` vers `.env.local` d'abord. Un déploiement Convex de
développement suffit — cette app n'a pas d'instance de production.

---

## Commandes

Depuis ce dossier, ou via `pnpm --filter @beyours/reference <cmd>` :

| Commande | Effet |
| --- | --- |
| `pnpm dev` · `pnpm build` · `pnpm start` | Next.js |
| `pnpm lint` · `pnpm type-check` | Qualité |
| `pnpm test` · `pnpm test:coverage` | Vitest |
| `pnpm test:e2e` · `pnpm test:e2e:ui` | Playwright |

---

## Le rapport aux paquets

Les dépendances moteur sont déclarées en `workspace:^` : cette app construit
toujours contre le **moteur courant du dépôt**, jamais contre une version
publiée. C'est voulu — c'est ce qui permet de voir immédiatement l'effet d'un
changement dans `packages/`.

Le corollaire : ce qui passe ici ne prouve pas que la version publiée passera.
Le boilerplate, lui, consomme les paquets **publiés** dans son dépôt miroir.
C'est là que se voit une erreur d'`exports` ou de `files` mal déclarés.

---

## Documentation liée

- [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — le design system de l'app
- [`MISE_EN_PROD.md`](./MISE_EN_PROD.md) — checklist héritée, à lire avec du recul
- [`../docs/`](../docs) — 31 pages de documentation produit : guides, référence
  API Convex, déploiement
- [README de la racine](../../README.md) — le monorepo et ses trois apps
