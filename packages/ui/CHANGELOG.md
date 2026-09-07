# @be-in-digital/ui

## 3.1.0

### Minor Changes

- 16521f2: Fix the diner's broken first-day moments

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
  « Instructions livraison: » even on a dine-in ticket, and the kitchen _screen_
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

### Patch Changes

- Updated dependencies [16521f2]
  - @be-in-digital/core@2.5.0

## 3.0.0

### Major Changes

- 158019f: Stop the allergen badge crashing on the allergen names the data actually holds

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

  and an owner types more of them by hand into the comma-separated _Allergenes
  (suggestion IA)_ field at
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
  bare allergen behind. A leading hyphen is deliberately _not_ treated as
  negation: in a menu it is a bullet, and reading it as a minus would hide a real
  declaration.

  Dropping the badge, or folding the value into a generic "other", would hide a
  disclosure — the hazard the crash was hiding in the first place. Only names of
  the allergen _category_ are in the alias table: an ingredient that merely
  contains one ("beurre", "crevette", "fruits de mer") is deliberately absent,
  because naming an allergen the owner did not write is worse than leaving the
  badge unstyled. Bare `céréales` went the same way: Annex II says _céréales
  contenant du gluten_, and rice is a cereal.

  **`showLabel` now defaults to `true`.** An icon on its own is not a disclosure —
  a carrot for celery, a wine glass for sulphites and sparkles for sesame tell a
  diner nothing, and neither call site passed a label. English `shellfish` is now
  its own entry reading "Crustacés et mollusques" rather than an alias for
  crustaceans, because the word spans Annex II §2 _and_ §14 and narrowing it drops
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
  `statusConfig["constructor"]` returned a _function_ that `??` never catches, and
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
  the _number_ `0` when `originalAmount` is 0, and `{0 && …}` renders `0` in JSX:

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

- cde4410: One design system, and per-store theming that reaches a diner

  Two structural defects, resolved together because the first cannot work until
  the second is settled: theming has to drive one design system.

  **Per-store branding painted nothing.** The Design screen has always written
  `stores.branding` — colours, typography, logo — and nothing read the colours
  back. `--primary` had exactly one definition per app, the literal `24 95% 53%`
  in `app/globals.css`, so every establishment the engine has delivered shipped
  the same orange. `buildBrandingCss` turns the stored blob into design tokens
  and `StoreTheme` paints the storefront with them, following the same
  establishment the rest of the storefront follows. Colours are re-emitted from
  parsed numbers and font families rebuilt from an allowed character set, because
  `updateBranding` validates a type and a length, not grammar. The foreground on
  a brand colour is chosen by contrast ratio rather than fixed to white — white
  on `#ffeb3b` is 1.07:1, a button whose label cannot be read.

  **The design system was forked five ways.** `packages/ui` (50 components),
  `apps/reference/components/ui` (37), `apps/themes/components/ui` (37,
  byte-identical to reference), `packages/admin/src/ui` (9). Sixteen of the
  twenty-six shared names had drifted: a default Button was `h-10` in the package
  and `h-9` in the apps, with different focus rings, so one storefront rendered
  two button heights depending on the page. There is now one implementation, in
  `packages/ui`, on the newer shadcn generation, reached through one specifier.

  Breaking changes for `@be-in-digital/ui`:
  - `Input`, `Textarea` and `Checkbox` are bare primitives. The composed-field
    API (`label`, `error`, `description` props and a wrapping `div`) is gone —
    pair them with a `Label`, which is what every call site but two already did.
  - `Breadcrumb` is the composable seven-part set. The data-driven component that
    took `items` is gone, and with it the `BreadcrumbItem` _type_ — that name is
    now a component.
  - `Alert` keeps `warning` and `success` but loses its `title` prop and its
    automatic icon map; use `AlertTitle`, `AlertDescription` and your own icon.
  - `Button` sizes shift to the current generation (`default` 40px → 36px) and
    gain `xs`, `icon-xs`, `icon-lg`. `Card`, `Switch`, `Label`, `Badge`,
    `Skeleton`, `Table` and `Tooltip` change geometry with them.
  - `ButtonProps`, `InputProps` and the other per-component prop interfaces are
    no longer exported; the components are typed from `React.ComponentProps`.
  - The package is published as TypeScript source. `exports` points at `src`,
    there is no `dist`, and consumers must transpile it. This is what restores
    the `"use client"` boundaries the bundler was stripping.

  `@be-in-digital/admin` no longer carries its own copy of nine primitives, and
  re-exports the sidebar from `@be-in-digital/ui`.

  `@be-in-digital/convex-schema` gains a typed `StoreBranding` and
  `StoreDoc.branding`, which were implicitly `any`.

### Patch Changes

- bd7a656: Wire up dine-in table numbers, and make the four allergen surfaces agree

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
  configured — a restaurant can serve _sur place_ without ever running the wheel
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

