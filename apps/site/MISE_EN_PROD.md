# Production launch — Be in Digital Restauration (sales site)

> **⚠️ Superseded in part, 2026-09-01 — Convex deployments.** This file names
> deployments whose roles have changed. The cutover to the dedicated account
> completed, and the site's project was **transferred** (not migrated) from team
> `momoseck8` to `be-yours`, so the deployment, its URLs, its env vars and its
> data are unchanged — only the owning team moved.
>
> What this file may still get wrong: beyours.fr runs on **`famous-wildcat-229`**
> (project `beyours-commercial-site`), never on `fearless-poodle-133`; the engine
> runs on **`optimistic-swordfish-937`**, no longer on `robust-elephant-263`.
> `dusty-nightingale-945` is an empty, unused project.
>
> The measured inventory is in the README, section **Convex deployments**. The
> reasoning below is kept as the record of what was done at the time.


What is left to do before we can **really sell and take money** on `apps/site`
(the commercial site, `@beyours/site`, deployed to beyours.fr). It was called
`web-restaurant` when this note was written and the directory has not carried
that name for a long time; corrected in #534. Its counterpart on the delivered
product side is `apps/reference/MISE_EN_PROD.md` — do not confuse the two.

Status: the commercial foundation is **~70% real** (Stripe checkout, idempotent
and signed webhooks, subscriptions, referrals + Connect payouts, founders
offer). What follows are the holes left to fill, ranked by severity.
The sales sequence itself lives in `PROCESS_DE_VENTE.md`.

Legend: 🔴 blocks opening sales · 🟠 do it soon after · 🟡 nice to have.
Every item is tagged **[decision]** (a human call) or **[build]** (to be coded) or
**[config]** (settings/account).

---

## 1. Stripe payments — switch to real money

- [ ] 🔴 **[config] Switch Stripe to Live mode**: `STRIPE_SECRET_KEY` set to
  `sk_live_…`, recreate the webhook on the prod endpoint, update `STRIPE_WEBHOOK_SECRET`.
  Today, a missing key means the order is marked `paid` with no Stripe (test mode).
- [ ] 🔴 **[config] Create the 4 maintenance Prices and set their ids**. There
  are **no hard-coded Price IDs any more** — this item used to name
  `price_1TEn…` in `convex/stripe.ts:28-33`, and that fallback is gone on
  purpose (`convex/stripe.ts:16-22`: a test Price charged with a live key fails
  *after* the payment). `convex/stripe.ts:23-28` now maps each plan/period pair
  to an env var, and `resolveMaintenancePriceId` (`:36-55`) throws when the one
  it needs is unset — before the order exists. Set all four
  `STRIPE_PRICE_{ESSENTIELLE,PREMIUM}_{MONTHLY,YEARLY}` on the Convex
  deployment, or none.
- [ ] 🔴 **[config] Create the founders coupon and the 2 creation Products**.
  `STRIPE_FOUNDERS_COUPON_ID` and `STRIPE_PRODUCT_CREATION_ESSENTIELLE` both
  unset ⇒ the **first Essentielle sale is refused**
  (`convex/foundersOffer.ts:55-88`), deliberately: without the coupon's
  `max_redemptions` nothing caps the offer, and every seat past the tenth ships
  a 3 500 € build for nothing.
  Console steps, field by field, with the amounts and the verification:
  [`tasks/stripe-founders-offer-runbook.md`](../../tasks/stripe-founders-offer-runbook.md).
- [ ] 🟠 **[build] Dunning (failed payment)**: today `invoice.payment_failed`
  leaves the invoice `open` and does nothing. Turn on Stripe retries (Smart
  Retries in the dashboard) + a chaser email to the customer. Otherwise a failed
  renewal goes unnoticed.
- [ ] 🟡 **[build] Refunds**: no refund flow at all. Add an admin action
  (cancelling a build before go-live, a goodwill gesture). Can wait for the 1st case.

## 2. Compliant invoicing (French law) — 🔴 blocks invoicing

