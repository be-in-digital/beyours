# Runbook — Registering licence keys, and closing the gate

> How a delivered site comes to hold a licence key, how to give one to the sites
> delivered before keys were handed over, and what has to be true before
> `BEYOURS_LICENSE_ENFORCEMENT` is set to `strict`. Contains **no credential**.
>
> Card: `LAUNCH-10` · Issue: #181 · Related: NEW2-SITE-1 (#322) makes the renewal
> chargeable; this makes it enforceable. Both halves are needed.

## What the licence key is

An opaque string (`bys_` + 32 hex) on `saDeployments.licenseKey`, written into
the client site's `.beindigital-site.json`. Before `pnpm update:engine` or
`pnpm update:template` pulls anything, the site presents it to
`GET /maintenance/status?key=…` on the beyours.fr Convex deployment, and stops
when the answer says the contract has lapsed.

It proves "this repo belongs to that deployment", nothing more. Whoever holds it
can read a maintenance status; pulling an update still needs the private
boilerplate repo and the `@be-yours/*` registry. **The gate is a courtesy,
not a lock** — see `apps/themes/docs/UPDATES.md`.

## Two things, not one

A refusable renewal needs both:

- **the licence key** — which site is asking;
- **the order link** (`saDeployments.orderId`) — which contract answers for it.

Without the link, the gate falls back to every subscription filed under the
customer's email and keeps the most favourable. A customer running two
restaurants is therefore never refused on the one they stopped paying for: the
other one's contract answers. `saFleet.create` only started accepting an
`orderId` with #181, so **every site provisioned through the console before that
is in this state**, and the fleet page lists them alongside the keyless ones.

## The three states of a site

| State | What the update scripts do |
|---|---|
| Key in our database **and** in the site's sentinel | Ask on every update, and can be refused |
| Key in our database only | Ask nothing — the sentinel has nothing to present |
| No key at all | Ask nothing |

Only the first state is enforceable. A key sitting in the fleet table and never
copied into the client repo buys nothing, which is why every step below ends in
the client repo rather than in the console.

## 1. New deliveries — automatic, nothing to do

- `saFleet.create` stamps a key at provisioning.
- `saFleet.updateStatus(status: "live")` stamps one if the deployment somehow
  reached handover without it, and writes an activity row saying it still has to
  be reported into the site.

Provisioning also asks which paid order this deployment is sold on. Pick it —
it cannot be guessed, because a multi-site customer has several, and defaulting
to the most recent would give both sites the same contract.

At handover, take the key from the deployment's page in the console (**Licence**
panel) and run the line it gives you in the client repo:

```bash
pnpm setup -- --license-key bys_… --license-api https://<deployment>.convex.site
```

On a site already initialised, add the two fields to `.beindigital-site.json` by
hand instead, then confirm with step 3.

## 2. Sites already delivered — the backlog (account owner)

Open **/admin/flotte**. A banner lists two things, both fed by
`saFleet.unlicensed` (which counts `live`, `degraded` and `suspended`, and
ignores anything not handed over yet): deployments holding no key, and
deployments with no order linked.

For each one:

1. Open the deployment, **Licence** → **Émettre une clé**. The key is copied to
   the clipboard and an activity row records the issuance.
2. In the same panel, pick the paid order this site was sold on and
   **Rattacher**. Orders already linked to another deployment are greyed out.
3. In that client's repository, add `licenseKey` and `licenseApi` to
   `.beindigital-site.json`, commit, push.
4. Verify with step 3 below before moving to the next.

The banner disappears when both lists are empty. That is the gate on step 4 — it is
also the only measurement of it, because whether a client repo actually carries
the key is not something this backend can see.

**This step is the account owner's.** It needs the production Convex data and
push access to each client repository; neither is available from this repo, and
the list of sites is not in it either.

## 3. Verifying one site

Ask the licence API directly. **This is the only verification that works** —
note the host is beyours.fr's own deployment, `famous-wildcat-229`, not the
client's:

```bash
curl -s "https://famous-wildcat-229.convex.site/maintenance/status?key=bys_…"
```

