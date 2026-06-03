# Uber Eats — Production Go-Live Runbook

Status as of 2026-06-03: **Sandbox validation PASSED.** Uber is enabling the
required scopes on the production client. Execute the steps below once Uber
confirms production access.

- **Test Client ID:** `BN3BbPRSpD7-TNs5DqC6fyq20n3rVLCF` (sandbox)
- **Production Client ID:** `RhJUZXI31BKM6QKxNJFee1AueQPgtwnn`
- **Production app (Uber portal):** "Be in Digital POS"

---

## 0. PREREQUISITE — re-enable schema validation (data-migration debt)

**Current state (2026-06-03):** to ship the Uber webhook fix, `schemaValidation`
was set to **`false`** in `apps/restaurant-theme/convex/schema.ts` on the dev
deployment. The Uber webhook + actions are deployed and working. Before
production go-live you MUST backfill the drifted rows and set
`schemaValidation: true` again.

`convex deploy` with validation ON FAILS on pre-existing documents that predate
the catalog schema revamp. Unrelated to Uber, but must be resolved for prod.

Observed mismatches (dev deployment):
- `products.stock.autoDisableOnZero` → schema now expects `autoDisableWhenEmpty`
- `products.stock.trackStock` → schema now expects `tracked`
- `products.isFeatured` (now required) missing on old docs
- `products.source`, `products.tags` (required) missing on old docs
- `blogArticles.coverImageId` (required) missing on auto-generated drafts

Recommended fix (data migration, not schema-loosening):
1. Temporarily relax the changed validators in `packages/convex-schema/src/tables/catalog.ts`
   and `cms.ts` (accept old+new via `v.optional`) so a deploy succeeds.
2. Deploy a one-time `internalMutation` that backfills each old product doc:
   `stock.autoDisableWhenEmpty = stock.autoDisableOnZero`,
   `stock.tracked = stock.trackStock`, `isFeatured ??= false`,
   `source ??= "pos"`, `tags ??= []`; and `blogArticles.coverImageId` for drafts
   (attach a placeholder media id or make the field intentionally optional).
3. Run the migration (`npx convex run migrations:backfillProducts`).
4. Re-tighten the validators and redeploy.

Known drifted rows to backfill before re-enabling validation:
- `products`: `stock.trackStock`→`tracked`, `stock.autoDisableOnZero`→`autoDisableWhenEmpty`; add `isFeatured`(false), `source`, `tags`([]) where missing.
- `stores`: `status` legacy value `"active"` → map to `"open"`.
- `blogArticles`: auto-generated drafts missing `coverImageId` (attach media or make optional).

Owner: catalog/CMS team (they own the intended field semantics). The Uber
integration itself is fully deployed and working with validation OFF.

---

## 1. Set production credentials in the deployment env

Convex functions read env from the DEPLOYMENT, not the local `.env`.

```
npx convex env set UBER_EATS_CLIENT_ID RhJUZXI31BKM6QKxNJFee1AueQPgtwnn
npx convex env set UBER_EATS_CLIENT_SECRET <prod secret from Uber portal>
npx convex env set UBER_EATS_WEBHOOK_SECRET <prod webhook signing key>
npx convex env set UBER_EATS_SANDBOX_MODE false
```

The client switches host automatically (sandbox → `test-api.uber.com`,
prod → `api.uber.com`; auth `sandbox-login` → `login`/`auth.uber.com`).

## 2. Register the OAuth redirect URI on the PROD app

In the Uber developer portal → app "Be in Digital POS" → Redirect URIs, add the
production callback (same path, prod Convex site URL):

```
https://<prod-convex-deployment>.convex.site/connect/uber-eats/callback
```

(On the test app "Base Theme" this is
`https://reliable-parrot-452.convex.site/connect/uber-eats/callback`.)

## 3. Deploy

After step 0 is resolved:
```
cd apps/restaurant-theme && npx convex deploy
```

Confirms the Uber fixes ship: order actions on `/v1/delivery/order/...`,
deny/cancel bodies (`deny_reason`/`cancellation_reason` `{info,type}`),
webhook v0.1 hardening + `orders.failure` handling, OAuth provisioning.

## 4. Production smoke test (careful — real orders/money)

- OAuth: run `generateAuthorizeUrl` → merchant consent → confirm token stored.
- `activateAndListStores` against a real prod store → 200.
- Place one real test order (or use Uber's prod test tooling) → verify webhook
  received + accept/ready flow → 200s.
- Verify webhook signature uses the PROD webhook secret.

## Reference

- Endpoint map + bodies: see `.context/uber-eats-validation-evidence.md`
  and the evidence PDF `.context/uber-evidence/Uber-Eats-Validation-Evidence.pdf`.
- Sandbox test eater ordering: log into ubereats.com as the test developer
  account, set delivery to the test store address, place an order (no payment,
  no courier). Order creation must be human-driven (Uber login is anti-bot).
