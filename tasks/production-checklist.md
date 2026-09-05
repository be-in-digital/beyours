# Production Checklist — Stripe BID Subscriptions

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


> **IMPORTANT**: the current credentials are in **test** mode. Before going to production, they must be replaced with the real live credentials.

> ✅ **Target deployment confirmed** (Convex dashboard, 2026-08-28) — **and
> superseded on 2026-09-01**: the engine's production is now
> `optimistic-swordfish-937`, as the heading below says. As measured then,
> `robust-elephant-263` was the **production** deployment of project
> `beindigital-engine` — the same project whose dev deployment is
> `reliable-parrot-452`. This file was right; the doubt came from the name never
> having been written down anywhere else. Full inventory:
> [README → Convex deployments](../README.md#convex-deployments).

---

## Convex env vars to update (prod deployment: `optimistic-swordfish-937`)

> **Corrected 2026-09-03.** This heading and step 3 below both said
> `robust-elephant-263`, contradicting the banner at the top of this same file.
> The engine's production backend is **`optimistic-swordfish-937`** (project
> `beyours-engine-reference`, team `be-yours`) since the 2026-09-01 cutover.
> `robust-elephant-263` still answers `200` and serves nothing — following the
> old instruction writes live Stripe keys into a dead deployment without
> complaining.

That deployment is the engine's production backend — the one that runs
`convex/bidSubscription.ts` and `convex/bidStripeWebhook.ts`.

Note that this is **not** the site's backend, `famous-wildcat-229`. That
deployment backs `apps/site` (beyours.fr), whose `convex/` directory contains no
`bid*` function and reads no `STRIPE_BID_*` variable — the BID billing code
exists only in `apps/reference/convex/` and `apps/themes/convex/`. The rule
enforced by `apps/site/scripts/check-prod-bundle.mjs` is about the **browser
bundle served by beyours.fr**, a different app and a different artefact. The two
statements never conflicted. (That rule named `fearless-poodle-133`, the site's
*former* production deployment, until it was updated; `ALLOWED_CONVEX_SUBDOMAIN`
is `famous-wildcat-229` — verified 5 Sep 2026.)

**The site has its own, separate Stripe surface**, and it is what gates the
first sale: the founders coupon, the two creation Products and the four
`STRIPE_PRICE_*` maintenance Prices, all on `famous-wildcat-229`. None of them
is in this file. See
[`stripe-founders-offer-runbook.md`](./stripe-founders-offer-runbook.md).

| Variable | Current (test) | Replace with |
|----------|---------------|-----------------|
| `STRIPE_BID_SECRET_KEY` | `sk_test_•••` (see secret store) | `sk_live_...` (Stripe live key) |
| `STRIPE_BID_WEBHOOK_SECRET` | `whsec_•••` (see secret store) | `whsec_...` (new live webhook) |
| `STRIPE_BID_PRICE_STARTER` | `price_1T6zX9K8R9QQdjlQi9OztwRa` | Live Starter monthly price ID |
| `STRIPE_BID_PRICE_PRO` | `price_1T6zXAK8R9QQdjlQfUGoJZxD` | Live Pro monthly price ID |
| `STRIPE_BID_PRICE_ENTERPRISE` | `price_1T6zXBK8R9QQdjlQqzIRvk9F` | Live Enterprise monthly price ID |
| `STRIPE_BID_PRICE_STARTER_ANNUAL` | `price_1T6zXwK8R9QQdjlQ7aw8SLt9` | Live Starter annual price ID |
| `STRIPE_BID_PRICE_PRO_ANNUAL` | `price_1T6zXxK8R9QQdjlQW6UaGd2g` | Live Pro annual price ID |
| `STRIPE_BID_PRICE_ENTERPRISE_ANNUAL` | `price_1T6zXyK8R9QQdjlQS3iIsp46` | Live Enterprise annual price ID |
| `STRIPE_BID_PRICE_MAINTENANCE` | — **missing from this file until 2026-09-03** | Live price ID of the annual maintenance renewal |
| `BID_APP_URL` | ⚠️ `https://reliable-parrot-452.convex.site` — **wrong kind of value** | The site's public URL (e.g. `https://app.beindigital.fr`) |

