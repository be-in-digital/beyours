# @be-in-digital/core

> Authentication, RBAC, internationalization, AWS services and environment
> validation — the foundation layer.

The source is exactly five directories: `auth/`, `aws/`, `env/`, `i18n/`,
`sentry/`. Anything not in one of those is not in this package.

## Table of Contents

- [Installation](#installation)
- [Authentication](#authentication)
- [Internationalization (i18n)](#internationalization-i18n)
- [Payments](#payments)
- [AWS Services](#aws-services)
- [RBAC (Role-Based Access Control)](#rbac)

## Installation

```bash
pnpm add @be-in-digital/core
```

## Authentication

Built on **Better Auth** + Convex.

> [!IMPORTANT]
> The session layer here is a **placeholder**. `useAuth`, `AuthProvider` and
> `getServerSession` — and therefore `requireAuth`, `getServerUser` and every
> `require*Guard` built on top of them — throw `"Better Auth non installé"` when
> called. They fix the shape of the eventual API; they do not run. Apps wire
> Better Auth directly (`better-auth/react` + `@convex-dev/better-auth`) and
> enforce permissions in Convex. See the
> [Authentication guide](../guides/authentication.md).
>
> The RBAC half of this directory is different: pure, tested, and used
> everywhere. See [RBAC](#rbac) below.

### Setup

```typescript
import { Role, hasPermission } from "@be-in-digital/core/auth/rbac";
```

**There is no auth configuration in this package.** `createAuthConfig` was
exported here, together with `authHooks`, `emailTemplates`, `authErrors`,
`validatePassword`, `validateEmail`, `DEFAULT_SESSION_EXPIRY`,
`DEFAULT_SESSION_REFRESH` and `MIN_PASSWORD_LENGTH`. Every one of them had zero
call sites, and the configuration they described contradicted the one that runs:
`MIN_PASSWORD_LENGTH = 8` against the live `minPasswordLength: 12`, and five
lifecycle hooks whose entire bodies were a `console.info` and a list of TODOs
over names like "lock the account after N attempts". They are gone.

Better Auth is configured where it is instantiated — `apps/*/convex/auth.ts`,
through `@convex-dev/better-auth`. The session lifetime, the password rule and
the OAuth providers live there. See the
[Authentication guide](../guides/authentication.md).

### Also exported here

The types `AuthUser`, `AuthSession`, `AuthSessionData`, `BetterAuthConfig`,
`CanAccessProps`, `RoleGateProps` and friends: several React pieces ship as
**types only**, to be implemented in the app where JSX is available.

## Internationalization (i18n)

Dynamic, unlimited languages with GPT-3.5-turbo auto-translation.

### Configuration

The constant is `DEFAULT_I18N_CONFIG`; `I18nConfig` is the type it satisfies.
There is no `i18nConfig` export, and no `TranslationProvider`:

```typescript
import { DEFAULT_I18N_CONFIG, COMMON_LANGUAGES } from "@be-in-digital/core";
import type { I18nConfig, I18nProviderComponent, I18nProviderProps } from "@be-in-digital/core";
```

`I18nProviderComponent` and `I18nProviderProps` are **types**. The provider
itself has to be written in the app, for the same reason as `CanAccessProps`:
this package ships no JSX, so it can offer the shape of a provider and not a
provider.

### useTranslation Hook

Same story: `@be-in-digital/core` exports the type `UseTranslation`, and the
running hook lives in `@be-in-digital/restaurant`, on top of the language store.

```typescript
import { useTranslation } from "@be-in-digital/restaurant";

function ProductCard({ product }) {
  const { t, locale, defaultLocale, isReady } = useTranslation();

  return (
    <div>
      <h2>{t("product.title")}</h2>
    </div>
  );
}
```

`t` resolves a key: override → static JSON → default locale → the key itself.
Setting the locale is a store action (`useLanguageStore`), not part of this
return. See the [i18n guide](../guides/i18n-translation.md).

### Auto-Translation

The export is `translateText`, not `translateWithGPT`. It imports no SDK and
reads no environment — the HTTP client and the key are injected, which is what
keeps the package loadable from the Convex runtime.

```typescript
import { translateText, batchTranslate, estimateTranslationCost } from "@be-in-digital/core";

// Single translation
const translated = await translateText(
  "Margherita Pizza",
  "en",           // source
  "fr",           // target
  "product name", // context hint (optional)
  httpClient,     // typed optional, but throws without it
  apiKey,         // idem
);
// → "Pizza Margherita"

// Batch: items are { text, key? }, and the client and key are REQUIRED here
await batchTranslate(
  products.map((p) => ({ text: p.name, key: p._id })),
  "en",
  "es",
  httpClient,
  apiKey,
);
// Cost: ~$0.001 per product
```

### Language Storage

Languages are stored via cookies (primary) with localStorage fallback. There is
no `getLocale`; reading is split by where you are, and returns `null` rather than
a fallback:

```typescript
import {
  getLocaleFromCookie,       // server: takes the request's cookie header
  getLocaleFromLocalStorage, // client: no argument
  detectLocale,              // walks the whole priority chain
  resolveRequestLocale,      // the store's active languages are the allow-list
  setLocale,                 // writes cookie + localStorage together
} from "@be-in-digital/core";

const currentLocale = getLocaleFromLocalStorage(); // "fr" | null
setLocale("en");
```

## Payments

**Payments are not part of this package.** There is no `payments/` directory in
`packages/core/src`, and no `createStripePayment`, `handleStripeWebhook`,
`createSumUpCheckout`, `createPayPalOrder`, `capturePayPalPayment` or
`processRefund` anywhere in the engine.

The payment code is Convex:

| What | Where |
|------|-------|
| Query/mutation definitions (`settlePayment`, `reserveRefund`, …) | `@be-in-digital/convex-functions/payments` |
| Refund decisions (`planRefund`, `routeRefund`) | `@be-in-digital/convex-functions/refundPolicy` |
| Settlement binding (`assertSettlesOrder`) | `@be-in-digital/convex-functions/paymentSettlement` |
| Provider SDK calls and webhooks | each app's `convex/stripe.ts`, `sumup.ts`, `paypal.ts`, `stripeWebhook.ts` |

Square is announced but **not implemented** — no code reads a Square credential,
and `routeRefund` returns `{ kind: "unsupported", provider: "square" }`.

See the [Payments guide](../guides/payments.md).

What this package *does* contribute is the environment schema those providers are
read through — `siteEnvSchema`, via `getSiteEnv()`:

```env
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_SANDBOX_MODE=true
SUMUP_CLIENT_ID=...
SUMUP_CLIENT_SECRET=...
```

SumUp is connected over OAuth: there is no `SUMUP_API_KEY`.

## AWS Services

### S3 Storage

S3 is a **factory over an injected client**, not a set of free functions: the
package has no `@aws-sdk/client-s3` dependency at all, so it stays loadable from
the Convex runtime, and injecting the client is what makes it testable
(`packages/core/src/aws/s3/client.ts:112`). There is no `uploadToS3`,
`deleteFromS3` or `getSignedUrl` export — pass an `S3Operations` adapter to
`createS3Service` and use the returned instance.

```typescript
import { createS3Service, S3_FOLDERS } from "@be-in-digital/core";
import type { S3Operations } from "@be-in-digital/core";

declare const client: S3Operations; // your adapter over @aws-sdk/client-s3
const s3 = createS3Service(config, client);

// Upload a file — the key is generated from the folder and content type
const { key, url } = await s3.upload(file, {
  folder: "products",
  contentType: "image/webp",
});

// Presigned URLs (the bucket is private)
const upload = await s3.getPresignedUploadUrl({ folder: "products", contentType: "image/webp" });
const download = await s3.getPresignedDownloadUrl(key);

// Delete
await s3.delete(key);
```

**S3 folders** are the allow-list in `@be-in-digital/core/aws/folders`. It is the
single source of truth: the `/api/files` proxy serves a folder only if it appears
here, so an upload into an unlisted folder produces a URL that 404s.

| Folder | Content |
|--------|---------|
| `products/` | Product images |
| `categories/` | Category images |
| `cms/` | CMS media uploads |
| `branding/` | Logos, brand assets |
| `stores/` | Store photos |
| `storefront/` | Storefront imagery |
| `blogs/`, `blog-auto/` | Blog images, hand-written and generated |
| `email/` | Email campaign assets |
| `avatars/`, `users/` | Account images |

### SES Email

Same shape as S3: `sendEmail` and `sendTemplatedEmail` are **methods on the
service**, not module-level exports.

```typescript
import { createSESService, createSESv2Operations, getSESService } from "@be-in-digital/core";

const ses = createSESService(config, createSESv2Operations(awsConfig));
// or, server-side, build it from the environment:
const ses = getSESService();

// Simple email
await ses.sendEmail({
  to: "customer@example.com",
  subject: "Order Confirmed",
  html: "<h1>Your order is confirmed!</h1>",
});

// Templated email
await ses.sendTemplatedEmail({
  to: "customer@example.com",
  templateName: "order-confirmation",
  templateData: { orderNumber: "ORD-123", total: "24.99" },
});
```

Transactional mail leaves the product through the app's `/api/email/send` route,
which is `createEmailRouteHandler({ secret, linkOrigin })` from this package:
Convex holds no SES credentials, so it POSTs there instead. Bulk campaign sends
are the exception and use `@aws-sdk/client-sesv2` directly from a Convex Node
action.

## RBAC

Role-based access control for admin operations.

```typescript
import { hasPermission, Role } from "@be-in-digital/core";

// Roles: super_admin, client_admin, manager, kitchen, waiter, delivery, customer
const canManageProducts = hasPermission(user.role, "products:write");
const canViewOrders = hasPermission(user.role, "orders:read");

// Also available: hasAnyPermission, hasAllPermissions, getRolePermissions,
// parseRole, isValidRole, and the requirePermission* guards.
```

A `Permission` is the template literal `` `${Resource}:${Action}` `` — both are
exported enums, so a typo is a compile error rather than a silent `false`.

### Permission Matrix

The columns are the `Role` enum's seven members — there is no `owner`, `admin` or
`staff` role, and `users:manage` is not a permission (`Resource` has no `users`
member; team management is `team:*`).

| Permission | client_admin | manager | kitchen | waiter | delivery | customer |
|-----------|--------------|---------|---------|--------|----------|----------|
| `products:write` | Yes | Yes | No | No | No | No |
| `orders:read` | Yes | Yes | Yes | Yes | Yes | No |
| `payments:refund` | Yes | No | No | No | No | No |
| `settings:write` | Yes | No | No | No | No | No |
| `team:write` | Yes | No | No | No | No | No |

`super_admin` holds everything `client_admin` does plus exactly four:
`stores:delete`, `stores:manage`, `kitchen:manage` and `analytics:view_all`. The
full matrix is `ROLE_PERMISSIONS` in
`packages/core/src/auth/rbac.ts`, and the
[Authentication guide](../guides/authentication.md) reproduces it.

## Environment Validation

Zod-based validation for all environment variables with a two-tier architecture.

### Setup

```bash
# Copy the template
cp apps/reference/.env.example apps/reference/.env.local
# Fill in the values
```

### Schemas

```typescript
import { packageEnvSchema, siteEnvSchema } from "@be-in-digital/core/env";
import type { PackageEnv, SiteEnv } from "@be-in-digital/core/env";
```

- **packageEnvSchema**: Platform-level vars (AWS, OpenAI, Uber Eats, Deliveroo)
- **siteEnvSchema**: Per-restaurant vars (Convex, Auth, Stripe, SES, Maps, etc.)

### Getters (lazy-loaded, memoized)

```typescript
import { getPackageEnv, getSiteEnv } from "@be-in-digital/core/env";

const { AWS_REGION, OPENAI_API_KEY } = getPackageEnv();
const { NEXT_PUBLIC_CONVEX_URL, STRIPE_SECRET_KEY } = getSiteEnv();
```

### Startup Validation

The app validates all env vars at startup via `instrumentation.ts`:

```typescript
import { validateAllEnv, formatEnvReport } from "@be-in-digital/core/env";

const { ok, missing } = validateAllEnv();
if (!ok) {
  console.error(formatEnvReport(missing));
  // Production: throws error
  // Development: logs warning, continues
}
```

The report groups missing variables by tier (Package-level vs Site-level) and shows a hint to copy `.env.example`.
