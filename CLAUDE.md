# CLAUDE.md - BeInDigital Engine

## 🎯 Project Overview

**BeInDigital Engine** is a premium Next.js e-commerce platform for restaurants with Convex backend. We sell specialized themes by restaurant type that owners can purchase and customize.

### Business Model
- **Product**: Next.js theme sold once per restaurant
- **Multi-store**: 1 restaurant owner = 1-∞ locations (unlimited)
- **Pricing**: Per store
- **Maintenance**: 1 year included, then annual renewal
- **No plan gating exists.** Two offers are sold — Essentielle and Premium — and
  the engine never learns which one was bought: no plan literal, no `planSlug`,
  no entitlement read anywhere in `apps/themes/convex` or `packages/*/src`.
  `apps/site/convex/planAvailability.ts` decides which plan may be **bought**, not
  what a bought plan unlocks. Do not write copy that implies a feature is withheld
  from a tier. If gating is ever wanted, `maintenanceContracts` is the right home:
  one singleton row per deployment, written by the team, read-only for the client.
- **A delivered site never invents its own social proof.** No `reviews` table and
  no `ratings` table exist, so nothing can produce a star. Never ship a hard-coded
  testimonial, rating, review count or customer count in `apps/themes` — not even
  as a placeholder a client is "expected to overwrite". A figure about an
  establishment is the establishment's to state. Held by
  `tests/storefront/no-fabricated-social-proof.test.ts` in both apps.

---

## 🔧 Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS
- **UI**: shadcn/ui
- **State**: Zustand (client) + Convex Hooks (server)
- **Forms**: React Hook Form + Zod
- **i18n**: Cookies/localStorage
- **Testing**: Vitest (unit) + Playwright (e2e)

### Backend
- **BaaS**: Convex (1 instance per client)
- **Auth**: Better Auth + Convex
- **Storage**: AWS S3
- **Email**: AWS SES
- **Real-time**: Convex Subscriptions

### Package Management
- **Manager**: pnpm
- **Monorepo**: Turborepo
- **Registry**: GitHub Packages (private)

### Integrations
- **Payments**: Stripe, SumUp, PayPal, Cash — Square is announced, not built.
  `globalSettings.payments.cardProvider` also admits `none`, which is how a
  cash-only establishment removes the card tile from the checkout rather than
  greying it.
- **Delivery**: Uber Direct
- **Platforms**: Uber Eats, Deliveroo
- **Translation**: GPT-3.5-turbo

---

## 📁 Repository Structure

```
beindigital/
├── packages/
│   ├── ui/                    # React Components
│   ├── core/                  # Auth, i18n, Payments, AWS
│   ├── restaurant/            # Business Logic, Zustand stores
│   ├── integrations/          # Uber Eats, Deliveroo, Uber Direct
│   ├── marketing/             # Email campaigns, segments, subscribers
│   ├── cms/                   # Custom CMS
│   ├── convex-schema/         # DB Schemas
│   ├── convex-functions/      # Backend Functions
│   ├── admin/                 # Admin Pages, Stores, Hooks
│   └── mcp-server/            # MCP Package Registry
│
├── apps/
│   ├── site/                  # @beyours/site — commercial site → beyours.fr
│   │   ├── app/               # Marketing, template catalogue, Stripe checkout,
│   │   │                      # affiliate portal, internal ops console
│   │   └── convex/            # Its OWN Convex backend (separate from the engine)
│   │
│   ├── reference/             # @beyours/reference — the engine's test bench
│   │   ├── app/               # Storefront, admin, CMS, kitchen display, QR games
│   │   ├── components/        # UI, Storefront, Admin, Game
│   │   ├── lib/               # Stores, Utils, AWS, Printing, Translation
│   │   ├── convex/            # Schema, Functions (thin wrappers over the packages)
│   │   ├── e2e/               # Playwright tests — the CI e2e target
│   │   └── __tests__/         # Vitest tests
│   │
│   ├── themes/                # @beyours/themes — the client template (cloned per client)
│   │   ├── templates/         # Vertical designs (pizzeria, fast-food, food-truck…)
│   │   ├── demos/             # 50 sales demos
│   │   ├── site/              # CLIENT zone — per-site customization
│   │   └── convex/            # Same wrappers as reference
│   │
│   └── docs/                  # Documentation (no package.json)
│
├── .github/workflows/         # CI/CD (tests, lint, deploy)
├── turbo.json
└── package.json
```

**Three applications, three audiences.** `apps/site` is the commercial site and
depends on **none** of the engine packages — it is a website, not an instance of the
product. `apps/reference` is where an engine feature is built and proven; it is sold
to nobody. `apps/themes` is the shippable counterpart, cloned into one repo and one
Convex backend per client.

