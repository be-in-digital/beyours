# Features

What the product does, what it half-does, and what it does not do at all.

This is not a marketing list. It is a ledger, and its purpose is that nobody has to
find out the hard way — in front of a client — that a feature named in a sidebar,
a pricing table or a guided tour has no implementation behind it. That has happened
here often enough to be the reason this file exists.

**Checked against the tree at `158019f` (5 September 2026).** Every state below was
verified by reading the file or running the command shown. Where a claim from an
older document no longer holds, the correction is stated rather than the claim
repeated. Companion files: [`ARCHITECTURE.md`](ARCHITECTURE.md) for how the pieces
fit, [`TESTING.md`](TESTING.md) for what is held by a test, and
[`README.md`](README.md) for the repository itself.

---

## 1. How to read this

Three states, and nothing in between:

| | Meaning |
| --- | --- |
| **Ships** | An owner or a customer can reach it and use it in `apps/themes`, the app a paying client runs. |
| **Partial** | Something real exists, and there is a named gap between what exists and what the copy promises. The gap is spelled out; "partial" on its own is not information. |
| **Not built** | No implementation. A schema field, a dead export, a translated string or a `<ComingSoon/>` screen is **not** an implementation. |

The bar for **Ships** is deliberately `apps/themes`, not `apps/reference`. The bench
proves a feature; the template delivers it. A feature that works in the bench and is
stubbed in the template does not reach a customer, and is marked accordingly.

---

## 2. Where "181+" comes from

`CLAUDE.md:130` heads its feature list "Key Features (181+)". The figure originates in
[`_project/FEATURES_DIAGRAM.md:647`](_project/FEATURES_DIAGRAM.md), which totals a
mermaid diagram of intended capabilities, and is restated at `:696` along with
"Themes: 6", "Languages: 5", "Payment Providers: 5".

It is a **design document**, written before the build. It is not a count of anything
that exists, and it should not be quoted as one. Two of its own summary lines are
already false against the tree: five payment providers are declared in the schema but
only four are implemented (§4, Payments), and there is no runtime theme selector at
all (§4, Design and theming).

Use it for intent. Use this file for state.

---

## 3. The audit ledger

The most recent systematic measurement is the **discovery audit of 1 September
2026**, recorded at [`tasks/fix-prompts.md:16-19`](tasks/fix-prompts.md):

> of the 92 features `CLAUDE.md` enumerates, **29 ship as described, 23 are partial,
> and 41 are absent or unreachable** from `apps/themes` — the app a paying client
> actually runs.

Two caveats, both worth carrying:

- Those three numbers sum to **93**, against a stated total of 92. The discrepancy is
  in the source; it is quoted here as written rather than silently adjusted.
- The audit was taken at commit `009af63`. Several of its findings have since been
  fixed, and this file says which — see §5, where each is re-checked at `158019f`.
  Do not cite the audit for the state of an individual feature; cite the code.

The card-level ledger is [`tasks/sales-readiness-backlog.md`](tasks/sales-readiness-backlog.md)
— 35 `P0` cards, 12 `TECH` cards and 10 `LAUNCH` cards, each self-contained with
problem, location, fix and done-criteria. It is the authoritative sold-vs-built
record and it is more current than any prose summary, this one included.

---

## 4. Domain by domain

### Multi-store

**Ships.** `stores` is the tenancy root. Create, edit, publish and delete an
establishment; opening hours including services that cross midnight; geolocation;
per-store status; a cross-store cascade on delete
(`packages/convex-functions/src/storeCascade.ts`). The admin lives at
`/dashboard/stores` (`packages/admin/src/pages/stores/`), and every scoped query goes
through `requireStorePermission`.

