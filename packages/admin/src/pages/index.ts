/**
 * Every admin screen, at the subpath `package.json` has always advertised.
 *
 * `"./pages": "./src/pages/index.ts"` was declared and the file did not exist
 * — the only broken one of the eight subpaths this package publishes (`.`,
 * `./components`, `./stores`, `./stores/api`, `./pages`, `./lib`, `./hooks`,
 * `./game`). Ten entries in `packages/mcp-server`'s registry point client
 * builds at `@be-yours/admin/pages`, and every one of them failed to
 * resolve.
 *
 * This note said twenty, which was never the count of anything: `exports` in
 * `package.json` is the list, and it is eight. Count it there before quoting a
 * number here.
 *
 * It re-exports the per-screen barrels rather than restating them, so a screen
 * added to `pages/<x>/index.ts` arrives here on its own.
 *
 * EVERY SCREEN HERE MUST MOUNT UNDER `AuthGuard`. These components read the
 * Convex API from `useAdminApiStore` and dereference it without a guard,
 * because `AuthGuard` folds `api === null` into its pending state and renders a
 * skeleton rather than its children until the layout's effect has injected it.
 * Mounted outside that shell, the first render throws
 * `TypeError: Cannot read properties of null`.
 */

export * from "./categories"
export * from "./customers"
export * from "./dashboard"
export * from "./design"
export * from "./email"
export * from "./games"
export * from "./inventory"
export * from "./kitchen"
export * from "./languages"
export * from "./messages"
export * from "./orders"
export * from "./payments"
export * from "./privacy"
export * from "./products"
export * from "./promotions"
export * from "./settings"
export * from "./stores"
export * from "./system"
export * from "./team"
