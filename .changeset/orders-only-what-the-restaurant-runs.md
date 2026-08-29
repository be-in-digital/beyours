---
"@be-in-digital/convex-schema": minor
"@be-in-digital/convex-functions": minor
---

An order is refused when the restaurant is not taking any, and when it is not
the kind the restaurant runs.

**"Fermé" and "Indisponible" now mean it.** `orders.create` checked
`isPublishedStore` alone, and both statuses are *published* — that is what keeps
a paused restaurant listed with a readable menu. The storefront greyed out every
button on them and nothing else did, so a tab left open, a cart restored from
localStorage or a direct call took the order anyway. `isOrderableStore` is the
narrower rule, next to `isPublishedStore` where the wider one already lived.

This reverses a decision the suite documented — *"a closed restaurant is
published: it takes orders for later, and the storefront is what decides whether
to offer that."* It does not hold: `closed` and `temporarily_unavailable` are set
by hand from the dashboard, and the two screens that offer ordering already
refuse on them. Pre-orders for a named later date are a feature nobody has built;
until someone does, the status means what the owner meant.

**The four service switches are enforced.** `globalSettings.services` was written
by the settings page and read nowhere that mattered. The storefront took
`store.overrides.services` — `undefined` on every establishment that has not
customised it — and the selector read `undefined` as "offer everything", so a
restaurant that does not deliver still showed Livraison. `orders.create` never
looked at `args.type` at all.

`resolveStoreServices` puts the store override first, the global switches next,
and everything-on last, so a deployment whose settings row has never been saved
keeps working. `ORDER_TYPE_SERVICE` is the one map the selector filters on and
the mutation validates against — the button a customer can press and the order
the server accepts can no longer disagree. `clickAndCollect` is deliberately
unmapped: three order types, four switches, and folding it into `takeaway` would
make that switch mean two things.
