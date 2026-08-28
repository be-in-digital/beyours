---
"@be-in-digital/convex-functions": minor
"@be-in-digital/convex-schema": minor
"@be-in-digital/admin": patch
---

One `convex` version across the monorepo: 1.44.0.

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
