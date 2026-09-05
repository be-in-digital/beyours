import { describe, expect, test } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  describeUnresolvable,
  engineImportsIn,
  exportsResolve,
  unresolvableImports,
} from "../../../scripts/lib/engine-exports.mjs"

/**
 * The mirror must not ship a tree its own pinned versions cannot resolve.
 *
 * CI builds `apps/themes` against `packages/*` at HEAD through the pnpm
 * workspace link. The mirror ships something else: `publish-mirror.mjs`
 * rewrites every `workspace:^` to `^<latest published>` from the registry,
 * because only the registry says what a client can install. Nothing compared
 * the two, and they diverge silently — a subpath added to a package's
 * `exports` without a version bump exists at HEAD and not in the tarball.
 *
 * Measured on this repository at the time of writing: every engine version was
 * last set on 2026-09-01 (#278), and `./sesSending`, `./stripeChargeRouting`,
 * `./htmlSanitize`, `./platformWebhookFailures`, `./platformWebhook`,
 * `./paymentEvents`, `./blogAutoPlanner` and `@be-in-digital/admin/game` were
 * all added on 2026-09-04. Shipped `apps/themes` modules import every one of
 * them. A client's `pnpm install` succeeds; `next build` and `convex deploy`
 * then die with `ERR_PACKAGE_PATH_NOT_EXPORTED` — with all four required checks
 * green, `check:mirror-css` included, because it symlinks `packages/<name>` and
 * so never sees the pinned version either.
 *
 * `.changeset/gamification-player-flow.md` already described this window and
 * noted it "does not close on its own if the release never publishes". These
 * are the assertions that make it close.
 *
 * Bench-only: it reads the monorepo's own scripts and would be meaningless on
 * a client site.
 */

function tree(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "engine-imports-"))
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), body)
  }
  return root
}

describe("finding what a tree imports", () => {
  test("it reads static, dynamic, type-only and require forms", () => {
    const root = tree({
      "convex/a.ts": `import { x } from "@be-in-digital/convex-functions/orders"`,
      "convex/b.ts": `const m = await import("@be-in-digital/core/sentry")`,
      "convex/c.ts": `import type { T } from "@be-in-digital/convex-schema/types"`,
      "lib/d.js": `const y = require("@be-in-digital/ui")`,
    })

    const found = engineImportsIn(root)
    expect([...(found.get("@be-in-digital/convex-functions") ?? [])]).toEqual(["./orders"])
    expect([...(found.get("@be-in-digital/core") ?? [])]).toEqual(["./sentry"])
    expect([...(found.get("@be-in-digital/convex-schema") ?? [])]).toEqual(["./types"])
    // A bare specifier is the root export, which an `exports` map calls ".".
    expect([...(found.get("@be-in-digital/ui") ?? [])]).toEqual(["."])
  })

  /**
   * `import type` is included on purpose: a type-only import of a subpath the
   * tarball does not carry still fails `tsc` on the client's machine, and the
   * client is the only place it would ever be noticed.
   */
  test("it looks everywhere a client would resolve, and nowhere it would not", () => {
    const root = tree({
      "app/page.tsx": `import "@be-in-digital/admin/game"`,
      "tests/x.test.ts": `import "@be-in-digital/marketing/email"`,
      "node_modules/dep/index.js": `import "@be-in-digital/core/should-not-be-seen"`,
      ".next/server/chunk.js": `import "@be-in-digital/cms/also-not"`,
      "README.md": `import "@be-in-digital/ui/nor-this"`,
    })

    const found = engineImportsIn(root)
    expect([...found.keys()].sort()).toEqual([
      "@be-in-digital/admin",
      "@be-in-digital/marketing",
    ])
  })
})