**Two scopes, deliberately.** The three apps use `@beyours/*`; the ten engine packages
under `packages/` use `@be-in-digital/*` (private GitHub Packages). Installing them
needs a `read:packages` PAT in `NODE_AUTH_TOKEN`; without one, use
`pnpm engine:link <engine-clone>` from inside `apps/themes` for local symlinks
(the script lives there, not at the root).

> **BeYours is the product sold to restaurant owners. BeInDigital is the agency.**
> Two brands, two businesses — read the Naming section of `README.md` before any
> find-and-replace.

---

## 🗄️ Key Database Schemas

**Multi-tenant**: one **Convex deployment** per client — isolation is a whole
backend, not a schema inside a shared database. No SQL database is involved;
neither Neon nor Postgres appears anywhere in the codebase.

### Core Tables
- `stores`, `products`, `menus`, `orders`, `userProfiles`
- Auth tables (`user`, `session`, `account`, `verification`, `jwks`) are owned by
  the Better Auth component and are **not** declared in
  `packages/convex-schema/src/schema.ts` — see its comment at `:80-87`. There is
  no `users` or `sessions` table to query.

### Kitchen System
- `kitchenTickets` (auto-print). Print config lives on `stores.printConfig`.
  There is no `printerSettings` table: it was declared for the unbuilt ESC/POS
  path, never gained a reader or a writer, and has been removed. The thermal
  path when it comes is cloud printing, whose shape `stores.printConfig`
  already carries.

### Gamification
- `gameQRCodes`, `requiredActions`, `games` (win ratio), `prizes`, `gamePlays`, `prizeRedemptions`
- `gamePlays.consent` records the diner's agreement (art. 7.1) — when, and to
  which wording. `gamePlay.play` throws `CONSENT_REQUIRED` without it. The
  wording lives in `packages/admin/src/game/consent-copy.ts` and owns its own
  version; `GAME_CONSENT_NOTICE_VERSIONS` in `convex-functions/gamePlay` is the
  set the server accepts.

### i18n
- `languages` (dynamic, unlimited), `translations`, `translationJobs` (GPT)

### Integrations
- Platform links live in the `storeIntegrations` table, keyed by `storeId` +
  `platform`. `stores.integrations` is still declared as `v.optional(v.any())`
  because old documents hold it, but **nothing reads or writes it**
  (`packages/convex-schema/src/tables/stores.ts:149-154`).
- Products have `externalIds.uberEatsId`, `externalIds.deliverooId`

---

## 🎯 Key Features — 70 shipping · 6 partial · 17 absent, at `cdc6c81`

This section used to be headed "181+", a number copied from
`_project/FEATURES_DIAGRAM.md` whose own table sums to 201 and which counts
things that are not features (six themes as six, seven team roles as seven).
Neither figure was ever measured.

**The figure above was measured on 7 September 2026, against the tree at
`cdc6c81`, and it is true of that commit and of no other.** It counts the 93
leaf features of the nine `FEATURES_DIAGRAM` categories this section reproduces:
**70 ship, 6 are partial, and 17 are absent** from `apps/themes` — the
application a paying client actually runs. Every row is listed with its evidence
in `tasks/feature-audit-2026-09-07.md`, so the count can be checked rather than
believed.

It replaces **29 shipping · 23 partial · 41 absent**, measured at `009af63` on
1 September 2026 and quoted here as binding for six days after thirty-four
commits had moved it. `pnpm check:claude-md` now fails when the commit named
above is not an ancestor of `HEAD` — which proves the pin is real, and proves
nothing at all about whether the count still is. **Re-measure before you quote
it, and redo the ledger when you do.** A figure with no commit attached is not
a measurement; do not restore one.

### Multi-Store (5)
Store config, hours, geolocation, status

### Products & Menu (9)
Catalog, categories, options, pricing, stock, scheduling

### Orders (8)
Creation, tracking, statuses, types (delivery/pickup/dine-in)

### Kitchen Display System
Real-time display, auto-print tickets (browser), multi-station, prize scanner

### Payments
Stripe, SumUp, PayPal, Cash, tracking, refunds. **Square is not
implemented** — `refundPolicy.ts` refuses it by name. It is presented as
forthcoming in the admin and in the guided tour; do not describe it as available.

`cardProvider` is `stripe | sumup | none`, and it lives on
**`globalSettings.payments`** — one row for the deployment, not a field on
`stores`. This file called it `payments.cardProvider` twice with nothing to say
which document that was, and there is no `payments` field on `stores` at all;
`packages/convex-schema/src/tables/globalSettings.ts:118` is the declaration.
`none` is the owner saying "we do not take cards" and the checkout removes the
tile entirely;
`paymentAvailability.get` answers `card` (can one be taken right now — greys the
tile) and `cardOffered` (does this establishment take cards at all — removes it)
as two separate questions, because a misconfigured provider and a deliberate
refusal owe the diner different screens.

