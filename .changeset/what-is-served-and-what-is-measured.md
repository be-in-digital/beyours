---
"@be-in-digital/convex-functions": minor
"@be-in-digital/convex-schema": minor
"@be-in-digital/admin": minor
"@be-in-digital/ui": minor
---

Serve no draft dish, settle the hours the screen promises, and measure the targets

**The public catalogue returned everything.** `products.list` collected the
whole table and `products.getById` answered for any id, both to anyone with no
account, so a dish the owner had not published was on the carte and on its own
product page — and then refused at the checkout, where `orders.create` has
always checked. `sitemap.ts` and `structured-data.ts` had each grown an
`isActive` filter of their own, which is why the hole looked closed; the menu
page had none, and it is the page a diner opens.

The filter is in the query now, once. `products.list`, `products.getById` and
`categories.list` serve only what is on sale, and `products.listAll`,
`products.getAnyById` and `categories.listAll` — guarded by `products:read` —
are what the back office reads, which is exactly what those screens saw before.
`menus.list` had no public caller at all in the repository, so it is guarded
rather than filtered: a filtered public query nothing public calls is surface
bought for nothing.

**`useGlobalHours` had two readings.** The field is optional, so a store written
before it existed carries no value; the dashboard read that as `?? true` and
drew the switch on, `resolveStoreHours` read it as a falsy `&&` and served the
store's own week. An owner could edit the deployment-wide hours, watch the
screen agree this location follows them, and have the order path enforce
something else. `followsGlobalHours` is now the single reading, and it answers
`false` — what the order path has always enforced, so no establishment's
opening hours change; only the dashboard stops claiming otherwise.

**The blog title was stored as typed.** Only `content` was sanitised, while the
title travels further — the page `<title>`, the breadcrumb JSON-LD, the Open
Graph tags. `sanitizePlainText` cleans the title, excerpt and both meta fields
on write, keeping their words and dropping their markup.

**Two instruments were reporting green over defects they could see.**
`scanContrast` never passed the `overlays` argument `loadTokens` takes, so a
caller naming a template measured the engine palette — the one no client ships;
and it read `className` only, so an element painting its ink or its surface
inline was unmeasured. Both are fixed, with a fixture suite that fails if either
input stops being honoured.

**And twenty-one icon-only controls were smaller than WCAG 2.5.8 allows**, from
22×22 down to the 16×16 password reveal on the sign-in dialog. `scanTargetSize`
in `@be-in-digital/ui/target-size` measures every one of them from the markup,
each control is now at least 24×24, and the sweep is a test rather than a list
that goes stale on the next filter chip.
