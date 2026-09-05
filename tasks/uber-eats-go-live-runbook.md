# Uber Eats — Production Go-Live Runbook

Status as of 2026-06-03: **Sandbox validation PASSED.** Uber is enabling the
required scopes on the production client. Execute the steps below once Uber
confirms production access.

- **Test Client ID:** `BN3BbPRSpD7-TNs5DqC6fyq20n3rVLCF` (sandbox)
- **Production Client ID:** `RhJUZXI31BKM6QKxNJFee1AueQPgtwnn`
- **Production app (Uber portal):** "BeYours POS"

---

## 0. PREREQUISITE — re-enable schema validation (data-migration debt)

**✅ RESOLVED on dev (2026-07-04).** `schemaValidation` is back to **`true`** in
`apps/reference/convex/schema.ts` and the push passes validation on the
dev deployment (`reliable-parrot-452`). What was done:

1. One-time migration added: `apps/reference/convex/migrations.ts`
   (mirrored in `apps/themes/convex/migrations.ts` for client instances)
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

In the Uber developer portal → app "BeYours POS" → Redirect URIs, add the
production callback (same path, prod Convex site URL):

```
https://<prod-convex-deployment>.convex.site/connect/uber-eats/callback
```

(On the test app "Base Theme" this was
`https://reliable-parrot-452.convex.site/connect/uber-eats/callback` —
`reliable-parrot-452` is a personal dev deployment left on the old `momoseck8`
team since the 2026-09-01 cutover. It still answers `200` and serves nothing, so
re-point the test app before trusting a test flow through it. Deployment names:
[README → Convex deployments](../README.md#convex-deployments).)

## 3. Deploy

After step 0 is resolved:
```
cd apps/reference && npx convex deploy    # a client instance: cd apps/themes
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

## 5. Confirm the allergen enum — OUTSTANDING, and not verifiable from CI

`buildUberEatsMenuPayload` now sends `nutritional_info.allergens`, mapped from
the canonical vocabulary by `UBER_EATS_ALLERGEN_TYPE` in
`packages/core/src/allergens/index.ts`. Menus synced before that carried no
allergen declaration at all, so this is new data on the wire.

**The enum spellings in that table are unverified.** `developer.uber.com` is
blocked by the CI egress proxy and Uber does not publish the allergen enum
outside the partner portal. The values used are Uber's own allergen vocabulary
as far as it is publicly documented — `MILK` rather than `DAIRY`, `TREE_NUTS`
rather than `NUTS` — but `CRUSTACEANS`, `MOLLUSCS`, `LUPIN` and `SULPHITES`
are EU-specific and least certain.

Before the first production menu push:

1. Open the Menu API reference in the partner portal and read the accepted
   values for `nutritional_info.allergens[].type`.
2. Correct `UBER_EATS_ALLERGEN_TYPE` — one table, and every caller goes
   through it. `UBER_EATS_ALLERGEN_TYPES` is the union that types it, so a
   value that is not a declared member will not compile.
3. Push a menu for one store and read back `GET /eats/stores/{id}/menu` to
   confirm the allergens survived the round trip rather than being dropped as
   unrecognised.

A rejected enum member is the good failure — Uber refuses the upload and the
sync reports an error. The bad one is Uber accepting the payload and silently
dropping an allergen it did not recognise, which looks identical to success
and leaves a dish showing no declaration. Step 3 is what distinguishes them,
so do not skip it.

Related: values the canonical vocabulary itself could not map are never sent
(there is no honest enum member for them) and are logged by
`collectUnsyncableAllergens` at sync time, naming the product. Watch the
Convex logs on the first sync and get those renamed in the dashboard.

## Reference

- Endpoint map + bodies: see `.context/uber-eats-validation-evidence.md`
  and the evidence PDF `.context/uber-evidence/Uber-Eats-Validation-Evidence.pdf`.
- Sandbox test eater ordering: log into ubereats.com as the test developer
  account, set delivery to the test store address, place an order (no payment,
  no courier). Order creation must be human-driven (Uber login is anti-bot).
