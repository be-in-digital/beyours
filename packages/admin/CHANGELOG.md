# @be-in-digital/admin

## 9.0.1

### Patch Changes

- 03329a2: Fix the product form's "Ajouter un choix" button doing nothing.

  `addChoice` shallow-copied the options array and then pushed onto the option
  object inside it — the same object react-hook-form was holding. The stored
  value changed before `setValue` was told anything had, leaving `setValue` to
  compare a value against itself, so the re-render that shows the new choice row
  was not guaranteed. `removeChoice` had the same shape.

  The array work moves to `product-options.ts` as pure functions that rebuild the
  path they change and never touch their input, with unit tests pinning that
  invariant.

## 9.0.0

### Major Changes

- 8fa94a4: Stop the admin offering screens the server refuses, and keep one copy of each

  Four defects with one shape between them: a screen that exists, works, and is
  reached by nobody — or is reached by someone the server then turns away.

  **The sidebar offered "Cuisine (KDS)" to two roles whose every KDS query the
  server refuses.** The entry was gated on `orders:read`; `kitchenTickets.getByStore`,
  `getPrintQueue`, `getOverdueCount` and `getPrintStuckCount` all enforce
  `kitchen:read`. `waiter` and `delivery` hold the first and not the second, and
  both are handed out by the owner's own Team screen. Convex rethrows a refusal
  out of `useQuery` _during render_, so the click did not produce an empty screen —
  it unwound past the admin shell onto the error page. Every server and every
  driver an owner adds saw that link.

  Measured before the fix:

  ```
  nav gate for Cuisine (KDS): orders:read
  roles shown the link  : super_admin, client_admin, manager, kitchen, waiter, delivery
  roles the server allows: super_admin, client_admin, manager, kitchen
  SHOWN BUT REFUSED     : waiter, delivery
  ```

  **Four more entries named a resource their screens do not enforce.**
  `Promotions` said `games:read` for a screen gated on `marketing:read`;
  `Email Marketing`, `Blog`, `Médiathèque` and `Pages` all said `settings:read`
  for screens gated on `marketing:read` or `content:read`. Those resolve to the
  same three roles today, so nothing was visibly broken — but the resource name is
  load-bearing on its own, because the server runs a **second** gate after the role
  check: `profileAllowsPermission` maps a permission's resource onto one of the
  eight module checkboxes the invite dialog offers, and `settings` maps to the
  `settings` module while `content`, `marketing` and `games` all map to
  `marketing`. A member granted settings and not marketing was shown all four
  sections and refused all four.

  **The sidebar never consulted that second gate at all.** `canSeeEntry` checked
  the role and stopped, while `userProfiles.permissions` — the modules the owner
  actually ticked — was fetched by `AdminAuthSync` and thrown away. A manager
  invited with `["orders"]` saw every entry their role permits and was refused by
  `module_denied` on most of them. The rule now lives in `lib/nav-visibility.ts`,
  runs both of the server's gates in the server's order, and _imports_
  `profileAllowsPermission` rather than restating it — a second copy of a policy
  is a second copy to drift. `AdminAuthStore` carries `permissions`, and
  `setAuth` takes it as a fourth, optional argument; an empty list reads as
  unrestricted, exactly as the server reads it, which is what every existing
  deployment carries.

  **The KDS and Langues screens existed three times each.** The live copies sat in
  `apps/reference/components/admin/` and, byte for byte, in `apps/themes/` — 1,520
  lines of kitchen and 362 of languages, duplicated — while this package exported
  an older `KitchenPage` and `LanguagesPage` that nothing rendered and that
  `packages/mcp-server` advertised to client builds. The packaged KDS had no
  order-mode control, no "Terminées" tab, no sound manager, no print trigger, no
  marketplace accept/ready/complete actions and a four-column board for three
  statuses; the packaged Langues had no UI-overrides tab. A fix made in the engine
  reached no client, and a fix made in one app had to be made twice.

  The live screens are now here — `pages/kitchen/` (nine files) and
  `pages/languages/` — and both apps render them. `KitchenPage` takes a
  `headerAction`, which is how `apps/reference` keeps its kitchen seeder without
  re-implementing the screen around it; `LanguagesPage` takes `uiOverrides`,
  because that tab lists the template's own translation keys (`lib/i18n`) and
  differs per client, so it stays in the app. Ports were verbatim: the only
  differences from the deleted files are the import paths, `Id<"…">` narrowed to
  `string` (this package mirrors the schema without importing Convex), the Convex
  API read from `useAdminApiStore` instead of imported, and the store-resolving
  fallback switched to the package's `ResolvingStore` spinner. The two apps also
  drew the Langues title twice — once in the route, once inside a panel that was
  never passed the flag suppressing it. One header now.

  **`LanguagesTabContent` and `PaymentsTabContent` are gone**, with the `embedded`
  props that existed only to serve them (`DesignPage` carried an orphan of the
  same kind). Both wrappers embedded a per-establishment screen inside Settings,
  which is headed "Paramètres Globaux — valeurs par défaut héritées par tous les
  établissements": showing an owner with three restaurants a one-store editor
  under that heading tells them they have just changed all three. Both screens
  keep their own routes, which is where `DesignTabContent` went before them.

  **`"./pages"` resolves.** `package.json` declared
  `"./pages": "./src/pages/index.ts"` and the file did not exist — the only broken
  subpath of the eight this package publishes, and the one ten `mcp-server`
  registry entries point client builds at. The barrel re-exports the per-screen
  barrels, so a screen added to `pages/<x>/index.ts` arrives on its own.

  **A lift is a merge, and a merge picks a winner silently.** Three behaviours
  existed in only one of the two copies and were restored rather than lost:
  `TicketTimer`'s cap at `+24h` — without it a ticket nobody cleared renders
  "2237h 47m", and the fix lived only in the packaged copy nothing rendered — the
  guided tour's `data-tour="kitchen-board"` anchor, whose selector
  (`components/onboarding/tour-steps.ts`) had pointed at an attribute only the
  unrendered board carried, and that step's copy, which still described "4
  colonnes Kanban … Terminé" for a board bounded to three active statuses since
  `getByStore` stopped returning finished tickets. Two more went with them:
  `apps/*/e2e/admin/kitchen.spec.ts` built its `test.skip` guard on a message the
  screen no longer shows, so a no-store run burned 15 s and failed hard instead of
  skipping — it reads `StoreGuard`'s "Aucun établissement" heading now; and the
  station filter's "Actif" marker became a `<div>` inside a `<button>` when the
  older app-local `Badge` was swapped for this package's, which is invalid under
  the button content model.

  The ticket types were moved rather than copied: `apps/*/lib/admin/types.ts` no
  longer restates `KitchenTicket` and its five unions, so the schema change the
  docstring complains about really is made in one place now.

  **Tests: 15 files for 210 sources became 20 for 215.** Five are new, and each
  holds one of the above:
  - `nav-permission-surface.test.ts` walks the import graph from every route file
    in _both_ apps to the Convex wrapper behind every mount-time query, and fails
    if any role is shown a link the server would refuse, or if an entry names a
    resource none of its own queries enforces. Mount-time queries only:
    `useQuery`/`usePaginatedQuery` throw before anything renders, while
    `useMutation`/`useAction` run on click and are the eligibility helpers'
    business — which is why `Design` may stay gated on `stores:read` and not
    `stores:write`.
  - `nav-visibility.test.ts` checks the rule against the server's own two gates
    for every entry × 6 roles × 11 module selections. Reverting the module half
    produces 231 disagreements.
  - `app-sidebar-render.test.tsx` renders the sidebar per role and reads the links
    back out of the DOM, because a correct rule nothing invokes protects nobody.
    This is why the package's vitest environment is now `jsdom`. Its first draft
    used `renderToStaticMarkup` and was green while proving nothing: zustand reads
    through `useSyncExternalStore`, whose _server_ snapshot is the store's initial
    state, so every role rendered as the default `customer` and every "the link is
    absent" assertion passed for the wrong reason. Its second draft read only
    anchors, and so "proved" that Gamification, Email Marketing and Blog were
    hidden from everyone — they are collapsible triggers, never anchors. Both
    mistakes are why the file asserts the positive cases as loudly as the
    negative ones.
  - `kitchen-screen.test.tsx` holds the three merge casualties — the 24h cap
    (four cases, including that it does not fire a minute early), the tour anchor
    on both boards and the corrected step copy, the station marker's element — and
    asserts that the packaged KDS still carries the order-mode control, the
    Terminées tab, the sound manager, the print trigger and the marketplace
    accept/ready/complete/cancel actions the old fork had lost.
  - `page-reachability.test.ts` holds the rule the audit ended on: **an exported
    page is either mounted or gone.** Every `*Page` in `src/index.ts` must have a
    route rendering it in both apps, at the same paths; every subpath in
    `package.json` must resolve; and every page `mcp-server` advertises at
    `@be-in-digital/admin/pages` must be exported from it. `check:divergence`
    cannot help here — it compares `e2e/` and `convex/` only, so a route added to
    one app and forgotten in the other passes it in silence.

  Breaking: `PaymentsPage`, `DesignPage` and `LanguagesPage` no longer take
  `embedded`; `LanguagesPage` takes `uiOverrides` and renders its own header;
  `KitchenPage` takes `headerAction` and is the full KDS rather than the former
  board-only fork; `LanguagesTabContent` and `PaymentsTabContent` are removed.
  `setAuth` gains an optional fourth argument — existing three-argument calls keep
  working and read as unrestricted.

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

