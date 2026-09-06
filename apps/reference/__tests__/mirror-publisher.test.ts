import { describe, expect, test } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  isExcluded,
  isMirrorOwned,
  isNotShipped,
  materializeMirror,
} from "../../../scripts/lib/mirror-tree.mjs"

/**
 * What crosses to `beyours-boilerplate`, and what the mirror keeps.
 *
 * `scripts/publish-mirror.mjs` rebuilds that repository in full on every sync,
 * deleting whatever the source no longer has. It is the highest-consequence
 * script in the repo — every client site has a `template` remote pointing at
 * the mirror and merges from it — and until this file it had no test at all,
 * because it used to shell out to `rsync` and nothing in a test can be pointed
 * at rsync's semantics.
 *
 * It now shares `lib/mirror-tree.mjs` with `check-mirror-css.mjs`, which is the
 * point: the tree CI compiles is the tree the publisher pushes. A checker that
 * materialises the mirror slightly differently is checking something no client
 * runs, and that is exactly how `apps/themes` came to ship a stylesheet missing
 * a third of its rules with CI green.
 *
 * This lives in the bench, not the template: it reads the monorepo root and
 * would be meaningless — and red — on a client site.
 */

const REPO_ROOT = path.join(__dirname, "../../..")

/** A miniature `apps/themes`: one of everything the rules have an opinion about. */
function sourceTree(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirror-src-"))
  const write = (rel: string, body = rel) => {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), body)
  }
  write("package.json", "{}")
  write("app/globals.css")
  write("vercel.json", "the turbo-ignore, monorepo-only")
  write("demos/vercel.json", "the demos deployment, a client needs it")
  write(".turbo/cache.log")
  write("templates/pizzeria/.turbo/cache.log")
  write("tsconfig.tsbuildinfo")
  write("scripts/init.mjs", "#!/usr/bin/env node\n")
  return root
}

/** A mirror clone as the publisher finds it: its own git, lockfile and install. */
function mirrorClone(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mirror-dst-"))
  const write = (rel: string, body = rel) => {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), body)
  }
  write(".git/HEAD", "ref: refs/heads/main\n")
  write("node_modules/react/index.js")
  write("pnpm-lock.yaml", "lockfileVersion: '9.0'\n")
  write("next-env.d.ts")
  write("app/deleted-last-release.tsx", "a file the source no longer has")
  write("app/globals.css", "stale")
  return root
}

describe("the exclusion rules", () => {
  test("the root vercel.json is monorepo-only", () => {
    expect(isNotShipped("vercel.json")).toBe(true)
  })

  test("a nested vercel.json is not, because it configures a real deployment", () => {
    // rsync matched a slash-less `--exclude` against the basename at any depth,
    // so `demos/vercel.json` — `cleanUrls`, and the `noindex` that keeps the 50
    // sales demos out of Google — was neither shipped nor, being excluded,
    // deletable. It was frozen on the mirror at whatever it was that day.
    expect(isNotShipped("demos/vercel.json")).toBe(false)
  })

  test("build output never ships, at any depth", () => {
    expect(isNotShipped(".turbo/cache.log")).toBe(true)
    expect(isNotShipped("templates/pizzeria/.turbo/cache.log")).toBe(true)
    expect(isNotShipped("tsconfig.tsbuildinfo")).toBe(true)
  })

  test("what the mirror owns is recognised as its own", () => {
    for (const owned of [".git/HEAD", "node_modules/react/index.js", "pnpm-lock.yaml", "next-env.d.ts"]) {
      expect(isMirrorOwned(owned), owned).toBe(true)
      expect(isExcluded(owned), owned).toBe(true)
    }
  })

  test("an ordinary file ships", () => {
    expect(isExcluded("app/globals.css")).toBe(false)
    expect(isExcluded("scripts/init.mjs")).toBe(false)
  })

  /**
   * The walk reads the FILESYSTEM and consults no gitignore, so being ignored
   * by git protects a file from a commit and not from a sync. Both `README.md`
   * and `publish-mirror.mjs` document running the publisher by hand, and that
   * path takes no CI gate at all — so one local run used to copy `.env.local`,
   * holding live Stripe, AWS and Deliveroo keys, into the repository every
   * client clones from and merges from.
   *
   * The root `.gitignore` already states the rule for `.infisical.json`: "or
   * the mirror would carry the agency's project id into every client repo".
   * These assertions are that sentence made true.
   */
  test.each([
    [".env", "a dotenv at the root"],
    [".env.local", "the file a developer actually fills in"],
    [".env.production", "worse: live keys"],
    [".env.convex", "the Convex store's values"],
    ["app/.env.local", "at any depth, not only the root"],
    [".infisical.json", "the agency's project id"],
    [".engine-link.json", "points pnpm at a path on one laptop"],
    ["coverage/lcov.info", "local test output"],
  ])("%s never reaches a client — %s", (rel) => {
    expect(isNotShipped(rel)).toBe(true)
    expect(isExcluded(rel)).toBe(true)
  })

  /**
   * The exemption, and the reason the rule is a prefix with a carve-out rather
   * than a `.env*` glob: these two are how a client learns which variables to
   * set. Excluding them would also FREEZE them on the mirror — an excluded path
   * is protected from the prune, so the copy already there could never be
   * corrected either.
   */
  test.each([".env.example", ".env.convex.example"])("%s still ships", (rel) => {
    expect(isNotShipped(rel)).toBe(false)
    expect(isExcluded(rel)).toBe(false)
  })
})