**Do not use `pnpm update:engine --check` for this.** This section used to say
it "prints the contract's state and pulls nothing". It prints package versions
and nothing about the licence: `--check` returns at
`apps/themes/scripts/update-engine.mjs:91`, *before* the
`assertMaintenanceCurrent` gate at `:93-95` — deliberately, so a client whose
maintenance has lapsed can still list what they are missing. It also exits 1 at
`:88` when the registry is unreachable, which is what an operator without
`NODE_AUTH_TOKEN` gets, and which reads like a licence failure but is not.
Corrected 2026-09-09.

`"found": true` means the key is registered. `"found": false` means no
deployment holds it — a typo, or a key from another environment.

## 4. Closing the gate (account owner, and a product decision)

Today an unknown key answers `entitled: true`. Setting one environment variable
on the beyours.fr Convex deployment makes it answer `entitled: false`:

```bash
# from apps/site — `--prod` is not optional
npx convex env set BEYOURS_LICENSE_ENFORCEMENT strict --prod
```

**`--prod` matters more here than anywhere else in this document.** Without it
the variable lands on a dev deployment, the production gate stays open, and
nothing tells you: the command succeeds, and the only way to notice is that
enforcement never changes. Confirm with `npx convex env list --prod` and check
it says `famous-wildcat-229`. (This block omitted `--prod` until 2026-09-09.)

Only the exact string `strict` closes the gate — a typo forgives, on purpose
(`apps/site/convex/maintenance.ts:73-77`): the worst case of a fumbled flag must
be an open gate, not a paying client whose updates are bricked.

Reverting is the same command with `unset`, takes effect immediately, and needs
no deploy.

**Do not set this before step 2 is finished.** It refuses exactly the sites that
hold no key — the ones delivered before keys were handed over. Their
`pnpm update:engine` would stop working, and the message they read would tell
them their key is unknown, which from their side is our mistake, not theirs.

Only the exact string `strict` closes the gate. `Strict`, `1`, `true` and every
other near miss leave it open, on purpose: a fumbled flag must not brick the
updates of a client who pays.

### What it does and does not buy

It buys: an invented key stops entitling, so a client cannot restore updates by
editing a string, and a lapsed contract is refused rather than asked nicely.

It does not buy: a lock. The sentinel lives in the client's own repository —
deleting `licenseKey` from it makes the scripts skip the check entirely, and
`BEYOURS_LICENSE_API` overrides the host they ask. Both are one edit away for
anyone holding the repo. What actually freezes a lapsed site is revoking its
access to the private boilerplate repo and to the `@be-yours/*` registry
(`apps/themes/docs/UPDATES.md`).

### What stays forgiving either way

A **registered** deployment whose customer email matches no subscription at all
keeps answering `entitled: true, reason: "unregistered"`. That is our
bookkeeping missing, not a licence nobody issued, and refusing it would cut off
a client over a link we failed to make.

Note what that means once the gate is closed: a site is refused only when the
contract answering for it is dead. With the order linked, that is its own
contract. Without it, it is the healthiest of its owner's — which is why step 2
covers the link and not only the key. And `saDeployments.customerEmail` is typed
by hand while `subscriptions.customerEmail` comes from Stripe, so a
capitalisation difference is an unmatched email and a permanent pass. Linking
the order removes that dependency entirely.

## Where this is enforced in code

| Piece | Location |
|---|---|
| Policy read | `resolveLicenseEnforcement` — `apps/site/convex/maintenance.ts` |
| The one open/closed decision | `resolveUnknownKey` — same file |
| The endpoint | `GET /maintenance/status` — `apps/site/convex/http.ts` |
| Issuance at go-live | `saFleet.updateStatus` — `apps/site/convex/saFleet.ts` |
| The order link | `saFleet.create` / `saFleet.update`, picker fed by `saClients.paidOrders` |
| Issuance and rotation | `saFleet.issueLicenseKey` — same file |
| The backlog list (both gaps) | `saFleet.unlicensed` — same file |
| Client side | `apps/themes/scripts/lib/maintenance.mjs` |

Tests: `apps/site/tests/convex/maintenanceStatusRoute.test.ts` (the route under
both policies), `maintenance.test.ts` (the policy and the decision),
`saFleet.test.ts` (issuance, rotation, the backlog, the admin guard).