**A promotion type the order path cannot honour is refused at creation.**
`free_product` and `bogo` alter the item list rather than the order total and no
code path builds those items, so `promotions.create` and `promotions.update`
refuse them and the admin form does not offer them. The list lives once, with
the resolver that enforces it: `HONOURABLE_DISCOUNT_TYPES` in
`packages/convex-functions/src/promotionDiscount.ts`. Implement one there and it
becomes creatable on the same commit.

### Third-Party Integrations (10)
Uber Eats, Deliveroo (menu sync, orders), Uber Direct (delivery)

### Gamification (16)
- QR codes on tables → social actions → game (Wheel/Scratch)
- **Admin controls win ratio** (0-100%)
- Prize management, 24h cooldown

### i18n (10)
- **Admin adds ANY language**
- **GPT-3.5-turbo auto-translation** ($0.001/product)
- Manual translation option
- Bulk translation of the **catalogue** — adding a language backfills products,
  categories and menus, and the CMS page editor has a « Traduire tout ». There is
  no bulk translator for **UI strings**: `translateUIStrings` used to exist in
  both apps' `convex/autoTranslate.ts`, with zero callers and a docblock claiming
  the admin languages page called it, and has been deleted. UI strings are
  translated one at a time through the « Traductions UI » tab of the admin
  languages screen (`translations.upsert`).
- `translationJobs` rows are written but **read by nothing**, so a batch that
  stops on the daily quota looks exactly like one that finished.
- **RTL, currency and date locale do not reach the storefront.** The « Droite à
  gauche » switch and the « Devise » picker are therefore **disabled with a
  stated reason**; the value is still stored, and nothing on the storefront reads
  it. Prices format as `fr-FR`/EUR whatever the owner picked, and Arabic renders
  left-to-right. Currency is the half-case: the admin's own payment and refund
  screens do format in the currency taken, only the public site does not.

### Personal data (RGPD)
A French restaurant running this engine is the **data controller**. The engine
answers all four obligations from `packages/convex-functions/src/privacy.ts`,
rendered at Dashboard → Organisation → **Données personnelles**:

- **Access and portability** (art. 15, 20) — `exportDataSubject` returns the raw
  rows as JSON, by e-mail or by device fingerprint.
- **Erasure** (art. 17) — `previewErasure` then `eraseDataSubject`. Multi-pass:
  a pass returns `complete: false` and the wrapper reschedules until it is true.
- **Consent** (art. 7.1) — on `gamePlays`, see above.
- **Retention** (art. 5.1.e) — the cron **purge expired customer data**, window
  in `globalSettings.dataRetention`, defaulting to the CNIL's three years.

**A paid order is anonymised, never deleted.** The money, lines, VAT and dates
stay and the customer leaves. Everything else about a diner is deleted outright.
Every run writes a `privacy_*` line to `systemAuditLog`.

**The invoice survives, whole.** Since #367 a paid order also issues an
`invoices` row, and that is a numbered fiscal document in an unbroken series
(art. 242 nonies A CGI) — never edited, never deleted. It keeps the buyer's
name, e-mail, phone and address under art. 17.3.b. The erasure reaches it
through `orders.invoiceId`, **exports** it (art. 15, 20) and **reports** it as
retained, so the operator can tell the diner what was kept and why. Do not add
it to the deletion set.

Guarded by `customers:manage`, held by `super_admin` and `client_admin` only —
deliberately not `customers:read`, which a waiter holds. Operator guide and the
**nine decisions still owed by the client**:
`tasks/gdpr-diner-data-runbook.md`.

### Design
Design system in `packages/ui`. A site's look is fixed **at clone time** by
`pnpm template:apply <slug>` — 5 verticals, 51 templates under
`apps/themes/templates/`, each **four** files: `theme.css`, `fonts.ts`,
`template.json` and `DESIGN.md`. `template.json` is load-bearing, not
documentation — the applier reads it — so a template written from the "two
files" this line used to claim would not apply. Those are
the storefront's *defaults*, compile-time constants in `apps/*/app/globals.css`
and `apps/*/site/fonts.ts`; per-store branding overrides them at runtime — see
below.

Logo, favicon and brand name are per store, through the CMS `branding` block on
the `storefront-layout` page — the only branding the storefront header, the
favicon, the JSON-LD and the admin sidebar actually read.

