---
"@be-in-digital/admin": minor
---

Ship the gamification player flow in the client template

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
