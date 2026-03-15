# Variables d'environnement - Architecture

## Vue d'ensemble

Les variables d'environnement de BeInDigital Engine sont separees en **deux niveaux** distincts, refletant le modele business ou BeInDigital vend un theme Next.js a chaque restaurant.

```
+-------------------------------------------------------------------+
|                    BeInDigital (Plateforme)                        |
|                                                                   |
|   AWS Account    OpenAI     Uber Eats Partner   Deliveroo Partner  |
|   (S3, SES)     (GPT-3.5)   (App Credentials)  (App Credentials)  |
|                                                                   |
|   10 variables "package" partagees par tous les sites              |
+-------------------------------------------------------------------+
        |                    |                    |
        v                    v                    v
+------------------+ +------------------+ +------------------+
|  Restaurant A    | |  Restaurant B    | |  Restaurant C    |
|                  | |                  | |                  |
|  Convex instance | |  Convex instance | |  Convex instance |
|  Auth secret     | |  Auth secret     | |  Auth secret     |
|  S3 bucket       | |  S3 bucket       | |  S3 bucket       |
|  SES domaine     | |  SES domaine     | |  SES domaine     |
|  Stripe account  | |  PayPal account  | |  SumUp account   |
|  Sentry DSN      | |  Sentry DSN      | |  Sentry DSN      |
|  Google Maps key | |  Google Maps key | |  Google Maps key  |
|                  | |                  | |                  |
|  25+ variables   | |  25+ variables   | |  25+ variables   |
|  "site" propres  | |  "site" propres  | |  "site" propres  |
+------------------+ +------------------+ +------------------+
```

---

## Separation Package vs Site

### Variables Package (infra BeInDigital - 10 vars)

Ce sont les credentials gerees par BeInDigital, partagees entre tous les restaurants deployes.

| Variable | Requis | Description |
|---|---|---|
| `AWS_REGION` | oui | Region AWS du compte BeInDigital |
| `AWS_ACCESS_KEY_ID` | oui | Cle d'acces IAM BeInDigital |
| `AWS_SECRET_ACCESS_KEY` | oui | Secret IAM BeInDigital |
| `OPENAI_API_KEY` | oui | Cle API OpenAI (prefixe `sk-`) pour traductions GPT |
| `UBER_EATS_CLIENT_ID` | non | Client ID de l'app partenaire Uber Eats |
| `UBER_EATS_CLIENT_SECRET` | non | Client secret Uber Eats |
| `UBER_EATS_WEBHOOK_SECRET` | non | Secret de verification des webhooks Uber Eats |
| `DELIVEROO_CLIENT_ID` | non | Client ID de l'app partenaire Deliveroo |
| `DELIVEROO_CLIENT_SECRET` | non | Client secret Deliveroo |
| `DELIVEROO_WEBHOOK_SECRET` | non | Secret de verification des webhooks Deliveroo |

> **Pourquoi Uber Eats / Deliveroo sont "package" ?**
> BeInDigital est **app partenaire** de ces plateformes. Les credentials API sont celles de BeInDigital, pas du restaurant. Le restaurant fournit uniquement ses identifiants propres (brandId, siteId) pour lier son compte.

### Variables Site (par restaurant - 25+ vars)

Chaque restaurant deploye fournit ses propres valeurs.