**Per-store colours and typography reach a diner, since #353 — and actually
reached one only from #410.** `stores.updateBranding` writes `store.branding`;
`buildBrandingCss` (`packages/ui/src/lib/branding.ts`) derives design tokens
from it; and `StoreTheme`, mounted in each app's `app/(storefront)/layout.tsx`,
emits them unlayered so they beat the defaults in `globals.css`'s `@layer base`.
Unlayered is only half of it, and the missing half cost the feature its whole
point: a layer settles a conflict **on one element**, and `globals.css` declares
the storefront palette on `.storefront-theme`, a `<div>` in
`components/storefront/storefront-shell.tsx`, while `StoreTheme` writes to
`:root` and `.dark` on `<html>`. A property declared on an element beats the one
it would have inherited, so nine tokens were overwritten straight back to the
engine green. Measured in Chromium: a store that picked `#d32f2f` had a red
admin and a green storefront. `buildBrandingCss` now takes `scopes`, and the
storefront passes `[".storefront-theme"]` (`STOREFRONT_SCOPES`).

The 51 vertical templates still have the identical defect — `site/theme.css`
also targets `:root` and `.dark` — so `pnpm template:apply` repaints the admin
and the sign-in pages and not the storefront. Recorded in
`tasks/wcag-contrast-audit-2026-09-08.md`; not fixed.

So the template above is the starting point, not the ceiling. Only the role
gates the Design screen now — `stores:write`, which `manager` does not hold.

Typography carries one real limit, and the screen states it: nothing fetches a
webfont, so a family other than the bundled Inter and Poppins renders only on a
device that already has it.

There is no runtime theme selector, and `themeId` is a schema field with zero
writers and zero readers. (No predefined-theme package exists either —
`packages/themes` was an empty stub and has been removed.)

### Accessibility
Three guards, each measuring rather than asserting a policy:

- **Contrast.** `tests/a11y/contrast.test.ts` in both apps sweeps every `.tsx`
  they render and fails on any pair below the WCAG 2.1 AA floor. A region may
  DECLARE the surface a shell in another file paints — a hex for a literal, a
  token name for one that paints `bg-background` — and the files whose surface
  is still unresolvable (the storefront header over the hero photograph, and
  what sits inside it) are pinned by name: a new one fails. It dropped all 150
  of its findings for want of that and guarded nothing; see
  `tasks/wcag-contrast-audit-2026-09-08.md` § The 150.
- **Motion.** `prefers-reduced-motion` is honoured in two places because there
  are two animation systems: a universal block in `app/globals.css` for CSS,
  and `<MotionConfig reducedMotion="user">` in `app/providers.tsx` for
  framer-motion, which writes inline `style` per frame and no stylesheet can
  reach. Nothing on the buying path animates forever — WCAG 2.2.2 is Level A
  and there is no pause control on a restaurant hero.
- **Live regions.** Every cart mutation is announced, by one polite region in
  `StorefrontShell` — not in the cart sheet, which unmounts, and a live region
  must be in the document before its contents change.

### Testing
- Vitest unit tests. **Coverage is measured on demand, not gated** —
  `pnpm test:coverage` reports it, no config sets a threshold and no workflow
  runs it. This file claimed "80%+ coverage" for months while nothing produced
  that figure; a run on 5 Sep 2026 had two of the nine engine packages clearing
  80% of statements and the lowest at 4%. Measure before you quote a number,
  and read `TESTING.md` before adding a threshold.
- Playwright E2E tests (critical flows)

---

## 🛠️ Development Guidelines

### Code Standards
- TypeScript strict mode
- No `any` types
- Zod validation for all inputs
- Error handling with try/catch
- JSDoc for complex logic
- Barrel files (`index.ts`)

### File Naming
- Components: PascalCase (`ProductCard.tsx`)
- Utils: camelCase (`formatPrice.ts`)
- Tests: `*.test.ts` or `*.spec.ts`

### State Management
```typescript
// Client state → Zustand
import { create } from 'zustand'
export const useCartStore = create((set) => ({...}))

// Server state → Convex
import { useQuery } from "convex/react"
const products = useQuery(api.products.list)
```

### Testing Requirements
- Write unit tests for utils, stores, validations
- Write E2E tests for critical flows
- Run `pnpm test && pnpm test:e2e` before commit

---

## 🌍 i18n with GPT-3.5

**Admin adds languages dynamically** (unlimited)

Both live in `packages/core/src/i18n/gpt-translation.ts`. There is no
`translateWithGPT` — the function is `translateText`, and `batchTranslate`
requires the HTTP client and the API key, they are not optional.

```typescript
import { translateText, batchTranslate, estimateTranslationCost } from "@be-in-digital/core"

// One string. `context` steers the model; the rest have defaults.
await translateText(text, "en", "fr", "product name", httpClient, apiKey)

// Many strings. httpClient and apiKey are REQUIRED here.
await batchTranslate(items, "en", "es", httpClient, apiKey)
```

`httpClient` is injected for the same reason the AWS services inject theirs: the
package must stay loadable from the Convex runtime. Note also that the engine's
own auto-translation pipeline is separate — it lives in
`@be-in-digital/convex-functions/autoTranslate`, deliberately off that package's
barrel, and the apps drive it from there.

