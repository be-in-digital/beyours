# Production-Readiness & Architecture Audit — Delivery Integrations

> **Historical record — paths are as they were at audit time.** `apps/restaurant-theme`
> has since been split into `apps/reference` (engine test bench) and `apps/themes`
> (client template). The paths below are left untouched on purpose: rewriting them
> would misreport what was actually changed, and where.

Branch: `audit/production-readiness-architecture` (from `origin/main`).
Scope: secrets/repo hygiene, package architecture, Convex schema, production
config, Uber Eats / Deliveroo (OAuth, webhooks, mapping, idempotence), CI, docs.
Approach: audit + fix **demonstrated P0/P1 only**; no broad refactors; no real
credentials created.

## Fixed in this branch

### Security & secrets
- **Removed hardcoded Deliveroo sandbox credentials** from
  `scripts/deliveroo-menu-scenarios.sh` (now required from env; `--help` still works).
- **Untracked Playwright artifacts** that should never be in git:
  `e2e/.auth/admin.json` (contained a live Better Auth session token + Convex JWT),
  `playwright-report/`, `test-results/`; added the missing `.gitignore` patterns.
- **Seed script** (`apps/restaurant-theme/scripts/seed-users.mts`): plaintext
  passwords and a hardcoded production Convex URL replaced by required env vars
  (`SEED_PASSWORD`, `NEXT_PUBLIC_CONVEX_URL`); CI `e2e.yml` updated accordingly.
- **`.env.example` templates** added (`apps/restaurant-theme`, `packages/core`) and
  the `.gitignore` `.env*` rule now allows `!**/.env.example`. Sandbox flags default
  to `true` in the template.
- Masked truncated Stripe test-key prefixes in `tasks/production-checklist.md`.

### Production config
- `apps/restaurant-theme/next.config.ts`: `ignoreBuildErrors: true → false`
  (the convex dir is already excluded via tsconfig; verified the build passes).
- `apps/restaurant-theme/convex/schema.ts`: `schemaValidation: false → true`.
- `packages/convex-schema/src/schema.ts`: added `uberEatsConnections` +
  `oauthStates` so the composed reference schema matches the app schema.

### Uber Eats / Deliveroo correctness & security
- **Money units (P0):** Uber mapper now emits integer cents (was euros → totals
  100× too small). Tests updated + regression test added.
- **Idempotence (P0):** `createFromWebhook` returns `{ orderId, created }`; Uber &
  Deliveroo handlers skip kitchen-ticket creation and auto-accept on retries.
- **Deliveroo webhook fail-open (P1):** removed the `DELIVEROO_IS_SANDBOX` signature
  bypass — invalid signatures are now rejected (`401`) in all environments.
- **OAuth CSRF (P1):** the Uber Eats connect callback now validates a single-use,
  10-minute `state` (new `oauthStates` table) before exchanging the code.

### Docs & tests
- Rewrote `apps/docs/guides/delivery-integrations.md` (accurate env vars, sandbox,
  webhooks, OAuth provisioning, validation, onboarding, secret rotation, prod checklist).
- Added `packages/convex-functions/src/__tests__/orders.test.ts` (idempotence +
  cents) and updated the Uber mapper tests to assert cents.

Verification: `pnpm type-check` (16/16), `pnpm lint` (0 errors), all package unit
tests pass, and the production `next build` succeeds with `ignoreBuildErrors:false`.

## Documented but intentionally NOT changed
- **Sandbox flag footgun (P1):** `UBER_EATS_SANDBOX_MODE` / `DELIVEROO_IS_SANDBOX`
  default to production when unset. Centralizing the `=== "true"` checks across 6+
  files would be a broad refactor; instead the template defaults to sandbox and the
  docs warn prominently.
- P2 hardening: 429/rate-limit backoff, swallowed `acceptOrder` failures, charCode
  constant-time compare on the Uber path, non-indexed dedup scan, cross-store
  fallback on fetch failure, root scratch screenshots. Listed for follow-up.

## Operator follow-ups (cannot be done in-repo)
1. **Rotate** the exposed Deliveroo sandbox client secret and **invalidate** the
   leaked Better Auth session/JWT — both remain in git history.
2. After enabling `schemaValidation`, run `npx convex dev` on existing deployments
   to surface/backfill any non-conforming rows before `convex deploy`.
3. Register the Uber redirect URI `${CONVEX_SITE_URL}/connect/uber-eats/callback`.
4. Provide sandbox credentials via `.env.local` / GitHub Secrets only.
