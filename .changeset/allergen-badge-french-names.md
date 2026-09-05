---
"@be-in-digital/ui": major
---

Stop the allergen badge crashing on the allergen names the data actually holds

`AllergenBadge` looked up a nine-key English union — `gluten`, `dairy`, `nuts`,
`shellfish`, `eggs`, `soy`, `fish`, `vegetarian`, `vegan` — and indexed it
unguarded: `allergenConfig[allergen].icon`. The field behind it is
`allergens: v.array(v.string())` (`packages/convex-schema/src/tables/catalog.ts:104`),
and the values in it are French. The repository writes them itself:

```
apps/reference/convex/seedKitchenOrders.ts:188        ["arachides"]
packages/convex-schema/src/__tests__/validators.test.ts:90  ["gluten", "lactose"]
apps/reference/tests/convex/kitchen-auto-print.test.ts:197  ["gluten", "lait"]
```

and an owner types more of them by hand into the comma-separated *Allergenes
(suggestion IA)* field at
`packages/admin/src/pages/products/image-to-product/suggestion-card.tsx:201`,
after a GPT extractor prompted in French (`apps/reference/convex/imageToProduct.ts:225,251`,
"Langue : francais") has already filled it in French. Measured with
`renderToStaticMarkup`, every one of those crashed:

```
× arachides   × lactose   × fruits à coque   × crustacés   × oeufs   × GLUTEN
  -> TypeError: Cannot read properties of undefined (reading 'icon')
```

The caller laundered the string into the union — `allergen as Allergen`,
byte-identical in both apps at `components/storefront/product-detail-client.tsx:206`
— so nothing type-checked the lie. The page that died is the dish page, which is
the page carrying the allergen disclosure Annex II of Regulation (EU) 1169/2011
makes mandatory.

**The union now names the fourteen allergens that regulation makes a restaurant
declare**, not nine arbitrary ones: gluten, crustacés, œufs, poisson, arachides,
soja, lait, fruits à coque, céleri, moutarde, sésame, sulfites, lupin,
mollusques — plus the two dietary markers the component already carried
(`vegetarian`, `vegan`). `dairy` and `shellfish` still resolve, so no existing
caller breaks.

**Input is normalised before lookup**: lower case, ligatures expanded, accents
stripped, punctuation collapsed. `Fruits à coque`, `FRUITS A COQUE` and
`fruits-a-coque` all land on the same row, and so does `Œufs` — `œ` is a single
code point that NFD does not decompose, so without the ligature step the correct
French spelling normalises to `ufs` and misses the table.

**An allergen the component does not recognise renders as the owner typed it**,
with its text visible even when `showLabel` is false. Dropping the badge or
folding the value into a generic "other" would hide a disclosure, which is the
hazard the crash was hiding in the first place. Only names of the allergen
*category* are in the alias table: an ingredient that merely contains one
("beurre", "crevette", "fruits de mer") is deliberately absent, because naming
an allergen the owner did not write is worse than leaving the badge unstyled.
Negations are absent for the same reason — `sans gluten` must never resolve to
`gluten`.

**The cast is gone.** `AllergenBadgeProps.allergen` is `Allergen | (string & {})`
— the type the database actually produces, with autocomplete on the known keys —
so both call sites now pass the raw value and `import type { Allergen }` is no
longer needed there.

Two siblings of the same bug went with it. `OrderStatusBadge` indexed its config
unguarded while the schema union carries eight statuses to its six; it now falls
back to `pending`. And all three badge lookups — including `StoreStatusBadge`,
which had the `??` guard already — went through an object literal, so
`statusConfig["constructor"]` returned a *function* that `??` never catches, and
`.className` rendered `undefined` into the class attribute. An owner can type
`constructor` into an allergen field. All three now ask `Object.hasOwn`.

**Icon-only controls in this package now carry accessible names.** Measured
before: `QuantitySelector` rendered two unlabelled buttons and an input with no
`id`, no `<label>` and no `aria-label` — three unnamed controls, so a blind diner
could not tell which one added an item; `AllergenBadge` and `SpiceLevelIndicator`
carried only a `title` on a non-interactive `<div>`, which is not a reliable
accessible name and never surfaces on touch, so a diner could not hear that a
dish contains nuts. `QuantitySelector`, `CartItem`, `AllergenBadge` and
`SpiceLevelIndicator` now name every control, hide their decorative icons from
the accessibility tree, and take overridable `labels`. Customer-facing text
defaults to French, matching `PriceDisplay`, which already formats in `fr-FR`.

**`PriceDisplay` no longer prints a stray `0`.** The guard was
`showDiscount && originalAmount && originalAmount > amount`, which evaluates to
the *number* `0` when `originalAmount` is 0, and `{0 && …}` renders `0` in JSX:

```
render(<PriceDisplay amount={12.5} originalAmount={0} />)
-> <span class="text-lg font-bold">12,50 €</span>0
```

The package had one test file covering fifty-eight components. It now has seven,
holding all of the above.