### Minor Changes

- 20ccb42: Give the contact form's messages a screen to be read on

  `contactMessages.create` was called by the storefront form. `list` and
  `updateStatus` were exposed and permission-guarded, and called by nothing: a
  customer wrote, the row landed in `contactMessages`, and the restaurant had no
  way to read it. The `status` field offered `new` / `read` / `archived`, and
  nothing could move a message between them.

  There is a Messages screen now, in the Opérations group of the admin, behind
  `customers:read`. It lists a store's messages newest first with sender, subject,
  date and status, and filters over the three statuses. Opening one is what marks
  it read; archiving it is a button in the dialog.

  The two halves of that screen are guarded differently, and the roles show it:
  `list` asks for `customers:read`, `updateStatus` for `customers:write`, and a
  manager and a waiter hold the first without the second. They read the inbox and
  change nothing in it, rather than failing on every click.

  **Breaking: `contactMessages.list` now requires `paginationOpts`.** It used to
  collect a store's whole table on every call. An inbox only grows, and until now
  nothing read it, so nobody had met the cost. Any consumer wrapping `defs.list`
  has to pass the argument through; both apps in this repository do.

  A second query, `unreadCount`, is bounded at 99 and feeds a badge on the sidebar
  entry, so a message that arrives while the owner is on another screen says so.

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

