---
"@be-in-digital/convex-functions": major
"@be-in-digital/convex-schema": major
"@be-in-digital/restaurant": major
---

Let a refused diner read why, and make three checkout guards able to hold

`orders.create` is sound: it recomputes every price server-side, dedupes on an
idempotency key, validates availability, options, quantity and scheduling,
enforces the minimum order and the delivery radius, and gates on the store's
service switches. What was left is that its refusals could not be read, and that
three of its guards could never fire.

**Every checkout refusal reached the diner as "Server Error".** Convex redacts
the message of a thrown `Error` in production; only `ConvexError` carries its
`data` to the browser. The repository states the rule itself, at
`packages/convex-functions/src/auth.ts:45` and again in
`invitation-acceptance.test.ts` — and the fix had been applied to the
**authorization** path and never to the customer checkout path:

```
$ grep -c 'throw new LineRejectedError' packages/convex-functions/src/orderLine.ts   -> 8
$ grep -c 'throw new Error('            packages/convex-functions/src/orders.ts     -> 15
$ grep -c ConvexError packages/convex-functions/src/orders.ts                       -> 0
```

So eight carefully written French sentences — `« Pizza » est épuisé.`,
`« Pizza » exige un choix : Taille.`, the minimum order, the delivery radius, a
service the restaurant does not run — all became two English words at the moment
of payment. The diner was blocked with no reason and no action, and abandoned.
It made the whole server-side validation effort invisible.

New `RefusalError` (`packages/convex-functions/src/refusal.ts`) extends
`ConvexError<{ code, message, … }>` — the flat payload `auth.ts` established and
`lib/convex-error.ts` already reads in both apps. `LineRejectedError`,
`OrderZoneRejectedError`, `QuoteRejectedError`, `PromotionRejectedError`,
`FieldTooLongError` and `RateLimitedError` extend it, so every existing throw
site and every `instanceof` catch is unchanged and the payload now survives the
wire. `ConvexError` overwrites `message` with the JSON of `data`; the base
restores the sentence, because a good deal of the storefront and of the suite
reads `error.message`. Ten plain throws in `orders.ts` became a new
`OrderRefusedError`, and the checkout page reads `convexErrorMessage(error, …)`
instead of `error.message`.

Three of those messages were in **English** — "This store is not open for
orders", "This store is not accepting orders right now", "This store does not
offer delivery orders" — the only English copy a diner could be shown on this
path. They are French now, like the rest of the storefront.

**Tracked stock was never decremented by an order.**

```
PROBE: stock before = {"tracked":true,"quantity":2}
PROBE: order 1 -> stock {"tracked":true,"quantity":2}
PROBE: order 2 -> stock {"tracked":true,"quantity":2}
PROBE: 4 portions sold out of a tracked stock of 2
```

The `insufficient_stock` guard and its message are correct, and could only ever
fire if the owner retyped the quantity in the dashboard after every single
order. A restaurant tracking ten portions of the daily special sold fifty and
found out in the kitchen. `autoDisableWhenEmpty` hung off the same manual
`updateStock` mutation, so a dish that ran out never came off the menu on its
own either.

`orders.create` now sells the stock the order takes, in the same mutation as the
order and its kitchen ticket — one transaction, so two checkouts racing for the
last portion are serialised by the same read-write conflict that protects the
promotion counter. The auto-disable rule moved out of `updateStock`'s handler
into a pure `stockPatch`, shared by both callers. A basket is counted as a
basket: two lines of the same dish were each checked against the stored
quantity, so a stock of 3 accepted 2 + 2.

**Opening hours were enforced in the browser only.**

```
PROBE: every day marked isClosed -> order created
PROBE: 04:00 order accepted (hours 11:00-14:00)
```

`isOrderableStore` returns `store?.status === "open"` and its own comment
concedes that hours are "a separate question, answered in the storefront".
Nothing flips `status` on a schedule — there is no such cron — so the weekly week
the dashboard writes was honoured by exactly one thing: a `toast.error` on the
checkout page. A tab left open past closing, a cart restored from localStorage
or a direct call produced a paid order and a kitchen ticket at 4 a.m. in an
empty building. The hole had been closed one level up for the manual `closed`
status and left open for the weekly schedule, which is the one restaurants
actually rely on.