| Categorie | Variable | Requis | Description |
|---|---|---|---|
| **Convex** | `CONVEX_DEPLOYMENT` | non | ID du deploiement Convex |
| | `NEXT_PUBLIC_CONVEX_URL` | oui | URL publique de l'instance Convex |
| | `CONVEX_SITE_URL` | non | URL du site Convex (pour webhooks) |
| **Auth** | `BETTER_AUTH_SECRET` | oui | Secret unique pour l'authentification |
| | `BETTER_AUTH_URL` | non | URL du service d'auth |
| | `SITE_URL` | non | URL du site (origines de confiance) |
| | `ENCRYPTION_KEY` | non | Cle AES-256-GCM (64 chars hex) |
| **App** | `NEXT_PUBLIC_APP_URL` | non | URL publique de l'app |
| | `ADMIN_URL` | non | URL de redirection admin |
| **AWS S3** | `AWS_S3_BUCKET_NAME` | non | Bucket S3 propre au restaurant |
| **AWS SES** | `AWS_SES_FROM_EMAIL` | non | Email expediteur du restaurant |
| | `AWS_SES_FROM_NAME` | non | Nom d'expediteur |
| | `AWS_SES_REPLY_TO_EMAIL` | non | Adresse de reponse |
| | `AWS_SES_CONFIGURATION_SET` | non | Configuration Set SES |
| **Monitoring** | `NEXT_PUBLIC_SENTRY_DSN` | non | DSN Sentry propre au client |
| **Maps** | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | non | Cle Google Maps propre au client |
| **Stripe** | `STRIPE_SECRET_KEY` | non | Cle secrete (prefixe `sk_`) |
| | `STRIPE_PUBLISHABLE_KEY` | non | Cle publique (prefixe `pk_`) |
| | `STRIPE_WEBHOOK_SECRET` | non | Secret webhook (prefixe `whsec_`) |
| **PayPal** | `PAYPAL_CLIENT_ID` | non | Client ID PayPal du restaurant |
| | `PAYPAL_CLIENT_SECRET` | non | Client secret PayPal |
| **SumUp** | `SUMUP_CLIENT_ID` | non | Client ID SumUp du restaurant |
| | `SUMUP_CLIENT_SECRET` | non | Client secret SumUp |
| **Uber Eats** | `UBER_EATS_SANDBOX_MODE` | non | Mode sandbox (`true`/`false`) |
| **Deliveroo** | `DELIVEROO_BRAND_ID` | non | ID de la marque Deliveroo du restaurant |
| | `DELIVEROO_SITE_ID` | non | ID du site Deliveroo du restaurant |
| | `DELIVEROO_IS_SANDBOX` | non | Mode sandbox (`true`/`false`) |

---

## Architecture technique

### Schema de validation (Zod)

Les schemas sont definis dans `packages/core/src/env/schemas.ts` et exportes via :
- `@beindigital-engine/core` (export principal)
- `@beindigital-engine/core/env` (sub-path export, sans dependances Node.js)

```
packages/core/src/env/
  schemas.ts    -- packageEnvSchema + siteEnvSchema (Zod)
  getters.ts    -- getPackageEnv() + getSiteEnv() (lazy, memoized)
  index.ts      -- barrel file
  __tests__/
    schemas.test.ts
    getters.test.ts
```

### Getters

```typescript
import { getPackageEnv, getSiteEnv } from '@beindigital-engine/core/env'

// Variables plateforme BeInDigital
const pkg = getPackageEnv()
pkg.AWS_REGION           // string (garanti)
pkg.UBER_EATS_CLIENT_ID // string | undefined (optionnel)

// Variables propres au restaurant
const site = getSiteEnv()
site.BETTER_AUTH_SECRET  // string (garanti)
site.STRIPE_SECRET_KEY   // string | undefined (optionnel)
```

**Comportement :**
- Premier appel : valide `process.env` via le schema Zod
- Appels suivants : retourne le resultat en cache (memoized)
- Throw `ZodError` si une variable requise est manquante ou invalide
- `_resetEnvCache()` disponible pour les tests

### Flux de validation

```
                          Demarrage
                             |
                             v
                   +-------------------+
                   | instrumentation.ts |  <-- Next.js startup hook
                   |                   |
                   | getPackageEnv()   |  -- Valide les 10 vars package
                   | getSiteEnv()     |  -- Valide les 25+ vars site
                   +-------------------+
                             |
                    OK?      |      KO?
                   +----+    |    +----+
                   |    v    |    v    |
                   | Continue|  dev: warn |
                   |  app   |  prod: crash|
                   +--------+-----------+

        Runtime (Convex actions, API routes)
                             |
                             v
                   +-------------------+
                   | getPackageEnv()   |  -- Cache hit (deja valide)
                   | getSiteEnv()     |  -- Cache hit (deja valide)
                   +-------------------+
                             |
                             v
                   Acces type-safe aux variables
```

---

## Import selon le contexte Convex

Le bundler Convex distingue deux runtimes :