Today the "invoice" is the PDF Stripe hosts. Legally insufficient.

- [ ] 🔴 **[decision] Entity + legal mentions**: lock down the issuing structure (SASU
  validated per the project decisions), SIRET, RCS, registered office address, capital.
- [ ] 🔴 **[build] Own-brand PDF invoice**: **sequential and unbroken**
  numbering (an FR requirement), legal mentions, breakdown of the services
  (build vs maintenance), date, customer details. Generate it when the
  `invoice.payment_succeeded` webhook arrives (the `invoicePdfUrl` field
  currently stores the Stripe PDF — replace it with our own).
- [x] 🔴 **[decision] VAT**: settled — **régime réel**, VAT at 20 % (#174).
  `VAT.regime = "reel"` in `lib/legal/company.ts` is the single source of truth,
  and every customer-facing mention (pricing footnote, CGV, legal notice,
  invoice) is read from it.
- [ ] 🔴 **[account] Turn Stripe Tax on before the first sale**: enable Stripe Tax
  in the dashboard (registered address, FR registration), set
  `tax_behavior=exclusive` on the four maintenance Prices, then
  `STRIPE_TAX_ENABLED=true` (Convex env) and `NEXT_PUBLIC_TVA_ENABLED=true`
  (Next env). Until the Next flag is set the site refuses to boot in production
  (`validateSiteEnv`, which sees only that half) — but note what that does NOT
  cover: `/checkout` and `/tarifs` are prerendered as static content and served
  from the CDN without booting a server, so the boot refusal never stands
  between those pages and a customer. What keeps them correct is
  `resolveTvaEnabled`, which resolves an unset flag to the declared regime
  rather than to "no VAT". Until the Convex flag is set
  `createCheckoutSession` refuses the sale — deliberately:
  an invoice stating a VAT position the company does not hold cannot be taken
  back, while a refused sale can be retried. Dashboard-only, so it cannot be
  done from the code.
- [ ] 🟠 **[build] E-invoicing 2026-2027**: get ahead of the Plateforme Agréée
  requirement (the pluggable adapter already exists on the web-agency side; plan
  the same one here before 09/2027).

## 3. Contracts & signing

- [ ] 🔴 **[config] YouSign in prod**: a production `YOUSIGN_API_KEY` (today it
  defaults to the sandbox `api-sandbox.yousign.app/v3`).
- [x] ~~**[build] Verify the YouSign webhook signature**~~ — **moot.** There is
  no YouSign webhook: `convex/http.ts` registers two routes, `/webhooks/stripe`
  and `/maintenance/status`, and neither is YouSign. Signing moved in-app
  (`convex/affiliateSignature.ts`); only vestigial schema fields remain. This
  line asked for HMAC verification of a route that does not exist, and carried a
  red "security hole" label while doing so.
- [ ] 🟠 **[config] `SIGNER_IP_SECRET` on both envs**: the same value on Vercel
  **and** on the Convex deployment (`openssl rand -base64 32`). It is what lets
  Convex trust the signer's IP: the address is observed by the Next server
  (`/api/signer-ip`) and HMAC'd, because a Convex action cannot see the
  request's IP at all. Unset, contracts still sign — the certificate simply
  records « Adresse IP : non établie », which is the honest answer and was NOT
  what the old code did: it printed whatever the caller sent, next to fields
  that are real evidence. Optional, therefore, but the eIDAS art. 25 trail is
  thinner without it.
- [ ] 🟠 **[host] The trusted headers are Vercel's.** `/api/signer-ip` reads the
  address only from `x-vercel-forwarded-for`, then `x-real-ip` — headers the
  Vercel edge overwrites, so a client cannot reach past it. Plain
  `x-forwarded-for` is deliberately not read: it used to be, and since the edge
  is what makes its client end trustworthy, a request that never went through
  one had its « Adresse IP constatée » row set by `curl -H`. **Nothing verifies
  at runtime that this deployment is behind that edge** — it is a claim about
  the infrastructure, recorded in ONE place,
  `TRUSTED_SIGNER_IP_HEADERS` in `lib/security/signer-attestation.ts`.
  So: on Vercel, nothing to do. **Moving to any other host, edit that list** to
  name the new edge's equivalent header, and only if that edge STRIPS the
  header on the way in — a reverse proxy that merely appends does not qualify.
  A deployment behind none of them logs
  « Aucun en-tête de confiance sur la requête » on every signature and records
  « non établie », which stays honest but loses the row.
- [ ] 🟠 **[decision] Customer contract**: YouSign signing is wired for the
  **introducers**. Decide whether the **customer engagement** (build + maintenance)
  goes through a signed contract before go-live, and wire the same flow if it does.

## 4. Sales journey — fill the gaps (detail in PROCESS_DE_VENTE.md)

- [x] ✅ **`/contact` form fixed** (2026-07-19): wired to
  `contactLeads.submit` → persists the lead + a confirmation email to the prospect +
  a notification email to the team. Leads visible in `/admin/prospects`
  (« Messages de contact » section). No longer leaking.
- [x] ✅ **Transactional emails wired** (2026-07-19): order
  confirmation (`checkout.session.completed`), renewal receipt
  (`invoice.payment_succeeded`, real renewals), dunning chaser
  (`invoice.payment_failed`), + affiliate welcome/payout. Branded system
  (`convex/email/`), best-effort SES sending (never blocks a webhook), tested
  (10 tests). **Left**: configure SES + the env vars (§7) for real sending.
- [ ] 🟠 **[build] Tracking page / mini customer portal**: a page where the customer
  finds their order, their invoice, the go-live status, and the onboarding
  resources. Today `/checkout/success` is a single Calendly button.

## 5. Provisioning & fleet (see also PROCESS_DE_VENTE.md §5)

Provisioning is **100% manual**, and **that is acceptable at the volume we target**
(≤ ~20-30 customers). Do not over-industrialize it now. Still worth doing:

- [x] 🟠 **[build] Link order → deployment** — done (#181). `saFleet.create` and
  `saFleet.update` accept an `orderId`, the « Provisionner » form lists the
  customer's paid orders, and a site delivered before this can be linked from
  its own page. It was filed as traceability; it is more than that. The
  maintenance gate resolves a site's entitlement through this link, and without
  it falls back to every subscription under the customer's email keeping the
  most favourable — so an unlinked site is entitled by its owner's healthiest
  contract rather than its own. **Left**: link the sites already delivered,
  listed on `/admin/flotte` (`tasks/license-key-registration-runbook.md`).
- [x] ✅ **Real monitoring** (2026-09-05): the loop exists. A cron
  (`convex/crons.ts`, `*/10 * * * *`) runs `saMonitoring.runProbes`, which GETs
  each `live`/`degraded` instance's site root and, when it has one, its Convex
  backend at `/instance_name` — the endpoint `npx convex network-test` itself
  uses. There is deliberately **no `/health` route**: neither `apps/themes` nor
  `apps/reference` serves one, so the root is the honest target; point
  `httpTarget()` at a real health route the day one ships. Each round records
  its checks through an `internalMutation`, then recomputes `health` (one failed
  round = degraded, two consecutive = down) and `uptime30d` (share of http
  probes over 30 days) from those rows. A deployment nobody has probed reports
  « — », not 100 %: `updateStatus` no longer promotes `health` to "healthy" on
  go-live, and every average skips deployments with no `lastCheckAt`.
  « Sonder maintenant » on `/admin/monitoring` and on a deployment page forces
  a round. Covered by `tests/convex/saMonitoring.test.ts`.
  **Left**: `integration` and `webhook` checks are still unwritten — probing a
  client's Stripe or Uber Eats needs that client's credentials, which this
  backend does not hold.
- [ ] 🟡 **[decision] Automating provisioning**: push it back until ~20-30
  customers. The manual runbook (PROCESS_DE_VENTE.md §5) is enough until then.

## 6. Legal & compliance — 🔴 mandatory before taking money

- [ ] 🔴 **[build] Legal pages missing**: no CGV, no mentions légales, no
  privacy policy on the site. All mandatory to sell in France.
  Create the 3 pages + footer links.
- [ ] 🔴 **[decision] CGV for the engagement**: term, delivery, maintenance,
  termination, ownership of the site at the end, right of withdrawal (or its
  exclusion in B2B).
- [ ] 🟠 **[build] GDPR**: state what is collected (leads, customers, game winners),
  cookies if analytics is added, retention periods.

## 7. Deploying the sales site itself

- [ ] 🔴 **[config] Convex prod + Vercel** for `web-restaurant` (the sales app),
  with every Live env var (Stripe, YouSign, AWS SES, Calendly).
- [ ] 🔴 **[config] Domain** for the marketing site (e.g. `beyours.fr`) +
  a public `/decouvrir` (the link sent to prospects).
- [ ] 🟠 **[config] Transactional emails**: the system is built and wired
  (§4). To turn it on for real, set the env vars on web-restaurant's Convex
  deployment: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
  `AWS_SES_FROM_EMAIL` (verified sender), `BID_NOTIFY_EMAIL` (team inbox for
  leads), `SITE_URL` (absolute links + logo), `CALENDLY_URL` (optional, booking
  button). Then **get SES out of the sandbox** (eu-west-3) to deliver to real customers.
- [ ] 🟡 **[config] Analytics**: wire conversion tracking (PostHog is already in
  the org) onto the pricing → checkout → payment funnel, so we can steer.
- [ ] 🟠 **[config] Email — pick a provider (SES OR Resend)**: `deliver()` is
  now multi-provider (`convex/email/providers.ts`). Default = SES (nothing
  changes). To avoid gating the launch on getting out of the AWS sandbox (already
  refused), set on the prod Convex: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`,
  `RESEND_FROM_EMAIL` (domain verified with Resend, approved within days). Customer
  instances stay on SES.

### Env cutover checklist (so bug #6 does not come back)

`NEXT_PUBLIC_*` values are **inlined at `next build`**; changing the Vercel variable
is not enough, you have to rebuild. Prod values are in `.env.production.example`.

- [ ] 🔴 **[config]** Set `NEXT_PUBLIC_CONVEX_URL=https://famous-wildcat-229.convex.cloud`
  (+ `…_CONVEX_SITE_URL`, `…_SITE_URL`) on the Vercel **Production** environment.
  This named `fearless-poodle-133` until 5 Sep 2026 — the former production,
  which still answers and serves nothing. Following it would have pointed
  beyours.fr at a dead backend. Deployment names: `README.md` → **Convex
  deployments**.
- [ ] 🔴 **[config] REBUILD WITHOUT CACHE** (Vercel → Redeploy, **uncheck** « Use
  existing Build Cache »). A plain redeploy reuses the old bundle and does NOT
  re-inline.
- [ ] 🔴 **[config]** Check the bundle actually served:
  `node scripts/check-prod-bundle.mjs https://beyours.fr` → must
  end on **✓** (exit 0).
- [ ] 🔴 **[config]** Open `/decouvrir` in a **private window** → **200** +
  live data (an endless loading state = dead Convex URL).

---

## Recommended order

1. **Stop the leak**: `/contact` form + post-payment email (§4) — cheap,
   big impact, every prospect lost is expensive at this stage.
2. **Make taking money legal**: compliant PDF invoice + legal pages +
   VAT decision (§2, §6).
3. **Switch Stripe/YouSign to Live** and check the Price IDs (§1, §3).
4. **Deploy** web-restaurant to prod + SES out of the sandbox (§7).
5. **Everything else** (customer portal, monitoring, fine-grained dunning,
   provisioning automation) as the first sales come in.

The **decisions** that fall to you (nobody else can make them):
VAT status, signed customer contract or not, the entity issuing the invoices, and
the threshold at which we automate provisioning.

---

**Version**: 1.0 · **Created**: 2026-07-19 · based on an audit of the real code.
