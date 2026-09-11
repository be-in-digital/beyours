# @be-in-digital/admin

## 17.0.0

### Minor Changes

- 390c8d5: Give a prize that gives something away a way to say what.

  `prizes.productId` and `prizes.menuId` were declared in the schema and written
  by nothing, which cost two things. The delete guards that read them —
  `menus.remove`'s `menu_in_prize` and the matching refusal in `products.remove`
  — could not fire outside their own tests, because no production path could put
  a prize in that state. And an owner could create a « Menu offert » that named
  no menu: it read « Menu offert » on the wheel, on the winning screen and on the
  QR code the diner brought to the counter, where nobody could tell what had been
  promised.

  `PRIZE_TARGET_FIELDS` declares the rule beside the code that enforces it — the
  shape `HONOURABLE_DISCOUNT_TYPES` established for promotions. A target is
  required for the type that gives something away, refused for every other type,
  and checked to belong to the same establishment. The admin prize form offers the
  picker for exactly those two types.

### Patch Changes

- Updated dependencies [d2e747a]
- Updated dependencies [b8c6f3e]
- Updated dependencies [f1e4bf6]
- Updated dependencies [50b0edb]
- Updated dependencies [390c8d5]
- Updated dependencies [4d759b5]
  - @be-in-digital/convex-functions@7.2.0
  - @be-in-digital/convex-schema@6.3.0

## 16.0.0

### Patch Changes

- Updated dependencies [c5500af]
  - @be-in-digital/convex-functions@7.1.0
  - @be-in-digital/core@4.2.0

## 15.0.1

### Patch Changes

- Clear the WCAG AA floor on every shipped template, and read the HSL spelling

  **Three shades, one step darker each.** Once a vertical template tints
  `--background` away from the engine's near-white `0 0% 99%`, three Tailwind
  inks in the admin fall under the floor:

  |                                             | measured across 51 palettes | floor |
  | ------------------------------------------- | --------------------------- | ----- |
  | `stat-cards-grid.tsx` — `text-red-600`      | 4.196–4.500:1               | 4.5   |
  | `csv-import-dialog.tsx` — `text-green-600`  | 2.832–2.983:1               | 3     |
  | `suggestions-review.tsx` — `text-amber-600` | 2.943–2.996:1               | 3     |

  Each moves to the 700 shade, with the dark-scheme value pinned where it was
  implicit so the fix does not follow the ink into a scheme that already cleared.
  These are 68 failures across 34 of the 51 templates, and they were invisible
  because the sweep that should have found them was discarding 40.9% of what it
  measured.

  **And `scanContrast` could not read the spelling this design system forces.**
  Tokens are stored as bare HSL channels — `--primary: 24 95% 53%` — precisely so
  a caller can tint them, which means an inline use of one cannot be written any
  way other than `hsl(var(--token))`. `cssColour` read `var(--token)` and returned
  null for the wrapped form, so every such inline style was dropped: not reported
  as unmeasurable, absent. A raw `hsl(h s% l%)` literal was dropped the same way.

  Both are read now, each with its optional alpha, and a token no stylesheet
  declares still resolves to nothing rather than to a guess.

- Updated dependencies
  - @be-in-digital/ui@4.3.1

## 15.0.0

### Patch Changes

- Updated dependencies [92dc32f]
- Updated dependencies [92dc32f]
  - @be-in-digital/restaurant@4.1.1
  - @be-in-digital/convex-schema@6.2.0
  - @be-in-digital/convex-functions@7.0.1

## 14.0.0

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
- Updated dependencies [549026f]
- Updated dependencies [549026f]
  - @be-in-digital/convex-functions@7.0.0
  - @be-in-digital/core@4.1.0
  - @be-in-digital/ui@4.3.0

## 13.0.0

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

### Patch Changes

- Updated dependencies [e5394e5]
  - @be-in-digital/convex-functions@6.2.0
  - @be-in-digital/convex-schema@6.1.0
  - @be-in-digital/ui@4.2.0

## 12.0.0

### Minor Changes

- 6d6df2d: Stop the delivery tiles sending a restaurant's own customers to a marketplace

  The menu page carried a « Commandez aussi sur vos apps » section whose two
  tiles were hard-coded to `https://www.ubereats.com` and
  `https://www.deliveroo.com` — the marketplaces' HOME pages, not this
  restaurant — under a COMMANDER button, on every menu, whether or not the store
  had either integration. A restaurant's own site was routing its own customers
  into a marketplace to be shown the competition, and paying commission on
  anything they ordered there.

  There was nothing to derive a correct link from: `platformStoreId` is an API
  identifier (a UUID for Uber Eats, a site id for Deliveroo) and neither
  platform's public URL is built from it. So the owner supplies it —
  `storeIntegrations.storefrontUrl`, a field on the store's integration card —
  and no tile renders without one.

  `normalisePlatformStorefrontUrl` refuses what the hard-coded links were: a
  non-https URL, a host that is not the platform's, embedded credentials, and the
  platform's home page itself (a path of `/` is the defect, not a value). The host
  check walks LABELS rather than matching a pattern over the string, because
  `deliveroo.com.attacker.example` satisfies the second and is a domain somebody
  else registers — and this value becomes an anchor on the restaurant's own site.

  `storeIntegrations.publicLinks` is the storefront's read: a platform name and a
  URL, for the integrations that are switched on and have one. Nothing else on the
  row is a diner's business.

- 6d6df2d: Count only money that arrived, and stop a settled charge sitting at `pending`

  Three defects on the money path, all of them a layer answering a question next
  to the one it was asked.

  **The dashboard counted orders nobody paid for.** `computeDashboardStats`
  filtered on `status !== "cancelled"` — a test about orders being UNMADE,
  standing in for one about orders being PAID — and `DashboardOrderRow` did not
  carry `paymentStatus` at all, so the distinction was not available to be got
  wrong; it was absent. An abandoned checkout, a declined card and a table whose
  cash has not been rung up all counted in full. Measured on a probe store: the
  card read 1 720,00 € against 20,00 € collected.

  `revenue` is now money that arrived (`COLLECTED_PAYMENT_STATUSES`: `paid`,
  `refund_pending`, `partially_refunded` — the states in which the till is
  holding it). `orderCount` still means orders that happened, because that is
  what an owner is asking when they look at « Commandes », and the difference is
  reported as `uncollected` rather than left to be inferred. « Chiffre
  d'affaires » now carries « dont X € en attente d'encaissement » when the two
  disagree.

  **A settled charge could sit at `pending` for ever.** `settlePayment` asked
  whether a row for this charge EXISTED, not whether it was DONE, so a
  `payment_intent.succeeded` landing on a placeholder row returned it untouched
  while `settleByExternalReference` marked the ORDER paid. The result was « Payé »
  over a `pending` payment row — which `planRefund` refuses permanently, and which
  `collectionOnOrder` does not count, so a second collection was still allowed on
  the same order. The row is now promoted in place (provider, amount and currency
  taken from the settlement: a refund is issued against whatever `provider` says).
  `LEDGERED_STATUSES` names the states that mean "already on the ledger" —
  including `refunded`, so a replayed event cannot resurrect a refunded charge.

  **A 100 % coupon produced an order no card could pay.**
  `createCheckoutSession` sent `unit_amount: order.total` and asked nothing about
  it; Stripe's EUR floor is 0,50 €, and the session create throws an SDK error
  that Convex redacts to "Server Error" behind the checkout's generic retry
  toast. The layers disagreed in both directions: `assertSettlesOrder` settles a
  0 c order and `settlePayment` refuses to write a row for one.
  `cardChargeFloor.ts` holds the rule — per-currency minimums, and `nothing_to_pay`
  as its own refusal, because an order that owes nothing is not a small payment —
  and the three card actions enforce it before calling a provider.

