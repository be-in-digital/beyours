import { describe, expect, test } from "vitest"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  describeUnresolvable,
  engineImportsIn,
  EXPORTS_UNKNOWN,
  exportsOfTarball,
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
 * The changeset behind `@be-in-digital/admin@9.0.0` ("Ship the gamification
 * player flow in the client template", now in `packages/admin/CHANGELOG.md`)
 * already described this window and noted it "does not close on its own if the
 * release never publishes". These are the assertions that make it close.
 *
 * Bench-only: it reads the monorepo's own scripts and would be meaningless on
 * a client site.
 */

const REPO_ROOT = path.join(__dirname, "../../..")

function tree(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "engine-imports-"))
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), body)
  }
  return root
}

/**
 * A REAL tarball, built by the same `npm pack` the publisher runs — not an
 * injected map. That distinction is the whole lesson of #380: the 67 tests
 * this file used to hold were all green while the gate flagged nothing in
 * production, because every one of them handed `unresolvableImports` a
 * fictional `published` object and none walked the path the publisher walks —
 * registry → tarball → manifest → resolution. GitHub Packages omits `exports`
 * from the packument `npm view` reads, so the tarball is the only artefact
 * that tells the truth, and these fixtures are genuine ones: whatever npm
 * writes into an archive (pax headers included), `exportsOfTarball` is proven
 * here to read back.
 */
function packFixture(manifest: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tarball-fixture-"))
  const source = path.join(dir, "source")
  fs.mkdirSync(source)
  fs.writeFileSync(
    path.join(source, "package.json"),
    JSON.stringify({ version: "0.0.0-fixture", ...manifest }, null, 2),
  )
  fs.writeFileSync(path.join(source, "index.js"), "")
  execFileSync("npm", ["pack", source, "--pack-destination", dir], {
    cwd: dir,
    stdio: ["ignore", "pipe", "pipe"],
  })
  const tarball = fs.readdirSync(dir).find((name) => name.endsWith(".tgz"))
  if (!tarball) throw new Error("npm pack wrote no tarball")
  return path.join(dir, tarball)
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

  /**
   * Node also accepts `{ "import": …, "require": … }` — all conditions, no
   * subpaths — as sugar for `{ ".": … }`. Reading it as a subpath map would
   * flag "." as unresolvable and block a sync over a package that is fine:
   * the opposite wrong answer to #380's, and just as much a gate defect now
   * that real registry maps flow through here.
   */
  test("a conditions-only map is the root and only the root", () => {
    const sugar = { import: "./dist/index.mjs", require: "./dist/index.cjs" }
    expect(exportsResolve(sugar, ".")).toBe(true)
    expect(exportsResolve(sugar, "./env")).toBe(false)
    // `{}` is the one object that exports nothing at all, "." included.
    expect(exportsResolve({}, ".")).toBe(false)
  })

  /**
   * The third state, and the one #380 is about: the lookup FAILED. It used to
   * be folded into "no exports field" above, so a registry that withheld the
   * map — GitHub Packages withholds it from every `npm view` — turned the
   * whole gate into a yes-machine. A failed lookup resolves nothing.
   */
  test("an unknown map — the lookup failed — resolves nothing", () => {
    expect(exportsResolve(EXPORTS_UNKNOWN, ".")).toBe(false)
    expect(exportsResolve(EXPORTS_UNKNOWN, "./anything")).toBe(false)
  })
})

describe("reading the published exports from the tarball", () => {
  test("a strict map is read back exactly as the manifest declares it", () => {
    const tarball = packFixture({
      name: "@be-in-digital/fixture-strict",
      exports: { ".": "./index.js", "./game": "./game.js", "./aws/*": "./aws/*.js" },
    })
    expect(exportsOfTarball(tarball)).toEqual({
      ".": "./index.js",
      "./game": "./game.js",
      "./aws/*": "./aws/*.js",
    })
  })

  /**
   * The state `npm view`'s silence was mistaken for, produced for real: a
   * manifest that genuinely declares no `exports`. It must come back as
   * `undefined` — the legacy shape the resolver allows — and stay
   * distinguishable from a lookup that failed.
   */
  test("a manifest with no exports field reads as undefined, the legacy shape", () => {
    const tarball = packFixture({ name: "@be-in-digital/fixture-legacy" })
    expect(exportsOfTarball(tarball)).toBeUndefined()
    expect(exportsResolve(exportsOfTarball(tarball), "./anything")).toBe(true)
  })

  test("garbage throws rather than answering", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tarball-garbage-"))
    const notGzip = path.join(dir, "not-a-tarball.tgz")
    fs.writeFileSync(notGzip, "this is not a gzip stream")
    expect(() => exportsOfTarball(notGzip)).toThrow()
    expect(() => exportsOfTarball(path.join(dir, "absent.tgz"))).toThrow()
  })
})

