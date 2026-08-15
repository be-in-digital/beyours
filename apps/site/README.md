# `apps/site` — le site commercial BeYours

Vitrine, catalogue de 52 templates démontrables, tunnel de paiement Stripe,
portail apporteurs d'affaires et console d'exploitation interne.

Next.js 16 (App Router) + Convex + Stripe + AWS SES.

**En ligne : https://beyours.fr**

![Accueil](docs/captures/accueil.png)

> **BeYours est un nom de produit, pas une société.** L'entité juridique est
> **TUUM AGENCY SAS**, qui exploite la marque commerciale « Be in Digital ».
> Mentions légales, CGV, confidentialité et contrat d'apporteur restent à ce
> nom — voir [Marque et entité légale](#marque-et-entité-légale).

---

## En une minute

| | |
| --- | --- |
| **À quoi ça sert** | Vendre l'offre BeYours et piloter son exploitation |
| **Ce qui rentre** | Prospects sur la vitrine, apporteurs d'affaires sur le portail |
| **Ce qui sort** | Commandes Stripe, contrats signés, commissions, incidents suivis |
| **Ce qui la distingue** | Elle ne dépend d'**aucun** paquet `@be-in-digital/*` — c'est un site, pas une instance du produit |
| **Volumes** | 37 routes · 119 composants · 19 tables Convex · 3 crons · ~35 900 lignes |

---

## Quatre publics, une seule application

C'est la particularité de cette app, et ce qu'il faut comprendre en premier.

| Route | Public | Pages | Contenu |
| --- | --- | --- | --- |
| `(site)` | Prospects | 14 | Accueil, fonctionnalités, tarifs, catalogue, contact, checkout, pages légales |
| `(demo)` | Prospects | 1 | Démo interactive d'un template, `demo/[slug]` |
| `parrainage` | Apporteurs externes | 8 | Inscription, contrat signé, tableau de bord, partage |
| `admin` | Équipe interne | 14 | Clients, flotte, incidents, monitoring, factures, abonnements, ventes, prospects |

**Pourquoi la console interne n'est pas une app séparée.** Elle partage son
système d'identité avec le portail apporteurs : la connexion passe par
`/parrainage/connexion`, la table est `affiliateUsers`, et un administrateur
n'est rien d'autre qu'un apporteur avec `role: "admin"`. Les séparer imposerait
une session inter-domaines pour un bénéfice limité au rayon de panne.

Ses 26 fonctions Convex passent **toutes** par `requireAdmin`. Vérifié : 26
fonctions publiques, 26 appels.

---

## Le catalogue de templates

52 templates répartis par univers — pizzeria, fast-food, food-truck, poulet,
asiatique — chacun avec sa page de présentation et **sa démo interactive
complète**, où le visiteur parcourt la carte et remplit un panier.

![Catalogue](docs/captures/catalogue.png)

Un template est ici une entrée de données dans `lib/templates-data.ts` :

```ts
{ slug, name, tagline, accent, accentDark, shot }
```

`lib/template-storefront.ts` combine cette identité couleur avec l'ambiance de
l'univers — humeur de fond, police, arrondi, carte, informations
d'établissement — et applique le tout au runtime via des variables CSS scopées.

![Démo pizzeria](docs/captures/demo-pizzeria.png)

> ⚠️ **Ce storefront de démo est une réimplémentation.** Il ne partage aucun
> code avec `apps/boilerplate`, le produit réellement livré. Un prospect essaie
> donc autre chose que ce qu'il achète, et les deux dérivent à chaque évolution.
> C'est le chantier d'architecture principal ouvert sur le dépôt.
>
> À noter : `apps/boilerplate/demos/` contient déjà 50 démos navigables issues
> des vrais templates. La convergence passe probablement par là.

---

## Marque et entité légale

Trois niveaux à ne pas confondre :

| | |
| --- | --- |
| **BeYours** | Nom du produit. Titre du site, `og:site_name`, textes marketing |
| **Be in Digital** | Marque commerciale déclarée, exploitée par la société |
| **TUUM AGENCY SAS** | Entité juridique — SIREN 930 817 697, RCS Paris |

Tout est centralisé dans `lib/legal/company.ts`. **Ne jamais dupliquer ces
informations ailleurs**, et ne jamais faire de rechercher-remplacer global
`Be in Digital` → `BeYours` : le contrat d'apporteur
(`convex/contractContent.ts`) s'articule juridiquement autour de la marque
« Be in Digital », sa clause 5.2 interdit à l'apporteur de l'altérer, et **des
contrats sont déjà signés sur ce texte**.

C'est la raison pour laquelle le renommage BeYours d'août 2026 a traversé tout
le dépôt **sauf ce dossier**.

TVA : franchise en base, art. 293 B du CGI. Aucune TVA facturée, mention lue
depuis `VAT.mention`. Un plafond existe (~37 500 € de CA) — un seul gros ticket
peut le franchir et déclencher le passage au réel, rétroactif.

---

## Démarrer

Depuis la racine du monorepo :

```bash
pnpm install
pnpm dev:site
```

Le backend Convex a besoin d'un second terminal, depuis ce dossier :

```bash
npx convex dev
```

Copier `.env.production.example` vers `.env.local` et le remplir avant le
premier lancement.

---

## Backend Convex

`convex/` — 34 modules, 19 tables, 3 tâches planifiées, un webhook HTTP
(`POST /webhooks/stripe`). **Déploiement Convex propre**, distinct de celui de
l'agence et de ceux des clients. Quatre domaines :

**Apporteurs** — `affiliateUsers`, `referralCodes`, `referrals`,
`affiliateSettings`. Inscription, code de parrainage, suivi des commissions.

**Contrats** — `contractVersions`, `contractSignatures`. Signature réalisée
**dans l'app, sans prestataire externe**. Yousign a été retiré (abonnement
expiré) ; le schéma conserve des champs optionnels hérités, et
`MISE_EN_PROD.md` mentionne encore ses variables — obsolète.

