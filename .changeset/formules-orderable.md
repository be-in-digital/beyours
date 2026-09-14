---
"@be-in-digital/convex-schema": minor
"@be-in-digital/convex-functions": minor
"@be-in-digital/restaurant": minor
---

Make *formules* orderable — the customer half that never shipped

An owner was told in three places in the product that they could sell formules:
the menus tab's empty state, the products page heading, and the guided tour
auto-launched on first login. No customer could ever order one.

The admin half was complete — schema, CRUD, RBAC, a 473-line tab over a 761-line
section builder — and the seven customer-facing strings were already translated
into French, English and Spanish. `menu.addComboToCart` (« Ajouter la formule au
panier ») was referenced nowhere in either app. Someone translated the button
before anyone built it.

What was missing, and is here now:

- **`menus.listActive`** — the filtered public query `menus.list`'s own comment
  asked for. It resolves `pick_category` sections server-side, leaves out a
  formule whose mandatory dish has been switched off (rather than offering it and
  refusing the diner at the checkout), and keeps offering one whose dish is
  merely sold out, marked so.
- **`menuLine.ts`** — a pure module that verifies a composed formule against its
  sections and prices it. Every chosen dish passes the same gate an à-la-carte
  line does, so a formule is refused for the same reasons: sold out, switched
  off, outside its serving window.
- **`orders.create` accepts one.** It used to throw on any line with no
  `productId`, which is exactly what a bundle is. A formule becomes N order rows
  sharing a `menuLineId`, one per dish, each priced at its share — so the money,
  the kitchen and the invoice all get what they need without a nested shape.
- **The cart can hold one.** `CartItem.productId` is optional and `menu` carries
  the composition; `cartLineId` hashes the whole selection, so two « Formule
  Midi » composed differently are two lines. `CART_STORAGE_VERSION` is 2 and
  every persisted cart migrates without losing anything.
- **The storefront** renders the formules above the à-la-carte grid, composes one
  in a dialog, lists its dishes in the cart, and sends it to the checkout.

**The two money decisions, stated because they were the reason this was its own
change:**

1. **VAT across a mixed-rate bundle** is split **pro rata on à-la-carte value**,
   the standard treatment of an *offre composite à prix global*. A 15 € dish at
   10 % and a 5 € glass of wine at 20 % sold at 20 € owes 1,36 € + 0,83 €. Split
   evenly it would have declared 0,39 € more VAT than is owed, on a numbered
   fiscal document. The leftover centime goes to the largest share,
   deterministically, so the shares always sum to exactly the price and two runs
   bill the same.

2. **A formule's dishes are not discountable** by product- or category-scoped
   promotions. The bundle price is already the owner's discount; letting « -20 %
   sur les desserts » reach the dessert inside it discounts the same dish twice
   without the owner asking. Order-level promotions still apply. A coupon that
   matches nothing but formules is **refused with a sentence** rather than
   granted at zero — a diner charged full price with no explanation cannot tell a
   rule from a bug.

Also: the kitchen slip prints « Formule Midi · Plat — Risotto », so a cook can
see which dishes are one cover; and `menu.sections` / `menu.fixedItem`, the two
translated strings this change does not use, are removed rather than left as dead
translations in three languages.