**Cost**: ~$0.001 per product, $0.01 per page (`estimateTranslationCost`)

---

## 🎮 Gamification Flow

1. Customer scans QR code on table
2. Completes social actions (Google review, Instagram follow, etc.)
3. Plays game (Wheel of Fortune, Scratch Card)
4. **Admin controls win ratio** (e.g., 30% win, 70% lose)
5. If win: fills form → receives QR code by email → redeems at restaurant
6. 24h cooldown before next play

---

## 🖨️ Kitchen Printing

**Auto-print tickets** when an order is paid — through the browser, which is the
only transport that ships.

```
Browser print — the kitchen screen prints to the station's own printer
  KitchenPrintTrigger renders the ticket into a hidden iframe and calls
  print(); apps/*/scripts/kiosk-print.sh runs Chrome with --kiosk-printing so
  no dialog appears. A thermal printer set as the OS default gives a thermal
  ticket — via the OS driver, not via ESC/POS bytes we emit.
Multi-station routing  — stores.stationMapping
Reprint button         — kitchenTickets.requestReprint
Claim lock + retries   — one tablet wins a ticket; failures retry (#164)
```

**Not implemented, and not to be described as if it were:** ESC/POS byte
generation, network (port 9100) or USB transport, printer status polling. A
browser cannot open a raw socket and Convex cannot reach a restaurant's LAN, so
the thermal path will be **cloud printing** (Star CloudPRNT / Epson Server Direct
Print — the printer polls an HTTP endpoint), not a local print agent. The three
cloud providers already exist in `packages/admin/src/lib/kitchen-print.ts` as
`available: false`. Decision recorded in `tasks/sales-readiness-backlog.md`
(LAUNCH-04).

---

## ☁️ AWS Services

There is **no** `uploadToS3`, `sendEmail` or `sendTemplatedEmail` free function —
those three names were documented here for a long time and never existed. Both
services are **factories over an injected AWS client**: you build the SDK client,
they hold the policy. `packages/core` therefore has no `@aws-sdk/client-s3`
dependency at all; its one SDK dependency is `@aws-sdk/client-sesv2`, imported
only by the SES adapter that `createSESv2Operations` lives in.

Everything below comes from the package root, `@be-in-digital/core`; there is no
`./aws/s3` or `./aws/ses` subpath. The two `./aws/*` subpaths that do exist are
deliberately import-free so a Convex isolate can pull them in on their own:
`./aws/folders` (the folder allow-list) and `./aws/media-url`.

### S3 Storage
There is no `uploadToS3`. Build the service and call `upload` on it; the
client is injected, which is what makes it testable.

```typescript
import { createS3Service, S3_FOLDERS } from "@be-in-digital/core"

const s3 = createS3Service(config, client) // `client` is your S3Operations adapter
const { key, url } = await s3.upload(buffer, {
  folder: "products",       // any of the eleven in S3_FOLDERS
  contentType: "image/webp",
})
// also: getPresignedUploadUrl, getPresignedDownloadUrl, delete, getPublicUrl,
//       exists, getMetadata
```
Folders are a closed set of eleven, declared once in
`packages/core/src/aws/folders.ts` — `products`, `categories`, `cms`,
`branding`, `stores`, `storefront`, `blogs`, `blog-auto`, `email`, `avatars`,
`users`. Everything else derives from it: the Zod schema `upload()` parses
through (`aws/s3/validation.ts`), the MIME and size tables, and the
`/api/files` allowlist. Add a folder there and nowhere else.

This entry, and `s3FolderSchema` itself, used to name six. `S3_FOLDERS` is
where the `S3Folder` type comes from, so all eleven type-checked, and then
`s3.upload(file, { folder: "categories" })` threw at
`uploadOptionsSchema.parse()` — the failure `folders.ts`'s own header
describes: "which is exactly how category, blog and storefront images were
lost". The schema is now `z.enum(S3_FOLDERS)`, so the two cannot disagree
again.

The HTTP route `apps/*/app/api/upload/route.ts` deliberately accepts only five
of them; the rest are written by the presigned Convex flow, authorised
separately. That narrowing is a security boundary, not drift — do not widen it
to match.

The bucket is private either way: reads go through the app's `/api/files`
proxy, and `getPublicUrl` returns that proxy or the CDN, never a direct S3 URL.

### SES Email
`sendEmail` and `sendTemplatedEmail` are methods on the SES service
(`packages/core/src/aws/ses/client.ts:38,45`), not top-level exports.

