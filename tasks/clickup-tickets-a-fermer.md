# ClickUp — tickets waiting to be closed

ClickUp was rate-limited on **25/08/2026 around 21:45** for roughly 16h30 (until
**26/08 around 14:15**). No comment could be posted and no status changed during
that window. This file holds the state until then.

Workspace: space `90127678587`, folder `beyours` (`901211338962`), list
**Technique** (`901218271011`).

## Close now — pull requests already merged

| Ticket | PR | Caveat |
|---|---|---|
| [869ept06n](https://app.clickup.com/t/869ept06n) — Uber Direct not wired in | [#66](https://github.com/be-in-digital/beyours/pull/66) + [#67](https://github.com/be-in-digital/beyours/pull/67) | **Check before closing.** #67 says it closes « points 1 to 4 ». Re-read the ticket: if it carries further points, close only those and leave the rest open. |

## Close on merge — pull requests still open

| Ticket | PR | Subject |
|---|---|---|
| [869ept3qd](https://app.clickup.com/t/869ept3qd) | [#68](https://github.com/be-in-digital/beyours/pull/68) | Customer addresses stored in the database rather than on the phone |
| [869eprmb3](https://app.clickup.com/t/869eprmb3) | [#69](https://github.com/be-in-digital/beyours/pull/69) | The ten founders slots, actually capped |
| [869eprmk8](https://app.clickup.com/t/869eprmk8) | [#70](https://github.com/be-in-digital/beyours/pull/70) | Engine updates stop when maintenance has lapsed |
| [869eprmdf](https://app.clickup.com/t/869eprmdf) | [#72](https://github.com/be-in-digital/beyours/pull/72) | Legal mentions on every invoice, renewals included |

All four carry a `Closes <ticket>` line in their description, but ClickUp is not
wired to GitHub: closing stays manual.

## Do not close

- [869eprp21](https://app.clickup.com/t/869eprp21) — the internal `/track/`
  route still does not exist. #67 works around it by showing the Uber tracking
  card while a courier is on the road; the internal link stays dead everywhere
  else.

## Two actions that stay with the director

Neither is code, and the matching pull requests fail on purpose until they are
done.

**[869eprmb3] The Stripe coupon.** Since #69, a founders sale is *refused* when
the cap cannot be enforced. Before the first sale:

1. Create the Stripe coupon, `max_redemptions = 10`, restricted to the creation
   product through `applies_to.products`
2. Create the persistent product `STRIPE_PRODUCT_CREATION_ESSENTIELLE`
3. Set `STRIPE_FOUNDERS_COUPON_ID` and `STRIPE_PRODUCT_CREATION_ESSENTIELLE` on
   the production Convex environment

**[869eprmdf] Stripe invoice numbering.** Stripe numbers per customer by
default, each customer carrying its own prefix and sequence. French law asks for
one continuous chronological sequence. Switch it before the first invoice, as
the setting does not renumber what already exists:
*Stripe Dashboard → Settings → Billing → Invoices → Invoice numbering →
Sequential*. Not reachable from code.

**[869eprmk8] The license keys.** The maintenance freeze only covers sites
carrying a `licenseKey` in their `.beindigital-site.json`. Sites provisioned
before it existed have none and read as « unregistered » — deliberate, but it
means they cannot be frozen until one is issued (`saFleet.issueLicenseKey`, then
written into their sentinel).

## Two defects found along the way

No ticket; spun off as background tasks on 25/08:

- **Superadmin console under-reported MRR by half** — fixed by
  [#71](https://github.com/be-in-digital/beyours/pull/71).
- **`pnpm lint` red on `apps/themes`** — two `any` in `convex/uberDirect.ts`,
  inherited from #66.