- b9e20ea: Serve no draft dish, route no menu event by guess, and make eleven guards see

  **A public query served unpublished products.** `products.getManyByIds` took an
  array of ids and returned the documents behind them with no filter of any kind:
  no `isActive`, no ceiling on how many ids one call may look up. It is the query
  the favourites grid calls before any sign-in, and ids are not secret — they
  appear in order lines, in favourites and in the storefront's own DOM — so
  anything holding one read the dish behind it whatever its state: name, cost,
  allergens, platform overrides, for a draft or a dish taken off the menu. Every
  other public read of that table already honoured the flag. It now does too, and
  caps the lookup at `MAX_PRODUCT_ID_LOOKUP` so an anonymous caller does not choose
  the read count. Deliberately still cross-store: a deployment is one client's, and
  the favourites grid splits "here" from "your other establishments" on purpose.

  **A Deliveroo menu event could land on a sibling establishment.** The menu path
  matched `site_id` with a bare `.find()` and, when that missed, fell through to
  the BRAND — which covers every location of a chain, so the sync status was
  written to whichever sorted first. The event said "site 42's menu failed
  validation"; the screen said the Boulevard branch's had. `resolveMenuStoreIntegration`
  applies the order path's own refusal policy: a named site's verdict is final,
  and a brand that matches more than one establishment is `ambiguous_store`, which
  is the ordinary shape of a two-location client rather than an edge case.

  **A refused SVG kept its bytes for thirty days.** `cmsMediaConfirmUpload` reads
  an uploaded SVG back, refuses it for active content, and then deleted it with a
  bare `DeleteObjectCommand` — which on the versioned bucket `setup-aws.sh` builds
  writes a delete marker and retains every version. That is the defect #331 removed
  from `cmsMediaDelete.ts` and this path reintroduced, for the one object we have
  decided is hostile. It goes through `purgeS3Objects` now.

  **CMS video uploads landed as `.bin`.** The upload route kept a private
  six-entry MIME-to-extension map while `@be-in-digital/cms`'s `MIME_TO_EXT` —
  which calls itself the single source of truth, and is what the presigned Convex
  flow uses — held twelve. `ALLOWED_MIME_TYPES.cms` admits mp4, webm and three
  Office formats; all six fell through to `"bin"`.

  **The order-confirmation email printed no timing row, for any order, ever.**
  `timingLine` reads `order.estimatedPrepTime` and `orders.create` wrote the prep
  time it computes onto the kitchen ticket — a different document. `orders.create`
  now stamps the longest line's preparation time on the order as well, off the
  products its verification loop already holds, and stays silent when no dish
  declares one rather than promising "environ 0 minutes".

  **Dead code that contradicted the live product.** `packages/core`'s
  `src/auth/config.ts` is gone, with `createAuthConfig`, `authHooks`,
  `emailTemplates`, `authErrors`, `validatePassword`, `validateEmail`,
  `DEFAULT_SESSION_EXPIRY`, `DEFAULT_SESSION_REFRESH` and `MIN_PASSWORD_LENGTH`:
  zero call sites, and it declared `MIN_PASSWORD_LENGTH = 8` against the live
  `minPasswordLength: 12`, with five lifecycle hooks whose bodies were a
  `console.info` and a list of TODOs over names like "lock the account after N
  attempts". `@be-in-digital/convex-schema` loses the six printer types that
  outlived the `printerSettings` table — `PrinterType = 'network' | 'usb' |
'bluetooth'`, the ESC/POS transports `CLAUDE.md` records as decided against.
  Both are BREAKING on a published API and neither had a consumer.

  **`@be-in-digital/admin`** gains `PAYMENT_STATUS_LABELS`, so the payments screen
  stops declaring six operator-facing strings of its own, and the dashboard's
  recent-orders table stops declaring eleven — `lib/vocabulary.ts` claimed "label
  drift is now impossible" while two screens held their own copies.

  **And the guards that could not see what they were written for.** The attribution
  guard missed four shapes `CLAUDE.md` names by hand — a robot-emoji signature, a
  bare "Claude Code" in a body line, "AI-generated", "Made with Claude" — while
  still accepting the collisions that matter here (this product has an AI-generated
  blog; Claude is an ordinary French given name). The swallowed-pipe rule needed
  spaces around the pipe, so `2>&1|tee` walked through it, and never read
  `apps/themes/.github/workflows/`, the CI every client runs. The turbo test inputs
  still hashed `apps/themes`'s `.convex-build/` and `tsconfig.tsbuildinfo`, so a
  local typecheck threw the monorepo's whole test cache away. The Convex manifest
  guard's transcription of `entryPoints()` omitted `looksLikeNestedComponent`, so a
  legal local component would have turned it red. The mirror publisher walked the
  filesystem and shipped untracked files; it now ships what git tracks, minus the
  exclusions, and refuses rather than guessing when git cannot answer. The
  Infisical doc-claim checker knew one phrasing and the document used another, so
  it reported "0 folder claim(s) checked" and exited 0.

### Patch Changes

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

