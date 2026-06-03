# Checklist Production — Stripe BID Subscriptions

> **IMPORTANT** : Les credentials actuels sont en mode **test**. Avant la mise en production, il faut remplacer par les vrais credentials live.

---

## Convex Env Vars a mettre a jour (deployment prod : `robust-elephant-263`)

| Variable | Actuel (test) | A remplacer par |
|----------|---------------|-----------------|
| `STRIPE_BID_SECRET_KEY` | `sk_test_•••` (voir secret store) | `sk_live_...` (cle live Stripe) |
| `STRIPE_BID_WEBHOOK_SECRET` | `whsec_•••` (voir secret store) | `whsec_...` (nouveau webhook live) |
| `STRIPE_BID_PRICE_STARTER` | `price_1T6zX9K8R9QQdjlQi9OztwRa` | Price ID live Starter mensuel |
| `STRIPE_BID_PRICE_PRO` | `price_1T6zXAK8R9QQdjlQfUGoJZxD` | Price ID live Pro mensuel |
| `STRIPE_BID_PRICE_ENTERPRISE` | `price_1T6zXBK8R9QQdjlQqzIRvk9F` | Price ID live Enterprise mensuel |
| `STRIPE_BID_PRICE_STARTER_ANNUAL` | `price_1T6zXwK8R9QQdjlQ7aw8SLt9` | Price ID live Starter annuel |
| `STRIPE_BID_PRICE_PRO_ANNUAL` | `price_1T6zXxK8R9QQdjlQW6UaGd2g` | Price ID live Pro annuel |
| `STRIPE_BID_PRICE_ENTERPRISE_ANNUAL` | `price_1T6zXyK8R9QQdjlQS3iIsp46` | Price ID live Enterprise annuel |
| `BID_APP_URL` | `https://reliable-parrot-452.convex.site` | URL de prod (ex: `https://app.beindigital.fr`) |

## Etapes pour la prod

1. **Creer les produits live dans Stripe Dashboard** (ou via CLI avec `--live`)
   - Auto Blog - Starter : 9€/mois, 75.60€/an
   - Auto Blog - Pro : 29€/mois, 243.60€/an
   - Auto Blog - Enterprise : 79€/mois, 663.60€/an

2. **Creer un nouveau webhook live** dans Stripe Dashboard
   - URL : `https://<convex-prod-domain>.convex.site/webhooks/stripe-bid`
   - Events : `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

3. **Mettre a jour les env vars Convex** sur le deployment prod `robust-elephant-263` :
   ```bash
   cd apps/restaurant-theme
   pnpx convex env set STRIPE_BID_SECRET_KEY "sk_live_..." --prod
   pnpx convex env set STRIPE_BID_WEBHOOK_SECRET "whsec_..." --prod
   # ... (toutes les variables ci-dessus)
   ```

4. **Deployer les fonctions Convex en prod** :
   ```bash
   pnpx convex deploy
   ```

5. **Tester le flux complet** en live avec une vraie carte avant de lancer commercialement

---

*Derniere mise a jour : 2026-03-03*
