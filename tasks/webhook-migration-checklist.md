# Checklist — every URL a third party holds on us

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


> Compiled from the routers, not from memory: `apps/site/convex/http.ts`,
> `apps/reference/convex/http.ts`, `apps/themes/convex/http.ts` and every
> `app/api/**/route.ts`. Read it before the Convex cutover
> ([`convex-account-cutover-runbook.md`](./convex-account-cutover-runbook.md)),
> whose §3 covers only part of this list.

**Nothing here has been done.** Every entry lives in a third-party console.

**A provider left on an old URL fails silently** — it posts into the void and we
see nothing. The only exceptions are the OAuth redirect URIs, which fail loudly
at the *start* of the flow.

## Two things that decide the size of the job

**Every registered inbound URL is on a `*.convex.site` host. None is on Vercel.**
So this list is governed entirely by the Convex deployment, not the public
domain. The three `app/api/webhooks/*` files in `apps/themes` are **410
tombstones**, not handlers — they answer *"Update your webhook URL to
CONVEX_SITE_URL/webhooks/stripe"*. Leave them; they catch stragglers.

**The engine's endpoints are per client.** `apps/reference/convex/http.ts` and
`apps/themes/convex/http.ts` are byte-identical, and each restaurant runs its own
deployment. The engine table below is *fourteen endpoints per client site*, each
needing re-registration in three separate partner portals. Only the commercial
site's two are singular.

## Hosts

Corrected 5 Sep 2026 to agree with the banner at the top of this file, which it
contradicted — the table below was read on its own and cost an hour. The
cutover happened as a **transfer**, so the site's host never changed; the
"after the cutover" column was a plan, not an outcome.

| | Host today | Formerly, and still answering |
|---|---|---|
| Commercial site (`apps/site`) | `https://famous-wildcat-229.convex.site` | `fearless-poodle-133` — serves nothing |
| Engine (`apps/reference`) | `https://optimistic-swordfish-937.convex.site` | `robust-elephant-263` — serves nothing |
| A client site | its own `<deployment>.convex.site` | unchanged unless that client moves |

`dusty-nightingale-945` is an empty, unused project — it is the one name here
that answers `404`. Authoritative inventory: `README.md` → **Convex
deployments**.

---

## 1. Commercial site — `apps/site`, 2 endpoints

| Service | Path | Verified with |
|---|---|---|
| **Stripe — BeYours commercial account** | `/webhooks/stripe` | `STRIPE_WEBHOOK_SECRET`, hand-rolled HMAC with a 5-minute tolerance (`http.ts:24-58`) |

