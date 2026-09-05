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


What is left to do before we can **really sell and take money** on `web-restaurant`
(the site that commercializes the product). Its counterpart on the delivered
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
  (`validateSiteEnv`, which sees only that half); until the Convex flag is set
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

- [ ] 🟠 **[build] Link order → deployment**: `saDeployments.orderId` exists
  but is never filled in. Pass the `orderId` through the « Provisionner » form
  so payment → instance is traceable (audit + follow-up).
- [ ] 🟡 **[build] Real monitoring**: `saMonitoringChecks` is a table with no
  meaning without a loop. Add a cron (every 5-10 min) that pings each `live`
  instance and records a check. Do it once there are several instances.
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

- [ ] 🔴 **[config]** Set `NEXT_PUBLIC_CONVEX_URL=https://fearless-poodle-133.convex.cloud`
  (+ `…_CONVEX_SITE_URL`, `…_SITE_URL`) on the Vercel **Production** environment.
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