```typescript
import { createSESService, createSESv2Operations, getSESService } from "@be-in-digital/core"

const ses = createSESService(config, createSESv2Operations(awsConfig))
// or, server-side, read the config from the environment:
const ses = getSESService()

await ses.sendEmail({ to, subject, html })   // the field is `html`, not `htmlBody`
await ses.sendTemplatedEmail({ to, templateName, templateData })
await ses.sendBulkEmail({ ... })   // rate-limited to the SES sandbox ceiling
```
`sendEmail` and `sendTemplatedEmail` are **methods on the service instance**, not
module-level functions.

**How transactional mail actually leaves the product.** Convex has no SES
credentials for the password-reset path, so it POSTs to the app's own
`/api/email/send`, which is `createEmailRouteHandler({ secret, linkOrigin })`
from `@be-in-digital/core` — that handler calls `getEmailService()`
(`getSESService` is a deprecated alias). The two halves share one secret
(`EMAIL_API_SECRET`, with `BETTER_AUTH_SECRET` as a transitional fallback) and
must present the same one. Campaigns, automations, invitations, order
confirmations and migration notices are the exception: they run in Convex Node
actions and send from there.

**SES is the default transport, not the only one.** `EMAIL_PROVIDER=resend`
points a deployment at Resend instead — the whole deployment, both halves —
because every client owns its AWS account, files its own SES production-access
request, and approval is not guaranteed; one has been refused, and such a
client could not send at all. The decision lives in
`packages/core/src/email/providers.ts`, which imports no AWS SDK: SES is the
injected `SESOperations`, Resend is plain `fetch`, and both go through
`createSESService`, so validation, rate limiting and bulk batching are the same
either way. An unknown provider name is **refused rather than falling back to
SES** — `resolveEmailProvider` returns a refusal the caller surfaces; it does
not throw, so do not go looking for one.
Set `EMAIL_PROVIDER`, `RESEND_API_KEY` and `RESEND_FROM_EMAIL` on **both** the
Next.js env and the Convex deployment (`pnpm env:sync` carries them). Resend has
no configuration sets, so the SES-side wiring — the topic, the event
destination, `IncludeOriginalHeaders` — has no counterpart; what carries the
feedback instead is **`POST /webhooks/resend`**, added by #444. Set
`RESEND_WEBHOOK_SECRET` on the **Convex** deployment as well: that route
refuses every delivery while it is unset rather than acting on an unverified
body, because the body names the subscriber to suppress.

Until #444 there was no such route, and it was the whole of the difference
between the two transports: a Resend client mailed a growing list with **zero
suppression** — a dead mailbox re-mailed on every campaign, a spam report never
recorded, « Délivrés » at 0 for ever — and the first symptom available to
anybody was the sending domain being throttled. `email-provider-switch.test.ts`
now reads `http.ts` and fails when a value of `EMAIL_PROVIDERS` has no
`/webhooks/<provider>` route, so the next transport cannot ship without one.

In the ENGINE — `apps/themes` and `apps/reference` — no Convex
action constructs an `SESv2Client` any more; `convex/emailTransport.ts` is the
one seam, and `email-provider-switch.test.ts` holds it there.

That sentence used to be unqualified, and it was false of the third app:
`apps/site/convex/email/providers.ts:23,65,68` builds its own `SESv2Client`.
That is not drift — `apps/site` is the commercial site with its own Convex
backend and none of the engine packages, so it has no `emailTransport.ts` to
route through. The rule is the engine's; say which app you mean.

---

## 🧪 Testing

### Unit Tests (Vitest)
```bash
pnpm test              # turbo run test, every workspace
pnpm test:coverage     # turbo run test:coverage; writes coverage/ per package
pnpm test:ui           # Vitest UI for apps/reference, the engine's test bench
```

`test` and `test:coverage` fan out across the monorepo. `test:ui` cannot: a
Vitest UI is one server per project, so the root script opens the bench. For
any other workspace, name it — `pnpm --filter @be-in-digital/core test:coverage`.

### E2E Tests (Playwright)
```bash
pnpm test:e2e          # turbo run test:e2e
pnpm test:e2e:ui       # Playwright UI mode, apps/reference
pnpm test:e2e:debug    # Playwright inspector, apps/reference
```

The last two delegate to `apps/reference` for the same reason: an interactive
runner needs one target. `apps/themes` defines both as well, so
`pnpm --filter @beyours/themes test:e2e:debug` works on the template.

### CI/CD
GitHub Actions runs the suite on pushes to `main`, on pull requests targeting
`main`, and in the merge queue (`.github/workflows/ci.yml:3-19`). A push to a
feature branch with no open pull request runs nothing — open the PR to get CI.

---

## 🔐 Environment Variables

`packages/core/src/env/schemas.ts` is the source of truth, and
`instrumentation.ts` enforces it at boot. The names below are the ones code
actually reads — several that used to be listed here (`SUMUP_API_KEY`,
`UBER_EATS_API_KEY`, `DELIVEROO_API_KEY`, `UBER_DIRECT_CUSTOMER_ID`) are read
by nothing and never were.

