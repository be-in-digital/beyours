# BeYours

Site commercial de l'offre restauration BeYours : vitrine, tunnel de paiement,
portail apporteurs d'affaires et console d'exploitation interne.

**Next.js 16** (App Router) + **Convex** (backend) + **Stripe** + **Yousign**.

> BeYours est un nom de produit. L'entité éditrice reste **BeInDigital SAS** :
> mentions légales, CGV et confidentialité sont à son nom.

---

## Surfaces

Quatre publics dans une seule application, séparés par route group :

| Route | Public | Contenu |
| --- | --- | --- |
| `(site)` | Prospects | Accueil, fonctionnalités, tarifs, templates, contact, checkout Stripe, pages légales |
| `(demo)` | Prospects | Démonstration du produit, `demo/[slug]` |
| `parrainage` | Apporteurs externes | Inscription, contrat signé électroniquement, tableau de bord, partage |
| `admin` | Équipe interne | 14 pages : clients, flotte, incidents, monitoring, factures, abonnements, ventes, prospects |

La console `admin` et le portail `parrainage` partagent le système d'identité :
un administrateur est un `affiliateUsers` avec `role: "admin"`, et la connexion
passe par `/parrainage/connexion`. C'est la raison pour laquelle les deux
restent dans la même application.

---

## Démarrer

```bash
pnpm install
cp .env.production.example .env.local   # puis remplir
pnpm dev
```

Le backend Convex a besoin d'un second terminal :

```bash
pnpm dev:backend
```

---

## Scripts

| Commande | Effet |
| --- | --- |
| `pnpm dev` | Serveur de développement |
| `pnpm dev:backend` | `convex dev` |
| `pnpm build` | Build de production |
| `pnpm lint` | ESLint |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm test` | Tests unitaires Vitest |
| `pnpm test:e2e` | Tests end-to-end Playwright |
| `pnpm seed` | Jeu de données de démonstration (console interne) |

---

## Backend

`convex/` — 19 tables, réparties en quatre domaines :

- **Apporteurs** : `affiliateUsers`, `referralCodes`, `referrals`, `affiliateSettings`
- **Contrats** : `contractVersions`, `contractSignatures` (signature électronique Yousign)
- **Commerce** : `orders`, `payments`, `subscriptions`, `invoices` (Stripe + Stripe Connect)
- **Exploitation** : `saDeployments`, `saStores`, `saSalesSnapshots`, `saIncidents`,
  `saIncidentUpdates`, `saMonitoringChecks`, `saActivity`

Un webhook HTTP (`POST /webhooks/stripe`), trois tâches planifiées, et un module
email multi-fournisseur (AWS SES par défaut, Resend en alternative).

Les 26 fonctions de la console d'exploitation passent toutes par `requireAdmin`.

---

## Mise en production

Voir [`MISE_EN_PROD.md`](./MISE_EN_PROD.md) pour la liste des variables
d'environnement, la configuration Stripe en mode Live et les vérifications
avant bascule. Le processus commercial est documenté dans
[`PROCESS_DE_VENTE.md`](./PROCESS_DE_VENTE.md).

---

## Historique

Ce dépôt vient du monorepo `be-in-digital/beindigital`, où l'application vivait
sous `apps/web-restaurant`. Elle en a été extraite en août 2026, avec son
historique, lors du découpage par métier.

Les trois paquets partagés du monorepo ont été dissous : `webgl-utils` est
devenu `lib/webgl/`, `config` a été inliné dans `tsconfig.json`, et `tokens`
a été retiré — il était déclaré en dépendance sans être importé nulle part.