| Runtime | Fichiers concernes | Pattern d'import |
|---|---|---|
| **"use node"** (Node.js) | `oauthConnect.ts`, `teamMembersEmail.ts`, `deliverooWebhook.ts`, `validateIntegration.ts`, imports, menu syncs, orders | `import { getPackageEnv, getSiteEnv } from "@beindigital-engine/core/env"` |
| **V8 isolate** (httpAction, queries, mutations) | `uberEatsWebhook.ts`, `deliverooWebhookHandler.ts`, `oauthCallbackHandlers.ts`, `kitchenTickets.ts` | `const { getPackageEnv } = await import("@beindigital-engine/core/env")` |
| **V8 isolate** (config module) | `auth.ts` | `process.env.SITE_URL` (garde le pattern direct, pas de Zod) |

> **Pourquoi `auth.ts` ne migre pas ?**
> Ce fichier configure Better Auth au niveau module (pas dans un handler async). Il s'execute tres tot dans le cycle de vie Convex et l'import du package core pourrait poser des problemes de bundling dans le V8 isolate.

### Variables `NEXT_PUBLIC_*` (client-side)

Les variables prefixees `NEXT_PUBLIC_` sont **inlinées au build** par Next.js. Elles ne sont pas validables cote serveur au runtime.

Fichiers concernes (non migres, voulu) :
- `app/providers.tsx` : `process.env.NEXT_PUBLIC_CONVEX_URL`
- `lib/convex.ts` : `process.env.NEXT_PUBLIC_CONVEX_URL`
- `app/(test)/address-test/page.tsx` : `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

---

## Fichiers .env.example

Deux fichiers de reference pour le onboarding :

| Fichier | Contenu | Pour qui |
|---|---|---|
| `packages/core/.env.example` | 10 variables package | Equipe BeInDigital |
| `apps/restaurant-theme/.env.example` | 25+ vars site + rappel des vars package | Deploiement d'un restaurant |

> A chaque deploiement, le fichier `.env.local` de `apps/restaurant-theme/` contient **toutes** les variables (package + site) puisque le process Node.js a besoin des deux a runtime.

---

## Ajouter une nouvelle variable d'environnement

1. **Determiner le niveau** : package (infra BeInDigital) ou site (par restaurant)
2. **Ajouter au schema** dans `packages/core/src/env/schemas.ts`
   - Utiliser `.optional()` si la variable n'est pas requise pour tous les deploiements
   - Ajouter des validations Zod (`.url()`, `.email()`, `.startsWith()`, `.regex()`)
3. **Mettre a jour le `.env.example`** correspondant
4. **Rebuild le package** : `pnpm --filter @beindigital-engine/core build`
5. **Utiliser le getter** dans le code consommateur :
   ```typescript
   const pkg = getPackageEnv()  // ou getSiteEnv()
   const maVar = pkg.MA_NOUVELLE_VAR
   ```

---

## Generer une ENCRYPTION_KEY

```bash
openssl rand -hex 32
# Produit un string de 64 caracteres hexadecimaux (32 bytes)
# Exemple : a1b2c3d4e5f6...
```

---

## Diagramme complet des flux

```
+==========================================+
|          packages/core/src/env/          |
|                                          |
|  schemas.ts                              |
|  +------------------------------------+  |
|  | packageEnvSchema (Zod)             |  |
|  |   AWS_REGION          required     |  |
|  |   AWS_ACCESS_KEY_ID   required     |  |
|  |   AWS_SECRET_...      required     |  |
|  |   OPENAI_API_KEY      required     |  |
|  |   UBER_EATS_*         optional     |  |
|  |   DELIVEROO_*         optional     |  |
|  +------------------------------------+  |
|  +------------------------------------+  |
|  | siteEnvSchema (Zod)                |  |
|  |   NEXT_PUBLIC_CONVEX  required     |  |
|  |   BETTER_AUTH_SECRET  required     |  |
|  |   ENCRYPTION_KEY      optional     |  |
|  |   STRIPE_*            optional     |  |
|  |   PAYPAL_*            optional     |  |
|  |   SUMUP_*             optional     |  |
|  |   AWS_S3_BUCKET_NAME  optional     |  |
|  |   AWS_SES_FROM_*      optional     |  |
|  |   SENTRY_DSN          optional     |  |
|  |   GOOGLE_MAPS_KEY     optional     |  |
|  |   DELIVEROO_BRAND_ID  optional     |  |
|  |   UBER_EATS_SANDBOX   optional     |  |
|  +------------------------------------+  |
|                                          |
|  getters.ts                              |
|  +------------------------------------+  |
|  | getPackageEnv() -> PackageEnv      |  |
|  | getSiteEnv()    -> SiteEnv         |  |
|  |   (lazy parse + memoize)           |  |
|  +------------------------------------+  |
+==========================================+
          |                    |
    export "."          export "./env"
    (avec Node.js deps)  (Zod seulement)
          |                    |
          v                    v
