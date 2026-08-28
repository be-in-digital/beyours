---
"@be-in-digital/convex-schema": major
"@be-in-digital/convex-functions": major
---

`convex` moves from a hard dependency to a peer dependency.

**Breaking: consumers must declare `convex` themselves**, at `^1.44.0`. Every
consumer already does — both apps and the boilerplate are on 1.44.0 — so nothing
in the fleet has to change today. It is still a change to the contract, hence
the major.

Both packages ship raw TypeScript (`main: ./src/index.ts`, `files: ["src"]`, no
build step), so the consumer's compiler reads their source, which imports
`convex/server` and `convex/values`. That is the definition of a peer: the
consumer supplies the copy, and there must be exactly one. As a hard dependency
at an exact version it was the opposite — the package brought its own.

Measured on the real tarball rather than argued, with a consumer on convex
1.42.0:

| | Result |
|---|---|
| **Before** — `dependencies: { convex: "1.44.0" }` | installs quietly, **two copies**: the consumer's `convex@1.42.0` and a nested `@be-in-digital/convex-schema/node_modules/convex@1.44.0` |
| **After** — `peerDependencies: { convex: "^1.44.0" }` | npm **refuses**: `npm error peer convex@"^1.44.0" from @be-in-digital/convex-schema@2.2.0` |
| **After**, consumer on 1.44.0 | installs, exactly one copy |

Two copies of `convex/values` means two sets of validators, which is the same
class of failure as the two React contexts that once crashed the admin — quieter,
because there is no provider to notice the mismatch.

One limit worth stating: inside this monorepo the change has no effect. Workspace
links resolve `convex` from each package's own `devDependencies`, so
`packages/convex-schema` keeps using its local copy whatever a sibling declares.
The guard is real where the packages are installed from the registry, which is
every client site.
