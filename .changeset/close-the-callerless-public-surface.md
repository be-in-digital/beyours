---
"@be-in-digital/convex-functions": patch
---

Record what happened to the app-side registrations of these definitions

No source change here — this is the note that belongs beside one. #413's third
class was the app-side public Convex surface, which lives in `apps/*/convex` and
is outside changesets (`apps/*` is on the `ignore` list). It is recorded here
because the definitions it registered are this package's.

**Measured, and the issue's own number was wrong.** #413 said 36 callerless
public functions per app. That counts only bare `query(`/`mutation(`/`action(`
and misses the 200 exports built with
`storeQuery`/`storeMutation`/`authedQuery`/`authedMutation` — which
`lib/storeFunctions.ts` binds to the same generated builders, so they are routed
just as publicly and merely permission-checked inside. Counting them: **359
registrations per app, 81 of them with no caller anywhere.** A caller sweep also
has to tolerate optional chaining, because `packages/admin` takes the API as
`any` and writes `api?.products?.list`; scanning for `api\.x\.y` alone reports
132 dead where there are 81, and would have deleted live screens' backends.

**Eleven of the 81 were unauthenticated storefront reads no screen opened** —
`products.getFeatured`, `getBySlug`, `getByCategory`, `cms.getPage`,
`menus.getById`, `categories.getById`, two blog listings, two translation reads,
and `orders.getByViewToken`. Their live siblings (`products.list`,
`cms.getPageBlocks`, `orders.getById`) are what the storefront actually calls.
None of the 81 was an unguarded write, so this was never an open door; it was
surface, and #281 is the precedent for what surface becomes.

**71 registrations are gone, in both twins identically. Ten are kept, annotated
`@kept-callerless` at the declaration**, because something outside the code
reaches them: three from `apps/reference`'s own ops scripts, and seven named by
a runbook or guide as something an operator runs by hand.

**Making them internal was tried first, and is wrong.** Every one authorises
from the *caller's* identity, and an internal function reached from a cron, the
Convex dashboard or `npx convex run` has none — it would refuse every caller it
could ever have, which is the same defect as the `useToast` that threw.
`tests/convex/scheduled-paths.test.ts` caught three Deliveroo actions doing
exactly that, and that is why the answer is delete-or-keep rather than
delete-or-internalise.

**One removal was a real break, found by review rather than by a test.**
`uberEatsOAuth.generateAuthorizeUrl` is the only writer of a `uberEats` row in
`oauthStates`, and the live `uberEatsConnectCallback` HTTP route validates that
row before exchanging a code. With no writer the callback could only ever answer
"Invalid or expired OAuth state" — Uber Eats would have become unconnectable on
every client. It is restored and annotated, along with the five others a runbook
names. The lesson is in the guard's shape: "no caller in this repository" and
"nothing needs this" are different claims, and a source scan can only measure
the first.

`apps/*/tests/convex/public-surface.test.ts` now holds the line in both apps: it
enumerates every public registration, requires a caller for each, and requires
any exception to be listed *and* to carry its reason next to the code. It fails
when a callerless public function is added, and its allowlist is itself checked
for entries that have gone stale.