New `isWithinBusinessHours` and `resolveStoreHours` in
`@be-in-digital/convex-schema` — the only package `convex-functions` and
`restaurant` can both import, which is why `storeStatus` and `storeServices` are
there already. `orders.create` refuses an order outside the resolved week, on the
establishment's clock and honouring `useGlobalHours`; `isStoreOpen` and
`useStoreStatus` delegate their boolean to the same function, so the button the
storefront disables and the order the mutation refuses cannot drift apart. An
empty week is not a closure — `stores.create` seeds a full one, so an empty array
means nobody declared anything, and `status` decides as it always has.

**The menu and the order mutation disagreed about scheduling windows.**

```
PROBE @23:00  client(menu) = false  server(order) = true
PROBE @01:00  client(menu) = false  server(order) = true
PROBE tz      client = true (UTC)   server = false (Europe/Paris)
```

The server handled midnight-crossing windows and took a timezone;
`isProductScheduledNow` did neither — `now.getDay()` / `now.getHours()` on the
visitor's own clock, and `currentTime > availableUntil` reading a 22:00→02:00
late menu as an empty set. Two opposite failures out of one seam: the late menu
was greyed out for every hour it was actually served, and a diner in another
timezone saw a dish, added it, and was refused at payment — with the unreadable
error above. `timeWindow` moved to `@be-in-digital/convex-schema` and
`isProductScheduledNow` renders from it; `isProductAvailable`, the product card,
the grid, the menu and the favourites grid all take the establishment's
timezone, which `useStoreStatus` now returns.

**`/cart` showed "Votre Box est vide" before the persisted cart hydrated.**
`useCartHydrated` exists for exactly this and documents the failure mode; it had
been applied to `/checkout`, twice, and to neither read in `CartContent`. A diner
who reloaded or arrived from a bookmark got a full-screen dead-end hero on first
paint.

**Four things adversarial verification of the above turned up, all fixed here.**

Two were regressions this change introduced. `isOvernight` compared the raw
`"HH:MM"` strings while `parseClockTime` accepts `H:MM`, so the two disagreed
about what a time is — in both directions. `"17:00" <= "9:00"` is
lexicographically true, so a 9-to-5 bakery written `9:00` read as an overnight
service and took orders at four in the morning; `"2:00" <= "18:00"` is false, so
a food truck written `18:00 – 2:00` read as a window no minute is inside and
could not sell at any hour of its own service. Both functions compare parsed
minutes now, and an unreadable time closes the shop rather than waving an order
through — the same call `storeStatus` makes next door, where forgetting hides a
restaurant rather than letting one take orders it cannot honour. `isStoreOpen`
also reported "open, no current service, opens again in two hours" when the two
reading frames fell back differently on a timezone `Intl` rejects; it asks
`isWithinBusinessHoursAt` about its own clock now. The rule is shared, the clock
is each caller's.

Two were consequences of selling stock for the first time. A cancelled order
gave nothing back — a restaurant that cancelled three orders was left showing
three portions it still had, with the dish possibly off the menu and a full tray
behind the counter — so `updateStatus` returns what the order took, once, which
`cancelled` being terminal is what makes safe. And the sale told the delivery
platforms nothing: `stock.quantity` is what suspends an item on Uber Eats and
builds the Deliveroo availability delta, the Inventaire screen has booked that
push on every manual edit since the beginning, and there is no sweep to catch a
missed one. Both apps' `products.ts` and `menus.ts` carried their own copy of
`scheduleMenuSync`; it is one module now, and the order path is its third
caller.

One more, on the same path and the same shape: `/checkout/success` rendered
`error.message` from the payment-verification actions straight onto the screen a
diner sees *after* being charged — `[CONVEX A(stripe:verifyCheckoutSession)]
Server Error`. `SettlementRejectedError` joins the family, so the sentence that
says a payment does not settle this order arrives intact.

Held by tests that stay: `openingHours.test.ts` and the cross-checked window
cases in `product-service.test.ts` for the rules, `refusal.test.ts` (including a
`convexToJson`/`jsonToConvex` round trip of every payload) and `stockPatch.test.ts`
for the pieces, and `checkout-refusals.test.ts`, `order-opening-hours.test.ts`
and `cart-hydration.test.ts` in both apps for the wiring — including the
restock, the platform push, and the two malformed-hour outages above. Assertions that matched
a thrown English message now match `data.code`: the copy is French and gets
edited, the code is the contract.
