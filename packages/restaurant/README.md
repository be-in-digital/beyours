# `@be-yours/restaurant`

Client-side business logic: the Zustand stores, the services that talk to
Convex, and the React hooks the storefront is built out of.

`4.1.1` · 23 source files · 2,718 lines · shipped as `dist/` (tsup)

---

## Entry points

| Subpath | Holds |
| --- | --- |
| `.` | Types, stores, services and hooks |
| `./stores` | Zustand stores — cart, store selection, UI state |
| `./services` | Business services over the Convex client |
| `./hooks` | React hooks |

---

## The state split this package encodes

```ts
// Client state → Zustand, from here
import { useCartStore } from "@be-yours/restaurant/stores"

// Server state → Convex hooks, straight from convex/react
import { useQuery } from "convex/react"
const products = useQuery(api.products.list)
```

Client state is what the browser owns between renders. Server state is what the
backend owns and pushes. Do not mirror one into the other — a Convex
subscription that is copied into a Zustand store stops being real-time and
starts being a cache nobody invalidates.

---

## Consumed from `dist/`

⚠️ This is the package that catches people out. `main` is `./dist/index.js`, so
**editing `packages/restaurant/src` changes nothing in a running browser until
you rebuild**:

```bash
pnpm --filter @be-yours/restaurant build
# or, while iterating
pnpm --filter @be-yours/restaurant dev
```

A stale `dist/` looks exactly like a bug in your component.

---

## Commands

| Command | Effect |
| --- | --- |
| `pnpm build` | tsup → `dist/` |
| `pnpm dev` | tsup in watch mode |
| `pnpm lint` · `pnpm type-check` | Quality |
| `pnpm test` · `pnpm test:watch` · `pnpm test:coverage` | Vitest |
| `pnpm clean` | Remove `dist/` and `node_modules` |

---

[Root README](../../README.md) · [`ui`](../ui)
