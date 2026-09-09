# @be-in-digital/ui

## 4.3.0

### Minor Changes

- 549026f: Measure the colours the sweep was dropping, and stop the motion nobody could

  The contrast sweep reported 150 failing pairs in `apps/themes` and excluded all
  150 for an unresolved surface. The guarded count was zero: a suite that had
  measured nothing was green, which is worse than a red one because a green check
  is read as an answer.

  `scanContrast` regions now take an optional `surface` — the colour a shell in
  another file paints behind the tree, as a hex for a literal or as a TOKEN name
  for a shell that paints `bg-background`, since the admin's surface differs
  between the two colour schemes and a hex cannot say that. Declaring three of
  them resolved 138 of the 150: the QR-game screens on `#120d1a`, the kitchen
  display on `#0f172a`, and the admin on `SidebarInset`'s `bg-background`. The
  twelve that remain are text over the hero photograph, which no static reading
  can resolve and which the app suites now pin by filename, so a new unresolvable
  surface fails instead of joining a silent pile.

  That exposed 89 real failures. Two were faults in the scanner —
  `cursor-not-allowed` is the other spelling of "inactive" beside
  `pointer-events-none` and was not exempted under 1.4.3. The rest were four
  habits: a raw Tailwind hue where `--success`/`--warning`/`--destructive` exists,
  an opacity modifier on text (`text-muted-foreground/30` at 1.48:1), a chip
  tinted with its own ink (`bg-amber-500/10 text-amber-500` at 1.95:1), and a
  light-only palette pair read in dark mode (`text-orange-600` on
  `bg-orange-50/50` at **1.109:1**). `SpiceLevelIndicator`'s unlit flames were
  1.48:1, so a level of two out of five looked like two out of two.

  Alongside them, `prefers-reduced-motion` reaches framer-motion for the first
  time. The CSS block named `.animate-in` — one element in the app — and could
  never have reached a library that writes inline `style` per frame, so the
  preference applied to none of the ten `motion.*` elements on the buying path.

### Patch Changes

- Updated dependencies [549026f]
  - @be-in-digital/core@4.1.0

## 4.2.0

### Minor Changes

- e5394e5: Serve no draft dish, settle the hours the screen promises, and measure the targets

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

## 4.1.0

### Minor Changes

- 0ad1a85: Render the focus ring at the opacity the guard measures, and pair the tour popover

  The engine half of #436, which changed two published packages and shipped no
  changeset with them. Without this the fixes below sit on `main` and reach no
  client site — the templates in that PR travel by the mirror, but these do not.

  **The focus indicator was below AA on every screen.** The token matrix in both
  apps checks `--ring` at full opacity, and all twelve primitives rendered it as
  `focus-visible:ring-ring/50` — shadcn's stylistic default, carried in
  unexamined. Half a token is not half as visible: alpha composites toward the
  page, so the measured ratio was not 5.03:1 but 2.13:1 in the light admin,
  2.61:1 in the dark, 2.42:1 on the light storefront, against the 3:1 WCAG 1.4.11
  asks of a control. Only the dark storefront cleared, at 3.09:1, and under a
  vertical template it was worse — `pizzeria` measured 2.10:1. A keyboard user
  could not see where they were. Accordion, Badge, Button, Checkbox, Input,
  InputGroup, Select, Slider, Switch, Tabs and Textarea now render the token the
  test already trusted.

  This is a visible change: the ring is a solid 3px in the brand colour rather
  than a soft wash. That is the point of it, and `--ring` is guaranteed to clear
  3:1 against the page in all four scopes before it is drawn.

  **`loadTokens` can read a cascade.** It read `app/globals.css` and stopped,
  which measured the palette no delivered site runs — `app/layout.tsx` imports
  `@/site/theme.css` after it. It takes an optional `overlays` argument now, so a
  sweep can reproduce the stylesheet order a client actually gets. Additive: every
  existing call is unchanged.

  **The onboarding tour was white text on a white box.** `styles.popover` spread
  reactour's `base` — a white background and no `color` — so the sentence
  inherited `--foreground` from the admin above it. Fine in light mode at
  20.147:1; near-white on white in dark, measured in Chromium at 1.045:1, over all
  28 steps, for every owner whose machine is in dark mode. It now takes
  `--popover`/`--popover-foreground`, so a theme moves both members together.

### Patch Changes

- Updated dependencies [b9e20ea]
- Updated dependencies [6d6df2d]
  - @be-in-digital/core@4.0.0

## 4.0.0

### Major Changes

