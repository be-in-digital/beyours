# Accounts to create under `developers@beyours.fr` before production

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

**Production stays on its current Convex team — decided 2026-08-16.**
`apps/site/.env.production.example` records the prod deployment as
`fearless-poodle-133`, on **team `momoseck8` / project `wedilybird`**. That reads
as a personal account rather than a company one, and moving it was considered.
**The decision is to leave it where it is** — do not transfer, and do not rebuild
it elsewhere. Treat this section as closed unless the owner reopens it.

Two consequences to live with, since they do not go away by themselves:

> ⚠️ **Convex spending caps apply per team.** A cap set too low on `momoseck8`
> disables **every project on that team**, production included. Whoever owns that
> team has to keep the cap funded, and know that they do.

> ⚠️ **Account recovery runs through that team's owner.** Access to the production
> backend depends on an account that is not `developers@beyours.fr`. Make sure at
> least one other person can reach it.

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
| **AWS** | S3 (uploads) + SES (transactional email) — **one account per client**, see [`aws-ownership.md`](../apps/docs/deployment/aws-ownership.md) | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET_NAME`, `AWS_SES_*` | SES starts **in sandbox** (eu-west-3) and production access is granted **per account** — so it is one request per client, and AWS's review is not instant. Sequence it early in onboarding, or the restaurant opens with silent email. |
| **Domain / DNS** | `beyours.fr` | — | Also carries the SES / Resend domain-verification records. |

## 2. Payments

| Service | Used for | Env vars |
|---|---|---|
| **Stripe** | two distinct flows: BeYours billing the restaurateur (`STRIPE_BID_*`) **and** the restaurant taking customer payments (`STRIPE_*`) | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_BID_SECRET_KEY`, `STRIPE_BID_WEBHOOK_SECRET`, `STRIPE_BID_PRICE_*`, `STRIPE_TAX_ENABLED` |
| **PayPal** | alternative payment | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` |
| **SumUp** | alternative payment | `SUMUP_CLIENT_ID`, `SUMUP_CLIENT_SECRET` |
| **Square** | alternative payment | `SQUARE_ACCESS_TOKEN` |

> Stripe live mode is gated on the legal/invoicing work in
> `apps/site/MISE_EN_PROD.md` §2-3 (compliant invoicing, VAT regime).

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
| **Resend** | fallback email provider if the SES sandbox exit is refused | `EMAIL_PROVIDER`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |

## 5. Content & AI

| Service | Used for | Env vars |
|---|---|---|
| **OpenAI** | GPT translations (~$0.001/product) + auto-blog | `OPENAI_API_KEY` |
| **Unsplash** | CMS media library | `UNSPLASH_ACCESS_KEY` |

## 6. Monitoring & maps

| Service | Used for | Env vars |
|---|---|---|
| **Sentry** | error tracking — **one project per client**, under the client's own account | `NEXT_PUBLIC_SENTRY_DSN`, and optionally `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` for source maps |
| **Google Cloud** (Maps Platform) | address autocomplete | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |

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
- [ ] Convex: **no transfer** (decided) — spending cap on team `momoseck8` funded, and a second person able to reach the account (`convex-spending-cap-runbook.md`)
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
