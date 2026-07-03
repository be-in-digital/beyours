# Uber Eats — Production Go-Live Runbook

Status as of 2026-06-03: **Sandbox validation PASSED.** Uber is enabling the
required scopes on the production client. Execute the steps below once Uber
confirms production access.

- **Test Client ID:** `BN3BbPRSpD7-TNs5DqC6fyq20n3rVLCF` (sandbox)
- **Production Client ID:** `RhJUZXI31BKM6QKxNJFee1AueQPgtwnn`
- **Production app (Uber portal):** "Be in Digital POS"

---

## 0. PREREQUISITE — re-enable schema validation (data-migration debt)

**✅ RESOLVED on dev (2026-07-04).** `schemaValidation` is back to **`true`** in
`apps/restaurant-theme/convex/schema.ts` and the push passes validation on the
dev deployment (`reliable-parrot-452`). What was done:

1. One-time migration added: `apps/restaurant-theme/convex/migrations.ts`
   (`auditSchemaDrift` dry-run + `backfillSchemaDrift`).
   - `products`: `stock.trackStock`→`tracked`,
     `stock.autoDisableOnZero`→`autoDisableWhenEmpty`; `isFeatured`→`false`,
     `source`→`"manual"`, `tags`→`[]` where missing (7 docs patched).
   - `stores`: `status` `"active"`→`"open"`; legacy `isActive` dropped
     (undeclared in schema, unread by code) (1 doc patched).
2. `blogArticles.coverImageId` made **optional in the table validator**
   (`packages/convex-schema/src/tables/cms.ts`) — both creation paths (manual
   draft + auto-blog) legitimately create cover-less drafts, and publishing
   already enforces presence (`convex-functions/blogPublish.ts`). The
   `undefined as any` workaround in `blog.ts` was removed.
3. Backfill run on dev, re-audit → 0 drifted, schema pushed with validation ON.

**For any OTHER deployment holding pre-revamp data (prod per-client instances):**
run the same sequence before/while deploying:
1. If the new schema fails to deploy (old rows), temporarily set
   `schemaValidation: false`, deploy (this ships `migrations.ts`).
2. `npx convex run migrations:auditSchemaDrift` (dry-run) then
   `npx convex run migrations:backfillSchemaDrift` (add `--prod` on prod).
3. Set `schemaValidation: true` back and deploy again — must pass.
Fresh/empty deployments need none of this.

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
