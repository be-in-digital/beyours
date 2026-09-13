---
"@be-in-digital/convex-functions": minor
"@be-in-digital/admin": minor
---

Build the three sales metrics the site named and the engine did not have

`apps/site` listed five figures. Two existed as today-only cards. Three did not
exist in any form — `grep -riE 'plats populaires|topProduct|peakHour|returnRate'`
over `apps/themes` and `packages` returned nothing at all:

- **Plats populaires** — there was no product-level aggregation anywhere.
- **Heures de pointe** — there was no time-of-day bucketing.
- **Taux de retour** — there was no notion of a returning customer until #364
  built the customer book.

All three are now computed in `dashboardStats.ts`, in the same pure module as
the rest of the overview's arithmetic, on the same collected-money rule.

The dishes rank on **units sold**, not revenue: the question is what the kitchen
is making, and ranking on money puts the 38 € plateau above the burger the
establishment sells forty of. Both figures are shown.

The hours are the establishment's own local hours, derived from the local
midnights the browser already computes — so there is no timezone argument, and a
period straddling a clock change reads correctly on both sides of it.

« Taux de retour » counts a diner as returning when their **first ever order
predates the period**, not when they ordered twice inside it. The second reading
makes the figure a function of the window length rather than of the restaurant.
The definition is stated on the card, and so is the number of orders with no
e-mail address, which belong to neither side.

Two things the issue also asked for:

- **The period is now a choice** — 7, 14 or 30 days. Every window on this screen
  was a literal while the site sold « analyse des tendances et des performances
  par période ». The breakdown pies follow the picker too; they used to sit on
  their own fixed thirty days, so the donuts and the chart above them answered
  about different stretches of time.
- **`analytics:read` is enforced.** It and `analytics:view_all` were declared in
  `packages/core/src/auth/rbac.ts` and consumed by nothing, so a `kitchen`
  account — which holds `orders:read` to work the pass — could read the
  establishment's turnover, average basket and best-selling dishes. The screen
  stays reachable for every role, because it is where each login lands; the
  figures are replaced by a stated panel, and the recent-orders table and quick
  actions remain.

`DashboardStats.last7Days` is now `days`: a field named for seven holding thirty
entries is the kind of name that survives into a chart axis.
