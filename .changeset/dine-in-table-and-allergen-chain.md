---
"@be-in-digital/core": minor
"@be-in-digital/convex-schema": minor
"@be-in-digital/convex-functions": minor
"@be-in-digital/integrations": minor
"@be-in-digital/admin": minor
"@be-in-digital/ui": patch
---

Wire up dine-in table numbers, and make the four allergen surfaces agree

Two product surfaces were designed, translated, and never connected.

## A dine-in order now carries the table it is served to

"Sur place" was offered in the order-type selector and accepted by
`orders.create`, and nothing anywhere carried a table number — zero occurrences
in `tables/orders.ts`, `tables/kitchen.ts`, the storefront, the kitchen
components or the order functions. The printed slip gave a cook the dish and
the customer's name, so staff had a plate and nowhere to take it. One of the
three advertised order types was unusable. The tell was `checkout.tableNumber`:
shipped and translated into `fr`, `en` and `es`, and read by no code at all.

`orders.tableNumber` and `kitchenTickets.tableNumber` are new
`v.optional(v.string())` columns. `orders.create` accepts a table, normalises
it, and `releaseToKitchen` copies it onto every ticket the order produces; the
slip prints `TABLE <n>` at the same size as the order number, and the kitchen
display card shows it beside the order number.

It is a **label**, not a number — dining rooms use `A3` and `Terrasse 4` as
readily as `12`, and parsing the field as an integer would reject half of them.

It deliberately does **not** share a foreign key with `gameQRCodes.tableNumber`,
which names the same real-world thing. There is no `tables` table, and adding
one would make dine-in service depend on the gamification QR codes being
configured — a restaurant can serve *sur place* without ever running the wheel
of fortune. The two share a representation instead:
`@be-in-digital/core/dining` normalises and bounds a table label for both.

Required at the storefront, optional on the server. Uber Eats and Deliveroo
forward `dine_in` orders that carry no table of their own, and refusing those
would lose the order outright. A table number on a `delivery` or `pickup` order
is rejected, which catches the order whose type was switched after the table
was typed.

While wiring it, the checkout form turned out to carry its **own** two-option
fulfilment toggle that knew nothing about the store's services: a cart set to
`dine_in` showed "À emporter" selected, and one click silently rewrote the type
to `pickup`. The customer sat at a table and the kitchen was told to bag the
order. The toggle now offers the same three types the cart does, filtered by
the same predicate the server validates against, and selects exactly.

## One allergen vocabulary instead of four

The chain was broken at every link, and each surface had drifted because each
carried its own idea of what an allergen was:

- the printed kitchen ticket rendered `{allergens.join(", ")}` — whatever text
  was in the array is what a cook read before plating;
- the admin product form had **no allergen control at all**, only a zod field
  and a `[]` default, so a restaurateur could not declare one through the
  normal product editor;
- the only production writer was therefore the AI image-to-product flow, whose
  prompt is written in French, feeding an unvalidated comma-separated text box;
- `uberEatsMenuSync` declared `allergens?: string[]` and never mapped it, so
  every dish synced to Uber Eats went out with no allergen declaration.

For an EU food business under INCO 1169/2011 that is a regulatory surface.

`@be-in-digital/core/allergens` is now the single source of truth: the
fourteen Annex II allergens plus `shellfish` and the two dietary markers, the
alias table that matches French and English spellings through accents,
ligatures and punctuation, the localised labels, and the Uber Eats mapping.
It is framework-free and exported as raw source, so the design system, both
apps, the admin package and the Convex runtime can all consult it.

The representation decision, made once and applied everywhere: **allergens stay
free text** — refusing a name we do not know would push a real declaration off
the menu — **but every surface resolves through this vocabulary, and a value it
does not recognise is treated explicitly as unverified rather than passed off
as checked.**

So: the badge renders it as the owner typed it and announces it as the
restaurant's own wording; the kitchen slip prints it under `MENTIONS À
VÉRIFIER :` rather than folded into the allergen line, because a cook has to
treat it differently; the admin marks the chip `non vérifiée` and states the
consequence; and Uber Eats is not sent it at all, since filing an unknown value
as `OTHER` would show a diner a declaration that names nothing. Those are
reported to the owner instead of dropped in silence.

Dietary markers are no longer treated as allergens anywhere: `vegan` printed
under `ALLERGÈNES :` told a cook it was one.

`packages/admin` gains one allergen control, shared by the product form (a new
`Allergènes` tab) and the AI review card, so the two cannot disagree again.

### Known limitation

`UBER_EATS_ALLERGEN_TYPE` maps every canonical key to an Uber Eats enum member,
but those spellings are **not verified against Uber's live menu schema** —
`developer.uber.com` is unreachable from CI and Uber does not publish the enum
outside the partner portal. The mapping is total and typed, so correcting it is
a one-table change that every caller inherits. Confirm it during Uber Eats
onboarding; see `tasks/uber-eats-go-live-runbook.md`.
