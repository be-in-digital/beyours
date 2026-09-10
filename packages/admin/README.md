# `@be-in-digital/admin`

The back office. 108 page components across 20 feature areas, plus the stores,
hooks and helpers they need.

`15.0.1` · 215 source files · 43,127 lines · **shipped as TypeScript source** ·
the largest package in the engine

---

## Why it ships as source

`main` points at `./src/index.ts` and there is **no `build` task**. Unlike
`convex-schema` and `convex-functions`, the reason here is React: this package
carries **Server Components**, and transpiling them through tsup would break the
boundary. A type error surfaces in `pnpm type-check` or in a consuming app's
build.

⚠️ **This package majors on a peer dependency.** A major bump propagates further
than it looks — check what depends on it before releasing.

---

## Entry points

| Subpath | Holds |
| --- | --- |
| `.` | The barrel |
| `./pages` | The 108 page components, grouped by feature |
| `./components` | Shared admin components, including onboarding |
| `./stores` · `./stores/api` | Zustand stores and their API layer |
| `./hooks` | Admin hooks |
| `./lib` | Helpers — including the kitchen-print provider table |
| `./game` | Gamification admin, including the consent wording |

Feature areas under `./pages`: `dashboard`, `products`, `categories`,
`inventory`, `orders`, `kitchen`, `stores`, `team`, `email`, `games`,
`languages`, `promotions`, `payments`, `messages`, `design`, `settings`,
`privacy`, `system`.

---

## Things worth knowing before you edit

**Consent wording owns its own version.** `src/game/consent-copy.ts` holds the
art. 7.1 notice shown before a diner plays, and its version string. The set the
server accepts is `GAME_CONSENT_NOTICE_VERSIONS` in
`@be-in-digital/convex-functions/gamePlay`. Change the copy, bump the version,
and add it there — otherwise `gamePlay.play` throws `CONSENT_REQUIRED`.

**Kitchen printing has exactly one working transport.** `src/lib/kitchen-print.ts`
lists three cloud providers with `available: false`. What ships is browser
printing: the kitchen screen renders the ticket into a hidden iframe and calls
`print()`, and `apps/*/scripts/kiosk-print.sh` runs Chrome with
`--kiosk-printing` so no dialog appears. A thermal printer set as the OS default
gives a thermal ticket **through the OS driver**, not through ESC/POS bytes we
emit.

Not implemented, and not to be described as if it were: ESC/POS byte generation,
network (port 9100) or USB transport, printer status polling. A browser cannot
open a raw socket and Convex cannot reach a restaurant's LAN.

**Two switches on the Languages screen are disabled with a stated reason.** The
« Droite à gauche » toggle and the « Devise » picker still store their value, and
nothing on the storefront reads it: prices format as `fr-FR`/EUR whatever the
owner picked, and Arabic renders left to right. Currency is the half-case — the
admin's own payment and refund screens *do* format in the currency taken; only
the public site does not.

**The Design screen is gated by role only** — `stores:write`, which `manager`
does not hold. The vertical template applied at clone time is a starting point,
not a ceiling.

**There is no plan gating.** The engine never learns which of the two offers was
bought. Do not add copy implying a feature is withheld from a tier.

---

## Commands

| Command | Effect |
| --- | --- |
| `pnpm lint` · `pnpm type-check` | Quality |
| `pnpm test` · `pnpm test:watch` · `pnpm test:coverage` | Vitest |
| `pnpm clean` | Remove `node_modules` |

---

[Root README](../../README.md) · [`ui`](../ui) · [`convex-functions`](../convex-functions)