- e4955e7: Take the dead half of four published packages off the client's API

  The sweep behind #413 counted, rather than guessed, what these packages export
  that nothing imports. Most of it is harmless clutter, and
  `tasks/reference-themes-divergence.md` already ruled on that class: removing a
  name from a published package is "a breaking major that buys nothing but a
  shorter barrel", so twenty consumer-free `packages/ui` components stay. What
  follows is the residue that argument does **not** cover — exports that are
  broken rather than merely unused, and exports left behind by a removal that only
  finished on one side of a package boundary.

  **`@be-in-digital/ui` shipped a second toast system whose hook could only
  throw.** The product's toasts are `sonner`, mounted in each app's
  `app/providers.tsx` and imported by 129 files. Beside it, `Toast.tsx` held a
  module-private `ToastContext` defaulting to `undefined`, and exported a
  `ToastProvider` that supplied it and a `useToast` that threw `useToast must be used within ToastProvider` when it was
  absent — and `ToastProvider` was mounted in no app, no package and no test. So
  `useToast` was not an export nobody happened to import; it was an export with no
  reachable behaviour except the throw. A probe run before the removal confirmed
  both halves: the hook resolved off the root barrel as a function, and rendering a
  consumer of it raised that exact error. Provider, hook and context are gone. (Only the first two were ever on the
  published API; an earlier draft of this note said all three were.)
  `Toast` — the presentational box, which needs no provider and carries the
  accessible-name test for its dismiss button — deliberately stays, because "a hook
  whose every call throws" and "a component nobody imports" are different claims
  and only the first was acted on. `packages/ui/src/__tests__/one-toast-system.test.ts`
  holds it: the barrel is `export * from "./Toast"`, so anything added to that file
  is republished without a second decision, which is how the provider reached a
  client API in the first place.

  **`@be-in-digital/marketing` kept the pure half of a mutation #397 removed.**
  That PR deleted `incrementRevenue` from `convex-functions` and left a tombstone
  saying why — nothing writes a `converted` email event and no order carries the
  campaign that led to it, so the attribution behind a "revenu attribué" figure
  does not exist in this schema. `incrementRevenueStat` computed the identical
  `{ revenue + amount, converted + 1 }` shape for that caller, on the far side of a
  package boundary, and was kept alive only by its own two tests. It now carries
  the same tombstone in `stats.ts`. Two siblings in that file,
  `incrementCampaignStats` and `calculateSubscriberMetadata`, are equally
  consumer-free — but they are the barrel-pruning case the divergence doc rules
  against, not the finishing of a removal, so they are recorded here and left
  alone.

  **`@be-in-digital/restaurant` published five cart selectors nothing selected
  with.** `useCartItems`, `useCartSummary`, `useCartItemCount`, `useCartOrderType`
  and `useCartStoreId` were compiled into `dist` and exported from both the root
  and `./hooks`, with zero references in either app, any package or any test. The
  storefront reaches for `useCartStore` with an inline selector instead — about
  sixty call sites — which is the ordinary Zustand idiom and the reason the
  wrappers never took. `useCart` stays: `packages/mcp-server`'s registry tells a
  client developer to import it, so removing it would break an instruction rather
  than an unused export. `apps/docs` taught `useCartSummary` in two code samples
  and now teaches `getSummary` off the store, which is what the cart page actually
  does.

  **`@be-in-digital/admin` exported four components no screen mounts.** Two auth
  forms — `ForgotPasswordForm` and `ResetPasswordForm` — which both apps rewrote
  inline from `@be-in-digital/ui` primitives rather than import, plus a
  `StatusBadge` and a `DateDisplay`. The `StatusBadge` _interface_ in
  `lib/vocabulary.ts` is a different, live thing and is untouched.

  **Two more were deleted and put back, and the reason is worth keeping.**
  `PropagationModal` and `DuplicateCatalogModal` are mounted by nothing either, and
  the first draft of this change removed them on the stated ground that "there is
  no propagation or catalogue-duplication path in `convex-functions` at all". That
  was false, and adversarial review caught it: `products.updateWithPropagation`
  and `products.duplicateCatalog` both exist, are registered as `storeMutation` in
  both apps, are permission-guarded, and are covered by `catalogue-scope.test.ts`
  and `authorization.test.ts`. `PropagationModal`'s
  `onConfirm(scope, targetStoreIds)` is an exact match for
  `updateWithPropagation`'s validator. They are the unmounted UI of a _built_
  feature — multi-store propagation, which is what "1 restaurant owner = 1-∞
  locations" is made of — and that closes by wiring them in, not by deleting them.
  Recorded as the near-miss it was: this repository's own named failure mode is a
  claim nobody checked, and this one would have shipped as the changelog of a
  major bump.

  **`@be-in-digital/core` carried 466 lines of i18n examples.** Fifteen exported
  `example1_…` through `example15_…` functions, on no barrel, in no `exports` map
  and in no `tsup` entry — so never compiled into `dist`, but shipped in the
  tarball by `"files": ["dist", "src"]`. No supported import path reaches them,
  which is why this is a patch. Two `apps/docs` pages cited the file for a claim
  about the package shipping no JSX; they now make that claim on their own
  authority.

  `@be-in-digital/mcp-server` is a patch because its registry advertised `Toast` to
  client builds as a "Toast notification system". It is a box, and now says so.

  **One thing this does NOT do, said plainly.** The class (c) sweep in the same
  change removes 71 public _registrations_ from `apps/*/convex` while leaving the
  handler definitions they wrapped exported from `@be-in-digital/convex-functions`
  — so roughly sixty definitions there now have no registration anywhere. That is
  deliberate, and it is the opposite of what was done to `incrementRevenueStat`
  above, so the difference is worth stating. `incrementRevenue` was removed by
  #397 _with a tombstone explaining that the figure it computed cannot exist in
  this schema_, and the marketing half computed that same impossible figure. These
  definitions compute things that are perfectly possible; they are the
  implementation a restored six-line wrapper would call, which is how a screen
  gets wired to one again. Pruning them is a decision about that package's own
  surface, not a loose end of this one.