- Updated dependencies [c9619e2]
- Updated dependencies [bd7a656]
- Updated dependencies [bd17a78]
  - @be-in-digital/core@2.4.0

## 2.0.3

### Patch Changes

- 8ce83cb: Publish the packages whose source has been ahead of the registry since July,
  and fix the one thing that kept a client site from compiling even then.

  `@be-in-digital/integrations`, `@be-in-digital/marketing` and `@be-in-digital/ui`
  all still sit at **2.0.2 on GitHub Packages**, and all three have had source
  changes merged since — without a version bump. `changeset publish` then answers
  `already published` and skips them, so the registry keeps serving the July
  build under a version number the repository has since changed. Published 2.0.2
  and workspace 2.0.2 are two different sets of code.

  Nothing catches it in this repository, because `apps/themes` links these
  packages with `workspace:^` and compiles against the current source. Only a real
  client site installs the published artefact — and `beyours-boilerplate` has been
  failing its type-check since 2026-08-16 for exactly this reason:

  ```
  convex/emailCampaignActions.ts:136  Expected 2-3 arguments, but got 4
  convex/uberDirect.ts:387            Property 'uberDirect' does not exist on ...
  ```

  What each package has been withholding:
  - **`integrations`** — the whole **Uber Direct** module (`#66`: book, track and
    cancel a courier, ~950 lines under `src/uber-direct/`) is exported from
    `src/index.ts` and absent from the published bundle. A feature the fleet has
    never received.
  - **`marketing`** — `renderTemplateToEmailHtml` gained a fourth `options`
    argument and `absolutiseUrls` became public (`#185`). Without them, a campaign
    email built by a client site renders `/api/files/…` paths that resolve to
    nothing inside an inbox, and the call site does not compile.
  - **`ui`** — the storefront fix that keeps `draft` establishments out of the
    public site (`#116`), plus accessibility repairs: `Switch` announces itself as
    a switch rather than a checkbox, `Card` carries the `data-slot` every other
    primitive has, `AddressAutocomplete` labels its fields, and `Dialog` stops
    overflowing the viewport.

  **`admin` carries one real fix.** It ships raw TypeScript (`files: ["src"]`,
  every `exports` entry pointing at a `.ts`), so a consumer type-checks its source
  — and `@types/qrcode` sat in `devDependencies`, where an installing client never
  sees it. `qr-codes-page.tsx` therefore failed to compile in every client site
  while compiling fine here, because `apps/reference` happens to declare those
  types itself. For a package that ships source, an `@types/*` backing a runtime
  dependency is part of the public type surface: moved to `dependencies`.
  `@types/react` stays in `devDependencies` — React is a peer dependency and the
  consumer brings its own.

  Otherwise no source changes — only the versions the registry should have been
  serving.

  Verified against a real `beyours-boilerplate` clone with these four packages
  built from this branch and installed in place of the published ones: `tsc
--noEmit` goes from four errors to clean.

## 2.0.2

### Patch Changes

- 7f0122b: Republished from main. Fixes two problems with the 2.0.1 tarballs that broke consumers:
  - `@be-in-digital/core`: the `./auth/rbac` subpath pointed at `src/auth/rbac.ts` while the tarball only ships `dist/` → broken import for consumers (`convex-functions/auth` included). `files` now includes `src`.
  - The type fixes that were on main but never published (promotion-form/email-config in admin, Uber Eats signatures in integrations/convex-functions) go out with this patch — they had been committed without a changeset.

## 2.0.1

### Patch Changes

- 1a5ca27: Rename package scope from @beindigital-engine to @be-in-digital for GitHub Packages compatibility

## 2.0.0

### Major Changes

- 7c3d4da: Configure private npm publishing for all @beindigital-engine packages

  ### What changed
  - Packages are now publishable to npm as private (restricted) packages under the `@beindigital-engine` scope.
  - Removed `"private": true` flag from all packages and replaced with `"publishConfig": { "access": "restricted" }`.
  - Added `"files"` field to control published contents.

  ### Why

  First official release of all packages on the npm private registry for distribution.

  ### How to install

  ```bash
  npm login --scope=@beindigital-engine
  pnpm add @be-in-digital/core @be-in-digital/ui @be-in-digital/restaurant
  ```

## 1.0.0

### Major Changes

- ad4d8d2: Configure private npm publishing for all @beindigital-engine packages

  ### What changed
  - Packages are now publishable to npm as private (restricted) packages under the `@beindigital-engine` scope.
  - Removed `"private": true` flag from all packages and replaced with `"publishConfig": { "access": "restricted" }`.
  - Added `"files"` field to control published contents.

  ### Why

  First official release of all packages on the npm private registry for distribution.

  ### How to install

  ```bash
  npm login --scope=@beindigital-engine
  pnpm add @be-in-digital/core @be-in-digital/ui @be-in-digital/restaurant
  ```