describe("materialising the mirror", () => {
  const source = sourceTree()
  const dest = mirrorClone()
  const { copied, deleted } = materializeMirror(source, dest)
  const at = (rel: string): string => path.join(dest, rel)

  test("it ships the app and the nested vercel.json", () => {
    expect(copied.sort()).toEqual([
      "app/globals.css",
      "demos/vercel.json",
      "package.json",
      "scripts/init.mjs",
    ])
    expect(fs.readFileSync(at("app/globals.css"), "utf8")).toBe("app/globals.css")
  })

  test("it ships neither the root vercel.json nor build output", () => {
    expect(fs.existsSync(at("vercel.json"))).toBe(false)
    expect(fs.existsSync(at(".turbo"))).toBe(false)
    expect(fs.existsSync(at("templates/pizzeria/.turbo"))).toBe(false)
    expect(fs.existsSync(at("tsconfig.tsbuildinfo"))).toBe(false)
  })

  test("it removes what the source no longer has", () => {
    expect(deleted).toContain("app/deleted-last-release.tsx")
    expect(fs.existsSync(at("app/deleted-last-release.tsx"))).toBe(false)
  })

  test("it leaves the mirror's own files alone", () => {
    // The one that would be unrecoverable. Every client site merges from this
    // repository's history.
    expect(fs.readFileSync(at(".git/HEAD"), "utf8")).toBe("ref: refs/heads/main\n")
    expect(fs.existsSync(at("node_modules/react/index.js"))).toBe(true)
    expect(fs.existsSync(at("pnpm-lock.yaml"))).toBe(true)
    expect(fs.existsSync(at("next-env.d.ts"))).toBe(true)
    expect(deleted).not.toContain(".git/HEAD")
  })

  test("it preserves the executable bit", () => {
    fs.chmodSync(path.join(source, "scripts/init.mjs"), 0o755)
    const second = fs.mkdtempSync(path.join(os.tmpdir(), "mirror-dst-"))
    materializeMirror(source, second)
    expect(fs.statSync(path.join(second, "scripts/init.mjs")).mode & 0o111).not.toBe(0)
  })

  test("it replaces a path that changed kind since the last sync", () => {
    // A file that became a directory, or the reverse. rsync coped; a bare
    // mkdir/copyFile would abort mid-publish, after the mirror was cloned and
    // before it was pushed.
    const from = sourceTree()
    fs.mkdirSync(path.join(from, "app/globals.css.d"))
    fs.rmSync(path.join(from, "app/globals.css"))
    fs.writeFileSync(path.join(from, "app/globals.css.d/inner.css"), "now a directory")

    const to = mirrorClone()
    fs.writeFileSync(path.join(to, "app/globals.css.d"), "used to be a file")

    materializeMirror(from, to)
    expect(fs.readFileSync(path.join(to, "app/globals.css.d/inner.css"), "utf8")).toBe("now a directory")
  })

  test("a second run over its own output changes nothing", () => {
    const again = materializeMirror(source, dest)
    expect(again.deleted).toEqual([])
  })
})

describe("the publisher and the checker cannot drift apart", () => {
  const read = (rel: string): string => fs.readFileSync(path.join(REPO_ROOT, rel), "utf8")

  test.each([
    "scripts/publish-mirror.mjs",
    "scripts/check-mirror-css.mjs",
    // The third consumer: it compiles the published tree against packed
    // tarballs. Materialising a tree of its own would mean it proved something
    // about a tree no client receives — the same defect, one level up.
    "scripts/check-mirror-build.mjs",
  ])(
    "%s materialises the tree with the shared module",
    (script) => {
      expect(read(script)).toContain('from "./lib/mirror-tree.mjs"')
    },
  )

  test("nothing shells out to rsync any more", () => {
    // It was absent from the container this repo is usually edited in, which
    // made the publish path impossible to exercise before pushing it.
    expect(read("scripts/publish-mirror.mjs")).not.toContain("rsync")
  })
})