**Required — a deployment refuses to start without these.** The block that
enforces them is `siteRequiredShape` in `packages/core/src/env/schemas.ts`, and
it holds **ten**: the ten down to `AWS_SES_FROM_EMAIL`. `OPENAI_API_KEY` is
listed here too because nothing that uses AI works without it, but it is
declared optional and a deployment does boot without one — count the block, not
this list, and do not re-add a line range, which is what went stale:

```bash
NEXT_PUBLIC_CONVEX_URL=       # the backend itself
CONVEX_SITE_URL=              # webhook and OAuth callback URLs
SITE_URL=                     # password reset links
BETTER_AUTH_SECRET=           # >= 32 chars: openssl rand -base64 32
ENCRYPTION_KEY=               # 64 hex chars: openssl rand -hex 32
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=            # the client's own AWS account — for a NEW client.
                              # Not yet true of every deployment: see below.
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=
AWS_SES_FROM_EMAIL=
OPENAI_API_KEY=sk-...
```

> **One account per client is the decision, not yet the state of the fleet.**
> `apps/docs/deployment/aws-ownership.md` records what is still owed: every site
> provisioned before the change holds the fleet-wide key and the shared bucket,
> and so "still carry credentials to other clients' data
> ([#199](https://github.com/be-in-digital/beyours/issues/199))". Moving one is a
> migration — copy its S3 objects, create and verify its SES identity, re-point
> stored URLs, rotate the shared key — not a config change.
>
> `scripts/setup-aws.sh` with no `SITE_SLUG` provisions into that shared account,
> which is deliberate (a legacy site must be able to re-run it) and now warns
> before it does. Do not read the comment above as a description of what is
> deployed.

**Optional — each one gates a feature that stays off until it is set:**

```bash
CONVEX_DEPLOYMENT=

# Email transport. SES when unset; `resend` is the escape hatch for a client
# whose AWS SES production-access request was refused. Set all three on the
# Convex deployment too — the actions send from there.
EMAIL_PROVIDER=               # "ses" (default) | "resend"
RESEND_API_KEY=               # re_...
RESEND_FROM_EMAIL=            # verified at Resend; falls back to AWS_SES_FROM_EMAIL

# Which SNS topic `/webhooks/ses` accepts, as a full ARN. Set it on the CONVEX
# deployment — the verifier reads it there. A valid Amazon signature proves
# Amazon sent the message, not that OUR topic did, so without this the endpoint
# REFUSES: it confirms no subscription and accepts no notification, logging
# `topic_not_configured` and the ARN it saw, which is the value to paste in.
# It used to accept notifications unconfigured; nothing requires a subscription
# to reach an HTTPS endpoint, so an attacker published on their own topic and
# replayed the JSON Amazon signed for them. The topic must also be on
# SignatureVersion 2: version 1 is SHA-1 and is refused.
# See tasks/webhook-migration-checklist.md.
SES_SNS_TOPIC_ARN=
SES_SNS_ALLOW_ANY_TOPIC=       # "true" re-opens notifications to any signed
                               # topic while the ARN above is still unset. An
                               # operator's deliberate downgrade; it never lets
                               # the endpoint confirm a subscription.

# The Svix signing secret for POST /webhooks/resend, from the Resend dashboard.
# Only for EMAIL_PROVIDER=resend, and set on the CONVEX deployment — a Resend
# deployment gets no SNS notification at all, so this route is the ONLY way a
# bounce or a spam report reaches the product. Unset, the route answers 401 to
# every delivery rather than acting on an unverified body.
RESEND_WEBHOOK_SECRET=

# Payments — SumUp and PayPal are OAuth client pairs, not single API keys
STRIPE_SECRET_KEY=            # sk_...
STRIPE_WEBHOOK_SECRET=        # whsec_...
SUMUP_CLIENT_ID=
SUMUP_CLIENT_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_SANDBOX_MODE=          # "true" | "false"
# SQUARE_ACCESS_TOKEN — no code reads this; Square is unimplemented

# Delivery platforms — also OAuth pairs, each with its own webhook secret
UBER_EATS_CLIENT_ID=
UBER_EATS_CLIENT_SECRET=
UBER_EATS_WEBHOOK_SECRET=
UBER_DIRECT_WEBHOOK_SECRET=   # falls back to the Uber Eats one when unset
DELIVEROO_CLIENT_ID=
DELIVEROO_CLIENT_SECRET=
DELIVEROO_WEBHOOK_SECRET=
```

`SUMUP_API_KEY`, `UBER_EATS_API_KEY`, `DELIVEROO_API_KEY` and
`UBER_DIRECT_CUSTOMER_ID` were listed here for a long time and are read by **no
code at all** — an operator setting them configured nothing. The authoritative
list is `packages/core/src/env/schemas.ts`, which the apps enforce at startup.

`turbo.json` declares no `env` for most tasks, so a non-`NEXT_PUBLIC_` variable
that is not listed in a task's `env`/`passThroughEnv` never reaches it. Adding a
variable means adding it there too.

---

## 📝 Notes for Claude Code

When working on tasks:

1. **Reference this file** for architecture decisions
2. **Use the tech stack** specified (Next.js 16, Convex, Zustand)
3. **Follow code standards** (TypeScript strict, no `any`, Zod validation)
4. **Create barrel files** (`index.ts`) in folders
5. **Write tests** (Vitest for unit, Playwright for e2e)
6. **Multi-store**: always filter by `storeId` (`v.id("stores")`). There is no
   `restaurant_id` field anywhere in the codebase.
7. **i18n**: Use cookies (primary) or localStorage (fallback)
8. **State**: Zustand for client, Convex for server
9. **Run tests** before commit: `pnpm test && pnpm test:e2e`
10. **NEVER mention "Claude Code"** in commit messages (no `Co-Authored-By: Claude`, and no reference to Claude at all).
    This rule is now executed rather than merely written. `.githooks/commit-msg`
    strips the trailers as they are written — `pnpm install` installs it, by
    pointing `core.hooksPath` at that tracked directory — and `pnpm
    check:attribution` refuses them in the required `Lint` job, over every
    commit between the event's base and `HEAD`. Naming `CLAUDE.md` in a commit
    is not attribution and stays legal; the guard matches co-author trailers,
    `Claude-*` trailers, session links, "generated/made/built with Claude"
    credits, a bare mention of the assistant by product name, an
    "AI-generated" credit on a line of its own, and a robot emoji used as a
    signature — and it self-tests both directions before it judges anything.
    The last four were added after an audit measured them walking straight
    through it; the accepted cases guard the collisions that would otherwise
    make it unusable here (this product HAS an AI-generated blog, and Claude is
    an ordinary French given name).
    It was prose for months, and #409 measured the cost: 17 of the 24 commits in
    `4e625bde..3a6cb8d1` carry one, permanently, because `core.hooksPath`
    pointed at husky's `.husky/_` — a directory husky gitignores, so it was
    absent from every fresh clone and worktree, and git runs no hook and says
    nothing when its hooks path resolves to nothing.
11. **English only on GitHub and Git** — see below

---

## 🌐 Language rule — English on GitHub, French for customers

**Everything that lands on GitHub or in Git is written in English.** No exceptions
by default:

- commit messages and branch names
- issue titles **and** issue bodies, labels, milestones
- pull request titles, descriptions, and review comments
- repository documentation (`README`, `CLAUDE.md`, `docs/`, `tasks/`, ADRs)
- code comments, test names, error strings thrown by engine code

**Why:** the repository is a shared engineering artefact. It is read by tooling, by
contributors who may not read French, and by anyone we later hand a client repo to.
The code itself is already English — the prose around it should not be the exception.

**The exception — French stays French when it is the product.** Do not translate:

- customer-facing copy: storefront strings, CMS content, email templates, the
  commercial site, `apps/site` marketing copy
- legal and contractual text: CGV, mentions légales, RGPD notices, contracts,
  invoices — French is a legal requirement here, not a habit
- French domain terms quoted inside an English sentence, when translating them
  would lose precision: *établissement*, *apporteur d'affaires*, *fondateurs*,
  *régime de TVA*, *Prêt Boost*, SIRET. Quote them, don't invent an English word.
- fixtures, seeds and test data that mimic real French restaurant content

**Outside the repo, French is the default:** conversation with the team, ClickUp
tasks and comments, and internal notes.

Never rewrite history on `main` to apply this rule — commits already merged stay as
they are.

---

## 📚 Additional Documentation

These four are written from the code, and each says plainly where the product
falls short of what this file claims. `pnpm check:claude-md` fails the build if
one of them stops existing, or if a command named above stops running.

- `ARCHITECTURE.md` — the three apps, the ten engine packages, how a client
  site is cloned and updated, and the real shape of the shared services
- `FEATURES.md` — every feature marked shipped, partial or not built, measured
  against `apps/themes` rather than against the sales page
- `TESTING.md` — what the suites cover, what CI actually runs, how to measure
  coverage and why no threshold is enforced
- `DEPLOYMENT.md` — Vercel and Convex per client, the env tiers a deployment
  refuses to boot without, and the rollback path

Alongside them: `README.md` for orientation, `apps/docs/` for per-feature
guides and deployment detail, and `tasks/sales-readiness-backlog.md` for the
authoritative sold-vs-built ledger.

---

**Version**: 2.1.0  
**Last Updated**: September 5, 2026  
**Maintained by**: BeInDigital Team