- 91d388a: Give the dining-room screen a dismissal window the owner can set

  `stores.displayConfig` decides how long a finished order stays on the
  customer-facing screen in the dining room. `kitchenTickets.getForDisplay` has
  read it since that screen shipped — `autoDismissEnabled` decides whether a ready
  order is dropped at all, `autoDismissMinutes` how long it survives — and nothing
  wrote it. Measured:

  ```
  STORED  displayConfig -> {"autoDismissEnabled":false,"autoDismissMinutes":15}  ready count = 1
  DEFAULT displayConfig -> {"autoDismissEnabled":true,"autoDismissMinutes":15}   ready count = 0
  writers via db.patch|insert|replace : 0
  readers of store.displayConfig      : 3
  ```

  So every establishment ran on the query's own fallback: **an order the customer
  is still waiting for disappeared from the wall they are watching, fifteen
  minutes after the kitchen called it ready, with no setting anywhere to change
  it.**

  The mutation had been deleted, and the field filed under "legacy", on the claim
  that nothing read the stored value. Three places in the repository stated that
  claim — the schema comment, the `updateSoundConfig` docblock, and
  `kitchen-sound-config.test.ts`, which certified it as a test — and the reader had
  never gone away. All three are corrected. So are four more found alongside them:
  both package CHANGELOGs (annotated rather than rewritten, as this repository's
  convention has it), `kitchen-alerts.ts` and its test, which still said
  `soundConfig` had no editor after #243 gave it one, and the audit line in
  `tasks/sales-readiness-backlog.md` that the claim originally came from.

  `updateDisplayConfig` is restored on the `updateSoundConfig` model, the field is
  typed rather than `v.any()`, and the editor is a fifth **Écran de salle** card on
  the kitchen tab, placed last because that tab is ordered as a service runs
  through it and the dining-room screen is downstream of everything.

  **The mutation refuses a window it cannot honour.** `v.number()` accepts `NaN`,
  `Infinity`, zero and negatives, and `getForDisplay` turns whatever is stored into
  `readyAt > now - minutes * 60_000`: `NaN` makes every comparison false, zero and
  negatives keep only tickets that became ready in the future — each of them
  emptying the ready column, which is the failure this setting exists to prevent,
  reached from the other side. `Infinity` is the odd one out, measured rather than
  assumed: it stores and round-trips, and quietly becomes a second, undeclared way
  to say "never dismiss" when `autoDismissEnabled: false` is the declared one. All
  are refused rather than clamped — silently storing a number other than the one
  sent is how a setting comes to disagree with the screen it governs, and it would
  put a value nobody typed into the audit trail. The editor clamps its own input to
  the same range, and a test pins the two ranges together so they cannot drift.

- ec8e3ea: Ship the gamification player flow in the client template

  `apps/themes` — the app a paying client runs — carried a 37-line placeholder
  where the bench had the whole player flow, and four admin screens behind
  `ComingSoon`. That gap was documented as deliberate rather than closed, on the
  grounds that "gamification is not part of what a client buys today". A client's
  deployment served it anyway: all seven Convex wrappers were live and
  byte-identical, `convex/gameEmail.ts` was already emailing a `/game/prize/<code>`
  link to a route that did not exist in the template, and `/dashboard/games` was
  never stubbed at all — it rendered the real overview, linking to four
  placeholders.

  The flow now lives in `packages/admin/src/game/`, behind a new
  `@be-in-digital/admin/game` subpath, and both apps render it through identical
  thin adapters. Twelve components and the `lib/game` engine layer — wheel maths,
  particle canvas, Web Audio synthesis, haptics, device fingerprint — moved
  verbatim; what stayed in each app is what is genuinely per-app: the generated
  Convex API, `useCmsPage`, and the route params.

  The package cannot import an app's generated API, so the boundary is a typed
  prop rather than the `useAdminApiStore` injector the admin screens use — that
  store is filled by the `(admin)` layout, and a customer scanning a table QR code
  never mounts it. `GamePlayApi` and `PrizeTicketApi` name each function with its
  real argument shape, so a backend that exists in one app and not the other is a
  compile error in both instead of a 500 on a client's site.

  Two smaller things fell out of it. The CMS fallbacks were six inline `??`
  expressions, one branching on the game type and none of them testable; they are
  now `resolveGameCopy`, which also treats a field the owner cleared as unset
  rather than printing an empty heading. And `prizeEmoji` no longer lives at the
  bottom of the welcome screen, which two other screens were importing a value
  from.

  `/dashboard/games/settings` is gone rather than un-stubbed. The comment claiming
  the sidebar linked to it was false — `admin-routes.ts` declares five game routes
  and `nav-config.ts` links exactly those five. The bench had already deleted it;
  the template's legacy `/games/settings` redirect now points where the bench's
  does.

  **Release ordering matters here, and the mirror does not enforce it.**
  `apps/themes` now imports `@be-in-digital/admin/game`, a subpath that exists
  only from this release onwards. `scripts/publish-mirror.mjs` resolves engine
  versions from the registry (`npm view`), not the workspace, and runs
  `pnpm install --lockfile-only` with no build or type-check. Its push trigger
  includes `apps/themes/**`, which this change touches — so if the mirror syncs
  before `@be-in-digital/admin` is published, it commits a boilerplate pinned to
  the previous version, in which that subpath does not resolve. A client cloning
  or running `pnpm update:template` in that window gets a template that will not
  install. The `workflow_run: [Release]` trigger re-syncs afterwards and repairs
  it; the window is however long `ci.yml` takes, and it does not close on its own
  if the release never publishes. **Publish the package before letting the mirror
  sync, and re-run the mirror once Release reports green.**

