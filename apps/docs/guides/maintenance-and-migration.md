# Maintenance & Migration Guide

> Track the maintenance contract of a deployment, gate platform updates by coverage, and handle site migration requests.

## Overview

Every site is sold with **1 year of maintenance included**, then renewed annually. The maintenance system makes that contract explicit inside each deployment:

- **Covered** → the client automatically receives every platform update.
- **Expired** → the site stays frozen on the last release published before the end of coverage. Newer releases are visible but **locked**.
- In both cases, the client can request the **migration of their whole site** (code, database, assets, domain, emails) to the host and team of their choice.

Everything lives in the client's own Convex instance under **Dashboard → Système & Mises à jour**.

## Data Model

| Table | Purpose |
|---|---|
| `maintenanceContracts` | Singleton. `startedAt`, `coveredUntil`, `autoRenew`, billing hooks (`stripeCustomerId`, `stripeSubscriptionId`). |
| `platformReleases` | Release catalog, synced from the npm registry `time` map on every update check (idempotent by version). |
| `migrationRequests` | Client requests: target provider/team, scope, status + full status history. |

Contract status is **derived, never stored**: `active`, `expiring_soon` (≤ 30 days left), `expired`, or `none` — computed by `computeMaintenanceStatus()` in `@be-yours/convex-functions/maintenance`.

## Update Gating

A release is covered when `releasedAt <= coveredUntil`. The `system.checkForUpdates` action:

1. Fetches the packument of `@be-yours/restaurant-theme` and syncs the release catalog (best effort — a registry outage falls back to the stored catalog).

   > ⚠️ No package by that name is published by this repo (see `packages/*`).
   > The request 404s, so the catalog silently stays empty. The real engine
   > package name has to be decided before this feature can work.
2. Resolves `latestVersion` (newest published) and `entitledVersion` (newest **covered**) by semver.
3. Returns `hasEntitledUpdate`, `lockedVersions`, `maintenanceStatus`, `coveredUntil`.

The admin UI shows covered releases with a green badge and locked ones with a lock badge plus a renewal call-to-action.

## Migration Requests

Reserved for the account owner (`client_admin`) or `super_admin`.

- One **open** request at a time (`pending`, `acknowledged`, `in_progress`).
- Allowed transitions: `pending → acknowledged → in_progress → completed`, with `declined` (BID) and `cancelled` (client, until work starts) as exits. Terminal states are final.
- Every creation and status change is appended to `statusHistory` and to the `systemAuditLog`.

Client flow: **Système → Maintenance → Demander une migration** (target host, receiving team, scope checkboxes, preferred date). The client then follows the status timeline on the same screen and can cancel while the request is open.

## Self-Serve Renewal (Stripe)

When `STRIPE_BID_PRICE_MAINTENANCE` is set on the Convex deployment, the renewal CTAs show a **"Renouveler en ligne"** button:

1. `bidSubscription.createMaintenanceCheckoutSession` (owner only) opens a Stripe Checkout in subscription mode, tagged `bidProduct: "maintenance"`. The Stripe customer is shared with the autoBlog plans.
2. The existing BID webhook routes maintenance events to `maintenance._applyStripeRenewal` — **never** to `ownerEntitlements`:
   - `checkout.session.completed` / `customer.subscription.updated` (status `active`/`trialing`) → `coveredUntil` = the subscription's `current_period_end`. Coverage **only ever extends** — a `past_due` period advance grants nothing until payment succeeds.
   - `customer.subscription.deleted` → `autoRenew: false`; the paid coverage stays until `coveredUntil`.
3. While auto-renew is active, the contract card exposes the Stripe **billing portal** to manage or cancel it.
4. Back from checkout, the admin lands on `/dashboard/system?maintenance=success`; the contract card refreshes live once the webhook lands.

Manual renewal (invoice) stays available via `_setContract` below — both paths audit `maintenance_contract_set`.

## Notifications

Creating a migration request schedules `maintenanceEmail.notifyMigrationRequest` (SES, best effort — a delivery failure never blocks the request):

- **BeYours** gets an alert at `BID_NOTIFY_EMAIL` with the full request details and deployment URL.
- **The client** gets a confirmation at their contact email.

## BeYours Operations

### Provision or renew a contract

From the Convex dashboard (or CLI) of the client deployment, run the internal mutation `maintenance:_setContract`:

```json
{
  "startedAt": 1751702400000,
  "coveredUntil": 1783238400000,
  "autoRenew": false,
  "notes": "Go-live 2026-07-05, 1 year included"
}
```

Renewal = same mutation with a new `coveredUntil` (and `lastRenewedAt`). A `super_admin` account can also use the `maintenance.setContract` mutation from the app. Both paths write a `maintenance_contract_set` audit entry.

### Process a migration request

Use `maintenance.updateMigrationRequestStatus` (super_admin) to move the request through `acknowledged → in_progress → completed`, with an optional note shown in the client's timeline. Use the existing **backup export** (Système → Sauvegarde) as the data-handover artifact, plus the repository snapshot at the client's entitled version.

## Environment Variables

```bash
# Next app (optional) — "Contacter BeYours" mailto in the renewal CTA
NEXT_PUBLIC_BID_SUPPORT_EMAIL=support@example.com

# Convex deployment (npx convex env set ...)
STRIPE_BID_SECRET_KEY=sk_live_...        # shared with autoBlog billing
STRIPE_BID_WEBHOOK_SECRET=whsec_...      # shared BID webhook
BID_APP_URL=https://client-site.example  # checkout redirect base
STRIPE_BID_PRICE_MAINTENANCE=price_...   # annual renewal price → enables online renewal
BID_NOTIFY_EMAIL=ops@example.com         # migration request alerts (SES)
```

## Key Files

- `packages/convex-schema/src/tables/maintenance.ts` — table definitions
- `packages/convex-functions/src/maintenance.ts` — pure logic (status, gating, semver, transitions) + handlers
- `apps/reference/convex/maintenance.ts` — auth wrappers + internal ops mutations
- `apps/reference/convex/system.ts` — `checkForUpdates` with maintenance gating
- `packages/admin/src/pages/system/system-page.tsx` — Maintenance tab, gated updates, migration form
