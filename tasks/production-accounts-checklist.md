# Accounts to create under `developers@beyours.fr` before production

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


Every third-party account the product depends on must be owned by
**`developers@beyours.fr`**, not by a personal address. Compiled from the
environment variables the code actually reads (`_project/ENVIRONMENT_VARIABLES.md`,
the six `.env.example` templates) plus `apps/site/MISE_EN_PROD.md` and
`apps/reference/MISE_EN_PROD.md`.

> **Prerequisite:** the mailbox `developers@beyours.fr` itself has to exist and be
> reachable before anything below — every signup sends a verification mail, and
> several providers also send the account-recovery codes there.

---

## 0. Two problems to settle first

**Settled — and then reversed.** On 2026-08-16 the decision was to leave
production on team `momoseck8` / project `wedilybird` and not move it. **On
2026-09-01 it was moved anyway**, by *transfer* rather than migration, so URLs,
env vars and data are unchanged and only the owning team differs.

Current state, measured on 2026-09-01: production runs on team **`be-yours`** —
`famous-wildcat-229` (beyours.fr) and `optimistic-swordfish-937` (the engine).
What is left on `momoseck8` serves nothing. The paragraph above is kept because
`.env.production.example` and several older documents still name
`fearless-poodle-133`, and someone will find them.

One consequence survives the move, pointing at a different team; the other is
largely resolved by it:

> ⚠️ **Convex spending caps apply per team.** A cap set too low on **`be-yours`**
> disables every project on that team, production included. That is now the team
> to keep funded. A healthy cap on `momoseck8` proves nothing about production.

> ✅ **Account recovery** was the reason for the move. The owner of `be-yours` is
> the dedicated account, not a personal one. Still ensure a second Admin — not a
> Developer, who cannot raise the limit — can reach it.

Both are procedure, not code: **`convex-spending-cap-runbook.md`** carries the
steps, the blast radius, and the sign-off. Read it before ticking the Convex line
in the checklist below — in particular, whether a cap even exists to set depends
on the team's plan, and a limit of `$0` is a tripwire rather than a safety.

**Two brands, two addresses.** BeYours is the product, BeInDigital is the agency.
Some existing accounts are on `hello@beindigital.fr` (the ClickUp workspace, for
one). Decide per service which brand owns it before creating duplicates.

---

## 1. Platform & infrastructure

| Service | Used for | Env vars | Notes |
|---|---|---|---|
| **GitHub** | org `be-in-digital`, private Packages `@be-in-digital/*` | `NODE_AUTH_TOKEN` | Needs a `read:packages` PAT. Actions budget must stay funded — it hit zero on 2026-08-16 and every workflow died. |
| **Convex** | backend, 1 deployment per client + `apps/site` | `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_SITE_URL` | See §0. |
| **Vercel** | `beyours.fr` + 1 project per client | — | |
| **AWS** | S3 (uploads) + SES (transactional email) — **one account per client**, see [`aws-ownership.md`](../apps/docs/deployment/aws-ownership.md) | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET_NAME`, `AWS_SES_*` | SES starts **in sandbox** (eu-west-3) and production access is granted **per account** — one request per client, reviewed by hand, and **already refused once** on the BeYours account. Sequence it early: a refusal leaves a client site unable to email at all, since only `apps/site` has a Resend fallback. Check where a request stands with `DOMAIN=<domain> pnpm ses:check`. Procedure: [`client-aws-onboarding-runbook.md`](./client-aws-onboarding-runbook.md). |
| **Domain / DNS** | `beyours.fr` | — | Also carries the SES / Resend domain-verification records. |

## 2. Payments

| Service | Used for | Env vars |
|---|---|---|
| **Stripe** | three surfaces, three deployments — see below | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_TAX_ENABLED`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_PRICE_*`, `STRIPE_FOUNDERS_COUPON_ID`, `STRIPE_PRODUCT_CREATION_*`, `STRIPE_BID_SECRET_KEY`, `STRIPE_BID_WEBHOOK_SECRET`, `STRIPE_BID_PRICE_*` |
| **PayPal** | alternative payment | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` |
| **SumUp** | alternative payment | `SUMUP_CLIENT_ID`, `SUMUP_CLIENT_SECRET` |
| **Square** | alternative payment | `SQUARE_ACCESS_TOKEN` |

**The three Stripe surfaces** (corrected 2026-09-03 — this row named two, and
omitted the one that gates the first sale):

