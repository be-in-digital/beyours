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
with its text visible even when `showLabel` is false, and is announced as the
restaurant's own wording rather than as an allergen. The obvious prefix is the
wrong one: an owner writing `sans gluten` into the allergens field would
otherwise be announced "Allergène : sans gluten" — "Allergen: gluten-free", the
exact inversion of what they declared. The same held for `halal`, `bio` and
`fait maison`. A value carrying a negation symbol (`gluten ✗`) is never resolved
either, because normalisation would otherwise delete the symbol and leave the
bare allergen behind. A leading hyphen is deliberately *not* treated as
negation: in a menu it is a bullet, and reading it as a minus would hide a real
declaration.

Dropping the badge, or folding the value into a generic "other", would hide a
disclosure — the hazard the crash was hiding in the first place. Only names of
the allergen *category* are in the alias table: an ingredient that merely
contains one ("beurre", "crevette", "fruits de mer") is deliberately absent,
because naming an allergen the owner did not write is worse than leaving the
badge unstyled. Bare `céréales` went the same way: Annex II says *céréales
contenant du gluten*, and rice is a cereal.

**`showLabel` now defaults to `true`.** An icon on its own is not a disclosure —
a carrot for celery, a wine glass for sulphites and sparkles for sesame tell a
diner nothing, and neither call site passed a label. English `shellfish` is now
its own entry reading "Crustacés et mollusques" rather than an alias for
crustaceans, because the word spans Annex II §2 *and* §14 and narrowing it drops
a mollusc declaration.

**The cast is gone.** `AllergenBadgeProps.allergen` is `Allergen | (string & {})`
— the type the database actually produces, with autocomplete on the known keys —
so both call sites now pass the raw value and `import type { Allergen }` is no
longer needed there.

Two siblings of the same bug went with it. `OrderStatusBadge` indexed its config
unguarded while the schema union carries eight statuses to its six, so its
caller papered over the gap by folding `out_for_delivery` and `completed` onto
`delivered` — a purple "Delivered" badge for an order still in the van, sixteen
lines above a label reading "En livraison". The component declares all eight
statuses now and the fold is gone, along with its `as OrderStatus` cast. And all
three badge lookups — including `StoreStatusBadge`,
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

Guarding only `originalAmount` would leave the identical hole on the other
operand, so the whole condition is coerced. The discount is now resolved once,
to an object or to nothing, which also keeps out the other strings it printed:
`Infinity` passed a naive `> 0` check and gave "-NaN%", a negative amount gave
"-150%", and a 0.4% markdown rounded to a meaningless "-0%".

Four more icon-only controls elsewhere in the package were named while the sweep
was open: the toast dismiss, the admin sidebar's open and close — the hamburger
being the only route to the admin navigation below `md`, so a blind owner on a
phone could not open the menu at all — and the filter chip's remove, whose
`Badge` text is a sibling of the button and so named nothing.
`PaginationEllipsis` had `aria-hidden` on the element wrapping its own sr-only
label, which prunes the subtree and killed the very text somebody wrote to name
it.

The package had one test file covering fifty-eight components. It now has eight,
holding all of the above — including the cases three adversarial passes proved
the first round of tests could not see.