+------------------+  +--------------------+
| Next.js App      |  | Convex Functions   |
|                  |  |                    |
| instrumentation  |  | "use node" files:  |
|   .ts            |  |   import from      |
|   (startup       |  |   core/env         |
|    validation)   |  |                    |
|                  |  | V8 httpAction:     |
| API routes:      |  |   await import()   |
|   import from    |  |   from core/env    |
|   core           |  |                    |
|                  |  | auth.ts:           |
| Client comps:    |  |   process.env      |
|   NEXT_PUBLIC_*  |  |   (direct, no Zod) |
|   (build inline) |  |                    |
+------------------+  +--------------------+
```

```
Flux de donnees: Ou chaque variable est lue
======================================================

process.env
    |
    +-- packageEnvSchema.parse() --> PackageEnv (cached)
    |       |
    |       +-- AWS_REGION ------------> SES adapter, teamMembersEmail
    |       +-- AWS_ACCESS_KEY_ID -----> SES adapter, teamMembersEmail
    |       +-- AWS_SECRET_ACCESS_KEY -> SES adapter, teamMembersEmail
    |       +-- OPENAI_API_KEY --------> GPT translation (via param)
    |       +-- UBER_EATS_CLIENT_ID ---> uberEatsWebhook, import, menuSync,
    |       |                            validate, kitchenTickets
    |       +-- UBER_EATS_CLIENT_SECRET> (memes fichiers)
    |       +-- UBER_EATS_WEBHOOK_SEC > uberEatsWebhook
    |       +-- DELIVEROO_CLIENT_ID ---> deliverooWebhookHandler, webhook,
    |       |                            import, menuSync, orders, validate,
    |       |                            kitchenTickets
    |       +-- DELIVEROO_CLIENT_SECRET> (memes fichiers)
    |       +-- DELIVEROO_WEBHOOK_SEC -> deliverooWebhookHandler
    |
    +-- siteEnvSchema.parse() --> SiteEnv (cached)
            |
            +-- NEXT_PUBLIC_CONVEX_URL -> providers.tsx (build inline)
            +-- CONVEX_SITE_URL -------> oauthConnect, oauthCallbackHandlers
            +-- BETTER_AUTH_SECRET ----> auth.ts (direct process.env)
            +-- SITE_URL --------------> auth.ts, teamMembersEmail
            +-- ENCRYPTION_KEY -------> oauthConnect (encrypt)
            +-- ADMIN_URL ------------> oauthCallbackHandlers
            +-- AWS_S3_BUCKET_NAME ----> S3 uploads (via config param)
            +-- AWS_SES_FROM_EMAIL ----> SES adapter, teamMembersEmail
            +-- STRIPE_SECRET_KEY -----> oauthConnect, oauthCallbackHandlers
            +-- STRIPE_PUBLISHABLE_KEY> client-side (build inline)
            +-- STRIPE_WEBHOOK_SECRET -> webhook handler (futur)
            +-- PAYPAL_* -------------> PayPal integration (futur)
            +-- SUMUP_* --------------> oauthConnect
            +-- UBER_EATS_SANDBOX ----> tous les fichiers Uber Eats
            +-- DELIVEROO_BRAND_ID ----> DB (storeIntegrations)
            +-- DELIVEROO_SITE_ID -----> DB (storeIntegrations)
            +-- DELIVEROO_IS_SANDBOX --> tous les fichiers Deliveroo
            +-- SENTRY_DSN -----------> sentry config (via param)
            +-- GOOGLE_MAPS_KEY ------> address autocomplete (build inline)
```