| Surface | Deployment | Variables |
|---|---|---|
| **beyours.fr selling the product** — creation + maintenance checkout, founders offer | `famous-wildcat-229` (`apps/site`) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_TAX_ENABLED`, the four `STRIPE_PRICE_*`, `STRIPE_FOUNDERS_COUPON_ID`, `STRIPE_PRODUCT_CREATION_{ESSENTIELLE,PREMIUM}` |
| **BeYours billing the restaurateur** — auto-blog plans, maintenance renewal | `optimistic-swordfish-937` (`apps/reference`), and each client instance | `STRIPE_BID_SECRET_KEY`, `STRIPE_BID_WEBHOOK_SECRET`, the six `STRIPE_BID_PRICE_*` plan prices, `STRIPE_BID_PRICE_MAINTENANCE`, `BID_APP_URL` |
| **The restaurant taking customer payments** | each client instance (`apps/themes`) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |

`STRIPE_SECRET_KEY` therefore names **two different accounts** depending on the
deployment: BeYours' own on `famous-wildcat-229`, the restaurant's on a client
instance. Do not copy one to the other.

> `STRIPE_PUBLISHABLE_KEY` was listed here and has been removed: **no line of
> the product reads it.** It is declared optional in
> `packages/core/src/env/schemas.ts:197` and shown by the themes setup wizard,
> and the schema says so itself at `:248`. Create the key if a future client
> integration needs it, but nothing today gates on it.

> Stripe live mode is gated on the legal/invoicing work in
> `apps/site/MISE_EN_PROD.md` §2-3 (compliant invoicing, VAT regime).
> The console steps for the founders coupon and the four maintenance Prices —
> the blocker on the first Essentielle sale — are in
> [`stripe-founders-offer-runbook.md`](./stripe-founders-offer-runbook.md).

## 3. Delivery platforms

| Service | Used for | Env vars | Status |
|---|---|---|---|
| **Uber Eats** | partner app **"BeYours POS"** | `UBER_EATS_CLIENT_ID`, `UBER_EATS_CLIENT_SECRET`, `UBER_EATS_WEBHOOK_SECRET` | Prod client ID already issued — **confirm which account owns it**. |
| **Deliveroo** | partner app | `DELIVEROO_CLIENT_ID`, `DELIVEROO_CLIENT_SECRET`, `DELIVEROO_WEBHOOK_SECRET` | Sandbox secret is **compromised** (still in git history) — rotate, see `secret-rotation-runbook.md`. |
| **Uber Direct** | delivery-as-a-service | `UBER_DIRECT_CUSTOMER_ID` | |

## 4. Commercial site (`apps/site`)

| Service | Used for | Env vars |
|---|---|---|
| **Yousign** | electronic signature of the affiliate contracts | — (see `PROCESS_DE_VENTE.md`) |
| **Calendly** | demo booking, linked from `/checkout/success` | `CALENDLY_URL` |
| **Resend** | email provider for the commercial site — the SES sandbox exit **was refused**, so this is the plan of record for `beyours.fr`, not a contingency. Implemented in `apps/site/convex/email/providers.ts`; client sites cannot use it | `EMAIL_PROVIDER`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |

## 5. Content & AI

| Service | Used for | Env vars |
|---|---|---|
| **OpenAI** | GPT translations (~$0.001/product) + auto-blog | `OPENAI_API_KEY` |
| **Unsplash** | CMS media library | `UNSPLASH_ACCESS_KEY` |

## 6. Monitoring & maps

| Service | Used for | Env vars |
|---|---|---|
| **Sentry** | error tracking — **one project per client**, under the client's own account | `NEXT_PUBLIC_SENTRY_DSN`, and optionally `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` for source maps |
| **Google Cloud** (Maps Platform) | address autocomplete | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — restrict it by HTTP referrer and to the two APIs the loader asks for, then verify: `bash scripts/wizards/github-e2e-maps-bootstrap.sh --section 2 --check` |

---

## Ownership rule

Per `_project/ENVIRONMENT_VARIABLES.md`, credentials split in two:

- **Package level — BeYours owns them, shared across every client:** OpenAI,
  Uber Eats, Deliveroo. These are the ones that must sit under
  `developers@beyours.fr`.
- **Site level — the restaurant owns them, one per client:** its Convex instance,
  its **AWS account** (S3 bucket + SES sender), its Stripe/PayPal/SumUp account,
  its Sentry project, its Google Maps key. Do **not** create these under
  `developers@beyours.fr` — they belong to the client and follow the client if
  they leave.

> **AWS moved from package level to site level on 2026-08-28**, and the code
> follows: the credentials are site variables, and `setup-aws.sh` provisions per
> client (`SITE_SLUG=<slug> DOMAIN=<domain>`). Read
> [`apps/docs/deployment/aws-ownership.md`](../apps/docs/deployment/aws-ownership.md)
> before provisioning. Two things it does **not** do: clients already on the
> shared bucket still have to be migrated, and SES production access is granted
> per account, so each new client needs its own request — start it early.

Unsplash, Yousign, Calendly, Resend, Vercel and GitHub are BeYours-level too:
they serve the commercial site and the fleet, not one restaurant.

---

## Checklist

- [ ] `developers@beyours.fr` mailbox exists and is monitored
- [ ] Decide BeYours vs BeInDigital ownership per service (§0)
- [ ] Convex: transferred to team `be-yours` (2026-09-01) — spending cap **on `be-yours`** funded, and a second Admin able to reach the account (`convex-spending-cap-runbook.md`)
- [ ] GitHub: PAT `read:packages` issued; Actions budget funded
- [ ] Vercel account + `beyours.fr` domain
- [ ] AWS: **one account per client** — follow [`client-aws-onboarding-runbook.md`](./client-aws-onboarding-runbook.md), and **start it on day one**: the SES sandbox exit is one AWS review per account and gates every customer email
- [ ] Stripe live (both flows), gated on the invoicing/VAT work
- [ ] PayPal / SumUp / Square, if the offer includes them
- [ ] Uber Eats — confirm ownership of the existing prod app
- [ ] Deliveroo — account + **secret rotated**
- [ ] Uber Direct
- [ ] Yousign · Calendly · Resend
- [ ] OpenAI · Unsplash
- [ ] Sentry (1 projet par client — [`apps/docs/deployment/sentry.md`](../apps/docs/deployment/sentry.md)) · Google Maps Platform
- [ ] Every credential stored in the secret store, never in the repo