The multi-tenant key is `storeId`, never `restaurant_id` — see
[`ARCHITECTURE.md`](ARCHITECTURE.md#the-multi-tenant-key-is-storeid-not-restaurant_id).

**Not built inside it:** `stores.displayConfig`, `stores.branding`,
`stores.integrations` and `stores.settings` are all `v.optional(v.any())` with no
writer (`packages/convex-schema/src/tables/stores.ts:151-155`). Live integration data
is in the `storeIntegrations` and `uberEatsConnections` tables. `stores.themeId`
(`tables/stores.ts:70`) has no reader and no writer.

### Products and menu

**Ships.** Catalogue, categories, options and variants, pricing, stock, scheduling,
allergens, image upload, and a from-an-image product creator
(`apps/*/convex/imageToProduct.ts`). Admin at `/dashboard/products` and
`/dashboard/categories`.

**Partial — Menus / formules.** The admin half is complete: a "Menus / Formules" tab,
a list screen and a section builder, Convex CRUD, RBAC and cross-store guards. The
customer half does not exist. `api.menus` has **zero storefront readers**, and
`packages/convex-functions/src/orders.ts` rejects any order line without a
`productId`. The string `menu.addComboToCart` — "Ajouter la formule au panier" — is
translated into fr/en/es in both apps and referenced by nothing. The guided tour
still tells owners they can offer combined deals. This gap is deliberate and
recorded: [`tasks/sales-readiness-backlog.md`](tasks/sales-readiness-backlog.md)
LAUNCH-04 §4, tracked as #352.

**Not built:** *Nutritional information* — `products.nutritionalInfo` exists
(`packages/convex-schema/src/tables/catalog.ts:105`) and no component reads it
(`grep -rn "nutritionalInfo" --include='*.tsx'` → 0). *Image gallery* — products
carry an `images` array and every consumer reads `images[0]`; there is no
multi-image uploader and no gallery.

### Orders

**Ships.** Creation, tracking by token, the eight-state lifecycle (`pending`,
`confirmed`, `preparing`, `ready`, `out_for_delivery`, `delivered`, `completed`,
`cancelled` — `packages/convex-schema/src/tables/orders.ts:23-30`), three service
types (`delivery`, `pickup`, `dine_in`), four sources (`website`, `uber_eats`,
`deliveroo`, `pos`), delivery fees in fixed or percentage mode, promotions applied at
order time, VAT, and cash marked paid at the counter.

**Not built — scheduled orders.** `orders.scheduledFor` exists in the schema, but
`orders.create` **takes no `scheduledFor` argument** (see its validator block,
`packages/convex-functions/src/orders.ts:349` onwards) and the field now has **no
writer at all**: its only one was `uberEatsOrders.saveFromPlatform`, a dead
importer with zero callers that was deleted with #313. No
customer can choose a pickup time — which is the core of a click-and-collect offer,
and beyours.fr sells "click & collect intégré" (`pricing-data.ts:108`).

### Kitchen and printing

**Ships.** A real-time kitchen display, multi-station routing via
`stores.stationMapping` (`packages/convex-schema/src/tables/stores.ts:114-119`), a
reprint button (`kitchenTickets.requestReprint`, `kitchenTickets.ts:878`), a print
claim lock with TTL and bounded retries (`PRINT_CLAIM_TTL_MS`,
`MAX_PRINT_ATTEMPTS`, `kitchenTickets.ts:148-160`) so one tablet wins a ticket and
failures retry, a 30-day ticket retention purge, and the prize scanner.

**The only print transport that ships is the browser.** `KitchenPrintTrigger`
(`apps/*/components/admin/kitchen/KitchenPrintTrigger.tsx`) renders the ticket into a
hidden iframe and calls `print()`; `apps/*/scripts/kiosk-print.sh` launches Chrome
with `--kiosk-printing` so no dialog appears. A thermal printer set as the OS default
produces a thermal ticket — through the OS driver, not through ESC/POS bytes this
codebase emits. The admin says so itself:
`packages/admin/src/lib/kitchen-print.ts:144` calls browser printing "le seul mode
disponible aujourd'hui".

**Not built:** ESC/POS byte generation, network (port 9100) or USB transport, printer
status polling. The `printerSettings` table is registered and has **zero readers and
zero writers**; its only non-schema reference is a delete cascade for rows nothing
creates. The three cloud-printing providers in `kitchen-print.ts:151,157,163` are
declared `available: false`. The decided path is cloud printing (Star CloudPRNT /
Epson Server Direct Print, where the printer polls an HTTP endpoint) rather than a
local agent, because a browser cannot open a raw socket and Convex cannot reach a
restaurant's LAN — LAUNCH-04 §3.

**Not built:** *Kitchen analytics* (no files). *Order assignment* — `assignTo` is
exported as a real mutation in both apps
(`apps/*/convex/kitchenTickets.ts:168`) and **no UI calls it**; `assignedTo` appears
in `packages/admin/src/pages/kitchen/ticket-card.tsx:32` as a prop type and is never
rendered. *Priority management* — the schema has a priority field and all three
ticket writers hardcode `priority: "normal"`
(`packages/convex-functions/src/orders.ts:1809`,
`apps/*/convex/deliverooWebhook.ts:442`, `apps/*/convex/uberEatsWebhook.ts:246`).

### Payments

**Ships:** Stripe, SumUp, PayPal and cash, with payment tracking, webhook
verification, deduplication (`paymentEvents`), settlement binding and refunds. The
refund route is decided by `routeRefund`
(`packages/convex-functions/src/refundPolicy.ts:143`), and the only screen carrying a
working refund dialog is `/dashboard/payments`
(`packages/admin/src/config/admin-routes.ts:31`).

**Square is not implemented.** It is a literal in the schema's provider union
(`packages/convex-schema/src/tables/payments.ts:16`), and the only executable code
that names it is the one that **refuses** it:

```ts
// packages/convex-functions/src/refundPolicy.ts:151-158
if (payment.provider === "square") {
  return { kind: "unsupported", provider: "square",
           reason: "Aucune intégration Square n'existe : …" }
}
```

It is presented as forthcoming in Paramètres → Paiements ("Square : bientôt
disponible", `packages/admin/src/pages/settings/payments-tab.tsx:224`) and in the
guided tour ("Square arrive"), in the same convention as the print providers. Do not
describe it as available. Decision: LAUNCH-04 §5.

**Not built:** plan gating of any kind. `grep -rniE '"essentielle"|"premium"|planSlug'
apps/themes/convex packages/*/src` returns only email-marketing tag fixtures — nothing
in the product withholds anything from either commercial plan.

### Delivery platforms

**Ships:** Uber Eats and Deliveroo — OAuth connection, menu sync, order ingestion
through signed webhooks, status mapping, and Uber Direct for delivery.
`packages/integrations/src/` holds the three clients (`uber-eats/`, `deliveroo/`,
`uber-direct/`) plus shared `common/`; the webhook handlers are
`apps/*/convex/{uberEatsWebhook,deliverooWebhook,deliverooWebhookHandler}.ts`.

**Not built:** Uber Direct driver assignment (no implementation).

Note that beyours.fr currently advertises the platform integrations as `"soon"` for
both plans (`apps/site/components/pricing/pricing-data.ts:118`), which is more
conservative than the engine's state.

### Gamification

**Ships, in both apps.** QR codes on tables → required social actions → a game
(wheel or scratch card, `packages/convex-schema/src/tables/gamification.ts:14-15`) →
an admin-controlled win ratio → prize claim by email → redemption at the restaurant,
with a cooldown. The player flow lives in `packages/admin/src/game/` and both apps
render it from identical thin pages — the seven-row gamification divergence that used
to exist between the twins was closed, and `scripts/check-app-divergence.mjs` says so
in its own comments (`:81-86`).

**Not built:** loyalty *points, levels, challenges, badges, streaks*. The gamification
schema supports the wheel and the scratch card and nothing else. The word "fidélité"
on beyours.fr describes the game, not a points programme.

### Internationalisation

**Ships:** the admin can add any language (`/dashboard/languages`), translations are
stored per document, and GPT translation runs through
`translateText` / `batchTranslate` (`packages/core/src/i18n/gpt-translation.ts:113`,
`:220`) with a per-store daily budget (`stores.translationQuota`). Translation jobs
are recorded — `translationJobs` now has a writer at
`packages/convex-functions/src/autoTranslate.ts:998`, correcting an earlier audit
finding that it had none.

**Partial — the storefront half.** The admin can define languages the storefront
cannot fully honour:

- **RTL does not work.** `languages.isRtl` is written by the admin form
  (`packages/admin/src/pages/languages/languages-page.tsx:217-220`) and read by
  nothing that sets a direction: `grep -rn 'dir=' apps/themes/app --include='*.tsx'`
  returns **0**. Arabic renders left-to-right.
- **Date and number formatting is hardcoded `fr-FR`** in 32 places across the apps
  and packages.
- **Currency** is stored and displayed in the admin and does not reach the
  storefront.

**Not built:** the *bulk UI-string translator*. `translateUIStrings` exists as an
action in both apps (`apps/*/convex/autoTranslate.ts:276`) and has **no caller** —
those two definitions are the only hits in the repository.

### CMS, blog and Auto Blog

**Ships:** a page/block CMS with a per-page schema registry. `packages/cms` supplies
the machinery — `setCmsRegistry()`, validation, SVG/HTML sanitisation, media
handling — and each app registers its own page definitions at module load
(`apps/*/convex/cms.ts:11`). A media library with S3 upload, alt-text generation and
auto-translation. A blog with categories, tags and articles. An Auto Blog engine —
AI article generation, image sourcing, scheduling and Stripe-billed entitlements —
whose two crons ship in `apps/themes` (`plan auto blog jobs`, `execute auto blog
queue`). Its full specification is [`docs/features/auto-blog-engine.md`](docs/features/auto-blog-engine.md)
and [`tasks/auto-blog-spec.md`](tasks/auto-blog-spec.md).

**Not built:** the CMS *components* editor. `/dashboard/content/components` renders
`<ComingSoon/>` in both apps and is deliberately kept out of the nav — a comment in
`packages/admin/src/config/nav-config.ts` says so where the entry would go.

### Email marketing

**Ships:** subscribers with CSV import and double opt-in, templates, campaigns,
segments, automations with runs, SES event ingestion (bounces, complaints),
suppression, rate limiting, and a scheduled dispatcher (`dispatch scheduled
campaigns`, every minute). `packages/marketing/src` holds the renderer, the CSV
parser, segment filtering and stats; the Convex side is
`packages/convex-functions/src/email*.ts` and `sesSending.ts`.

**Not built:** SMS. No table, no provider, no code.

### Design and theming

**Ships:** the design system in `packages/ui` (57 source files, of which 50 are
components under `src/components/`); a per-store branding editor at
`/dashboard/design` — its own route, deliberately, for the reason spelled out at
`packages/admin/src/config/admin-routes.ts:50-64`; and 50 vertical design templates
applied at clone time by `pnpm template:apply <slug>` (see
[`ARCHITECTURE.md`](ARCHITECTURE.md#the-design-templates)).

**Not built:** a runtime theme selector. Theme choice is a developer running a script
in the client's repository, not a setting an owner can change. Also not built: custom
CSS, layout options, font selection and colour customisation as *end-user controls* —
there is no field and no screen for any of the four beyond the branding editor's
fixed set.

> `packages/themes` does not exist. It was an empty stub and was removed. Templates
> live in `apps/themes/templates/`.

### Authentication and team

**Ships:** Better Auth on Convex, email/password with mandatory verification, roles
and permissions (`packages/core` `Role` / `hasPermission`), team invitations with a
seven-day expiry and a nightly sweep, and a bootstrap path for the first
administrator (`ADMIN_BOOTSTRAP_TOKEN` → `claimFirstAdmin`, documented in
[`apps/docs/deployment/first-administrator.md`](apps/docs/deployment/first-administrator.md)).

**Not built — two-factor authentication.** `packages/core/src/auth/config.ts:94-102`
ships `plugins: []` with the two-factor plugin commented out above it. Social login
is *plumbed* — `socialProviders` is accepted and passed through
(`config.ts:63,92`) — but no provider is configured by default.

### Analytics

**Not built.** This is the single largest gap between what is sold and what exists,
so it gets its own heading.

```bash
find apps/themes packages -iname '*analytic*' -not -path '*/node_modules/*' | wc -l   # 0
grep -riE 'plats populaires|topProduct|peakHour|returnRate' packages apps/themes \
  --include='*.ts' --include='*.tsx' | wc -l                                          # 0
```

What ships is one fixed dashboard with hard-coded windows, available to everyone.
`apps/site/components/pricing/pricing-data.ts:119` —
"Analytics & suivi des performances", `essentielle: false, premium: true` — is the
**only** Gestion-tier row separating the two commercial plans, and the metrics its
long description names ("plats populaires, heures de pointe, taux de retour",
`features-data.ts:227`) do not exist. Since there is also no plan gating anywhere in
the product, nothing withholds anything from Essentielle either.

The one thing that currently limits the exposure: Premium is **closed for sale**.
`apps/site/convex/planAvailability.ts` is the single source both the pricing card and
the checkout read, and the checkout action refuses a closed plan ahead of every
env-dependent check. See §6.

---

## 5. Sold and absent — the ledger, re-checked

Eleven items were measured on 1 September 2026 as sold-and-not-built. Every one is
re-checked here at `158019f`, because some have since been fixed or partly addressed
and repeating a stale finding is the same failure as inventing one.

| # | Claim | State at `158019f` | Evidence |
| --- | --- | --- | --- |
| T-1 | Analytics is the paid tier's differentiator | **Still absent** | 0 files; `pricing-data.ts:119`. Premium is closed for sale, so it cannot currently be bought. |
| T-2 | Customer management (CRM) | **Still absent** | `<ComingSoon title="Clients"/>` in both apps; no `customers` table among the 75; kept out of the nav on purpose (comment in `nav-config.ts`). |
| T-3 | Themes chosen at runtime | **Still absent** | `themeId` in 5 declarations, 0 readers, 0 writers. Theme = `pnpm template:apply` at clone time. |
| T-4 | Sitemap emits `/s/{slug}` 404s; structured data unused | **Fixed** | `apps/themes/app/sitemap.ts:5` records the removal; `<JsonLd>` is mounted in the storefront layout, menu, product and blog pages. |
| T-5 | Push notifications | **Still absent** | `grep -rniE "web-?push|firebase|fcm|expo-notifications|serviceWorker|PushManager"` over `apps/themes` and the four packages → 0. Sold as "planned" only (`pricing-data.ts:126`). |
| T-6 | Scheduled orders / time-slot click-and-collect | **Still absent** | `orders.create` has no `scheduledFor` argument; only the Uber Eats importer writes the field. |
| T-7 | Daily backups and 24/7 monitoring | **Partly addressed** | Monitoring: per-client Sentry now ships ([`apps/docs/deployment/sentry.md`](apps/docs/deployment/sentry.md)). Backups: no cron is a backup; what exists is a manual export in the admin that states it excludes S3 objects (`packages/admin/src/pages/system/backup-section.tsx:154`). No `uptime`/`healthcheck` endpoint. Both are still billed (`pricing-data.ts:160,165`). |
| T-8 | Fifteen features that are schema fields, dead exports, or nothing | **Mostly still true**, two corrections | See the per-domain sections above. Corrections: `translationJobs` **does** have a writer now (`autoTranslate.ts:998`); *order assignment* has a real mutation exported in both apps but still no caller and nothing that renders it. |
| T-9 | Reviews, ratings, SMS, suppliers, purchase orders have no schema | **Still true** | `grep -inE "review|rating|reservation|sms|push" packages/convex-schema/src/schema.ts` → no match among the 75 tables. Table reservations were resolved differently — see §6. |
| T-10 | Two-factor auth and social login | **Still true for 2FA** | `packages/core/src/auth/config.ts:102` — `plugins: []`, plugin commented out at `:96-101`. |

---

## 6. Product decisions on record

`LAUNCH-04` ([`tasks/sales-readiness-backlog.md:1888`](tasks/sales-readiness-backlog.md))
settled five sold-but-absent promises on 5 September 2026. These are decisions, not
findings; do not re-open them without reading the card.

1. **Native iOS/Android app — sold honestly as « à venir ».** What exists is
   `apps/themes/.template/mobile`, one placeholder screen, outside the pnpm workspace,
   never built or submitted. There is no PWA either. The whole Premium delta is this
   app, so **Premium is closed for sale**: `apps/site/convex/planAvailability.ts` is
   the single source the pricing card and the checkout both read, and the checkout
   action refuses a closed plan before any env-dependent check, so it refuses in test
   mode too. `apps/site/tests/convex/planAvailability.test.ts` holds it, including a
   structural rule: **no plan may be open while it still advertises a `"planned"`
   row.** Flip `planAvailability.premium` to `"open"` in the commit that ships the app.
2. **Table reservation — link out.** No table, no route, no mutation, and none is
   planned. `stores.reservationUrl` is optional; set it in Établissements →
   Informations générales and the storefront renders a « Réserver » button pointing at
   TheFork / Zenchef / Guestonline; leave it empty and no button appears, which is
   right for the many places that book by phone. The value reaches an `href`, so it is
   https-only and validated on three sides — the admin form, the mutation
   (`assertReservationUrl`, `packages/convex-functions/src/stores.ts:148,211`) and the
   storefront (`isSafeReservationUrl`). `javascript:` and `data:` both parse as valid
   URLs and both are stored XSS, which is why the check is explicit.
3. **ESC/POS printing — say what ships; cloud printing later.** See §4, Kitchen.
4. **Menus / formules — build the orderable flow, in its own PR** (#352). See §4,
   Products. Open.
5. **Square — keep it visible, marked « Bientôt ».** See §4, Payments.

---

## 7. Where the feature copy lives

If you change what the product does, these are the surfaces that make a promise and
have to change with it. A claim removed from one and left on another is worse than
leaving it everywhere.

| Surface | File | Language |
| --- | --- | --- |
| beyours.fr feature pages | `apps/site/components/features/features-data.ts` | French — customer-facing, do not translate |
| beyours.fr pricing, comparison table, FAQ | `apps/site/components/pricing/pricing-data.ts` | French |
| Plan availability (the gate both of the above read) | `apps/site/convex/planAvailability.ts` | — |
| Admin navigation — what an owner can reach | `packages/admin/src/config/nav-config.ts` | French labels |
| Admin routes — the single source of truth | `packages/admin/src/config/admin-routes.ts` | — |
| Onboarding tour — auto-launches on first login, for every new owner | `packages/admin/src/components/onboarding/tour-steps.ts` | French |
| Sales demos a prospect browses | `apps/themes/demos/` | French |
| Package registry read by editors and agents | `packages/mcp-server/src/registry.ts` | English |
| Feature guides | `apps/docs/guides/` (12 files) | English |

Two of those carry known defects worth knowing before you trust them:

- [`apps/docs/guides/payments.md`](apps/docs/guides/payments.md) opens with a warning
  that **every one of its code samples is module-not-found** — `packages/core/src` has
  no `payments/` directory. Read the source, not the guide.
- `packages/mcp-server/src/registry.ts` is a hand-maintained index of the engine's
  exports that nothing verifies. It advertised `uploadToS3` and a top-level
  `sendEmail` — one that never existed, one that is a method on the SES service —
  until 5 Sep 2026. See
  [`ARCHITECTURE.md`](ARCHITECTURE.md#10-the-real-shape-of-the-shared-services) for
  the real surfaces.