- Escape JSON-LD properly, run the guard on the path every caller takes, and serve no draft

  Five defects a diner or an attacker meets, and the lint rule that was supposed
  to catch the worst of them and could not.

  **Stored XSS in the JSON-LD block, reachable by a manager.** `JsonLd` escaped
  `</script>` with `.replace(/<\/script>/gi, …)`, and an HTML parser ends a script
  element on `</script` followed by whitespace, `/` or `>`. `JSON.stringify`
  escapes tab, newline and carriage return but not space or solidus, so
  `</script >` and `</script/>` both walked straight through. Reproduced as
  execution rather than injection:

      HTML: ..."name":"</script ><script>document.title='PWNED'</script >"...
      document.title after parse = "PWNED"

  It is reachable because a blog title is sanitised nowhere — the body is
  sanitised twice, on write and again on publish — and rides `saveDraft` →
  `publishArticle` → `article.content.title` into the breadcrumb trail.
  `Role.MANAGER` holds `content:write` and production CSP grants
  `'unsafe-inline'` with no nonce. `serialiseJsonLd` now escapes `<`, `>`, `&`,
  U+2028 and U+2029 to their `\uXXXX` forms: those characters cannot occur in
  JSON output except inside a string, so the encoding is total in a way a pattern
  match cannot be, and a JSON parser decodes them back unchanged. `title`,
  `excerpt`, `metaTitle` and `metaDescription` also go through a new
  `sanitizePlainText` on both write and publish.

  The only previous test asserted
  `read("lib/json-ld.tsx")).toContain('type="application/ld+json"')` — a
  string-containment check against the source file, which says nothing about
  escaping and passed throughout.

  **A permission check that ran for nobody.** `validateIntegration.validate`
  carried `@guarded-inline: checks settings:read by role` and put the check inside
  `if (!identity) { … }` — the branch only unauthenticated callers take, and they
  were rejected on the next line anyway. Every signed-in account, a diner's
  included, skipped it and could drive credential probes against the
  restaurant's own Uber Eats, Deliveroo and Uber Direct credentials, using the
  sanitised replies as a store/brand-id oracle. `categories.reorder` had the same
  shape with a smaller blast radius: its `requireStorePermission` sat inside
  `if (storeId)`, and `storeId` stays null when `args.ids` is empty, so
  `{ ids: [] }` reached the handler authorised by nothing.

  **The rule that should have caught both.** A harness of twelve declarations —
  one control that must error, one that must pass, ten known evasions — was run
  against `eslint/convex-auth.mjs` on ESLint 9.39.4. Ten of the twelve slipped.
  The rule read declarations as TEXT (`sourceCode.getText()` returns comments and
  string literals), so a guard named in prose counted as a guard, a variable
  merely named `requireX` counted as a call to it, an unknown or aliased or
  member-expression builder was ignored entirely, and `permission: undefined`
  satisfied the permission rule. It now walks the AST and asks the three
  questions text cannot answer: is the signal a call, is it in code, and does
  every caller reach it. The harness is kept as
  `src/__tests__/convex-auth-rule.test.ts` — the rule had no test of any kind.
  Over the real tree it reported exactly the two live defects above and, once its
  heuristics were corrected against 56 false positives on `ctx.db.query(…)`,
  nothing else. Its glob widens from `convex/*.ts` to `convex/**/*.ts`.

  One limit is asserted rather than papered over: a marker's REASON cannot be
  graded by a linter, so harness case K passes and will keep passing. That is now
  the only part left to human judgement, instead of being the part everyone
  trusted while the mechanism underneath it was decorative.

  **A draft dish on the public carte.** `products.list` is public and
  unauthenticated and returned every row, `isActive` ignored:

      products.list => [{"name":"LIVE"},{"name":"SECRET-DRAFT","isActive":false}]

  `categories.list`, `menus.list` and `products.getById` were the same; `menus`
  already declared the `by_storeId_isActive` index the query did not use. #440
  closed this in `getManyByIds` and said the fix made it behave "like every other
  public read of that table" — measured, the other public reads did not filter.
  `list` is what the public carte, `sitemap.ts` and the JSON-LD all call, and
  `orderLine.ts` refuses an inactive product at order creation, so a draft
  rendered live at full price, was indexed, and the diner who added it was
  refused at payment. The three public reads now serve what is on sale; the
  drafts move to `products.listAll` and `categories.listAll`, store-scoped behind
  `products:read`, which the trending picker and the kitchen station mapping use.

- Updated dependencies [7713538]
- Updated dependencies [0ad1a85]
- Updated dependencies
- Updated dependencies [6d6df2d]
- Updated dependencies [6d6df2d]
- Updated dependencies [6d6df2d]
- Updated dependencies [b9e20ea]
- Updated dependencies [6d6df2d]
  - @be-in-digital/convex-schema@6.0.0
  - @be-in-digital/convex-functions@6.1.0
  - @be-in-digital/ui@4.1.0
  - @be-in-digital/restaurant@4.1.0
  - @be-in-digital/core@4.0.0

## 11.0.0

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

