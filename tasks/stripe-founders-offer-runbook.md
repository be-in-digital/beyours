# Runbook — Stripe founders coupon & the four maintenance Prices (`apps/site`)

> Closes the engineering half of **LAUNCH-02** (issue #173). The other half is a
> Stripe Dashboard action only the account owner can perform — this file tells
> them exactly what to create, with which values, and how to prove it worked.
> It contains **no credential** and no Stripe id.

## Why this card exists

Until these six objects exist in the live Stripe account and their ids are set
on the site's Convex deployment, **the first Essentielle sale is refused by the
code** — deliberately.

Two independent guards, both of which fire *before* the customer is charged:

| Guard | Where | Refuses when |
|---|---|---|
| `resolveFoundersPricing` | [`convex/foundersOffer.ts:55-88`](../apps/site/convex/foundersOffer.ts) | `STRIPE_FOUNDERS_COUPON_ID` **or** `STRIPE_PRODUCT_CREATION_ESSENTIELLE` unset, on a deployment with a Stripe key |
| `resolveMaintenancePriceId` | [`convex/stripe.ts:36-55`](../apps/site/convex/stripe.ts) | any one of the four `STRIPE_PRICE_*` unset |

Neither is a bug to route around. The founders guard refuses because nothing
else caps the offer: past the tenth seat, each build ships for 3 500 € excl.
tax. The maintenance guard refuses because `createSubscription` resolves the
same Price ID again *after* payment ([`stripe.ts:462`](../apps/site/convex/stripe.ts))
— unset, the customer is debited and never provisioned. Both are covered by 13
tests in `apps/site/tests/convex/foundersOffer.test.ts`, run with
`pnpm --filter @beyours/site test`.

The order is created at [`stripe.ts:243`](../apps/site/convex/stripe.ts), and
both guards run above it — a refusal leaves nothing behind to clean up.

---

## 0. Prerequisites

- Access to the **live** Stripe account as an owner or admin.
- Stripe Tax enabled on that account, with a French registration —
  [`stripe.ts:99-110`](../apps/site/convex/stripe.ts) requires
  `STRIPE_TAX_ENABLED="true"` because the company is on the régime réel, and
  `createCheckoutSession` throws `[TVA] …` rather than invoice a VAT position
  the company does not hold.
- Convex CLI access to the site's **production** deployment.

> **Which live account?** The repository names only the sandbox —
> **Be Yours · sandbox** (`acct_1TzapYA63ZMDexsm`), in
> [`webhook-migration-checklist.md:196`](./webhook-migration-checklist.md).
> The live account id is written down nowhere in this repo. Confirm it from the
> Stripe Dashboard before creating anything, and record it there rather than
> here.

---

## 1. Where the resulting ids go

All six variables are read by Convex actions only — no line of the Next server
reads any of them, so **none of them belongs on Vercel**.

| | |
|---|---|
| Deployment | **`famous-wildcat-229`** |
| Convex project | `beyours-commercial-site` |
| Team | `be-yours` |
| App | `apps/site` (beyours.fr) |

Source: [README → Convex deployments](../README.md#convex-deployments),
re-measured 2026-09-01. Do **not** use `fearless-poodle-133` — that is the
former production deployment, still answering `200`, and named in several older
documents. It serves nothing.

```bash
cd apps/site
pnpx convex env list --prod   # FIRST: read what it prints
```

`--prod` resolves through the local `CONVEX_DEPLOYMENT`, so it targets whichever
project *this checkout* is linked to. Read the output and confirm it says
`famous-wildcat-229` before setting anything — a checkout linked elsewhere
writes your live Stripe ids into a dev backend without complaining.

---

## 2. The creation Products

Two persistent Products. They exist so the founders coupon can be restricted to
the creation line: `applies_to` cannot target a product built on the fly with
`product_data`, and without the restriction Stripe spreads the discount pro rata
across *every* line of the session — the right total, the wrong split between an
amortizable investment and a deductible charge on the customer's invoice
([`stripe.ts:57-64`](../apps/site/convex/stripe.ts)).

| Product | Env var | Required for |
|---|---|---|
| BeYours — Essentielle — Création | `STRIPE_PRODUCT_CREATION_ESSENTIELLE` | **the founders offer** (blocking) |
| BeYours — Premium — Création | `STRIPE_PRODUCT_CREATION_PREMIUM` | targeted referral discounts only |

Only the Essentielle one blocks a sale: the offer is Essentielle-only
([`foundersOffer.ts:14`](../apps/site/convex/foundersOffer.ts)). Create both
anyway — unset, the Premium referral coupon spreads over maintenance the same
way ([`stripe.ts:331-333`](../apps/site/convex/stripe.ts)).

Create them as **Products with no default price**. The creation line's amount is
sent per session from `planPrices`, not read from Stripe
([`stripe.ts:379-399`](../apps/site/convex/stripe.ts)) — a price attached here
is ignored. The name and description shown to the customer come from the Stripe
catalogue once the product is set, so write them for a customer to read.

The env var receives the **product** id (`prod_…`), not a price id.

---

## 3. The founders coupon

One coupon, reused across every founders session
([`stripe.ts:314-321`](../apps/site/convex/stripe.ts)). That shared redemption
count is the cap — Stripe keeps the ledger, the Convex counter only reads a
snapshot.

| Field | Value | Derived from |
|---|---|---|
| `max_redemptions` | **10** | `foundersOffer.totalSlots` — [`foundersOffer.ts:15`](../apps/site/convex/foundersOffer.ts) |
| `applies_to.products` | the **Essentielle creation product** from §2 | [`foundersOffer.ts:67-71`](../apps/site/convex/foundersOffer.ts) |
| `percent_off` | **100** | the creation is offered outright: `creationCents: 0` — [`foundersOffer.ts:16`](../apps/site/convex/foundersOffer.ts) |
| `duration` | `once` | the in-repo precedent, the referral coupon — [`stripe.ts:326`](../apps/site/convex/stripe.ts) |
| `redeem_by` | **leave unset** | "It ends when the slots run out, never on a date" — [`foundersOffer.ts:5`](../apps/site/convex/foundersOffer.ts) |
| `currency` | not needed with `percent_off` | — |

**On `percent_off: 100` vs `amount_off: 350000`.** The repo does not state which
form the coupon takes, so this is a choice, not a value read out of the code.
Both zero the creation line today, and both make the session total agree with
the `amountCents` the order records
([`stripe.ts:234`](../apps/site/convex/stripe.ts), which books the discount as
the full `prices.creation`). `percent_off: 100` is recommended because it stays
correct if `planPrices.essentielle.creation` ever changes; a fixed `amount_off`
would silently leave a remainder on the creation line. If you prefer
`amount_off`, it must be **350000** cents with `currency: eur`
([`planPrices.ts:16`](../apps/site/convex/planPrices.ts)) — and it then has to
be recreated whenever that constant moves.

The resulting coupon id goes into `STRIPE_FOUNDERS_COUPON_ID`.

> **What `max_redemptions` does and does not do.** Stripe counts a redemption
> when the discount is actually applied to a completed payment, so it is the
> backstop, not the turnstile. The front-line cap is `countFoundersSold`, which
> holds a seat for an unpaid checkout for 24 h
> ([`foundersOffer.ts:25`](../apps/site/convex/foundersOffer.ts)). The two are
> meant to be used together; neither is sufficient alone, which is exactly why
> the guard refuses when the coupon is missing.

---

## 4. The four maintenance Prices

These bill the **renewal**, not the first period. The first month or year is
charged inline on the Checkout session from `planPrices`
([`stripe.ts:400-411`](../apps/site/convex/stripe.ts)); the subscription is then
created with a `trial_end` of +30 or +365 days
([`stripe.ts:466-489`](../apps/site/convex/stripe.ts)), so the recurring Price
takes over from the second period onward.

| Env var | Interval | Currency | Amount (excl. tax) | Cents |
|---|---|---|---|---|
| `STRIPE_PRICE_ESSENTIELLE_MONTHLY` | `month` | `eur` | 100,00 € | `10000` |
| `STRIPE_PRICE_ESSENTIELLE_YEARLY` | `year` | `eur` | 1 000,00 € | `100000` |
| `STRIPE_PRICE_PREMIUM_MONTHLY` | `month` | `eur` | 200,00 € | `20000` |
| `STRIPE_PRICE_PREMIUM_YEARLY` | `year` | `eur` | 2 000,00 € | `200000` |

Amounts from [`planPrices.ts:14-24`](../apps/site/convex/planPrices.ts), the
declared single source of truth. Currency from
[`stripe.ts:380`](../apps/site/convex/stripe.ts). Interval from the `trial_end`
arithmetic cited above.

**No code asserts that the recurring Price matches `planPrices`.** Nothing
compares them at any point — a Price created at the wrong amount produces a
customer who pays one figure for the first period and another forever after,
and no test or guard in this repo notices. Set them by hand against the table
above, and read them back in §6.

Two required settings, both of which are decisions the code has already made:

- **`tax_behavior: exclusive`** on every one of the four.
  [`stripe.ts:104`](../apps/site/convex/stripe.ts) names this as a prerequisite
  of `STRIPE_TAX_ENABLED`, and the checkout sends its own lines as `exclusive`
  ([`stripe.ts:350-352`](../apps/site/convex/stripe.ts)). A Price left on
  `inclusive` bills the renewal VAT-inside while the first period was billed
  VAT-on-top.
- **Attach them to a Product that is *not* either creation Product from §2.**
  The founders coupon is restricted to the creation product by `applies_to`; a
  maintenance Price hanging off that same product would be zeroed by the coupon
  too. Create separate maintenance Products (one per plan is the natural
  split — the repo does not prescribe it).

Set all four or none: `apps/site/lib/env.ts:102-107` treats them as one
all-or-nothing group, and `resolveMaintenancePriceId` throws on whichever one it
reaches first.

---

## 5. Setting the variables

```bash
cd apps/site
pnpx convex env list --prod          # confirm famous-wildcat-229 (see §1)

pnpx convex env set STRIPE_PRODUCT_CREATION_ESSENTIELLE "prod_..." --prod
pnpx convex env set STRIPE_PRODUCT_CREATION_PREMIUM     "prod_..." --prod
pnpx convex env set STRIPE_FOUNDERS_COUPON_ID           "..."      --prod

pnpx convex env set STRIPE_PRICE_ESSENTIELLE_MONTHLY "price_..." --prod
pnpx convex env set STRIPE_PRICE_ESSENTIELLE_YEARLY  "price_..." --prod
pnpx convex env set STRIPE_PRICE_PREMIUM_MONTHLY     "price_..." --prod
pnpx convex env set STRIPE_PRICE_PREMIUM_YEARLY      "price_..." --prod
```

A coupon id is whatever Stripe assigned — it is not prefixed like the others,
and may be a short code if one was chosen at creation.

These are not the only Stripe variables that deployment needs; the full
read-by-code list is in `apps/site/.env.example` and in the site README's
environment section.

---

## 6. Verification

**6a — the ids are on the right deployment.** From `apps/site`:

```bash
pnpx convex env list --prod | grep -E 'STRIPE_(PRICE|PRODUCT_CREATION|FOUNDERS)'
```

Seven lines, no blanks. Fewer than seven means a guard will still fire.

**6b — the objects are what you think they are.** Read each id back from Stripe
rather than trusting the paste. With the live key:

```bash
stripe prices retrieve price_...  --live   # unit_amount, currency, recurring.interval, tax_behavior
stripe coupons retrieve <coupon>  --live   # percent_off, max_redemptions, times_redeemed, applies_to
```

Check against §3 and §4 field by field. `times_redeemed` must be `0` before the
first sale — a non-zero count means seats were already spent, and only
`max_redemptions − times_redeemed` remain.

For the four maintenance Prices that comparison is now automated. From
`apps/site`, against the deployment that sells:

```bash
pnpx convex run stripeAudit:run --prod
```

It reads each of the four ids back from Stripe and compares them to
`planPrices` — amount, currency, `tax_behavior`, interval, `interval_count`,
`active`, whether the Price hangs off a creation Product, and whether the object
is live or test. `findings: []` means the four objects match what the code
charges. Anything else names the variable, the Price id and the field.

It does **not** audit the coupon: `max_redemptions`, `applies_to` and
`times_redeemed` are still the manual read-back above, and §6c is what actually
proves `applies_to`.

**6c — the guards no longer fire.** This is the only step that proves the thing
the card is about. Open a real Essentielle checkout on beyours.fr and stop at
the Stripe page *without paying*:

- The session must open at all. A `FoundersOfferUnavailableError` or a
  `STRIPE_PRICE_… manquant en env` means §5 did not take.
- The Stripe page must show **two lines** — creation and maintenance — with the
  creation line discounted to **0,00 €**, and a total equal to the maintenance
  line plus VAT.
- If the creation line is *not* zero but the total is right, `applies_to` is
  wrong: the discount is spreading across both lines. Fix the coupon, do not
  ship it.

Abandon the session. An unpaid checkout holds a founders seat for 24 h
([`foundersOffer.ts:19-25`](../apps/site/convex/foundersOffer.ts)) and then
returns it — so this costs one seat for a day, and nothing permanently.

**6d — the renewal actually bills.** Not provable without a completed sale.
`createSubscription` runs from the `checkout.session.completed` webhook, and the
recurring Price is only exercised when the trial ends 30 or 365 days later.
Until one real order has been through it, the four Prices are verified as
*objects* (6b) and not as *behaviour*. Say so rather than signing that line off.

---

## 7. What is still not covered

Stated plainly, because a check that looks like coverage and is not is worse
than no check at all.

| | Detected today? | By what |
|---|---|---|
| A `STRIPE_PRICE_*` / coupon / creation product missing | **Yes** — the sale is refused before payment, loudly | the guards in `stripe.ts` / `foundersOffer.ts` |
| Half the founders pair set (coupon without product, or the reverse) | **Only where Next sees the variables** † | `validateSiteEnv` — feature group « Offre fondateurs » |
| One creation Product set without the other | **Only where Next sees the variables** † | `validateSiteEnv` — feature group « Produits de création Stripe » |
| A Price id pasted into a Product variable, or the reverse | **Only where Next sees the variables** † | `validateSiteEnv` — `prod_` / `price_` prefix checks |
| A maintenance Price created at the **wrong amount** | **Yes, on demand** | `stripeAudit:run`, against `planPrices` |
| A maintenance Price on the wrong `tax_behavior` or currency | **Yes, on demand** | `stripeAudit:run` |
| A maintenance Price on the wrong interval, or archived | **Yes, on demand** | `stripeAudit:run` |
| A maintenance Price attached to the creation product | **Yes, on demand** | `stripeAudit:run` |
| The ids pointing at **test-mode** objects under a live key | **Yes, on demand** | `stripeAudit:run` — `livemode`, and «&nbsp;no such Price&nbsp;» |

**†** — and on the deployment that sells, it does **not**. These variables live
on the Convex deployment, not in the Next process env, so `validateSiteEnv`
never sees them there and none of those three rows fires in production. They
catch a bad local `.env.local`, and nothing else. `pnpx convex env list --prod`
(§6a) is the only thing that covers the deployment. Read those three rows as
"caught in dev", not as "caught".

What « on demand » and « in dev only » cost, stated plainly rather than counted
as coverage:

- **Nothing runs the audit for you.** CI holds no live Stripe key, so it cannot.
  A Price edited in the Dashboard the day after `stripeAudit:run` came back clean
  is undetected until someone runs it again. Run it after any change to Stripe
  billing objects, and before a go-live.
- **The coupon is not audited.** `max_redemptions`, `applies_to` and
  `times_redeemed` are read back by hand (§6b) and proven only by §6c. A coupon
  whose `applies_to` points at the wrong Product still costs a free build.
- **The renewal billing behaviour is still unproven** until one real order has
  been through it — §6d, unchanged. The audit verifies the Prices as *objects*,
  not the subscription that will be raised against them.
- `validateSiteEnv` sees only the **Next** process env. In production these
  variables live on the Convex deployment, so its founders checks fire in local
  dev and in any environment where `.env.local` carries them — not on Vercel.
  `pnpx convex env list --prod` (§6a) is what covers the deployment.

---

## 8. Sign-off

- [ ] Live Stripe account id confirmed from the Dashboard and recorded in the password manager
- [ ] Stripe Tax enabled, FR registration present, `STRIPE_TAX_ENABLED="true"` on `famous-wildcat-229`
- [ ] Two creation Products created, no default price
- [ ] Founders coupon created: `max_redemptions: 10`, `applies_to` the Essentielle creation product, no `redeem_by`
- [ ] Four maintenance Prices created: correct interval, `eur`, amounts per §4, `tax_behavior: exclusive`
- [ ] Maintenance Prices attached to Products **other than** the creation Products
- [ ] Seven variables set on `famous-wildcat-229`, confirmed by §6a
- [ ] Each id read back from Stripe and checked field by field (§6b)
- [ ] `times_redeemed` is `0`
- [ ] A live checkout opens and shows the creation line at 0,00 € (§6c)
- [ ] Renewal billing **not** signed off — pending the first real order (§6d)

---

*Related: `production-checklist.md` (the engine's `STRIPE_BID_*`, a different
Stripe surface), `production-accounts-checklist.md` §2, `apps/site/MISE_EN_PROD.md`
§2-3 (the legal and VAT prerequisites gating live mode),
`apps/site/.env.example` (the full read-by-code variable list).*