- ab869a8: Let a paid order print itself, and stop the kitchen screen going dark

  Four defects met in the same place, and three of them had been closed once by
  deleting the thing that revealed them.

  **The kitchen cooked orders nobody had paid for.** `createWithTicket` inserted
  the order and its ticket in one transaction, before any provider redirect: a
  customer who reached Stripe and closed the tab left a slip on the pass, and
  nothing retracted it. The rule is now "a _paid_ order feeds the kitchen", and
  it lives in `releaseToKitchen` rather than in any one caller — every payment
  path reaches it through `orders.recordPaymentStatus` (Stripe webhook, Stripe
  success-page verify, PayPal capture, SumUp verify) or `markCashPaid`. It is
  idempotent, so a webhook racing its own success page still produces one ticket.

  **`orderConfirmation` is a promise the product can keep now.** It was withdrawn
  for offering a workflow nothing implemented. `releaseToKitchen` reads it:
  `"auto"` — and unset, which is every existing establishment — releases on
  payment; `"manual"` holds the order until staff accept it, which is what
  `orders.updateStatus` to `confirmed` now does.

  **Automatic printing was dead product-wide.** `stores.updatePrintConfig` had no
  caller in `packages/admin` or either app, so every establishment ran with
  `printConfig === undefined`, `kitchenTickets.create` stamped every slip
  `printStatus: "not_required"`, and `getPrintQueue` was permanently empty. The
  editor is back, in `packages/admin` this time, on the store-detail screen both
  apps already render. Beside it: the print reliability work — `claimForPrint`
  takes a ticket in one transaction so two tablets on the same pass cannot both
  print it; `getPrintQueue` returns failed slips again once their retry delay has
  passed, so `printAttempts` is finally read by something; and the trigger commits
  its render with `flushSync` and refuses to print a slip whose content is not
  there, because a blank page filed as "printed" leaves the queue and is never
  seen again.

  **The KDS query was unbounded and nothing was ever deleted.** `getByStore`
  subscribed to every ticket a store had ever had; `getByStatus` behind the
  "Terminées" tab did the same for the class that only grows. Both are bounded
  now — the live read to the three active statuses, the completed tab to a page at
  a time — and `purgeExpiredTickets` runs nightly, because bounding a read while
  the table grows for ever only moves the failure.

  **A customer's allergy reached the validator and stopped there.** The Uber Eats
  mapper extracts `special_instructions` and `customer_request.allergy` into
  `notes`; `createFromWebhook`'s item validator had no field for it and the
  webhook passed `notes: undefined` one line before the insert. Both carry it now,
  through one shared `toKitchenTicketItemsFromPlatform` rather than the same
  mapping hand-written in two byte-identical files.

  Two things the ticket never carried and the product depended on: `allergens`,
  gathered from the products ordered, which the printed slip has always had a
  block for and only demo data ever filled; and `estimatedPrepTime`, without which
  `estimatedReadyAt` was never set and the overdue alarm could not fire for a real
  order. Stations are routed as well — `stationMapping` sends a category to a
  pass, and an order is split into one ticket per station it touches, so the cold
  station is not handed a slip for a pizza.

  Breaking: `kitchenTickets.getByStatus` now takes `paginationOpts` and returns
  Convex's `PaginationResult` — `{ page, isDone, continueCursor }` — rather than
  an array, so a caller reads `result.page` and drives it with
  `usePaginatedQuery`. `printStatus` gains a `"printing"` literal, and
  `markPrintSent` / `markPrintFailed` take an optional `claimId`.

- 91d388a: Stop a product deletion from breaking Deliveroo and bricking the menu that used it

  `products.remove` was `handler: async (ctx, args) => { await ctx.db.delete(args.id) }`
  and nothing else, while thirteen columns across nine tables pointed at
  `products`. Two of them are REQUIRED — `externalProductMappings.internalProductId`
  and `favorites.productId` — so those rows survived holding an id that resolves to
  nothing and could not be repaired field by field. Measured before the fix:

  ```
  menu still holds the dead id: ["10002;products"]
  that product now resolves to: null
  favorites rows left: 1, externalProductMappings rows left: 1
  favorites[0].productId resolves to: null
  ```

  **Deliveroo was told a deleted dish had synced.** Proven end to end through the
  real signed webhook route, with only `globalThis.fetch` standing in for
  Deliveroo's servers:

  ```
  --- ordered dish was DELETED, its PLU was mapped ---
  [Sync Debug] Item PLUs: Tiramisu:PLU-TIRAMISU
  [Sync Debug] hasMissingPLU=false, hasMismatch=false
  sync_status body: {"status":"succeeded","occurred_at":"..."}
  ```

  `getByExternal` returned the surviving mapping without ever dereferencing
  `internalProductId`, so the webhook's PLU loop counted zero unmatched items and
  answered `sendSyncStatus(..., "succeeded")` for an order the kitchen cannot
  cook. **And the formule became permanently uneditable**: `menus.update`
  re-validates every stored section as a unit, so one dead id refused every
  subsequent write — including the one removing that section.

  **The decision is per referencing table, and it splits on authorship**, which is
  the reasoning `categories.remove` already established: a cascade destroys an
  afternoon's work on a click meant to tidy up.
  - **Refused** while they point at the dish — `menus`, `promotions`, `prizes`.
    Each is a selling decision the owner made, and each has a screen to unmake it
    on. The refusal names them: _Ce produit est utilisé dans 1 formule : "Formule
    Midi"._
  - **Cascaded** — `externalProductMappings` and `favorites` (machine-kept rows
    that mean nothing without the dish), `orphanProducts` (the platform match is
    void, so the import returns to `pending` for review), and the
    `linkedProductId` provenance link on twins in other establishments.
  - **Left alone** — `orders.items[].productId`. What was sold is history, the
    column is already optional, and rewriting it would falsify the receipt.

  `favorites` gained a `by_productId` index. Every index on that table started at
  `userId`, so reaching the customers who favourited one dish would have meant
  collecting the whole establishment's favourites inside a mutation that deletes a
  single row — the same reason `by_storeId` was added to it for the store cascade.

  The refusals are `ConvexError`, not plain `Error`: Convex redacts a plain
  error's message in production, so a carefully counted refusal would have reached
  the owner as "Server Error" and read as a bug in the product — the same
  reasoning `auth.ts`'s `denied()` records. The products table was throwing that
  sentence away too, showing a generic _Échec de la suppression du produit_; it
  now shows the reason, through a `convexErrorMessage` reader added to this
  package.

  **`getByExternal` dereferences the product**, and keeps doing so after the
  caller was fixed. `products.remove` can no longer create such a row, but a store
  cascade, a restore or a hand-run mutation all arrive at this same query, and "we
  have a mapping" must never outlive "we have the dish". `getByInternal` is
  deliberately left alone: it is keyed on a product id the caller already holds,
  so it cannot manufacture a match for a product nobody asked about.

  **Two more routes to the same `succeeded` were found by an adversarial pass and
  closed.** Both produce the identical customer-visible outcome, reached without
  deleting anything.

  The webhook accepted `pos_item_id` **or** `plu` **or** `external_reference_id`
  as a POS identifier when testing for "no identifier at all", but the check that
  looks the identifier up in our own mappings read `pos_item_id` alone. A line
  identified by either of the other two skipped the database check entirely. All
  four sites now resolve the identifier through one `posItemId()` helper, which
  uses `||` rather than `??` because an empty string is not an identifier — with
  `??` a line carrying `pos_item_id: ""` alongside a real `plu` stopped at the
  empty one and a dish we can cook was refused.

  And **the mapping lookup spanned the whole deployment.** A PLU is unique inside
  one restaurant, not across an account, so an order for one establishment whose
  PLU happened to be mapped in ANOTHER was answered as producible by a kitchen
  that has never heard of the dish. The same span made `.unique()` throw the
  moment two establishments shared a PLU string — which is exactly what a chain
  running one menu across its locations does — and the caller counts a throw as an
  unmatched item, so a correct multi-store deployment refused its own orders.
  `getByExternal` now takes the establishment and reads a new
  `by_store_platform_external` index. Both directions are pinned by tests that
  were confirmed to fail without the change: the cross-tenant line answered
  `succeeded`, and the shared-PLU chain answered `failed`.

  **The store-cascade guard now sees foreign keys by type, not by name.** It read
  `validator.fields.storeId` — the field literally called `storeId` — which is not
  the same question as "what points at `stores`". Measured over the compiled
  validators: 46 FK columns, 43 named `storeId`, three invisible. More to the
  point, so was the next column somebody would call `restaurantId`, which is the
  exact failure the guard exists to prevent. It now walks the serialised validator
  by type and reports every path reaching `v.id("stores")`, however nested and
  whatever it is called. Verified by injecting `restaurantId: v.optional(v.id("stores"))`
  into an existing table: the guard fails, where the name filter passed it
  silently.

  Walking `validator.json` rather than the live validator objects is not a
  preference — the two use different keys for the same thing (`type` vs `kind`),
  and reading `.type` off a live node yields `undefined` for every field: a walk
  that finds nothing and a test that passes.

  That walk immediately found a live orphan. **`blogAutoConfig.targetStoreIds` is
  now detached on store deletion**, by `detachStoreFromBlogAutoConfigs`. A config
  belonging to establishment A that fans articles out to establishment B kept B's
  dead id forever after B was deleted; only the config's own `storeId` was ever
  handled. Every reference the guard finds must now be resolved either by the row
  being swept or by a named entry in `DETACHED_STORE_REFERENCES` that says what
  handles it — so a dangling id cannot be parked there to quiet the test.
  `systemAuditLog.targetStoreId` is listed as dangling on purpose: the
  `store_deleted` entry points at the store that was just deleted, and resolving
  it would erase the record of the deletion.

  **Breaking: the `printerSettings` table and `printerSettingsTable` export are
  gone.** Ten required fields, zero readers and zero writers anywhere in the
  repository since it was declared — the only reference outside the schema was the
  delete cascade, removing rows nothing could ever create. Its own comment kept it
  on the grounds that the planned thermal path would need "roughly" these fields,
  but those fields are ESC/POS-shaped (`ipAddress`, `port`, `usbVendorId`,
  `type: network | usb | bluetooth`) and that path is explicitly ruled out: the
  thermal path when it comes is cloud printing, whose shape `stores.printConfig`
  already carries. Auto-print runs on `stores.printConfig` today. Nothing can have
  written a row, so nothing is lost. The documentation that described it — in
  `CLAUDE.md`, both package READMEs, `STRUCTURE.md`, `EXAMPLES.md`, the docs app
  and `IMPLEMENTATION_STEPS.md` — was corrected with it, including a `SUMMARY.md`
  line advertising a `printerSettings.ts` function module that never existed.