- 038eb9d: Make the delete refusals reach the owner, and stop five more removes orphaning rows

  #400 gave six deletes a `ConvexError` carrying a French sentence the owner is
  meant to act on. Four admin screens caught it and showed a fixed line instead —
  so the owner clicked delete, something went grey, and the reason never appeared.
  The engine half was right and undelivered. The prize case was the worst of them:
  the server says _do not retry, deactivate instead_ and the screen said
  « Suppression impossible — réessayez ».

  **The refusal is now what the screen shows.** `games`, `prizes`, `emailTemplates`
  and `emailSegments` read it out of the `ConvexError` payload through
  `convexErrorMessage`, as `products-table` already did. So do the other eleven screen files,
  because the defect was the class and not the four instances — seventeen call
  sites across fifteen files, and a source-level case now holds every one of them,
  including the second delete in the two files that make two. (The first version
  of that sweep matched one binding per file, which left `catalog-page`'s prize
  delete and `use-store-detail`'s Deliveroo delete uncovered; reverting either
  kept the whole admin suite green.)

  **And five more removes were still leaving rows pointing at nothing.**
  - **A subscriber's rows go with them.** `emailSubscribers.remove` was a bare
    delete over TWO non-optional foreign keys — `emailEvents.subscriberId` and
    `emailAutomationRuns.subscriberId` — behind a live button. `privacy.ts` has
    cleared exactly those two tables, in that order, since the erasure path was
    written and says why; this delete was the one path that did not call it. It
    cascades now, a batch at a time, and the subscriber survives every pass but
    the one that finishes them — a half-drained delete never leaves the two tables
    promising a row the database no longer has.
  - **A campaign that has reached somebody is refused.** The delete button is
    offered for `draft`, `cancelled` and `failed`, and two of those three are
    states a send lands in mid-list: `markFailed` only fires on a campaign that
    was `sending`. What that partial send is recorded in is `emailEvents`, one
    `sent` row per (campaign, subscriber), which is what makes « Relancer » resume
    instead of restart. The rows survived a delete; the key did not. The only
    route left to finish the send was to rebuild the campaign — and the copy, with
    a new id, asks the same question of the same table and is told nobody has been
    reached, so everyone who already had it gets it again. Marketing mail is not
    recallable. It refuses and points at « Relancer ». Not a cascade: those rows
    are also the weekly cap's answer and the establishment's record of what it
    sent.
  - **A QR code that has been played is refused**, and can now be deactivated
    instead. `gamePlays.qrCodeId` has no reader anywhere, which is why nothing
    crashed and nothing was noticed — and that is the whole damage: a `gamePlays`
    row is the establishment's evidence under art. 7.1 that it was allowed to
    record a fingerprint, and `qrCodeId` is the only field saying where the
    consent was given. `isActive` has been in the schema from the start and the
    screen offered create and delete and nothing in between, so a refusal would
    have been a dead end; `gameQRCodes.setActive` and a control on the screen are
    the way out the refusal names.
  - **A formule a prize gives away is refused, and its translations go with it.**
    `menus.remove` was a bare delete. `prizes.menuId` gets the same treatment
    `products.remove` already gives a dish a prize names. `translations.entityId`
    is a `v.string()`, so no validator could see it was a foreign key: a menu's own
    name and description in every language the owner added were cleared by nothing
    short of deleting the whole establishment.
  - **A coupon an order was discounted by is refused.** `promotions.remove` was
    not a bare delete — it cleared the `promotionUsages` ledger in batches, which
    is what made deleting a popular coupon possible. The reference it never
    touched is the one that matters: `orders.promotionId` is optional and
    unindexed, so every order that coupon discounted was left naming a row that no
    longer resolved, with the discount still on the order and on the numbered
    invoice issued for it. `releasePromotionForOrder` read that id, found nothing,
    and quietly released nothing. A redeemed coupon is history now, and
    deactivation was already on the screen. It asks the order directly, through a
    new `orders.by_promotionId` — the cheap proxy is not equivalent, because the
    retention cron and an art. 17 erasure both clear `promotionUsages` while a
    paid order is ANONYMISED and keeps its `promotionId`, so proxying would have
    made a three-year-old coupon deletable again and re-created the very
    reference the guard exists to stop. `promotionUsages` is asked too: its
    `promotionId` is REQUIRED and its `orderId` is not. `purgeUsages` stays
    exported and the wrappers no longer schedule it: Convex resolves a scheduled
    function by name at run time, and a client deployment running the previous
    `remove` can still have a drain booked.
  - `emailAutomations.remove` gets the same guard over `emailAutomationRuns`. It
    has no UI caller; it is live on the API under `marketing:write` all the same.

  **BREAKING.** `emailSubscribers.remove` returns `{ deleted, complete }` and
  `menus.remove` returns `{ deleted, hasMore }`, both of which the app wrappers
  must drain — `emailSubscribers.purgeRemoval` and `menus.purgeTranslations` are
  new internal mutations, wired in both apps. `promotions.remove` no longer
  deletes usage rows; it refuses instead. `gameQRCodes.setActive` is new. One new
  index, `orders.by_promotionId`; every other index these guards seek was already
  declared.

  **And the instrument that measures all of this was reading low.** The
  read-counting double under-counted the exact unindexed scan it exists to catch.
  Convex's `.filter()` is a post-scan predicate — the stream reads every document
  of the scanned range and charges each one against the 16,384-document
  transaction limit, and the predicate only decides what comes back — but the
  double narrowed its candidate array inside `filter` and then counted the
  survivors. `.filter().collect()` over 6,000 rows scored the handful it returned;
  `.filter().first()` over a table where nothing matched scored **zero** for the
  most expensive query Convex will run. It caught a live one immediately:
  `storeIntegrations.getBySiteId` and `getByBrandId` — how both platform webhooks
  resolve their store on every delivery — were exactly that shape, and now narrow
  through `by_platform_enabled` first. No new index; the narrowing moved into the
  one that was already there. That is `dueForSending`'s own defect
  (#327), and it is what the hand-rolled double this one replaced was thrown out
  for. It was masked rather than hidden: `filter` took a plain JavaScript
  predicate while every real handler passes Convex's `FilterBuilder`, so the shape
  threw `TypeError` instead of under-counting — and the obvious repair would have
  turned that crash into a silently green full-table scan. It now speaks
  `FilterBuilder` and charges every document it walks, and eight cases in the
  double's own guard hold it there.

  The refusal only ever names a control the screen is rendering: « Relancer » is
  offered for `paused` and `failed`, so a campaign cancelled mid-list is told
  instead that it stays as the record. A refusal that sends the owner after a
  button that is not there is the dead end this whole change is about.

  Probes. Three throwaway suites, each reverted against the unfixed code:
  the games and prizes screen showed « Suppression impossible — réessayez » where
  the server had said « Désactivez-le pour le retirer du jeu », and the two email
  screens « Échec de la suppression » where it had named the campaign blocking
  them; seven of nine backend cases
  failed and the two controls — a delete that should still work — passed; and the
  counting cases returned 1 and 0 where Convex charges 6,000. Two tests that were
  green while blessing the defect are rewritten and named as such: the three
  `promotions.remove` cases in `queryBounds.test.ts` and the app-level
  "clears the offer at once and its usage record in batches".

  Closes #412.

- e569498: Stop six bare deletes leaving rows pointing at nothing

  Six handlers were written as `ctx.db.delete(args.id)` against tables other rows
  reference, and `v.id("table")` validates how an id is ENCODED, not that it still
  resolves — so no validator, no type and no test ever complained. Each one cost
  something different, and every one of them shipped to every client site.

  **A diner's won prize could be deleted out from under them (#326.1).**
  `prizeRedemptions.prizeId` is REQUIRED. Tidying the prize list left the
  redemption standing at `pending`, holding an id that resolves to nothing, and
  `redeemByCode` dereferences that column — so the person at the till with a valid
  code was told their prize did not exist. `games.remove` was the same shape over
  `gamePlays.gameId`, and worse in one respect: a play carries the diner's consent
  under art. 7.1, which is the establishment's evidence that it was allowed to
  record a fingerprint at all. Both now refuse and name the way out, which already
  existed and is already on the screen — `isActive: false` takes the prize out of
  the draw and the game off the QR codes immediately, without touching a record. A
  prize nothing has won still deletes, and the wheel section that named it keeps
  its label and colour and loses only the dead link.

  **Deleting an email template halted a send; deleting a segment widened one
  (#326.2).** `emailCampaigns.templateId` is required, so `sendBatch` read the
  template, found nothing, logged one line and returned: the campaign sat at
  `sending` for ever while the owner's screen read « En cours ». `segmentId` is
  optional, and that was worse — the code said "if the segment is there, filter by
  it", so a deleted segment meant no filter at all and the campaign went to the
  WHOLE list. Copy written for one slice reached every subscriber, in batches, and
  marketing mail cannot be recalled. Both deletes now refuse while a campaign that
  can still send, or any automation step, names them; a campaign that has finished
  does not block, which is the trade written down in `emailAssetReferences.ts`.

  **And the send no longer holds.** A batch that cannot read its template, its
  configuration or its segment marks the campaign `failed` with a sentence naming
  what to fix, shown under the campaign's name. That is a new status and a new
  `failureReason` column — relaunchable, so the owner fixes the cause and presses
  « Relancer », which keeps the cursor and resumes rather than mailing the first
  batch twice. The two defences are not redundant: the refusal covers deletes from
  now on, the failure covers every template or segment already gone, and every
  other way one can go missing.

  **A cancelled couponed order burned the diner's one use (#326.3).** The
  cancellation branch restored tracked stock and left the promotion exactly as
  checkout had spent it — `promotions.usageCount` still counted it, and the
  `promotionUsages` row still stood against the customer's email. A one-per-
  customer code was gone for good on an order the restaurant itself cancelled, and
  no screen anywhere edits either number. Both are released now, from a shared
  helper called by BOTH cancellation paths, because `updateFromWebhook` is a
  separate handler and a rule that lives in one caller is a rule the other skips —
  which this file has already paid for once, with a kitchen ticket left live on
  the pass after Uber cancelled the order.

  **`orders.remove` would have taken the invoice (#312).** One line, against a row
  that `payments.orderId`, `kitchenTickets.orderId` and `invoices.orderId` all
  reference REQUIRED. No screen calls it, which is the reason to guard it now
  rather than later: it is live under `orders:delete`, and whoever wires the first
  button to it will not be reading this file. It refuses on an invoice — a
  numbered fiscal document in an unbroken series, art. 242 nonies A CGI — and on a
  payment that moved money or is still in flight; it carries away the kitchen
  tickets, the dead payment attempts and the spent delivery quote, and releases
  the promotion. `orderCascade.ts` records which table is on which side and why.

  **The dead Uber Eats importer is gone (#313).** `uberEatsOrders.saveFromPlatform`
  inserted `paymentStatus: "paid"` with no `releaseToKitchen` — an order paid for
  and never reaching the pass — and its docblock claimed the webhook action called
  it. `grep` found zero callers; the live path is `orders.createFromWebhook`.
  Deleted rather than wired, because keeping it means keeping a second, wrong way
  to create a marketplace order. It was also the only writer of
  `orders.scheduledFor`, so `FEATURES.md` now says that field has none at all.

  **Four indexes were added for these guards, and one for the release:**
  `gamePlays.by_gameId`, `gamePlays.by_prizeId`, `prizeRedemptions.by_prizeId` and
  `promotionUsages.by_orderId`. Each answers its question in one row rather than
  by reading an establishment's whole history, so a delete does not get more
  expensive the longer a restaurant has been trading.

  **BREAKING:** `@be-in-digital/convex-functions` no longer exports
  `uberEatsOrders`, and the `./uberEatsOrders` subpath is removed. Both apps'
  wrappers and generated `api.d.ts` are updated here.

  32 new cases. `destructivePaths.test.ts` seeds the referencing row, runs the real
  handler and asserts BOTH halves — the refusal carries the code a screen switches
  on, AND neither side of the reference was deleted; 16 of its 21 fail against the
  code they fix, and the 5 that pass are the controls proving a delete that should
  still work does. The double is index-faithful, so the four new indexes are proved
  declared rather than merely spelled correctly. Both apps gain four cases on the
  campaign state machine.

  Closes #326. Closes #312. Closes #313.

### Patch Changes

- 13d9aa6: Bring the admin, the kitchen display and the QR game up to the AA floor

  The token layer having been fixed, what was left were the colour literals that
  never went through it. Measured by `tests/a11y/contrast.test.ts` over
  `packages/admin/src`: **84 rendered foreground/background pairs below WCAG 2.1
  AA**, each with a surface the sweep can resolve, so each one a real screen. They
  fell into four families, and three of the four were a literal that had escaped
  the design system.

  **Status badges were painted by hand, and were blind to dark mode.** `bg-green-100
text-green-700` measured 4.497:1 — three thousandths under the floor, and
  identical in dark mode because both halves are literals, so a pale green chip
  sat on a near-black table. The stock badges, the team member's `En attente` /
  `Expiré` / `Actif`, and the game catalogue's `Épuisé` now use the semantic pairs
  the design system already had: `bg-success text-success-foreground` (5.19:1
  light, 10.99:1 dark), `bg-warning text-warning-foreground` (5.40 / 9.43),
  `bg-destructive text-destructive-foreground` (5.04 / 7.61). The two auth error
  panels take `bg-destructive/5 text-destructive` (4.64 / 6.92), which is the
  treatment the storefront settled on in the same issue.

  **Two whole regions were dimmed with `opacity`, which is the trap #410 names.**
  An untracked inventory row carried `opacity-50` and an out-of-stock prize card
  `opacity-60`; an element opacity multiplies every ratio inside it, so the row's
  "N/A" thumbnail placeholder measured **1.92:1** and the `Épuisé` badge —
  which only ever renders on a card in that state — **3.29:1**. Both are now
  tinted with `bg-muted` instead of faded, and the text inside them is back at
  full strength (4.58:1 and 5.04:1). The prize ticket did the same to its QR
  plate at `opacity-30`, taking the "QR indisponible" fallback to **1.29:1**; the
  dimming moved onto the `<img>`, which is the thing that is actually spent.

  **The QR management card asked a themed ink to be read on a fixed white.**
  `--muted-foreground` inverts with the colour scheme and that plate does not, so
  the placeholder icon measured 2.54:1 in dark mode. The white plate now exists
  only under a QR code, where a scanner needs it.

  **The game arena is a deliberate dark stage, and its labels had been softened
  until they vanished.** `text-white/25` … `text-white/45` measure 2.4:1 to 4.5:1
  on `#120d1a`, and less than that on the translucent panels the screens lay over
  it; they are raised to `text-white/70` (9.54:1 on the stage, 8.08:1 on the
  lightest panel). The gold CTA every screen ends on kept its
  `from-amber-400 to-orange-600` gradient and lost its white label, which was
  **1.72:1** on the gold end: the label is now the stage's own `#120d1a`, which
  clears both ends (11.14:1 and 5.33:1). The printed ticket's `#1c1427` ink at
  40–55% opacity — 2.53:1 to 3.93:1 on the cream — is raised to 70% (6.49:1), and
  its `text-amber-600` eyebrow to `amber-700` (4.85:1). No French copy changed:
  these are the screens a diner reads.

  Three families keep a literal, deliberately, because a semantic token would
  state something untrue: the kitchen display's blue → green → orange workflow
  buttons (darkened one shade to `green-700` / `orange-700`, 4.94:1 and 5.23:1
  for their white labels), and the Uber Eats / Deliveroo platform pills, whose
  colours are the platforms' and not a status. Genuinely disabled controls are
  left as they are, under the 1.4.3 exemption for inactive components.

- e4955e7: Stop the confirmation email rendering from a field no order has ever carried

  `orders.scheduledFor` had no writer. Its only one was `uberEatsOrders.saveFromPlatform`,
  an importer with zero callers deleted with #313, and #363 had already removed the
  sibling `orders.scheduledAt` on an explicit finding — that customer-facing
  scheduled ordering is a capability this product does not have, and
  `orders.create` takes no time argument at all. It took `scheduledAt` and missed
  `scheduledFor`.

  **What made it worth removing rather than recording is that something read it.**
  `timingLine` in the confirmation email opened with `if (input.scheduledFor)` and
  rendered « Prévue pour le 12 mars 2026 à 19:30 ». That branch was written in
  #367, _after_ #363 had ruled the feature unbacked, against a field that was
  already unwritten — so it has never run for any order and never could. The
  field, its Zod line, its three type declarations, the payload mapping and the
  email branch are gone together.

  **A second, live defect was found underneath it, and is deliberately NOT fixed
  here.** `timingLine`'s remaining branch reads `order.estimatedPrepTime`, and
  `orders.create` writes the prep time it computes onto the **kitchen ticket**
  instead — `estimatedPrepTime: summary.estimatedPrepTime`, inside the ticket
  insert. Nothing writes the field the email reads. So the confirmation email
  prints no timing row for any real order and never has: both branches were dead,
  not one. That is a defect in what a customer-facing email says rather than dead
  code, and wiring it is a change with its own review, so it is reported under
  #413 and recorded in `timingLine`'s own docblock instead of being smuggled in
  under a deletion.

  **The tests that covered this were green throughout, and proved nothing.**
  `packages/core`'s `timingLine` cases call it with a `scheduledFor` and an
  `estimatedPrepTime` they supply themselves, so they exercise the rendering and
  say nothing about whether an order can reach it. The one asserting « Prévue pour
  le » is gone with its branch; the two that remain now carry a note saying what
  they do and do not establish.

  `packages/convex-functions/src/__tests__/confirmation-reads-what-orders-write.test.ts`
  asks the question those tests could not: every field the confirmation payload
  reads off an order must be written by some `insert("orders", …)` or order
  `patch`, or be named in an allowlist with its reason. `estimatedPrepTime` is the
  one entry, carrying the defect above. Writing that test surfaced two ways a
  scan like it can lie, both now closed in it: a loose key scan sees `orders.ts`'s
  _kitchen ticket_ literal and reports `estimatedPrepTime` as written — which is
  the very confusion that caused the bug — and a colon-only key regex misses the
  shorthand properties (`orderNumber,`, `viewToken,`) that a third of the orders
  insert uses.

  Two `packages/restaurant` cases ranking a scheduled order's kitchen priority
  went with the field; what they were really pinning — that being a delivery is
  what makes an order urgent — is the pair of cases they sat between. The
  Deliveroo `it.todo` that asked for this field to be written is rewritten rather
  than deleted: the need behind it is real, but it is a **KDS lateness** concern
  (an order an hour overdue looks identical to one placed this second), not a
  diner-facing booking feature, and the todo had gone stale — it still cited
  `scheduledAt`, deleted three PRs earlier, and two line numbers that had moved.

  **Why `@be-in-digital/core` is a major.** `./aws/ses/order-confirmation` is a
  first-class entry in that package's `exports` map — `convex-functions` and both
  apps import it across the package boundary — and this removes `scheduledFor`
  from the exported `OrderConfirmationInput` interface and drops `timingLine`'s
  second parameter. Either is a compile break for a consumer pinning a version.
  An earlier draft called it a minor, which would have been the same field being
  `major` in `convex-schema` and `minor` in `core` in one changeset.

  **No migration.** The field never had a live writer, so no document should carry
  it; #363 removed `scheduledAt` on the same reasoning with no migration and the
  registry in `convex/migrations/index.ts` is still empty. If some deployment does
  hold a document with the field, Convex refuses the schema push — a loud failure
  at deploy time, not silent data loss.

- 58f890f: Put the restaurant's website and its orders in the backup

  The export order and the import allow-list were written out twice — once in
  `system.exportBackup`, once in `systemInternal.ts` — and kept in step by hand.
  Between them they named **22 of the schema's 77 tables**. Omitted: `orders`,
  `payments`, `kitchenTickets`, `translations`, `teamMembers`, and **all sixteen
  `cms*` singletons** — so a "backup" of a restaurant's website did not contain
  that website's pages, and a restore reached zero orders (#169, #366).

  **One list now**, `@be-in-digital/convex-functions/backupTables`, read by both
  sides: 53 tables exported and restored, 3 exported and never re-inserted, 21
  excluded with the reason written down next to the name.

  The fiscal archive is the interesting case. `tables/invoices.ts` states the rule
  in the schema itself — an invoice is never edited and never deleted, so a
  restore must not delete-and-re-insert the series (art. 242 nonies A CGI). But a
  backup that loses an establishment's invoices is not a backup of that
  establishment. Both are answered by carrying them in the file and refusing them
  at the import, which is also what keeps `orders.invoiceId` resolving across a
  restore: those rows never move.

  **Two defects found on the way in.**

  `stores.stationMapping[].categoryId` points at `categories`, and `categories`
  points back at `stores`. No order satisfies both, so the kitchen routing came
  back naming categories that no longer existed — silently, because `v.id()`
  validates an id's encoding rather than that it resolves, so every ticket fell
  through to single-station behaviour. `remapDeferredReferences` is a second pass
  with the full id map, and `DEFERRED_REMAP_TABLES` is where an edge the order
  breaks on purpose has to be declared.

  And the export carried two live single-use credentials into a JSON file an
  administrator downloads to a laptop: `teamMembers.invitationToken`, which grants
  a role to whoever opens the link, and `emailSubscribers.doubleOptInToken`. Both
  fields are optional, so a restore comes back without them and the invitation is
  re-sent.

  A restore now also schedules the retention sweep: a backup carries personal data
  and can be older than the window it is restored into, and re-running the purge
  is what stops a restore resurrecting what the establishment was obliged to
  remove (art. 5.1.e).

  The manifest states, in the file itself, what a restore will not put back and
  what the backup does not carry at all — table by table with a reason each. The
  admin's Sauvegarde card says the short version before anyone clicks. "Absent
  because it is not the establishment's" and "absent because someone forgot" used
  to look identical from the outside.

  Tests check the lists against the schema rather than against memory: the import
  order is verified to be a topological sort of the foreign-key graph derived from
  Convex's own validators, and every table in the schema must be classified
  exactly once — which is how sixteen CMS singletons went missing without anyone
  noticing.

  Refs #169, #366.

- bdf8012: Close the second double-collection vector, and stop a correct refusal 500-looping

  #378 closed cash-then-card: `assertSettlesOrder` refuses a card settlement on an
  order the counter has already collected, because the order records WHICH method
  it is on and the two differ. Two card sessions differ in nothing it can see.

  A diner who opens checkout twice — a stale tab, a back-navigation, a retry —
  left two live Stripe Checkout Sessions against one order. Both referenced that
  order, that currency and that total, so the guard passed both; both were `card`,
  so #378's method check did not separate them; and `settlePayment` deduplicated
  on `externalId`, which two payment intents never share. Measured on the code as
  it stood:

  ```
  [PROBE] order total: 120000  collected: 240000
  [PROBE] succeeded rows: 2
  [PROBE] second session refused: false
  ```

  A 1 200 € order collected 2 400 €, in two `succeeded` rows, each independently
  refundable, with the order untouched and nothing anywhere saying so (#411).

  **The ledger is where the rule now lives — for every writer, not four of them.**
  `settlePayment`'s order-level check carried `p.provider !== args.provider`,
  which read two Stripe charges as one collection. That clause is gone, and it
  cannot come back: execution only reaches the check when `by_externalId` found no
  row for THIS charge on THIS order, so every row still standing there belongs to
  another charge, whoever minted it. Stating it inside `settlePayment` was not
  enough either — the claim was that this made the invariant "a property of the
  ledger rather than of five call sites remembering to ask a guard", and two other
  writers reached the same table without asking anything: `orders.markCashPaid`
  inserts a `succeeded` row directly, and `payments.create` + `payments.updateStatus`
  is a public pair under `payments:write` that writes one in two steps. All three
  now read `collectionOnOrder` from the new `paymentLedger` module.

  `assertSettlesOrder` is unchanged and stays the fast pre-check: it is given one
  claim and one order and no charges, so it cannot tell a redelivery from a second
  session, and the two tests that describe it waving one through now say so.

  **A refusal is not a failure, and the two need opposite answers.** The Stripe
  webhook answered 500 to every throw. A settlement refusal is permanent —
  retrying delivers the same answer — so Stripe retried for three days, each
  attempt re-ran the guard to the same refusal, the delivery stayed
  `processed: false` and was re-admitted as `in_flight` every time, and nobody was
  told. It now answers 2xx, retires the delivery and RECORDS it: refusing the row
  keeps the ledger honest but does not make the diner whole, because a provider
  does not report a charge it did not take. `payment_collection_refused` is a new
  `systemAuditLog` action, rendered in Dashboard → Système, naming the order, the
  charge and the reason — the only place a human learns a refund is owed. It takes
  its ids as strings on purpose: Convex validates arguments before a handler runs,
  so a `v.id()` there would throw out of the very catch block whose contract is
  "this can never fail its caller", straight back into the retry loop.

  `deliberateSettlementRefusal` tells the two apart, and reads the error's `data`
  rather than its class: Convex rebuilds a `ConvexError` across the mutation
  boundary, so `instanceof` is false at exactly the call site that matters and
  fails closed into the loop. Its code list is a `Record` over both reason unions,
  so a ninth reason does not compile rather than silently reading as a failure.

  The settlement is also written BEFORE the order status now. They are two
  transactions, and writing the status first committed it where a refusal could
  still follow — leaving an order reading « Payé » with no payment row against it.
  That was survivable while every refusal answered 500 and the endpoint showed red
  in Stripe's dashboard; a 200 makes it final and silent.

  **And the second charge is no longer taken at all.** `createCheckoutSession`
  overwrote the order's stored session id and told Stripe nothing about the old
  one, which stays payable for about twenty-four hours. It now expires the
  previous session before the replacement becomes payable, and READS the outcome:
  Stripe reports "already paid" and "already expired" with the same error, and one
  of those means the previous session has been completed with its settlement still
  in flight — the order reads `pending`, so no status gate can see it, and a
  replacement would collect the same meal twice. All three provider checkouts also
  refuse outright to open a payment on an order already collected, reading both
  the order's status (which counts `refunded`, so they agree with
  `markCashPaid`: a refunded order is closed business) and the ledger (which
  catches the window between a payment row being written and the status catching
  up). The refusal is a `ConvexError` — `order_already_paid` — so the diner reads
  « Cette commande a déjà été réglée » rather than being told to retry a payment
  they have already made.

  What this does NOT close, and the ledger is why it does not have to: an action
  is four round trips with no transaction around them, so two checkouts genuinely
  in flight at once can still open two sessions. They settle through
  `settlePayment`, which is serializable — one succeeded row, the second refused
  and recorded.

  **A Stripe key the API rejects no longer arms the card tile.**
  `cardPaymentAvailability` checked `STRIPE_SECRET_KEY.startsWith("sk_")`, which
  is a check on the shape of a string: a key that is revoked, rolled or from
  another account all passed it, so the tile was pre-selected and the
  `StripeAuthenticationError` thrown by `sessions.create` reached the diner as the
  redacted "Server Error" #374 was written to remove. Only Stripe can answer
  whether a key works and a query cannot ask it, so the verdict is recorded when
  it is learnt — in the new `cardProviderHealth` table, written by the hourly
  `stripe.verifyStripeKey` and by every checkout that succeeds or is refused — and
  read back by the availability query.

  Its own table for two reasons, both learnt the hard way from putting it on
  `globalSettings` first: that document is read by a PUBLIC query before any
  sign-in, and a provider's refusal message names the key's mode and last four
  characters; and it is created by exactly one thing, the owner pressing
  Enregistrer, so a deployment whose owner has never opened that screen — a fresh
  one, which is what #374 is about — had nothing to write a verdict onto and the
  fix was inert. The row is written only when the verdict moves, because it is
  read on the order path and Convex conflicts a write with every concurrent
  transaction that read it. Hourly rather than nightly because the cron is the
  only writer that can bring the tile BACK: once a verdict disarms it, no diner
  can reach the checkout that would report the key working again.

  A credentials refusal, and only that: a declined card, a rate limit or an outage
  say nothing about the key, and disarming the tile over one would take card
  payments away from a working establishment.

- ecb21a1: Stop `promotions.create` and `promotions.update` accepting the configuration of a withdrawn offer type

  #403 withdrew « Produit offert » and « Offre BOGO » as discount **types** — both
  alter the item list rather than the order total and no code path builds those
  items, so `assertHonourableDiscountType` refuses them on create and on update,
  and the promotion form stopped offering them. It left their five configuration
  fields on both args validators: `freeProductId`, `bogoTriggerProductId`,
  `bogoRewardProductId`, `bogoTriggerQuantity`, `bogoRewardQuantity`. Both
  handlers spread `args` straight into the row, so all five went on reaching the
  database unexamined for another five commits.

  **One of them was live.** `products.remove` reads the first three to refuse
  deleting a dish a promotion still points at. Measured against the real
  mutations: a plain `percentage` promotion given a `freeProductId` made that dish
  **undeletable**, and the refusal named a promotion that used the product in no
  way the owner could find — the field is on no form, and `update` has no way to
  clear an optional field, only to overwrite it with another product. There was no
  route back short of deleting the promotion.

  The five are gone from both validators. That is the whole guard: a Convex
  mutation refuses an argument no validator declares — `Validator error:
Unexpected field \`freeProductId\` in object`— which the tests measure rather
than assume.`discountTypeValidator`keeps all five **literals** deliberately:`update`reads`existing.discountType` to refuse an edit that would keep a
  withdrawn type, and that refusal is a French sentence an owner can act on. A
  narrowed union would turn it into an untranslated validator error.

  **The schema keeps the five as `v.optional`**, because rows written before the
  withdrawal still hold them — the treatment `stores.integrations` already has.
  The comments there described a feature that cannot be created ("for discountType
  === \"free_product\"", "BOGO fields"); they now say that nothing writes these,
  that one thing reads three of them, and what implementing `bogo` would take.
  `WITHDRAWN_PROMOTION_CONFIG_FIELDS` lives in `promotionDiscount.ts` next to the
  withdrawal itself, so the args that must refuse them, the delete guard that
  still reads them and the tests that hold both name one list.

  **The delete refusal now names an action that exists.** The guard still blocks —
  a legacy row pointing at a deleted dish is the dangling reference it was written
  to stop — but « Modifiez ou supprimez cette promotion » was half an instruction
  nobody could follow. The two references are told apart: `targetProductIds` is
  the promotion's product scope, which the form renders and the owner can unpick,
  and keeps that sentence; the three withdrawn fields get their own, saying that
  the reference is not on the promotion form and cannot be removed there, and that
  deleting the promotion is what frees the dish. Deactivating does not clear it,
  so the message does not suggest it.

  `promotion-discount-types.test.ts` asserted the form source held no
  `bogoTriggerQuantity` and no `bogoRewardQuantity`, and nothing at all about the
  server — which is exactly how the server half survived the #403 cleanup. It now
  covers all five names on both ends, against the validator objects rather than a
  source scan.

- Updated dependencies [ecb21a1]
- Updated dependencies [e4955e7]
- Updated dependencies [58f890f]
- Updated dependencies [e4955e7]
- Updated dependencies [13d9aa6]
- Updated dependencies [038eb9d]
- Updated dependencies [e569498]
- Updated dependencies [bdf8012]
- Updated dependencies [e4955e7]
- Updated dependencies [58f890f]
- Updated dependencies [ecb21a1]
- Updated dependencies [ecb21a1]
  - @be-in-digital/convex-functions@6.0.0
  - @be-in-digital/convex-schema@5.0.0
  - @be-in-digital/core@3.0.0
  - @be-in-digital/restaurant@4.0.0
  - @be-in-digital/ui@4.0.0
  - @be-in-digital/marketing@3.0.0

## 10.0.0

### Major Changes

- 895d200: Bound the four queries that grow with the mailing list and the order book

  **Convex refuses a transaction that reads more than 16,384 documents, and each
  of these was a live `useQuery`.** They do not degrade: at the row count where a
  restaurant's mailing list or order book has become worth having, the screen
  behind them throws on every load, permanently, and no admin action clears it.
  #316 made every storefront signup, order and game play add a subscriber, so the
  list grows on its own. Measured on the read-counting double:

  ```
                                          20,000 rows     before -> after
  PROBE emailSubscribers.list             subscribers     20,000 ->     15
  PROBE emailSubscribers.countByStatus    subscribers     20,000 -> 10,005
  PROBE emailSegments.countMatching…      subscribers      4,000 ->  2,001
  PROBE products.getTrending              orders          20,008 ->  1,008
  ```

  (`countByStatus` reads five index ranges of 2,000 rather than one table of
  20,000, and the segment preview's 4,000 is the active fifth of that seed — both
  were already past the ceiling on a list two or three times this size, which is
  one good year.) `dueForSending` is not in the table because the double cannot
  show its defect: a Convex `.filter` reads every row it rejects, and the double
  applies the predicate before counting. On the real backend the sweep read every
  campaign the establishment had ever written, once a minute, to find the almost
  always empty set of due ones.

  **The audience page reads a page.** `emailSubscribers.list` takes
  `paginationOpts` and resolves the status tab through `by_storeId_status`; the
  page is clamped to `MAX_PAGE_SIZE`, so `{ numItems: 1_000_000 }` from anyone
  holding `marketing:read` cannot reinstate the transaction the pagination
  prevents. `source` is gone from its arguments: no index carries it, and
  filtering after `.paginate()` returns two rows out of fifteen and calls it a
  page. The screen narrows source and search over the rows it has loaded and says
  so in the placeholder and the empty state, and « Charger plus » widens what they
  can see — the shape `/dashboard/orders` already uses.

  **The counts are counted, not downloaded.** Convex has no count, so a total is
  however many documents you were willing to read: `countByStatus` walks one
  `by_storeId_status` range per status, stopped at `SUBSCRIBER_COUNT_SCAN_LIMIT`,
  and `countMatchingSubscribers` reads at most `SEGMENT_PREVIEW_SCAN_LIMIT` active
  subscribers before applying rules that no index can answer. Both report whether
  they were capped: the dashboard renders « 2 000+ » and the segment dialog says
  which population its count describes, rather than presenting a floor as a total.
  `countMatchingSubscribers` now returns `{ count, scanned, truncated }` — a bare
  number could not say which of the two it was.

  **The homepage carousel ranks a window.** `products.getTrending` is the public
  storefront's own subscription, one per open tab, re-run on every new order, and
  it collected a month of orders to return three products. It now reads the
  `TRENDING_ORDER_SCAN_LIMIT` most recent orders of the window, newest first — so
  what the cap drops is the far end of the month, not this week — with a separate
  budget for the product lookups a reworked catalogue can otherwise stretch, and a
  clamped `limit`, because a public query is handed whatever a visitor sends.

  **And the cron stops scanning the archive every minute.** `dueForSending`'s
  docblock described an indexed per-store walk; what shipped was
  `.filter(q => q.eq(q.field("status"), "scheduled")).collect()`, and a Convex
  `.filter` narrows rows the database has already read. It walks
  `by_storeId_status` per establishment now, which is what the paragraph always
  claimed.

  **`incrementRevenue` is removed, and the dialog stops reporting a zero it cannot
  stand behind.** It had zero call sites, and nothing produces the figures it
  patched: no path writes a `converted` email event, and no order records the
  campaign that led to it. The campaign stats dialog rendered a hard « 0,00 € »
  and « 0 conversions » beside real send and open counts, for every campaign, for
  ever, and an owner reading it concluded their mailing sold nothing. Both tiles
  now say « Non suivi » with the reason underneath. `stats.converted` and
  `stats.revenue` stay in the schema, so wiring a real producer later is a
  producer, not a migration.

  Probes: 15 read-count cases in `queryBounds.test.ts`, seeding 20,000 rows — more
  than Convex will read in one transaction — and asserting the number of documents
  the query asks for rather than the answer it returns, because an answer is right
  on ten rows and right again on ten million. Two of them assert the count does
  not move at all as the table grows. The index-faithful double refuses an index
  the schema does not declare and an equality off the index prefix, so "narrow it
  in JavaScript instead" cannot pass either. 8 companion cases in each app's
  `query-bounds.test.ts` run the same paths through the real schema and the real
  auth wrappers, and `dueForSending`'s own tests moved off a hand-rolled `db` that
  answered `.filter().collect()` with the rows the test wanted — it could not tell
  the indexed walk from the table scan it replaced, and was green for the whole
  time that scan was shipping.

  Closes #327.

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

- Updated dependencies [895d200]
- Updated dependencies [16521f2]
- Updated dependencies [cdc6c81]
  - @be-in-digital/convex-functions@5.0.0
  - @be-in-digital/convex-schema@4.1.0
  - @be-in-digital/restaurant@3.1.0
  - @be-in-digital/core@2.5.0
  - @be-in-digital/ui@3.1.0

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
