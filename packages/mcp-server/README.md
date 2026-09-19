# `@be-yours/mcp-server`

A Model Context Protocol server over the engine's package registry. It answers
"which package exports this, and how do I import it" without anyone opening ten
`package.json` files.

`1.1.4` · 4 source files · 1,902 lines · shipped as `dist/` (tsup)

---

## What it serves

`src/registry.ts` holds the catalogue: every `@be-yours/*` package, its
subpath exports, and for each export the binding name and the import statement
that brings it in. `src/server.ts` exposes that over MCP on a **stdio**
transport.

| Function | Answers |
| --- | --- |
| `searchPackages(q)` | Which packages match a term |
| `getPackageByName(n)` | One package's full export surface |
| `importBinding(x)` | The identifier an export is bound to |
| `importStatement(x)` | The exact line to paste |

The point is the subpaths. `convex-functions` alone has 96 of them, and picking
the wrong one is not a compile error — it is an isolate that pulls in more than
it needed.

---

## Running it

```bash
pnpm --filter @be-yours/mcp-server build
pnpm --filter @be-yours/mcp-server start   # node dist/index.js, stdio
```

Point an MCP client at that command. It speaks stdio, so it is started by the
client rather than listening on a port.

---

## Keeping the catalogue honest

```bash
pnpm --filter @be-yours/mcp-server sync:versions
```

`scripts/sync-package-versions.mjs` re-reads the workspace and writes the
versions back into `src/package-versions.ts`. Run it when a package is bumped —
a registry that reports last month's version is worse than no registry.

---

## Not consumed by the applications

This is the one package none of the three apps import. It is developer tooling,
published alongside the others so it versions with them.

---

## Commands

| Command | Effect |
| --- | --- |
| `pnpm build` | tsup → `dist/` |
| `pnpm dev` | tsup in watch mode |
| `pnpm start` | `node dist/index.js` |
| `pnpm sync:versions` | Refresh `src/package-versions.ts` from the workspace |
| `pnpm lint` · `pnpm type-check` | Quality |
| `pnpm test` · `pnpm test:watch` | Vitest |
| `pnpm clean` | Remove `dist/` and `node_modules` |

---

[Root README](../../README.md)
