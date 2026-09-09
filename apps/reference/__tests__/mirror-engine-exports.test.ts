import { describe, expect, test } from "vitest"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  describeUnresolvable,
  engineImportsIn,
  EXPORTS_UNKNOWN,
  exportsResolve,
  tarballContents,
  unresolvableImports,
  unshippedTargets,
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

/** Every literal file a manifest's `exports` names; wildcards name no one file. */
function declaredTargets(entry: unknown, out: string[] = []): string[] {
  if (typeof entry === "string") {
    if (entry.startsWith("./") && !entry.includes("*")) out.push(entry)
  } else if (Array.isArray(entry)) {
    for (const alternative of entry) declaredTargets(alternative, out)
  } else if (entry !== null && typeof entry === "object") {
    for (const value of Object.values(entry)) declaredTargets(value, out)
  }
  return out
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
 * writes into an archive (pax headers included), `tarballContents` is proven
 * here to read back.
 *
 * By default the fixture SHIPS WHAT IT DECLARES: every literal target in its
 * `exports` is written into the archive, so a fixture is a correctly-built
 * package unless a test says otherwise. `omit` takes files back out — that is
 * a build that forgot an entry point, or a `files` field that excludes it —
 * and `ship` adds ones no literal target names, wildcard targets above all.
 * Paths are written the way `exports` targets are, `./dist/stores.js`.
 */
function packFixture(
  manifest: Record<string, unknown>,
  { ship = [], omit = [] }: { ship?: string[]; omit?: string[] } = {},
): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tarball-fixture-"))
  const source = path.join(dir, "source")
  fs.mkdirSync(source)
  fs.writeFileSync(
    path.join(source, "package.json"),
    JSON.stringify({ version: "0.0.0-fixture", ...manifest }, null, 2),
  )

  const shipped = new Set(["./index.js", ...declaredTargets(manifest.exports), ...ship])
  for (const rel of omit) shipped.delete(rel)
  for (const rel of shipped) {
    const full = path.join(source, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, "")
  }

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
    expect(tarballContents(tarball).exports).toEqual({
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
    expect(tarballContents(tarball).exports).toBeUndefined()
    expect(exportsResolve(tarballContents(tarball).exports, "./anything")).toBe(true)
  })

  test("garbage throws rather than answering", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tarball-garbage-"))
    const notGzip = path.join(dir, "not-a-tarball.tgz")
    fs.writeFileSync(notGzip, "this is not a gzip stream")
    expect(() => tarballContents(notGzip)).toThrow()
    expect(() => tarballContents(path.join(dir, "absent.tgz"))).toThrow()
  })
})

describe("reading what the tarball ships", () => {
  test("the file list is the archive's own, package-relative, files only", () => {
    const tarball = packFixture({
      name: "@be-in-digital/fixture-files",
      exports: { ".": "./dist/index.js" },
    })

    const { files } = tarballContents(tarball)
    // Written the way an `exports` target is, so a target is a plain lookup.
    expect(files.has("./dist/index.js")).toBe(true)
    expect(files.has("./package.json")).toBe(true)
    // Directory entries are dropped: no export target may resolve to one.
    expect(files.has("./dist/")).toBe(false)
    expect(files.has("./dist")).toBe(false)
  })

  /**
   * node-tar writes a pax extended header for any path the 100-byte ustar name
   * field cannot hold, and the header that follows it carries a TRUNCATED
   * name. Read short, that entry stops matching the target that declares it,
   * and a correctly-built package goes red — the one failure this gate cannot
   * afford, since a wrong red stops every client's delivery. `npm pack` writes
   * a real pax header here: the single path component is 123 bytes, which no
   * prefix split can rescue.
   */
  test("a path too long for the ustar header is read back whole", () => {
    const long = `./dist/${"a".repeat(120)}.js`
    const tarball = packFixture({
      name: "@be-in-digital/fixture-long",
      exports: { "./long": long },
    })

    const { exports, files } = tarballContents(tarball)
    expect(files.has(long)).toBe(true)
    expect(unshippedTargets(exports, "./long", files)).toEqual([])
  })
})

