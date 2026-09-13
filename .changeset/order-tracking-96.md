---
"@be-in-digital/convex-schema": minor
"@be-in-digital/convex-functions": minor
"@be-in-digital/core": minor
"@be-in-digital/admin": minor
---

Tell the diner their order is ready, and let the dining-room screen be opened

Two halves of order tracking, both named by the audit.

**The product confirmed an order and then said nothing else, ever.** A
click-and-collect customer had no way to know when to walk over except by
watching the tracking page. « Votre commande est prête » now goes out on the
`ready` transition — one email, at the one moment the diner has to act on
something.

It fires on `ready` and nothing else: `preparing` tells a diner nothing they
cannot infer, `out_for_delivery` is the courier's own tracking, and `completed`
arrives after they have the food. And it never fires on a **delivery** order —
« prête » there means the food left the kitchen, not that anything is expected of
the diner. The send is claimed transactionally on `orders.readyEmailAt`, so the
`ready` transition being reached twice puts one email in the inbox and not two.

**`/display/[storeId]` is a tablet bolted to a wall in the dining room, and its
only query required `kitchen:read`** — so the screen a customer is meant to read
could only be opened by somebody logged in as staff. Each establishment now has
its own display token, created and rotated by the owner from the kitchen tab, that
the screen reads with and no session at all.

What that token guards is deliberately narrow: `getForDisplay` returns order
numbers, statuses, timestamps and the establishment's own name — no customer name,
no telephone number, no dish, no amount — which is what is already legible to
anybody standing in the room. It exists so a stranger cannot poll the endpoint and
read how busy the kitchen is, not because the payload is sensitive. A store with
no token refuses every token-authenticated read, so no existing deployment becomes
readable by generating nothing. The value is shown once, at rotation; afterwards
the admin says only that one is set.