**Commerce** — `orders`, `payments`, `subscriptions`, `invoices`. Stripe et
Stripe Connect.

**Exploitation** — `saDeployments`, `saStores`, `saSalesSnapshots`,
`saIncidents`, `saIncidentUpdates`, `saMonitoringChecks`, `saActivity`. C'est la
console interne : suivi de la flotte de sites clients, incidents, monitoring,
revenus.

Email multi-fournisseur dans `convex/email/` : AWS SES par défaut, Resend en
alternative, sélection par `EMAIL_PROVIDER`.

---

## Variables d'environnement

Gabarit complet dans `.env.production.example`.

**Application** — `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`,
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_TVA_ENABLED`

**Posées sur le déploiement Convex**, jamais dans le dépôt —
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_TAX_ENABLED`,
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`,
`AWS_SES_FROM_EMAIL`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `BID_NOTIFY_EMAIL`,
`CALENDLY_URL`

`.gitignore` couvre `.env*` sauf les gabarits. Sur une app qui manipule Stripe
en mode live, ne jamais relâcher cette règle.

---

## Commandes

Depuis ce dossier, ou via `pnpm --filter @beyours/site <cmd>` depuis la racine :

| Commande | Effet |
| --- | --- |
| `pnpm dev` | Serveur de développement |
| `pnpm build` | Build de production |
| `pnpm lint` · `pnpm type-check` | Qualité |
| `pnpm test` | 33 tests unitaires Vitest, 6 fichiers |
| `pnpm test:e2e` | Playwright |
| `pnpm seed` | Jeu de données de démonstration pour la console |

---

## Polices

Les 7 familles sont **auto-hébergées** dans `app/fonts/` via `next/font/local` —
9 fichiers, 212 Ko.

Quatre d'entre elles sont les polices d'accent des templates : Fraunces pour la
pizzeria, Anton pour le fast-food, Oswald pour le food truck, Zen Kaku pour
l'asiatique.

**Ne pas revenir à `next/font/google`.** Ce chargeur télécharge les woff2 depuis
`fonts.gstatic.com` au moment du build : sept familles, donc sept occasions
qu'une indisponibilité de Google fasse échouer un déploiement sans qu'aucune
ligne n'ait changé. C'est arrivé au site agence le 15/08/2026.

---

## Points de vigilance

**8 `setState` synchrones dans des effets**, dans `app/admin/`,
`components/admin/ui/` et les carrousels. Ils déclenchent des rendus en cascade.
Neutralisés par un override `eslint-plugin-react-hooks@7.0.1` remonté à la
racine du monorepo — la 7.1.1 les passe en erreur. Ce sont de vrais signaux, à
traiter.

**Le logo affiche encore « B·IN·DIGITAL »** alors que le site s'annonce BeYours.
`components/ui/logo.tsx` sert une image, pas une chaîne : c'est un asset à
refaire.

**`MISE_EN_PROD.md`** documente `YOUSIGN_API_KEY` et `YOUSIGN_WEBHOOK_SECRET`
pour un prestataire retiré.

---

## Déploiement

Projet Vercel `beindigital-restaurant`, team `be-in-digital`. Un push qui touche
cette app la construit seule : le `vercel.json` de ce dossier porte
`ignoreCommand: npx turbo-ignore @beyours/site`.

Convex se pousse séparément : `npx convex deploy` depuis ce dossier.

Détails et checklist dans [`MISE_EN_PROD.md`](./MISE_EN_PROD.md). Le processus
commercial est décrit dans [`PROCESS_DE_VENTE.md`](./PROCESS_DE_VENTE.md).

---

## Pour reprendre cette app

1. Le [README de la racine](../../README.md) pour le contexte monorepo, puis
   celui-ci, puis [`DESIGN.md`](./DESIGN.md) pour la direction artistique.
2. `lib/legal/company.ts` avant toute modification touchant à la marque, aux
   pages légales ou au contrat d'apporteur.
3. `lib/templates-data.ts` et `lib/template-storefront.ts` pour comprendre le
   système de templates — c'est le cœur commercial.
4. `convex/schema.ts` pour le modèle de données, 530 lignes commentées.
5. `pnpm dev:site` + `npx convex dev`, puis `pnpm seed` pour peupler la console.

---

## Historique

Cette app vivait sous `apps/web-restaurant` dans le monorepo
`be-in-digital/beindigital`. Elle en est sortie en août 2026 dans un dépôt
`beyours` autonome, puis y est revenue sous `apps/site` quand les trois projets
BeYours ont été regroupés. Son historique a suivi à chaque étape.

Les trois paquets partagés de l'ancien monorepo ont été dissous : `webgl-utils`
est devenu `lib/webgl/`, `config` a été inliné dans `tsconfig.json`, et `tokens`
a été retiré — il était déclaré en dépendance sans être importé nulle part.