/**
 * The other half of the gate. `exportsResolve` answers "is the subpath in the
 * map"; a package can carry it and point at a file the tarball never shipped,
 * because the build did not emit that entry point or `files` excluded its
 * directory. Resolution succeeds, the gate stays green, and the client's
 * `next build` dies one step further along on ERR_MODULE_NOT_FOUND — the same
 * broken delivery the map half exists to stop.
 *
 * Recorded twice: `@be-in-digital/restaurant` c1af162 ("The build only bundled
 * `src/index.ts`, so those three `exports` entries pointed at files that never
 * existed — in the workspace and in the published tarball alike") and
 * `@be-in-digital/core`, whose `./auth/rbac` pointed at `src/auth/rbac.ts`
 * while the tarball shipped only `dist/`.
 */
describe("a subpath declared but not shipped", () => {
  test("the missing file is named, and told apart from a missing release", () => {
    const root = tree({
      "app/page.tsx": `import { useStore } from "@be-in-digital/fixture/stores"`,
    })
    const tarball = packFixture(
      {
        name: "@be-in-digital/fixture",
        exports: { ".": "./dist/index.js", "./stores": "./dist/stores.js" },
      },
      { omit: ["./dist/stores.js"] },
    )

    const published = {
      "@be-in-digital/fixture": { version: "6.0.0", ...tarballContents(tarball) },
    }
    const problems = unresolvableImports(engineImportsIn(root), published)

    expect(problems).toEqual([
      {
        pkg: "@be-in-digital/fixture",
        subpath: "./stores",
        version: "6.0.0",
        reason: "declared but not shipped",
        targets: ["./dist/stores.js"],
      },
    ])

    const message = describeUnresolvable(problems)
    expect(message).toContain("./dist/stores.js")
    // The remedy is a build, not a release: publishing again ships the same
    // hole, so the message must not send anyone to write a changeset.
    expect(message).toContain("ERR_MODULE_NOT_FOUND")
    expect(message).toContain("`files`")
    expect(message).not.toContain("ERR_PACKAGE_PATH_NOT_EXPORTED")
    expect(message).not.toContain("releasing the engine")
  })

  /**
   * The recorded occurrence, reduced. `restaurant` declared `./stores`,
   * `./services` and `./hooks` — three conditional entries, nine targets —
   * while the build bundled only `src/index.ts`. The root entry is built, so
   * the gate must report the three holes and leave the package's working half
   * alone.
   */
  test("the restaurant c1af162 shape: three entries, not one leaf between them", () => {
    const conditions = (name: string) => ({
      types: `./dist/${name}/index.d.ts`,
      import: `./dist/${name}/index.mjs`,
      require: `./dist/${name}/index.js`,
    })
    const unbuilt = ["stores", "services", "hooks"]
    const tarball = packFixture(
      {
        name: "@be-in-digital/restaurant",
        exports: {
          ".": {
            types: "./dist/index.d.ts",
            import: "./dist/index.mjs",
            require: "./dist/index.js",
          },
          "./stores": conditions("stores"),
          "./services": conditions("services"),
          "./hooks": conditions("hooks"),
        },
      },
      { omit: unbuilt.flatMap((name) => Object.values(conditions(name))) },
    )

    const problems = unresolvableImports(
      new Map([
        ["@be-in-digital/restaurant", new Set([".", "./stores", "./services", "./hooks"])],
      ]),
      { "@be-in-digital/restaurant": { version: "6.0.0", ...tarballContents(tarball) } },
    )

    expect(problems.map((p) => p.subpath).sort()).toEqual(["./hooks", "./services", "./stores"])
    expect(problems.every((p) => p.reason === "declared but not shipped")).toBe(true)
    // Every condition of an unbuilt entry is named, so whoever reads the
    // failure knows the entry point is missing rather than one file of it.
    expect(problems.map((p) => p.targets?.length)).toEqual([3, 3, 3])
  })

  /**
   * The documented limit, held deliberately. Both recorded occurrences shipped
   * NO leaf for the subpath they declared, which is proof no consumer can
   * resolve it whatever condition its bundler activates. A half-built entry —
   * the runtime file shipped, the `.d.ts` not — is left alone: which condition
   * a client's toolchain selects is not something this module can know, and it
   * would be deciding that on a guess. A wrong red here stops the sync to the
   * repository every client clones. Tighten it the day a partial build
   * actually reaches a client.
   */
  test("an entry with one leaf shipped is left alone; with none, both are named", () => {
    const manifest = {
      name: "@be-in-digital/fixture",
      exports: { "./x": { types: "./dist/x.d.ts", import: "./dist/x.mjs" } },
    }

    const half = tarballContents(packFixture(manifest, { omit: ["./dist/x.d.ts"] }))
    expect(unshippedTargets(half.exports, "./x", half.files)).toEqual([])

    const none = tarballContents(
      packFixture(manifest, { omit: ["./dist/x.d.ts", "./dist/x.mjs"] }),
    )
    expect(unshippedTargets(none.exports, "./x", none.files)).toEqual([
      "./dist/x.d.ts",
      "./dist/x.mjs",
    ])
  })

  /**
   * A wildcard target names no one file, so it is expanded against the import
   * that matched it — every `*` substituted, exactly as Node substitutes them.
   * Checking it as a literal would ask the tarball for a path called `*` and
   * go red on every package that uses the form.
   */
  test("a wildcard target is expanded against the import that matched it", () => {
    const tarball = packFixture(
      { name: "@be-in-digital/fixture", exports: { "./aws/*": "./src/aws/*.ts" } },
      { ship: ["./src/aws/folders.ts"] },
    )

    const { exports, files } = tarballContents(tarball)
    expect(unshippedTargets(exports, "./aws/folders", files)).toEqual([])
    expect(unshippedTargets(exports, "./aws/media-url", files)).toEqual([
      "./src/aws/media-url.ts",
    ])
  })

  /**
   * When two patterns match, Node resolves the more specific one, so that is
   * the target to look for. Checking `./aws/*` here would ask for
   * `./src/aws/ses/order.ts`, which nothing ships and nothing loads: a red on
   * a package that is fine.
   */
  test("the pattern Node would pick decides which file is looked for", () => {
    const map = { "./aws/*": "./src/aws/*.ts", "./aws/ses/*": "./src/ses/*.ts" }

    expect(unshippedTargets(map, "./aws/ses/order", new Set(["./src/ses/order.ts"]))).toEqual([])
    expect(unshippedTargets(map, "./aws/ses/order", new Set(["./src/aws/ses/order.ts"]))).toEqual([
      "./src/ses/order.ts",
    ])
  })

  /**
   * Silence here means "cannot prove it missing", never "it is fine" — the map
   * half has already run on all of these, and a lookup that failed outright is
   * flagged as EXPORTS_UNKNOWN before this is ever asked.
   */
  test("what cannot be checked is not flagged", () => {
    const map = { "./a": "./dist/a.js", "./blocked": null, "./external": "other-package/thing" }
    const files = new Set(["./dist/a.js"])

    // No file list at all — an injected fixture, or a read that never happened.
    expect(unshippedTargets(map, "./a", undefined)).toEqual([])
    // A blocked subpath, and a target inside another package, name no file here.
    expect(unshippedTargets(map, "./blocked", files)).toEqual([])
    expect(unshippedTargets(map, "./external", files)).toEqual([])
    // A legacy package resolves any path; an unread map is a different report.
    expect(unshippedTargets(undefined, "./anything", files)).toEqual([])
    expect(unshippedTargets(EXPORTS_UNKNOWN, "./anything", files)).toEqual([])
  })

  test("a subpath the map does not carry stays the other half's problem", () => {
    const map = { ".": "./dist/index.js" }

    expect(exportsResolve(map, "./game")).toBe(false)
    expect(unshippedTargets(map, "./game", new Set(["./dist/index.js"]))).toEqual([])
  })

  test("a mixed report keeps the build remedy apart from the release remedy", () => {
    const message = describeUnresolvable([
      {
        pkg: "@be-in-digital/admin",
        subpath: "./game",
        version: "8.0.0",
        reason: "not exported by the published version",
      },
      {
        pkg: "@be-in-digital/restaurant",
        subpath: "./stores",
        version: "6.0.0",
        reason: "declared but not shipped",
        targets: ["./dist/stores.js"],
      },
    ])

    expect(message).toContain("@be-in-digital/admin@8.0.0 does not export ./game")
    expect(message).toContain("releasing the engine")
    expect(message).toContain("@be-in-digital/restaurant@6.0.0 declares ./stores")
    expect(message).toContain("the BUILD is")
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
      "@be-in-digital/fixture": { version: "1.0.0", ...tarballContents(tarball) },
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
      { "@be-in-digital/admin": { version: "8.0.0", ...tarballContents(publishedAdmin) } },
    )

    expect(problems).toContainEqual({
      pkg: "@be-in-digital/admin",
      subpath: "./game",
      version: "8.0.0",
      reason: "not exported by the published version",
    })
  })

  /**
   * The `@be-in-digital/core` occurrence, replayed against its REAL exports
   * map: `./auth/rbac` pointed at `src/auth/rbac.ts` while the tarball shipped
   * only `dist/`, so the subpath resolved in the map and no file answered it
   * (`packages/core/CHANGELOG.md`). The map is read from the package rather
   * than transcribed, so the replay follows those subpaths if they ever move
   * into `dist/`; what it pins is that narrowing `files` back to `["dist"]`
   * goes red instead of shipping. `apps/themes` imports six such subpaths.
   *
   * Deliberately not built from `packages/core`'s own tarball: that would go
   * red whenever `dist/` is missing, which is an unbuilt checkout and not a
   * defect, and a gate that cries wolf locally is a gate people route around.
   */
  test("core's files-narrowed-to-dist regression, against its real exports map", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, "packages/core/package.json"), "utf8"),
    ) as { version: string; exports?: unknown }
    const intoSrc = declaredTargets(manifest.exports).filter((target) =>
      target.startsWith("./src/"),
    )
    expect(
      intoSrc,
      "core exports nothing out of src/ any more — update this replay",
    ).not.toHaveLength(0)

    const tarball = packFixture(
      { name: "@be-in-digital/core", exports: manifest.exports },
      { omit: intoSrc },
    )
    const imported = engineImportsIn(path.join(REPO_ROOT, "apps/themes")).get(
      "@be-in-digital/core",
    )
    expect(imported, "apps/themes no longer imports @be-in-digital/core").toBeDefined()

    const problems = unresolvableImports(
      new Map([["@be-in-digital/core", imported as Set<string>]]),
      { "@be-in-digital/core": { version: manifest.version, ...tarballContents(tarball) } },
    )

    expect(problems).toContainEqual({
      pkg: "@be-in-digital/core",
      subpath: "./auth/rbac",
      version: manifest.version,
      reason: "declared but not shipped",
      targets: ["./src/auth/rbac.ts"],
    })
    // The subpaths that `files` field DOES ship stay clean: the gate reports
    // the hole, not the package.
    expect(problems.map((problem) => problem.subpath)).not.toContain("./sentry")
  })

  /**
   * And the other half of "red today, green after the release": the same real
   * imports, against tarballs carrying the `exports` maps of the WORKSPACE
   * manifests — which is exactly what `changeset publish` ships. If this
   * fails, the next release will not fix the template: some shipped module
   * imports a subpath that does not exist even at HEAD, and no version bump
   * closes that.
   *
   * The fixtures ship what they declare, so this also proves the shipped-file
   * half runs clean over all nine real maps — nine packages, ninety-odd
   * subpaths, no false red. What it cannot prove is that each package's BUILD
   * emits those files; only a real tarball says that, and the mirror job packs
   * real tarballs.
   */
  test("the template's real imports resolve against what the release will publish", () => {
    const imports = engineImportsIn(path.join(REPO_ROOT, "apps/themes"))
    const published: Record<string, { version: string; exports: unknown; files: Set<string> }> =
      {}
    for (const pkg of imports.keys()) {
      const manifest = JSON.parse(
        fs.readFileSync(
          path.join(REPO_ROOT, "packages", pkg.slice("@be-in-digital/".length), "package.json"),
          "utf8",
        ),
      ) as { version: string; exports?: unknown }
      const tarball = packFixture({ name: pkg, exports: manifest.exports })
      published[pkg] = { version: manifest.version, ...tarballContents(tarball) }
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
    // Matched on shape rather than on one line of source: the call gained a
    // second argument (`covered`, which only sharpens the wording) and a line
    // break with it, and a test that pins the formatting refuses a change that
    // did not touch the behaviour.
    expect(publisher).toMatch(
      /if \(unresolvable\.length > 0\) \{?\s*fail\(describeUnresolvable\(unresolvable/,
    )
  })

  /**
   * The wording, which is the whole of what `covered` changes. Eight
   * consecutive syncs failed on `./contrast`, `./contrast-scan` and
   * `./paymentLedger` and told whoever read them to add a changeset, while
   * changesets for all three sat unconsumed in `.changeset/`. The advice was
   * for a step already done.
   */
  test("it tells the gate which changesets are already waiting", () => {
    expect(publisher).toContain("changesetPackages()")
    expect(publisher).toContain("covered:")
  })

  /**
   * Where the exports come FROM is the fix of #380 and these hold it: the
   * tarball (`npm pack`), read by `tarballContents` — never `npm view`,
   * whose packument GitHub Packages serves without the field, silently, for
   * every engine package. The one `npm view` left asks for the version, which
   * that packument does carry.
   */
  test("it reads the published exports from the tarball, not from npm view", () => {
    expect(publisher).toContain("tarballContents")
    expect(publisher).toMatch(/"pack"/)
    expect(publisher).not.toMatch(/"view"[^\]]*"exports"/)
  })

  test("a failed lookup flows as EXPORTS_UNKNOWN, never as undefined", () => {
    expect(publisher).toContain("EXPORTS_UNKNOWN")
  })

  /**
   * Both halves of the read, passed on together. Taking the map and dropping
   * the file list would answer "is the subpath exported" and lose "does its
   * file ship" — the gap the `declared but not shipped` report exists for, and
   * the same shape of silent skip as #380.
   */
  test("it carries the tarball's file list into the check, not just the map", () => {
    expect(publisher).toContain("published[pkg] = { version, ...publishedTarball(pkg, version) }")
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

/**
 * Which half of a release is missing.
 *
 * "Add a changeset for the package above" is right when none exists and wrong
 * when one does — and it was wrong for the eight consecutive syncs that
 * deadlocked the distribution chain, because the changesets were written and
 * `changeset version` had never been run. The gate could not tell the two
 * apart, so it repeated the wrong instruction once per failing run.
 */
describe("describeUnresolvable names the missing half", () => {
  const behind = [
    {
      pkg: "@be-in-digital/ui",
      subpath: "./contrast",
      version: "3.1.0",
      reason: "not exported by the published version",
    },
  ]

  test("with no changeset waiting, it asks for one", () => {
    const message = describeUnresolvable(behind)
    expect(message).toContain("add a changeset")
    expect(message).not.toContain("VERSION BUMP")
  })

  test("omitting `covered` altogether keeps the old message", () => {
    // The parameter is optional on purpose: every other caller and every
    // existing test passes one argument.
    expect(describeUnresolvable(behind)).toBe(describeUnresolvable(behind, { covered: new Set() }))
  })

  test("with the changeset already written, it asks for the version bump", () => {
    const message = describeUnresolvable(behind, {
      covered: new Set(["@be-in-digital/ui"]),
    })

    expect(message).toContain("VERSION BUMP")
    expect(message).toContain("pnpm version-packages")
    // The instruction that was wrong. It must not survive alongside the right
    // one, or the reader has to guess which applies.
    expect(message).not.toContain("add a changeset for the package above")
  })

  test("a mix says which half is done and which is not", () => {
    const message = describeUnresolvable(
      [
        ...behind,
        {
          pkg: "@be-in-digital/convex-functions",
          subpath: "./paymentLedger",
          version: "5.0.0",
          reason: "not exported by the published version",
        },
      ],
      { covered: new Set(["@be-in-digital/ui"]) },
    )

    expect(message).toContain("already waiting for @be-in-digital/ui")
    expect(message).toContain("For the rest, add a changeset")
  })

  test("it still says the import is not the thing to remove", () => {
    // The one line that has to survive every branch: the reflex fix is to
    // delete the import, and that ships a client a template missing the
    // feature rather than a template that builds.
    for (const covered of [new Set<string>(), new Set(["@be-in-digital/ui"])]) {
      expect(describeUnresolvable(behind, { covered })).toContain(
        "Do not work around it by removing the import",
      )
    }
  })
})