describe("a lookup that failed stops the sync", () => {
  /**
   * One problem per package, not one per subpath: the failure is the lookup,
   * and every subpath of it is equally unverified. And the message must not
   * prescribe a release — nothing says the version is behind, only that
   * nobody knows — but it must still refuse to ship, because "no answer" read
   * as "anything resolves" is exactly how the gate was a no-op (#380).
   */
  test("a package whose tarball could not be read is flagged, once", () => {
    const imports = new Map([["@be-in-digital/core", new Set([".", "./sentry", "./env"])]])
    const published = {
      "@be-in-digital/core": { version: "2.4.0", exports: EXPORTS_UNKNOWN },
    }

    const problems = unresolvableImports(imports, published)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatchObject({ pkg: "@be-in-digital/core", version: "2.4.0" })

    const message = describeUnresolvable(problems)
    expect(message).toContain("@be-in-digital/core@2.4.0")
    expect(message).toContain("could not be read")
    expect(message).toContain("NODE_AUTH_TOKEN")
    expect(message).not.toContain("releasing the engine")
  })

  test("a mixed report keeps both remedies apart", () => {
    const imports = new Map([
      ["@be-in-digital/admin", new Set(["./game"])],
      ["@be-in-digital/core", new Set(["."])],
    ])
    const published = {
      "@be-in-digital/admin": { version: "8.0.0", exports: { ".": "./dist/index.js" } },
      "@be-in-digital/core": { version: "2.4.0", exports: EXPORTS_UNKNOWN },
    }

    const message = describeUnresolvable(unresolvableImports(imports, published))
    expect(message).toContain("@be-in-digital/admin@8.0.0 does not export ./game")
    expect(message).toContain("releasing the engine")
    expect(message).toContain("could not be read")
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
 * #380, replayed end to end through the path the publisher actually walks —
 * a real tree's imports, resolved against a manifest read out of a real
 * tarball — with no injected `published` object anywhere.
 */
describe("the real resolution path, against a fixture tarball", () => {
  test("a subpath the tarball lacks is caught, from source file to report", () => {
    const root = tree({
      "app/game.tsx": `import { GamePlayerFlow } from "@be-in-digital/fixture/game"`,
      "app/page.tsx": `import { Button } from "@be-in-digital/fixture"`,
    })
    const tarball = packFixture({
      name: "@be-in-digital/fixture",
      exports: { ".": "./index.js" },
    })

    const published = {
      "@be-in-digital/fixture": { version: "1.0.0", exports: exportsOfTarball(tarball) },
    }
    expect(unresolvableImports(engineImportsIn(root), published)).toEqual([
      {
        pkg: "@be-in-digital/fixture",
        subpath: "./game",
        version: "1.0.0",
        reason: "not exported by the published version",
      },
    ])
  })

  /**
   * The 2026-09 incident itself, kept reproducible: the REAL imports of the
   * shipped template, against a tarball whose manifest carries the `exports`
   * map the registry actually served for `@be-in-digital/admin@8.0.0` — seven
   * keys, no `./game` — measured in #380 by `npm pack`. `GameContent.tsx`
   * imports `@be-in-digital/admin/game`, so the gate must go red on this
   * state; through `npm view` it flagged nothing, and every clone of the
   * boilerplate died at `next build`. The release deletes this state from the
   * registry; this fixture keeps it answerable here.
   */
  test("the template's real imports go red against the published admin@8.0.0 map", () => {
    const imports = engineImportsIn(path.join(REPO_ROOT, "apps/themes"))
    const adminImports = imports.get("@be-in-digital/admin")
    expect(adminImports, "apps/themes no longer imports @be-in-digital/admin — update this replay").toBeDefined()

    const publishedAdmin = packFixture({
      name: "@be-in-digital/admin",
      exports: {
        ".": "./dist/index.js",
        "./components": "./dist/components/index.js",
        "./hooks": "./dist/hooks/index.js",
        "./lib": "./dist/lib/index.js",
        "./pages": "./dist/pages/index.js",
        "./stores": "./dist/stores/index.js",
        "./stores/api": "./dist/stores/api.js",
      },
    })
    const problems = unresolvableImports(
      new Map([["@be-in-digital/admin", adminImports as Set<string>]]),
      { "@be-in-digital/admin": { version: "8.0.0", exports: exportsOfTarball(publishedAdmin) } },
    )

    expect(problems).toContainEqual({
      pkg: "@be-in-digital/admin",
      subpath: "./game",
      version: "8.0.0",
      reason: "not exported by the published version",
    })
  })

  /**
   * And the other half of "red today, green after the release": the same real
   * imports, against tarballs carrying the `exports` maps of the WORKSPACE
   * manifests — which is exactly what `changeset publish` ships. If this
   * fails, the next release will not fix the template: some shipped module
   * imports a subpath that does not exist even at HEAD, and no version bump
   * closes that.
   */
  test("the template's real imports resolve against what the release will publish", () => {
    const imports = engineImportsIn(path.join(REPO_ROOT, "apps/themes"))
    const published: Record<string, { version: string; exports: unknown }> = {}
    for (const pkg of imports.keys()) {
      const manifest = JSON.parse(
        fs.readFileSync(
          path.join(REPO_ROOT, "packages", pkg.slice("@be-in-digital/".length), "package.json"),
          "utf8",
        ),
      ) as { version: string; exports?: unknown }
      const tarball = packFixture({ name: pkg, exports: manifest.exports })
      published[pkg] = { version: manifest.version, exports: exportsOfTarball(tarball) }
    }

    expect(describeUnresolvable(unresolvableImports(imports, published))).toBe(
      describeUnresolvable([]),
    )
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
   * Where the exports come FROM is the fix of #380 and these hold it: the
   * tarball (`npm pack`), read by `exportsOfTarball` — never `npm view`,
   * whose packument GitHub Packages serves without the field, silently, for
   * every engine package. The one `npm view` left asks for the version, which
   * that packument does carry.
   */
  test("it reads the published exports from the tarball, not from npm view", () => {
    expect(publisher).toContain("exportsOfTarball")
    expect(publisher).toMatch(/"pack"/)
    expect(publisher).not.toMatch(/"view"[^\]]*"exports"/)
  })

  test("a failed lookup flows as EXPORTS_UNKNOWN, never as undefined", () => {
    expect(publisher).toContain("EXPORTS_UNKNOWN")
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