describe("resolving a subpath against a published exports map", () => {
  const map = {
    ".": "./dist/index.js",
    "./env": "./dist/env/index.js",
    "./aws/*": "./src/aws/*.ts",
  }

  test("an exact entry resolves", () => {
    expect(exportsResolve(map, ".")).toBe(true)
    expect(exportsResolve(map, "./env")).toBe(true)
  })

  test("a wildcard entry resolves what it covers, and nothing else", () => {
    expect(exportsResolve(map, "./aws/media-url")).toBe(true)
    expect(exportsResolve(map, "./aws/folders")).toBe(true)
    expect(exportsResolve(map, "./sentry")).toBe(false)
  })

  test("a subpath the map does not carry does not resolve", () => {
    expect(exportsResolve(map, "./sesSending")).toBe(false)
  })

  /**
   * A package with no `exports` field falls back to Node's legacy resolution,
   * which allows any path into the tarball. Treating that as a failure would
   * make this guard block publishes over a shape that is not a defect.
   */
  test("no exports field means nothing here can be wrong", () => {
    expect(exportsResolve(undefined, "./anything")).toBe(true)
    expect(exportsResolve(null, "./anything")).toBe(true)
  })

  test("a string exports field is the root and only the root", () => {
    expect(exportsResolve("./dist/index.js", ".")).toBe(true)
    expect(exportsResolve("./dist/index.js", "./env")).toBe(false)
  })
})

describe("the defect this exists for", () => {
  /**
   * The real shape, reduced: the tree imports a subpath the pinned tarball does
   * not carry. Everything in the monorepo resolves it; nothing a client has
   * does.
   */
  test("a subpath added without a version bump is caught", () => {
    const imports = new Map([
      ["@be-in-digital/convex-functions", new Set([".", "./orders", "./sesSending"])],
    ])
    const published = {
      "@be-in-digital/convex-functions": {
        version: "3.0.0",
        exports: { ".": "./dist/index.js", "./orders": "./dist/orders.js" },
      },
    }

    expect(unresolvableImports(imports, published)).toEqual([
      {
        pkg: "@be-in-digital/convex-functions",
        subpath: "./sesSending",
        version: "3.0.0",
        reason: "not exported by the published version",
      },
    ])
  })

  test("a tree the pinned versions do resolve raises nothing", () => {
    const imports = new Map([["@be-in-digital/core", new Set([".", "./sentry"])]])
    const published = {
      "@be-in-digital/core": {
        version: "2.4.0",
        exports: { ".": "./dist/index.js", "./sentry": "./dist/sentry/index.js" },
      },
    }

    expect(unresolvableImports(imports, published)).toEqual([])
  })

  /**
   * Not knowing is not the same as being fine. A package absent from the
   * registry answer must stop the publish, not be skipped — being skipped is
   * how this class of defect stayed invisible in the first place.
   */
  test("a package that is not published at all is reported, not skipped", () => {
    const imports = new Map([["@be-in-digital/brand-new", new Set(["."])]])

    expect(unresolvableImports(imports, {})).toEqual([
      {
        pkg: "@be-in-digital/brand-new",
        subpath: "*",
        version: null,
        reason: "not published",
      },
    ])
  })

  /**
   * The message is the whole value of the check: it is read by whoever finds
   * the mirror job red, and it has to say what to do without them opening the
   * script. In particular it must NOT suggest deleting the import — the import
   * is correct and the dependency range is what is behind.
   */
  test("the failure says what to do about it", () => {
    const message = describeUnresolvable([
      {
        pkg: "@be-in-digital/admin",
        subpath: "./game",
        version: "8.0.0",
        reason: "not exported by the published version",
      },
    ])

    expect(message).toContain("@be-in-digital/admin@8.0.0 does not export ./game")
    expect(message).toContain("ERR_PACKAGE_PATH_NOT_EXPORTED")
    expect(message).toContain("changeset")
    expect(message).toContain("Do not work")
  })
})

/**
 * The guard is only worth having if the publisher actually runs it. It is one
 * `if` in a script nobody reads twice, and the whole check is inert without it.
 */
describe("the publisher runs the guard", () => {
  const publisher = fs.readFileSync(
    path.join(__dirname, "../../../scripts/publish-mirror.mjs"),
    "utf8",
  )

  test("it imports the check", () => {
    expect(publisher).toContain("engine-exports.mjs")
    expect(publisher).toContain("unresolvableImports")
  })

  test("it fails the run rather than warning", () => {
    expect(publisher).toContain("if (unresolvable.length > 0) fail(describeUnresolvable(unresolvable))")
  })

  /**
   * Before `materializeMirror`, so a tree that cannot work is never even
   * written into the clone — and long before the push.
   */
  test("it checks before it copies", () => {
    expect(publisher.indexOf("unresolvableImports(")).toBeLessThan(
      publisher.indexOf("materializeMirror(SOURCE"),
    )
  })
})