### Minor Changes

- 13d9aa6: Measure every rendered colour pair against WCAG AA, and let branding reach the storefront

  Raised by an owner from real use — "parfois les couleurs ne sont pas très
  visibles" — and then measured. Three things were true at once.

  **Nothing measured the colours nobody derives.** `readableForeground` guarantees
  AA for the palette the Design screen derives, and a 262 144-colour sweep holds
  it. It says nothing about a `text-zinc-400` typed into a className or a
  `--muted-foreground` read out of `globals.css`, and that is where the failures
  were. `lib/contrast.ts` is the WCAG arithmetic for any colour a stylesheet can
  produce — oklch (Tailwind v4's palette), HSL triples (the tokens), hex
  (literals) — with alpha compositing and the group-opacity rule that a naive
  model gets backwards. `lib/contrast-scan.ts` walks the JSX with the TypeScript
  compiler, resolves each element's effective foreground and background through
  its ancestry, per colour scheme and per interactive state, and returns every
  pair below the floor. Both are exported (`./contrast`, `./contrast-scan`); the
  numbers agree with Chromium on 194 of the first 199 pairs to within 0.06, and
  the five that differ are above 7:1.

  **An establishment's colours never reached its own storefront.** `globals.css`
  declares the storefront palette on `.storefront-theme`, which is a `<div>`;
  this stylesheet targeted `:root` and `.dark`, which are `<html>`. A custom
  property declared on an element beats the one it would have inherited, so every
  token the scope names was overwritten straight back to the engine green.
  Measured in Chromium: a store that picked `#d32f2f` rendered `rgb(211, 49, 49)`
  in its admin and `rgb(13, 94, 64)` on the page a diner reads. `buildBrandingCss`
  now takes `scopes`, and the storefront passes `[".storefront-theme"]`.

  **Two derived tokens were missing, and both had a literal standing in for
  them.** `--accent-solid-foreground` is the label for the cart badge and the
  "nouveau" pill, which the storefront wrote as `text-white` — 2.78:1 on the
  shipped orange and 1.1:1 on a yellow an owner may pick. `--primary-ink` is the
  brand colour a _word_ can be written in, as opposed to the one a button is
  filled with: `--primary` stays exactly the colour the owner chose because that
  is the point of choosing it, and `text-primary` asks the same value to be read
  on the page, which `#f97015` cannot do at 2.85:1. The ink is the same hue walked
  until it clears AA against the page, which is the treatment
  `--accent-foreground` already had. Both are swept over the colour cube.

  `--sidebar-primary-foreground` is derived too. It was a fixed white in both
  shipped palettes and the sidebar's own selected item measured **2.57:1** in dark
  mode, where `--primary` is lifted to a light orange — the chrome an owner looks
  at all day.

  Every derived label is now chosen for the colour that will actually be
  **painted**. `formatHsl` emits whole degrees and whole percents, and picking a
  label for the unrounded candidate is a guarantee about a number nobody sees: it
  left one pair at 4.4911:1 (`#a05010`). A sweep over the colour cube holds each
  emitted fill against its emitted label, and fails at exactly that value if the
  rounding is dropped.

  Dark-mode guarantees are now measured against the _lightest_ dark ground the
  stylesheet is emitted for, so they hold on the storefront's as well as the
  engine's.

  Also: the two exhaustive sweeps in `branding.test.ts` carry an explicit budget.
  They were red in CI at 5 791 ms against Vitest's 5 000 ms default — a guard
  failing for a reason that has nothing to do with contrast is a guard people
  learn to ignore.

### Patch Changes

- Updated dependencies [e4955e7]
- Updated dependencies [e4955e7]
- Updated dependencies [58f890f]
- Updated dependencies [ecb21a1]
  - @be-in-digital/core@3.0.0

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
