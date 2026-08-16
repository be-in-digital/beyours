# Production Checklist — Stripe BID Subscriptions

> **IMPORTANT**: the current credentials are in **test** mode. Before going to production, they must be replaced with the real live credentials.

---

## Convex env vars to update (prod deployment: `robust-elephant-263`)

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
| `BID_APP_URL` | `https://reliable-parrot-452.convex.site` | Prod URL (e.g. `https://app.beindigital.fr`) |

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
   pnpx convex env set STRIPE_BID_SECRET_KEY "sk_live_..." --prod
   pnpx convex env set STRIPE_BID_WEBHOOK_SECRET "whsec_..." --prod
   # ... (all the variables above)
   ```

4. **Deploy the Convex functions to prod**:
   ```bash
   pnpx convex deploy
   ```

5. **Test the full flow** live with a real card before the commercial launch

---

*Last updated: 2026-03-03*
