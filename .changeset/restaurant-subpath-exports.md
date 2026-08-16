---
"@be-in-digital/restaurant": patch
---

Ship the `./stores`, `./services` and `./hooks` subpaths the package already declared. The build only bundled `src/index.ts`, so those three `exports` entries pointed at files that never existed — in the workspace and in the published tarball alike. Any consumer following the documented import paths (`import { useCartStore } from '@be-in-digital/restaurant/stores'`) hit a resolution error.

The store state and action types (`CartState`, `CartActions`, `CartStore`, and their `Store`/`UI`/`Language` counterparts) are now exported too. They were internal, which made the inferred store types unnameable: `export const cart = useCartStore` failed with TS4023 in a consumer.

Code splitting is enabled so the Zustand stores stay singletons across entry points — importing `useCartStore` from the root and from `./stores` returns the same store, not two carts.
