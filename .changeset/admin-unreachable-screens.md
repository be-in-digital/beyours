---
"@be-in-digital/admin": major
---

Stop the admin offering screens the server refuses, and keep one copy of each

Four defects with one shape between them: a screen that exists, works, and is
reached by nobody — or is reached by someone the server then turns away.

**The sidebar offered "Cuisine (KDS)" to two roles whose every KDS query the
server refuses.** The entry was gated on `orders:read`; `kitchenTickets.getByStore`,
`getPrintQueue`, `getOverdueCount` and `getPrintStuckCount` all enforce
`kitchen:read`. `waiter` and `delivery` hold the first and not the second, and
both are handed out by the owner's own Team screen. Convex rethrows a refusal
out of `useQuery` *during render*, so the click did not produce an empty screen —
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
runs both of the server's gates in the server's order, and *imports*
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
  in *both* apps to the Convex wrapper behind every mount-time query, and fails
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
  through `useSyncExternalStore`, whose *server* snapshot is the store's initial
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
