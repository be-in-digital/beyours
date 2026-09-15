---
"@be-in-digital/restaurant": patch
---

Bundle convex-schema so the package loads under plain Node

`dist` left `@be-in-digital/convex-schema` external, and that package publishes
raw `.ts` on purpose — the Convex bundler compiles it, and a schema has to stay
readable as source. So the bundle carried a runtime import of TypeScript.

It worked everywhere it was tried. In the monorepo `convex-schema` resolves
outside `node_modules` and Node strips types there. A client installs it from the
registry, where it is under `node_modules`, and Node refuses:

    Error: Stripping types is currently unsupported for files under
    node_modules, for ".../@be-in-digital/convex-schema/src/index.ts"

That is every Playwright spec importing a value from this package — the client
template's own `e2e/storefront/cart-line-identity.spec.ts` imports
`CART_STORAGE_VERSION` — on every client repo.

`tsup.config.ts` already had this exact reasoning written down for
`@be-in-digital/core/allergens`, one package along. `convex-schema` joins it in
`noExternal`. Bundled rather than repackaged: the four helpers used here are pure
functions and a constant, with no singleton to duplicate.
