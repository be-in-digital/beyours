# Production Checklist — Stripe BID Subscriptions

> **IMPORTANT**: the current credentials are in **test** mode. Before going to production, they must be replaced with the real live credentials.

> ✅ **Target deployment confirmed** (Convex dashboard, 2026-08-28):
> `robust-elephant-263` is the **production** deployment of project
> `beindigital-engine` — the same project whose dev deployment is
> `reliable-parrot-452`. This file was right; the doubt came from the name never
> having been written down anywhere else. Full inventory:
> [README → Convex deployments](../README.md#convex-deployments).

---

## Convex env vars to update (prod deployment: `robust-elephant-263`)

That deployment is the engine's production backend — the one that runs
`convex/bidSubscription.ts` and `convex/bidStripeWebhook.ts`.

Note that this is **not** `fearless-poodle-133`. That deployment backs
`apps/site` (beyours.fr), whose `convex/` directory contains no `bid*` function
and reads no `STRIPE_BID_*` variable — the BID billing code exists only in
`apps/reference/convex/` and `apps/themes/convex/`. The rule enforced by
`apps/site/scripts/check-prod-bundle.mjs` ("the only deployment allowed in
production is `fearless-poodle-133`") is about the **browser bundle served by
beyours.fr**, a different app and a different artefact. The two statements never
conflicted.

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
| `BID_APP_URL` | ⚠️ `https://reliable-parrot-452.convex.site` — **wrong kind of value** | The site's public URL (e.g. `https://app.beindigital.fr`) |

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

2. **Create a new live webhook** in the Stripe Dashboard
   - URL: `https://<convex-prod-domain>.convex.site/webhooks/stripe-bid`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

3. **Update the Convex env vars** on the prod deployment `robust-elephant-263`:
   ```bash
   # Engine context: apps/reference. A client instance: apps/themes.
   # Both mirror the same convex/ wrappers (bidSubscription, bidStripeWebhook).
   cd apps/reference
   pnpx convex env list --prod   # FIRST: proves --prod resolves to a deployment
   pnpx convex env set STRIPE_BID_SECRET_KEY "sk_live_..." --prod
   pnpx convex env set STRIPE_BID_WEBHOOK_SECRET "whsec_..." --prod
   # ... (all the variables above)
   ```
   Run the `env list` first and read what it prints — it must say
   `robust-elephant-263`. `--prod` resolves through the local
   `CONVEX_DEPLOYMENT`, so it targets whichever project this checkout is linked
   to, and `apps/reference` has been linked to two of them (`beindigital-engine`
   and a stray `beyours-reference`, see
   [README → Convex deployments](../README.md#convex-deployments)). A checkout
   linked to the wrong one writes your live Stripe keys into a dev backend
   without complaining.

4. **Deploy the Convex functions to prod**:
   ```bash
   pnpx convex deploy
   ```

5. **Test the full flow** live with a real card before the commercial launch

---

*Last updated: 2026-08-28 — deployment target confirmed against the dashboard (card 15).*
