---
"@be-in-digital/convex-functions": minor
"@be-in-digital/convex-schema": minor
"@be-in-digital/restaurant": minor
"@be-in-digital/admin": minor
"@be-in-digital/core": minor
"@be-in-digital/ui": minor
---

Fix the diner's broken first-day moments

Five defects a client meets on their first day of service (#376). Each was
reproduced with a throwaway probe before being touched, and each leaves a
permanent test behind in the package that owns the behaviour.

**1. The storefront had no way to declare an allergy.** The whole pipeline
existed except the input: `orders.create` takes `notes`, the order carries it,
`releaseToKitchen` copies it onto the ticket, and the printed slip has a line
for it. `grep -c notes checkout-form.tsx` answered 0, byte-identically in both
apps, so the line was forever blank. The checkout now carries an
« Allergies & instructions » field, capped by `FIELD_LIMITS.orderNote` — read
from the server, so the input and the mutation cannot disagree. Two things the
note reached only halfway are fixed with it: the printed slip announced it as
« Instructions livraison: » even on a dine-in ticket, and the kitchen *screen*
never showed it at all, so a kitchen working off the display — which is the
display this product ships — could not see it.

**2. Product creation dead-ended in silence when « Sélections max » was left
empty.** `maxSelections` was the one number on the form not wrapped in the
file's own `optionalNumber` guard, so `valueAsNumber` turned an empty box into
NaN, zod refused it, react-hook-form blocked the submit of the whole product,
and nothing on screen said which field was at fault. The schema moved into
`product-form-schema.ts` so its guards can be parsed rather than only read, the
field renders its own error, and a sweep asserts every optional number on the
form survives NaN.

A second defect sat underneath it: the placeholder promises « Illimité », the
storefront renders an uncapped checkbox group, and both platform syncs publish
`choices.length` — while `orderLine.ts` read an absent maximum as **one**, under
a comment claiming to match the storefront. So a diner who ticked the two sauces
the menu offered was refused at the moment of payment, by a sentence naming a
maximum nobody had configured. Absent now means unlimited on all four surfaces.
The test that blessed the old reading is rewritten and says so.

**3. The promotion form sold two discount types no order could ever be given.**
`resolvePromotionDiscount` threw `not_applicable` on `free_product` and `bogo`
at order time and always had; `promotions.create` stored them happily. An owner
built a campaign and printed flyers for it. Both are now refused at creation and
at update, with a `ConvexError` naming what to use instead, and the form takes
its options from `HONOURABLE_DISCOUNT_TYPES` — the resolver's own list — so
implementing either type returns the option on the same commit. Rows stored
before the guard stay listed, deletable, and honest: their value column reads
« Aucune remise appliquée ». `promotions`' two duplicate-coupon-code refusals
became `ConvexError`s in the same pass; as plain `Error`s the admin read
"Server Error" where the French sentence should have been.

**4. Two badges on French storefront screens spoke hardcoded English.**
`OrderStatusBadge` and `StoreStatusBadge` held eleven English labels between
them and took no label from outside, so a diner following their order read
« Preparing » and « Out for Delivery » between French sentences. The vocabulary
now lives once in `@be-in-digital/core/status-labels` — the source-language word
and the catalogue key, per status — the badges take a `labels` override, and
`useOrderStatusLabels` / `useStoreStatusLabels` in `@be-in-digital/restaurant`
resolve it through `t()` for the locale being rendered. Two further copies of
the same eight words are gone with it: a private map in the order page and
`getOrderStatusLabel`'s English map. `order.delivered` was missing from the
catalogues and is added in fr, en and es.

**5. The card path could not be turned off.** `payments.cardProvider` was a
`stripe | sumup` union with no third answer, and the checkout rendered the card
tile unconditionally — so a cash-only food truck, one of the five verticals this
engine is sold for, shipped with a pre-selected payment method it could not
honour. `none` is now a stored value; `cardPaymentAvailability` answers `card`
and `cardOffered` as two separate questions, because a provider that is merely
unconfigured owes the diner a greyed tile saying so while an owner who does not
take cards owes them no tile at all. Réglages → Paiements carries the switch,
and warns when the last method is turned off.

The guest dead-end behind it is closed too. Cash requires an account by recorded
decision, so a cash-only establishment left every guest facing an empty grid
under a disabled button reading « Choisissez un moyen de paiement ». The
checkout now says which of the two situations it is and renders the sign-in
where the diner is blocked. The test that asserted that button is rewritten.

Closes #376.