- 4e625bd: Say out loud that a deployment issues no invoices, and give the owner the form that fixes it

  **A seller-incomplete deployment took money indefinitely with no legal
  invoice and no warning anywhere (#375).** `issueInvoiceForOrder` deliberately
  answers `{ issued: false, reason }` instead of throwing — a missing SIREN
  must not fail a payment, and that part is right. Its docblock then claimed
  "the admin surfaces it", and nothing did: both callers awaited the result and
  discarded it, the paid order's detail page had zero invoice references, and
  no banner existed. The repo's signature failure class — an annotation
  asserting more than the code does — this time on the fiscal path
  (art. 242 nonies A CGI requires an unbroken numbered series).

  Worse than the docblock: **the state was unfixable from inside the product.**
  No admin screen collected `globalSettings.seller`, and `globalSettings.upsert`'s
  validator did not even accept a `seller` argument — `seller_incomplete` was
  permanent on every deployment ever cloned.

  Three surfaces now exist, and one form:
  - **The paid order says it.** New `orderInvoiceSurface` computes the invoice
    number or the refusal fresh on every read — never persisted, so completing
    the identity clears it by itself — and `orders.getById` in both apps
    spreads it onto the order. The detail page grew a « Facture » card: the
    number when issued, « Facture non émise » with the reason in French and a
    link to the fix when not — and for the backlog, a third state adversarial
    verification demanded: an order paid while the seller was incomplete stops
    refusing once the identity is complete, which used to make the card vanish
    and leave that order invoiceless for ever. It now offers « Générer la
    facture », the first UI caller `invoices.issueForOrder` has ever had,
    gated on the same `payments:write` the mutation enforces. While in the
    file: `tableNumber`, persisted since day one and displayed never, is now
    on the dine-in detail.
  - **The dashboard warns.** A persistent banner while `seller` is incomplete,
    shown only to holders of `settings:write` — exactly SUPER_ADMIN and
    CLIENT_ADMIN, the people who can act — using the engine's own
    `sellerIsComplete` so the banner and the refusal cannot disagree.
  - **The docblock now describes surfaces that exist.**
  - **The settings screen collects the identity.** A « Facturation » tab
    (raison sociale, forme juridique, siège, SIREN/SIRET, TVA, RCS, capital,
    mentions légales), backed by a `seller` argument on `upsert` matching the
    schema exactly. Only the legal name gates issuance, as before; the rest
    stays optional — a micro-entreprise legitimately leaves most of it empty.

  Deliberately NOT done: seller identity is not a boot-blocking requirement.
  Whether go-live should hard-require it is an owner decision; the banner is
  the honest middle until that decision is made.

  Held by tests that cross the seam the green suites never did:
  `order-detail-invoice.test.tsx` renders the real page and pins the refusal,
  the number, the link and the table; `seller-incomplete-banner.test.tsx` pins
  shown-when-incomplete, gone-when-complete, silent-to-staff;
  `order-invoice-surface.test.ts` in both apps drives the whole journey —
  money in, refusal on the order, identity saved through the new validator,
  refusal clears, catch-up issuance names the document; and
  `invoices.test.ts` pins `orderInvoiceSurface` itself, including that it
  recomputes on every read.

### Patch Changes

- 009af63: Restore the accents on French copy that the twin comparison could not see

  The accent guard compared `apps/reference` against `apps/themes`, so a word
  de-accented identically in both was invisible to it: "doit etre dans le futur",
  "n'est pas configure" and "l'import reel" all passed a green check. It now
  measures each string against a list of French spellings instead of against the
  other app, which does not care how many copies of a fault exist.

  That found 128 de-accented words across 40 files, all of them user-facing:
  "Article supprime", "Commande acceptee sur Uber Eats", "Publiee le",
  "La quantite doit etre positive", "Selectionnez au moins un element a migrer".
  Validator messages, kitchen tickets, the blog editor and the system pages are
  all affected, and the strings ship to every client.

  `createMigrationRequest`'s test asserted the misspelling (`/au moins un
element/`), so it has been rewritten to assert the corrected message.

- Updated dependencies [158019f]
- Updated dependencies [dc26361]
- Updated dependencies [60dbd7d]
- Updated dependencies [dc26361]
- Updated dependencies [20ccb42]
- Updated dependencies [c9619e2]
- Updated dependencies [bd7a656]
- Updated dependencies [91d388a]
- Updated dependencies [009af63]
- Updated dependencies [ec8e3ea]
- Updated dependencies [e7182b5]
- Updated dependencies [ab869a8]
- Updated dependencies [cde4410]
- Updated dependencies [4e625bd]
- Updated dependencies [91d388a]
- Updated dependencies [bd17a78]
- Updated dependencies [4e625bd]
- Updated dependencies [1c21483]
  - @be-in-digital/ui@3.0.0
  - @be-in-digital/convex-functions@4.0.0
  - @be-in-digital/convex-schema@4.0.0
  - @be-in-digital/restaurant@3.0.0
  - @be-in-digital/core@2.4.0

## 8.0.0

### Minor Changes

- 4c60c83: `convex` peer narrowed from `>=1.0.0` to `^1.44.0`.

  `>=1.0.0` was not a considered range, it was an absent one: it claims this
  package works against Convex 1.0 and every version since, including a future
  2.x, none of which is built or tested. The package uses `useQuery`,
  `useMutation` and `useAction` from `convex/react` and nothing else, so the range
  now states what it is actually shipped and exercised against.

  **This does not prevent the duplicate-copy failure**, and it should not be read
  as doing so. That was measured rather than assumed: with `apps/reference` put
  back on 1.31.7, `packages/admin` still resolves to 1.44.0 while the app resolves
  to 1.31.7 — the exact configuration that produced _"Could not find Convex
  client! useQuery must be used in the React component tree under
  ConvexProvider"_. pnpm satisfies a peer from any copy it can find, so narrowing
  which copies qualify does not stop it finding a different one from the app's.
  Adding `strict-peer-dependencies=true` did not change the outcome either; the
  install still succeeded, so that setting was not kept.

  What prevents it is every manifest in the monorepo declaring the same exact
  `convex`, which is already the case. This change makes the declaration honest,
  and gives consumers on npm or yarn — which do fail loudly on an unmet peer,
  unlike pnpm here — a true statement to fail against.

  No consumer is excluded: the boilerplate and both apps are on 1.44.0.

- 906d573: The kitchen display's sound alerts can be configured.

  `stores.soundConfig` decides which alerts sound and how loudly, and every piece
  was already there — the schema field, an audited mutation, and the reader on the
  routed kitchen screen. No screen wrote it, so every establishment ran on a
  literal hardcoded inside `KitchenContent`: a restaurant could not turn down a
  beep that repeats every thirty seconds for as long as a printer stays stuck.

  The store detail page gains a **Cuisine** tab with the three alerts — new ticket,
  overdue ticket, blocked print — each with a switch, a volume, and a preview
  button. Choosing a volume for a screen in a noisy kitchen without hearing it is
  guesswork, and the display already knew how to make the sound.

  The catalogue moves to `lib/kitchen-alerts`, shared by the editor that writes the
  setting and the display that plays it. It had been written out twice already —
  the defaults in `KitchenContent`, the frequencies in `KitchenSoundManager` — and
  a third copy in the editor would have been the one that drifted.

  `resolveSoundConfig` fills the setting in field by field rather than defaulting
  the object whole, so an establishment configured before an alert existed does not
  leave the display reading `undefined.enabled`. The form opens on the display's
  own fallbacks for an establishment that has never been configured, so it shows
  what the kitchen is currently hearing instead of claiming the alerts are off.

### Patch Changes

- a561c61: One `convex` version across the monorepo: 1.44.0.

  Six manifests declared three different things — `1.31.7` exact in the engine,
  the template and three packages, `^1.34.0` floating in `apps/site`, and a
  `>=1.0.0` peer in `packages/admin`. pnpm installed **two copies**, and
  `apps/site` was the only workspace on the newer one.

  The 1.31.7 pin was not a compatibility constraint. It was an incident fix: the
  unconstrained peer in `packages/admin` let pnpm resolve `convex` to the highest
  version in the repo while the app provided context from the lower one, so
  `useQuery` found no provider and the admin crashed on render for every user.
  Pinning `convex` as an explicit devDependency of `packages/admin` out-voted the
  resolution. Declaring the same exact version everywhere removes it instead —
  there is no second copy left to pick.

  `convex-schema` and `convex-functions` carry `convex` as a real dependency, so
  consumers inherit this bump.

  Nothing in the 1.31.7 → 1.44.0 range is breaking: no removed runtime API, no
  change to `ctx.auth`, and the same `node >= 18` floor. Two consequences did
  need handling. Convex 1.35.0 flipped codegen for components from static
  expansion to a `ComponentApi` reference, which is why `_generated/api.d.ts` in
  the engine and the template loses ~1980 lines each; `components.betterAuth` is
  still exported under the same name, now typed by better-auth's own package. And
  `_generated/server.d.ts` gains a typed `env` for `CONVEX_CLOUD_URL` and
  `CONVEX_SITE_URL`. The new default was accepted rather than opted out of with
  `legacyComponentApi`.

  The remaining hazard is untouched and deliberate: `packages/admin` still peers
  on `convex: ">=1.0.0"`. A permissive peer is right for a library, and with every
  manifest agreeing it cannot mis-resolve — but it is what made the original
  incident possible, and it will again if the versions ever diverge.

- aa2880f: Four multi-store defects, all of them settings written by the dashboard and
  read by nobody — or data written and never cleaned up.

  **Deleting an establishment takes its data with it.** `stores.remove` deleted
  the store row alone. Forty-two `storeId` columns across twenty tables were left
  pointing at a document that no longer existed, and the id stayed in
  `userProfiles.storeIds`. Nothing complained: `v.id("stores")` validates how an
  id is encoded, not that it resolves. The sweep is batched and resumable — one
  mutation is one transaction, and an established restaurant has more orders than
  a transaction may touch — so `remove` clears one batch and the app wrapper
  schedules `purgeStoreData` until there is nothing left. `favorites` gained a
  `by_storeId` index: both of its compound indexes start with `userId`, so it was
  the one table that could not be swept by store.

  **"Horaires globaux" governs the storefront.** `useGlobalHours` was written by
  the dashboard and read by nothing — `use-store-status` took `store.hours`
  unconditionally, so an owner who edited the global week and left every location
  on the flag changed nothing a visitor could see. `resolveStoreHours` resolves it
  on read rather than copying on write, so editing the global hours reaches every
  location that follows them without a migration.

  **Opening hours are the restaurant's, not the visitor's.**
  `globalSettings.timezone` was written and never read: open/closed came from
  `now.getDay()` and `now.getHours()`, the browser's clock. A customer abroad got
  the wrong answer, and anyone could change it by changing their system clock.
  `isStoreOpen` and `getNextOpenTime` take an optional IANA zone; without one they
  behave exactly as before, and an unknown zone name falls back to the visitor's
  clock rather than throwing.

  **Saving the Integrations tab keeps the Uber Direct credentials.** The settings
  form read `globalSettings.get` — the public storefront query, which strips
  `customerId`, `clientId` and `clientSecret` — so the fields came up empty and
  saving patched the empty values over the stored ones. It reads `getAdmin` now,
  the query behind the same `settings:read` the Paramètres page already requires.
  `upsert` also merges `integrations` platform by platform, so a tab saving its
  own section no longer takes out the others; each platform is still replaced
  whole, so disconnecting one remains possible.

  The three integration switches gained an id and an `aria-label`. They had
  neither, so a screen reader announced three anonymous check boxes.

- 526717a: Two ways a store id reached somewhere it should not have.

  **A stale admin selection no longer takes `/dashboard/team` down.** The persisted
  id is a bare string in localStorage, and localStorage outlives the deployment
  that issued it. `teamMembers.list` declares `storeId: v.id("stores")`, which
  refuses an id from another deployment, and Convex raises that out of `useQuery`
  during render — so the page went blank rather than degrading. `/dashboard/team`
  is one of `StoreGuard`'s `BYPASS_ROUTES`, so it renders before the guard has
  settled the selection; the guard does repair it, but a render happens first, and
  one render was all it took. The page now checks the id against
  `stores.listAll` before sending it, through the same `resolveStoreSelection` the
  guard uses. This is the shape #119 fixed for the storefront and not here.

  **A draft establishment is no longer readable by the storefront.**
  `stores.getById` is public — checkout, the contact page and the open/closed
  banner all need it before anyone signs in — and it returned drafts to anyone who
  had an id: address, contact details, `orderMode`, `overrides`. `stores.list`
  filters drafts out; a direct read walked past that.

  Closing the query was not an option: it is also the administration's read. The
  store detail page exists to publish drafts, and the KDS reads its own
  establishment while holding a role (`kitchen`, `delivery`) that does not have
  `stores:read`, so `getAdminById` is shut to it. The rule is therefore by caller —
  staff see drafts, everyone else gets `null` — using a new non-throwing `isStaff`
  beside `requireStaff`, because a query the storefront shares has to be able to
  answer "not staff" without raising.

- 889dddb: Creating an establishment from the dashboard works.

  It never did. `stores.create` declares six arguments; the create dialog sent a
  seventh — a `settings` object with currency, timezone, service toggles, fees and
  a tax rate. Convex refuses an undeclared argument rather than dropping it, so
  every attempt threw an `ArgumentValidationError` and the dialog showed nothing
  but "Échec de la création de l'établissement". On a product billed per store,
  the only establishments that could exist were the ones `seedFixture` wrote.

  The payload now lives in `buildStoreCreateArgs` instead of inside the React
  handler, because a payload written inline is invisible to the test suite. The
  unit tests call handlers directly, past the validator, and saw nothing;
  `store-create-args.test.ts` reads the argument names off the validator itself
  and compares.

  `resolveTaxRatePercent` loses its `storeTaxRate` source. It read
  `store.settings.taxRate` — a legacy column no mutation declares, so the only
  value it could ever have held came from the payload Convex was rejecting. Every
  order already fell through to `globalSettings.taxRate`; the rate is now read
  from there and nowhere else. A genuine per-store rate belongs in a declared
  argument with an editor behind it.

  `E2E_PORT` gives a Playwright run its own port. Two runs on one machine used to
  share 3000, and `reuseExistingServer` let the second drive the first one's
  build.

- Updated dependencies [a561c61]
- Updated dependencies [ebdda7e]
- Updated dependencies [213eb1d]
- Updated dependencies [7ae8072]
- Updated dependencies [aa2880f]
- Updated dependencies [629e88e]
- Updated dependencies [e7c6f36]
- Updated dependencies [74de4e9]
- Updated dependencies [526717a]
- Updated dependencies [889dddb]
  - @be-in-digital/convex-functions@3.0.0
  - @be-in-digital/convex-schema@3.0.0
  - @be-in-digital/core@2.3.0
  - @be-in-digital/restaurant@2.1.0

## 7.0.0

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

- Updated dependencies [8ce83cb]
  - @be-in-digital/marketing@2.1.0
  - @be-in-digital/ui@2.0.3

## 6.0.0

### Patch Changes

- Updated dependencies [3178b2d]
- Updated dependencies [e13cd4e]
  - @be-in-digital/core@2.2.0
  - @be-in-digital/convex-functions@2.2.2

## 5.0.0

### Patch Changes

- Updated dependencies [3a25d85]
- Updated dependencies [7e727ff]
  - @be-in-digital/core@2.1.0
  - @be-in-digital/convex-functions@2.2.1

## 4.0.0

### Minor Changes

- 285b579: Record establishment changes in the system audit log

  `systemAuditLog` was only ever written by system operations, so a restaurant
  could be created, renamed, moved, reconfigured or deleted and the journal stayed
  empty. Every mutation in the stores module now appends an entry naming the
  actor, the establishment, the operation, the timestamp and the before/after of
  the fields the edit moved.
  - `systemAuditLog` gains `store_created` / `store_updated` / `store_deleted`,
    an optional `targetStoreId`, and an index to read one establishment's history.
  - The printer API key is redacted on both sides of a `printConfig` diff, and
    create/delete snapshots use a field allowlist so the legacy `integrations`
    blob never reaches the log.
  - `system.getAuditLog` scopes establishment entries to the stores the reader has
    access to, and pages with Convex's own cursor instead of arithmetic that
    stalled after the second page.

### Patch Changes

- Updated dependencies [285b579]
- Updated dependencies [9817b8d]
  - @be-in-digital/convex-schema@2.2.0
  - @be-in-digital/convex-functions@2.2.0

## 3.0.0

### Minor Changes

- 5eec48d: Maintenance & migration system: a per-deployment maintenance contract (derived status, update coverage keyed on release date), a release catalog synced from npm that locks published versions once the contract expires, site migration requests (controlled-transition workflow plus audit log), self-serve renewal through Stripe (the `bidProduct: maintenance` webhook creates a contract, never ownerEntitlements), and SES notifications when a request is opened. Adds a Maintenance tab to the admin System page.

### Patch Changes

- 83f6af9: Enforce the order status machine in `updateStatus`.

  The mutation wrote whatever status it was handed. Nothing stopped an order going from `pending` straight to `completed`, or a cancelled order being revived — the transition table existed but only the storefront services consulted it, as advice.

  Three layers each carried their own opinion and they had drifted. The admin UI offered "Envoyer en livraison" on a ready order while the services table forbade `ready -> out_for_delivery`. The table is now single and lives in `@be-in-digital/convex-schema` (`ORDER_STATUS_TRANSITIONS`, `canTransitionOrderStatus`, `getNextOrderStatuses`); the services and the mutation both read it, and `ready -> out_for_delivery` is allowed, matching the button that already existed.

  **Behaviour change:** `updateStatus` now throws `Invalid order status transition: <from> -> <to>` instead of writing. Replaying the current status is an idempotent no-op rather than an error, so webhook retries and double-clicked buttons stay harmless. `updateFromWebhook` is deliberately left unguarded — Uber Eats and Deliveroo are authoritative for the orders they own.

  The cancellation window stops at `confirmed`, matching what Deliveroo permits: an order already being prepared, ready, or with a rider can no longer be cancelled internally.

- Updated dependencies [5eec48d]
- Updated dependencies [83f6af9]
- Updated dependencies [c1af162]
  - @be-in-digital/convex-schema@2.1.0
  - @be-in-digital/convex-functions@2.1.0
  - @be-in-digital/restaurant@2.0.3

## 2.0.2

### Patch Changes

- 7f0122b: Republished from main. Fixes two problems with the 2.0.1 tarballs that broke consumers:
  - `@be-in-digital/core`: the `./auth/rbac` subpath pointed at `src/auth/rbac.ts` while the tarball only ships `dist/` → broken import for consumers (`convex-functions/auth` included). `files` now includes `src`.
  - The type fixes that were on main but never published (promotion-form/email-config in admin, Uber Eats signatures in integrations/convex-functions) go out with this patch — they had been committed without a changeset.

- Updated dependencies [7f0122b]
  - @be-in-digital/convex-functions@2.0.2
  - @be-in-digital/convex-schema@2.0.2
  - @be-in-digital/core@2.0.2
  - @be-in-digital/marketing@2.0.2
  - @be-in-digital/restaurant@2.0.2
  - @be-in-digital/ui@2.0.2

## 2.0.1

### Patch Changes

- 1a5ca27: Rename package scope from @beindigital-engine to @be-in-digital for GitHub Packages compatibility
- Updated dependencies [321adad]
- Updated dependencies [1a5ca27]
  - @be-in-digital/convex-schema@2.0.1
  - @be-in-digital/convex-functions@2.0.1
  - @be-in-digital/ui@2.0.1
  - @be-in-digital/core@2.0.1
  - @be-in-digital/restaurant@2.0.1
  - @be-in-digital/marketing@2.0.1

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

### Patch Changes

- Updated dependencies [7c3d4da]
  - @be-in-digital/convex-functions@2.0.0
  - @be-in-digital/convex-schema@2.0.0
  - @be-in-digital/restaurant@2.0.0
  - @be-in-digital/marketing@2.0.0
  - @be-in-digital/core@2.0.0
  - @be-in-digital/ui@2.0.0

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

### Patch Changes

- Updated dependencies [ad4d8d2]
  - @be-in-digital/convex-functions@1.0.0
  - @be-in-digital/convex-schema@1.0.0
  - @be-in-digital/restaurant@1.0.0
  - @be-in-digital/marketing@1.0.0
  - @be-in-digital/core@1.0.0
  - @be-in-digital/ui@1.0.0
