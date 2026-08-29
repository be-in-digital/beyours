# Checklist — every URL a third party holds on us

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

| | Today | After the cutover |
|---|---|---|
| Commercial site (`apps/site`) | `https://fearless-poodle-133.convex.site` | `https://dusty-nightingale-945.convex.site` |
| Engine (`apps/reference`) | `https://robust-elephant-263.convex.site` | `https://optimistic-swordfish-937.convex.site` |
| A client site | its own `<deployment>.convex.site` | unchanged unless that client moves |

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

> ⚠️ **`/webhooks/ses` does not verify the SNS signature.** It only checks the
> shape of `SigningCertURL` (`emailHttpHandlers.ts:178-207`), so anyone who
> learns the URL can post fake bounces and get real subscribers suppressed.
> Re-subscribing the SNS topic is the natural moment to fix it — tracked as S3-3
> in `sprint-durcissement-reference.md:766`.

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
| **Resend** | outbound only (`api.resend.com/emails`); no webhook wired |
| **Sentry** | DSN outbound; no tunnel route anywhere |
| **Unsplash**, **OpenAI** | outbound only |
| **Google Maps** | browser key. *But* any HTTP-referrer restriction is keyed to the **public domain**, not the Convex host |
| **Calendly** | outbound link, and superseded by `BOOKING_URL` (bookself.app) |
| **Yousign** | **removed.** Replaced by in-app signing (`apps/site/convex/affiliateSignature.ts`); only vestigial schema fields remain |

## 5. Documentation that will send someone to the wrong place

Found while compiling this. Worth correcting alongside the migration.

| File | Problem |
|---|---|
| `apps/docs/api-reference/rest-api.md:18,36,44` | documents `POST /api/webhooks/{stripe,uber-eats,deliveroo}` on the **Next.js** host. Those are 410 tombstones or do not exist |
| `apps/docs/guides/payments.md:74` | points at `app/api/webhooks/stripe/route.ts` as the handler |
| `apps/docs/packages/integrations.md:63` | `app.post("/api/webhooks/uber-eats", …)` |
| `apps/site/MISE_EN_PROD.md:56-60` | **false**: claims a Yousign webhook signature is unverified at `convex/http.ts:476`. There is no Yousign route; Yousign is gone |
| `tasks/uber-eats-go-live-runbook.md:65,69` | hard-codes `reliable-parrot-452.convex.site/connect/uber-eats/callback` |
| `tasks/clickup-technique-cards.md:225-228,313` | same Uber URL, plus a stripe-bid URL |
| `apps/site/.env.production.example:37,42` | the old prod host, both `.cloud` and `.site` |
| `apps/site/scripts/check-prod-bundle.mjs:26` | hard-codes `fearless-poodle-133`; **the cutover fails this check until updated** |
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

- [x] **Commercial site: Stripe endpoint created 2026-08-29** — `we_1U9akpA63ZMDexsmVWHwZShf`, on account **Be Yours · sandbox** (`acct_1TzapYA63ZMDexsm`), test mode, the 8 events below, pointing at `dusty-nightingale-945`. `STRIPE_WEBHOOK_SECRET` pushed to that deployment. Verified: a signed `checkout.session.completed` left `pending_webhooks=0`, and an unsigned POST answers `400 Missing stripe-signature header` — the route is live and verifying. `STRIPE_SECRET_KEY` set the same day. End-to-end run observed in the deployment logs: `H(POST /webhooks/stripe)` → `stripeEvents:getByEventId` → `stripeEvents:create` → `orders:getByStripeSessionId` → `stripeEvents:markProcessed`, returning 2xx in 66 ms. The `No order found for session cs_test_…` line is correct for a synthetic `stripe trigger` event, which has no matching order — and the handler still records it processed, so Stripe does not retry. Note the key is **not** what this path needed: it runs only queries and mutations, no action. It is `convex/stripe.ts` and `convex/stripeConnect.ts` that call the Stripe API.
- [ ] Decision recorded on `/maintenance/status`: rewrite each client's sentinel, or keep the old deployment answering
- [~] **Engine test bench (`optimistic-swordfish-937`) — the two Stripe endpoints created 2026-08-29**, on the same sandbox account, test mode:
      `we_1U9bAyA63ZMDexsmp0Qupkwt` → `/webhooks/stripe`, one event (`checkout.session.completed` — the only one `stripeWebhook.ts` acts on), and
      `we_1U9bAzA63ZMDexsmcNDQi9tL` → `/webhooks/stripe-bid`, four events (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, matching the `switch` in `bidSubscription.ts:271-399`).
      Both `whsec_` pushed. Both routes answer `400 Missing stripe-signature header` to an unsigned POST, so they are live and verifying.
      **⚠️ Both currently fail every real delivery** — a triggered event left `pending_webhooks=2`. The engine deployment has no `STRIPE_SECRET_KEY` (`stripeWebhookVerify.ts:20-23` returns `not_configured` → 500) and no `STRIPE_BID_SECRET_KEY` (`bidSubscription.ts:34` throws). Stripe retries and eventually disables an endpoint that never succeeds, so set both keys or disable the endpoints until you can.
- [ ] Per client — Uber Eats, Uber Direct, Deliveroo ×3, Stripe, Stripe BID
- [ ] Per client — the four `/connect/*` redirect URIs, Uber's checked for a trailing slash
- [ ] SNS subscription for SES bounces repointed (and signature verification considered)
- [ ] Both Stripe secrets rotated into the deployment env, not copied between accounts
- [ ] Retention decided for the old deployment, so unsubscribe links keep resolving
- [ ] Delivery history checked on each provider before retiring the old endpoints
- [ ] The docs in §5 corrected