> **Every `STRIPE_BID_PRICE_*` above is read by code — verified 2026-09-03, do
> not prune them.** The six plan prices reach `process.env` through
> [`apps/reference/convex/bidSubscription.ts:70`](../apps/reference/convex/bidSubscription.ts)
> (`resolvePriceIdFromPlan(args.plan, process.env, billing)`) and `:267`
> (`buildPriceMap(process.env)`), which resolve them in
> [`packages/convex-functions/src/bidSubscription.ts:45-51,72-79`](../packages/convex-functions/src/bidSubscription.ts).
> `apps/themes/convex/bidSubscription.ts` mirrors both at the same lines.
> `STRIPE_BID_PRICE_MAINTENANCE` is read directly at `bidSubscription.ts:183`,
> and its absence is why "Renouveler en ligne" is refused. Issue #173 recorded
> these six as dead; they are not.

`BID_APP_URL` is the **checkout redirect base**: `getAppUrl()`
([`bidSubscription.ts:38`](../apps/reference/convex/bidSubscription.ts)) builds
the Stripe success and cancel URLs from it, so it has to be a page a customer
can land on. A `.convex.site` URL is not one — that host serves HTTP actions, not
pages. The recorded value is wrong twice over: wrong kind of URL, and pointing at
a dev deployment. Compare
[`apps/reference/.env.example:159`](../apps/reference/.env.example)
(`http://localhost:3000`) and `apps/docs/guides/maintenance-and-migration.md:99`
(`https://client-site.example  # checkout redirect base`).

## Steps for production

1. **Create the live products in the Stripe Dashboard** (or via CLI with `--live`)
   - Auto Blog - Starter: 9€/month, 75.60€/year
   - Auto Blog - Pro: 29€/month, 243.60€/year
   - Auto Blog - Enterprise: 79€/month, 663.60€/year
   - Maintenance renewal → `STRIPE_BID_PRICE_MAINTENANCE`. **Amount not
     recorded anywhere in this repo** — it is read as an opaque id at
     `bidSubscription.ts:183` and never compared to a constant. Take it from
     the commercial terms, not from here.

2. **Create a new live webhook** in the Stripe Dashboard
   - URL: `https://<convex-prod-domain>.convex.site/webhooks/stripe-bid`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

3. **Update the Convex env vars** on the prod deployment `optimistic-swordfish-937`:
   ```bash
   # Engine context: apps/reference. A client instance: apps/themes.
   # Both mirror the same convex/ wrappers (bidSubscription, bidStripeWebhook).
   cd apps/reference
   pnpx convex env list --prod   # FIRST: proves --prod resolves to a deployment
   pnpx convex env set STRIPE_BID_SECRET_KEY "sk_live_..." --prod
   pnpx convex env set STRIPE_BID_WEBHOOK_SECRET "whsec_..." --prod
   # ... (all the variables above, STRIPE_BID_PRICE_MAINTENANCE included)
   ```
   Run the `env list` first and read what it prints — it must say
   `optimistic-swordfish-937`. `--prod` resolves through the local
   `CONVEX_DEPLOYMENT`, so it targets whichever project this checkout is linked
   to, and `apps/reference` has been linked to more than one (see
   [README → Convex deployments](../README.md#convex-deployments)). A checkout
   linked to the wrong one writes your live Stripe keys into a dev backend
   without complaining.

4. **Deploy the Convex functions to prod**:
   ```bash
   pnpx convex deploy
   ```

5. **Test the full flow** live with a real card before the commercial launch

---

*Last updated: 2026-09-03 — deployment target corrected to `optimistic-swordfish-937`,
`STRIPE_BID_PRICE_MAINTENANCE` added, and every `STRIPE_BID_PRICE_*` re-verified
as read by code (LAUNCH-02 / #173). Previously: 2026-08-28, deployment target
confirmed against the dashboard (card 15).*