The 8 events this route actually switches on — register these and no others:
`checkout.session.completed`, `invoice.payment_succeeded`,
`invoice.payment_failed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `account.updated`, `charge.refunded`,
`charge.dispute.created`.

> **Inventory drift found while doing this.** The Stripe account already carried
> an endpoint at `https://hallowed-schnauzer-20.convex.site/webhooks/stripe`
> ("Convex dev — test mode", same 8 events, enabled). `hallowed-schnauzer-20` is
> a **seventh** Convex deployment, in none of the six rows of
> [README → Convex deployments](../README.md#convex-deployments). Someone's dev
> backend. Harmless, but it means the inventory is not closed.
| *(not a webhook)* licence check | `/maintenance/status` | query string `?key=` |

> **`STRIPE_WEBHOOK_SECRET` names two different endpoints on two different
> deployments, in two different Stripe accounts** — BeYours selling templates
> here, the restaurant taking customer payments on the engine. Do not copy one
> value into the other.

> ⚠️ **`/maintenance/status` is called by every client site we have ever
> shipped**, not by a provider. `scripts/init.mjs:264` writes the host into each
> site's `.beindigital-site.json` as `licenseApi`, and
> `scripts/lib/maintenance.mjs:49` reads it back before `update:engine`. Move
> this deployment and every deployed client points at a dead URL. It **fails
> open**, so updates keep working and the entitlement check just stops
> enforcing — silently. It cannot be fixed remotely: either edit each client's
> sentinel file, or keep the old deployment answering.

## 2. Engine / client sites — 14 endpoints, **per client**

| Service | Path | Verified with |
|---|---|---|
| **Uber Eats** | `/webhooks/uber-eats` | `UBER_EATS_WEBHOOK_SECRET` → falls back to `UBER_EATS_CLIENT_SECRET`; header `x-uber-signature` |
| **Uber Direct** | `/webhooks/uber-direct` | `UBER_DIRECT_WEBHOOK_SECRET` → `UBER_EATS_WEBHOOK_SECRET` → `UBER_EATS_CLIENT_SECRET`; 503 if none |
| **Deliveroo** | `/webhooks/deliveroo` | `DELIVEROO_WEBHOOK_SECRET` → `DELIVEROO_CLIENT_SECRET`; `x-deliveroo-hmac-sha256` |
| **Deliveroo** — orders | `/webhooks/deliveroo/order` | same |
| **Deliveroo** — menu | `/webhooks/deliveroo/menu` | same |
| **Stripe — restaurant payments** | `/webhooks/stripe` | `STRIPE_WEBHOOK_SECRET` |
| **Stripe — BeYours billing** | `/webhooks/stripe-bid` | `STRIPE_BID_WEBHOOK_SECRET` |
| **AWS SNS** (SES bounces + complaints) | `/webhooks/ses` | see the warning below |
| **Uber Eats** — OAuth return | `/connect/uber-eats/callback` | CSRF `state` |
| **SumUp** — OAuth return | `/connect/sumup/callback` | OAuth `code` exchange |
| **Stripe Connect** — return | `/connect/stripe/callback` | status re-checked via `GET /v1/accounts/{id}` |

> ⚠️ **`account.updated` for affiliates is on the wrong scope — #230.** Affiliates
> are `express` **connected accounts** (`stripeConnect.ts:56`), and Stripe
> delivers their `account.updated` only to a **Connect-scoped** endpoint
> (`connect: true`). The endpoint created in #225 is account-scoped, so the event
> sits in its list and never fires for an affiliate.
> Not silently fatal: `stripeConnect.checkAccountStatus` pulls
> `accounts.retrieve()` when the affiliate opens their dashboard, so onboarding
> completion is picked up. What is lost is the push — a later restriction or
> payout block is not learned until somebody looks, which is backwards for a
> payout gate.
> **Not fixable from a dashboard**: a second endpoint on the same URL carries a
> second `whsec_`, and `http.ts:80-91` verifies against one secret only.
| **Stripe Connect** — refresh | `/connect/stripe/refresh` | — |
| *(links already sent)* unsubscribe | `/email/unsubscribe` | — |
| *(links already sent)* double opt-in | `/email/confirm` | token |

Plus the Better Auth routes (`authComponent.registerRoutes`) — browser-only, no
third party, but `trustedOrigins` reads `SITE_URL`, so confirm sign-in still
works after the move.

**A webhook secret is per endpoint.** Recreating an endpoint at Stripe issues a
new `whsec_…`; the old value will not verify. Both Stripe flows, both secrets.

> ⚠️ **Uber's redirect URI must match byte for byte**, and we send it twice —
> once to authorize (`uberEatsOAuth.ts:70`) and once at token exchange (`:93`). A
> trailing slash on `CONVEX_SITE_URL` yields `redirect_uri_mismatch` and the
> connection cannot be established at all.

> ✅ **`/webhooks/ses` verifies the SNS signature** (`sesWebhookVerify.ts`).
> The warning that stood here — that it only checked the shape of
> `SigningCertURL`, so anyone who learnt the URL could post fake bounces — is
> fixed.
>
> ⚠️ **Two things to set when the SNS topic is (re-)subscribed**, and until they
> are, subscribing is a manual step:
>
> 1. **`SignatureVersion` must be 2** on the topic (SNS console → topic →
>    Edit → *Signature version*, or the `SignatureVersion` topic attribute).
>    Version 1 is SHA-1 and is now REFUSED — the verifier answers
>    `signature_version` and the notification is dropped. The sender picks the
>    version, so accepting both meant the weaker one was the one that counted.
>
> 2. **`SES_SNS_TOPIC_ARN` must name the topic**, on the Convex deployment
>    (`pnpm env:sync` carries it). A valid signature proves *Amazon* sent the
>    message, not that *our* topic did: every SNS topic in every AWS account is
>    signed by the same infrastructure with a certificate on the same hosts. And
>    the endpoint used to confirm any subscription whose `SubscribeURL` was on an
>    Amazon host — so a stranger could point their own topic at it and have it
>    subscribe itself, after which their forged bounces carried a genuine
>    signature.
>
>    With the variable unset the endpoint **refuses everything** — it confirms
>    no subscription and it accepts no notification — logging
>    `topic_not_configured` and the ARN it saw; paste that value in and re-send
>    the confirmation from the SNS console.
>
>    That second half is new, and it is a migration step rather than a
>    hardening one. Notifications on an already-confirmed subscription used to
>    keep working with the variable unset, on the grounds that SNS delivers
>    only where a subscription was confirmed. **Nothing requires a subscription
>    to reach an HTTPS endpoint.** An attacker publishes on a topic in their own
>    AWS account, keeps the signed JSON Amazon hands them, and POSTs it here:
>    the signature is genuine, the certificate is on an allowed host, and with
>    no list configured the topic check waved it through — after which
>    `emailHttpHandlers.ts` marks whichever subscribers the body names bounced
>    and complained. Set the ARN before the subscription is confirmed, which
>    this checklist already required, and there is nothing to migrate.
>    `SES_SNS_ALLOW_ANY_TOPIC=true` restores the old behaviour for a deployment
>    caught mid-configuration; it never lets the endpoint confirm a
>    subscription, which is the half that made a forged topic self-service.

## 3. Links already in the wild

Not registered with anyone, and they break the same way.

> ⚠️ **Unsubscribe links die on cutover.** `emailCampaignActions.ts:127` builds
> `${CONVEX_SITE_URL}/email/unsubscribe?id=…` into every marketing email. Those
> emails are **already in people's inboxes**. Move the deployment and every one
> of them 404s — a dead unsubscribe link is a compliance problem, not a cosmetic
> one. `/email/confirm` has the same shape.
>
> Same line: `CONVEX_SITE_URL` falls back to `""`, so an unset variable silently
> produces a relative path no mail client can resolve.

Keeping the old deployment alive for a retention period is the only thing that
protects these. Decide it consciously before deleting the old projects.

## 4. Services with **no** inbound URL — nothing to do

Confirmed by reading the code, so nobody re-checks them.

| Service | Why not |
|---|---|
| **PayPal** | `return_url` / `cancel_url` passed per request, never registered |
| **Sentry** | DSN outbound; no tunnel route anywhere |
| **Unsplash**, **OpenAI** | outbound only |
| **Google Maps** | browser key. *But* any HTTP-referrer restriction is keyed to the **public domain**, not the Convex host |
| **Calendly** | outbound link, and superseded by `BOOKING_URL` (bookself.app) |
| **Yousign** | **removed.** Replaced by in-app signing (`apps/site/convex/affiliateSignature.ts`); only vestigial schema fields remain |

## 4b. Resend — an inbound URL since #444

**Only for a deployment running `EMAIL_PROVIDER=resend`.** This row used to sit
in the table above reading *"outbound only; no webhook wired"*, and that was
accurate and was the defect: a Resend deployment had no feedback path at all,
so a dead mailbox was re-mailed on every campaign, a spam report was never
recorded, and the first thing anybody noticed was the sending domain being
throttled.

| Step | Where | Value |
|---|---|---|
| 1 | Resend dashboard → **Webhooks** → Add endpoint | `https://<deployment>.convex.site/webhooks/resend` |
| 2 | Subscribe it to | `email.sent`, `email.delivered`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`, `email.failed` |
| 3 | Copy the **Signing Secret** (`whsec_…`) | `npx convex env set RESEND_WEBHOOK_SECRET whsec_…` |

Set the secret on the **Convex** deployment, not the Next.js one — the handler
reads it there, the same way `/webhooks/ses` reads `SES_SNS_TOPIC_ARN`.

**While `RESEND_WEBHOOK_SECRET` is unset the route answers 401 to every
delivery.** That is deliberate and it fails closed: the body names the
subscriber to suppress, so acting on an unverified one would let anybody
suppress mail to a real customer. Svix retries a non-2xx for a day, so a secret
set within that window collects the backlog rather than losing it.

**Moving a Resend deployment** puts this endpoint in the same class as the
Convex-hosted webhooks in section 2 — the URL contains the deployment name, so
it has to be re-pointed and the secret re-set on the new deployment.

## 5. Documentation that will send someone to the wrong place

Found while compiling this. Worth correcting alongside the migration.

| File | Problem |
|---|---|
| `apps/docs/api-reference/rest-api.md:18,36,44` | documents `POST /api/webhooks/{stripe,uber-eats,deliveroo}` on the **Next.js** host. Those are 410 tombstones or do not exist |
| `apps/docs/guides/payments.md:74` | points at `app/api/webhooks/stripe/route.ts` as the handler |
| `apps/docs/packages/integrations.md:63` | `app.post("/api/webhooks/uber-eats", …)` |
| `apps/site/MISE_EN_PROD.md:56-60` | **false**: claims a Yousign webhook signature is unverified at `convex/http.ts:476`. There is no Yousign route; Yousign is gone |
| `tasks/uber-eats-go-live-runbook.md:65,69` | hard-codes `reliable-parrot-452.convex.site/connect/uber-eats/callback` — annotated 5 Sep 2026 as a dead personal dev deployment; the Uber test app still points at it |
| `tasks/clickup-technique-cards.md:225-228,313` | same Uber URL, plus a stripe-bid URL |
| ~~`apps/site/.env.production.example:37,42`~~ | **fixed** — both now name `famous-wildcat-229` (`:47`, `:51`). Verified 5 Sep 2026 |
| ~~`apps/site/scripts/check-prod-bundle.mjs:26`~~ | **fixed** — `ALLOWED_CONVEX_SUBDOMAIN` is `famous-wildcat-229`. Verified 5 Sep 2026; the row above it claimed the check would fail the cutover, and it no longer does |
| `tasks/convex-account-cutover-runbook.md` §3 | covers Stripe, Uber Eats, Deliveroo and auth origins — **omits Uber Direct, the SNS re-subscription, SumUp, and the client-fleet `licenseApi` sentinels** |

## Order

1. **Env vars on the new deployment first.** A webhook arriving where
   `STRIPE_WEBHOOK_SECRET` is unset is rejected, and Stripe records a failure
   against the endpoint.
2. Register the new URLs, **keeping the old ones live**.
3. Watch both for a cycle — Stripe shows per-endpoint delivery history, Uber and
   Deliveroo have their own logs.
4. Retire the old endpoints only once the new ones show real traffic.

## Sign-off

- [x] **Commercial site: Stripe endpoint created 2026-08-29** — ⚠️ **points at the wrong deployment since the 2026-09-01 transfer.** It was created against `dusty-nightingale-945`, which the cutover plan expected to become the site's production; the transfer kept `famous-wildcat-229` instead, and `dusty-nightingale-945` is now an empty, unused project. Everything verified below was verified there, so it says nothing about the endpoint beyours.fr actually needs. **Re-point this endpoint at `famous-wildcat-229.convex.site/webhooks/stripe` in the Stripe dashboard** (test mode, sandbox account — no live revenue depends on it, which is why this is a chore and not an incident). Original record: `we_1U9akpA63ZMDexsmVWHwZShf`, on account **Be Yours · sandbox** (`acct_1TzapYA63ZMDexsm`), test mode, the 8 events below, pointing at `dusty-nightingale-945`. `STRIPE_WEBHOOK_SECRET` pushed to that deployment. Verified: a signed `checkout.session.completed` left `pending_webhooks=0`, and an unsigned POST answers `400 Missing stripe-signature header` — the route is live and verifying. `STRIPE_SECRET_KEY` set the same day. End-to-end run observed in the deployment logs: `H(POST /webhooks/stripe)` → `stripeEvents:getByEventId` → `stripeEvents:create` → `orders:getByStripeSessionId` → `stripeEvents:markProcessed`, returning 2xx in 66 ms. The `No order found for session cs_test_…` line is correct for a synthetic `stripe trigger` event, which has no matching order — and the handler still records it processed, so Stripe does not retry. Note the key is **not** what this path needed: it runs only queries and mutations, no action. It is `convex/stripe.ts` and `convex/stripeConnect.ts` that call the Stripe API.
- [ ] Decision recorded on `/maintenance/status`: rewrite each client's sentinel, or keep the old deployment answering
- [~] **Engine test bench (`optimistic-swordfish-937`) — the two Stripe endpoints created 2026-08-29**, on the same sandbox account, test mode:
      `we_1U9bAyA63ZMDexsmp0Qupkwt` → `/webhooks/stripe`, one event (`checkout.session.completed` — the only one `stripeWebhook.ts` acts on), and
      `we_1U9bAzA63ZMDexsmcNDQi9tL` → `/webhooks/stripe-bid`, four events (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, matching the `switch` in `bidSubscription.ts:271-399`).
      Both `whsec_` pushed. Both routes answer `400 Missing stripe-signature header` to an unsigned POST, so they are live and verifying.
      **Both verified 2026-08-29** once `STRIPE_SECRET_KEY` and `STRIPE_BID_SECRET_KEY` were set: a triggered `checkout.session.completed` left `pending_webhooks=0`, and the logs show `stripeWebhookVerify:verify` and `bidSubscription:processWebhookEvent` both running to completion. The earlier `not_configured` and `STRIPE_BID_SECRET_KEY non configure` failures are gone.
      One caveat, not a wiring fault: `stripe trigger customer.subscription.deleted` still leaves `pending_webhooks=1`. The fixture builds a subscription with no `metadata.ownerId`, which `packages/convex-functions/src/bidSubscription.ts:231` refuses — correct, since a real subscription carries the id we set at creation. But note the shape: `bidStripeWebhook.ts` returns **500 on any handler error so Stripe retries**, deliberately. An event that can never be processed is therefore retried until Stripe disables the endpoint. Fine for real traffic, worth knowing before replaying old events.
      Also visible in those logs: `[Better Auth] Base URL is not set`. The deployment still has no `BETTER_AUTH_URL` / `SITE_URL`, so auth callbacks and redirects are not yet trustworthy there.
- [ ] Per client — Uber Eats, Uber Direct, Deliveroo ×3, Stripe, Stripe BID
- [ ] Per client — the four `/connect/*` redirect URIs, Uber's checked for a trailing slash
- [ ] SNS subscription for SES bounces repointed — topic on **SignatureVersion 2**,
      and `SES_SNS_TOPIC_ARN` set on the Convex deployment before confirming it
- [ ] Both Stripe secrets rotated into the deployment env, not copied between accounts
- [ ] Retention decided for the old deployment, so unsubscribe links keep resolving
- [ ] Delivery history checked on each provider before retiring the old endpoints
- [ ] The docs in §5 corrected
