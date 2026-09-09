import { describe, expect, test } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  formatOwedBump,
  formatOwedBumpSummary,
  owedBump,
} from "../../../scripts/lib/pending-release.mjs"
import { publishablePackages, REGISTRY, unpublishedPackages } from "../../../scripts/lib/registry.mjs"

/** What the lib returns. It is `.mjs`, so nothing here is inferred for us. */
interface Pkg {
  name: string
  version: string
  dir: string
}
type Resolved = Pkg & { published: string | null }

/**
 * Whether a push to `main` will publish anything.
 *
 * `release.yml` gates `changeset publish` on the E2E suite (#308) but only when
 * there is a publish to gate: of the 293 commits on `main` between 01/07/2026
 * and 07/09/2026, 12 moved a `packages/*` version, so gating unconditionally
 * would bill eight sharded runners on 96% of pushes for a run that ends in
 * "No unpublished projects to publish".
 *
 * The comparison the gate keys off is `changeset publish`'s own — each
 * package's version against the registry — so it has to answer exactly what
 * that command would do, including when it cannot reach the registry at all.
 */

const REPO_ROOT = path.join(__dirname, "../../..")

describe("publishablePackages", () => {
  test("finds every package changesets would consider", () => {
    const found = publishablePackages()
    const dirs = fs
      .readdirSync(path.join(REPO_ROOT, "packages"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())

    expect(found.length).toBe(dirs.length)
    expect(found.map((pkg: Pkg) => pkg.name)).toContain("@be-in-digital/core")
  })

  test("reports each package's directory relative to the repository", () => {
    // `check-source-drift.mjs` hands this straight to `git log`, which resolves
    // it against the repository root. An absolute path would work there and
    // then silently stop matching if the checkout moved.
    for (const pkg of publishablePackages() as Pkg[]) {
      expect(pkg.dir.startsWith("packages/")).toBe(true)
      expect(fs.existsSync(path.join(REPO_ROOT, pkg.dir, "package.json"))).toBe(true)
    }
  })

  test("skips a private package, as changesets does", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pkgs-"))
    const write = (name: string, manifest: unknown) => {
      fs.mkdirSync(path.join(root, "packages", name), { recursive: true })
      fs.writeFileSync(path.join(root, "packages", name, "package.json"), JSON.stringify(manifest))
    }
    write("public-one", { name: "@x/public-one", version: "1.0.0" })
    write("private-one", { name: "@x/private-one", version: "1.0.0", private: true })
    // A directory under `packages/` that is not a package at all.
    fs.mkdirSync(path.join(root, "packages", "scratch"), { recursive: true })

    expect(publishablePackages(root).map((pkg: Pkg) => pkg.name)).toEqual(["@x/public-one"])
  })
})

describe("unpublishedPackages", () => {
  const workspace = [
    { name: "@x/moved", version: "2.0.0", dir: "packages/moved" },
    { name: "@x/still", version: "1.0.0", dir: "packages/still" },
  ]

  test("is exactly `changeset publish`'s rule: version not on the registry", () => {
    const registry: Record<string, string> = { "@x/moved": "1.9.0", "@x/still": "1.0.0" }
    const pending = unpublishedPackages(workspace, (name) => registry[name] ?? null)

    expect(pending.map((pkg: Resolved) => pkg.name)).toEqual(["@x/moved"])
    expect(pending[0].published).toBe("1.9.0")
  })

  test("a package the registry has never heard of will publish", () => {
    const everything = unpublishedPackages(workspace, () => null)

    expect(everything.map((pkg: Resolved) => pkg.name)).toEqual(["@x/moved", "@x/still"])
  })

  test("a registry it cannot reach gates rather than waves through", () => {
    // A failed lookup answers null, which equals no version, which reports the
    // package as one that would publish. The gate then runs the suite on a
    // push that may publish nothing — the harmless direction. The other
    // direction publishes over a red suite, which is #308 itself.
    const pending = unpublishedPackages(workspace, () => null)

    expect(pending.length).toBe(workspace.length)
    expect(pending.every((pkg: Resolved) => pkg.published === null)).toBe(true)
  })

  test("nothing pending is an empty list, which is the 96% case", () => {
    const registry: Record<string, string> = { "@x/moved": "2.0.0", "@x/still": "1.0.0" }

    expect(unpublishedPackages(workspace, (name) => registry[name] ?? null)).toEqual([])
  })
})

describe("where it looks", () => {
  test("GitHub Packages, the registry a client installs from", () => {
    expect(REGISTRY).toBe("https://npm.pkg.github.com")
  })
})

/**
 * The second question the plan answers, added after the chain deadlocked on it.
 *
 * `changeset publish` prints the same ten lines of `already published` whether
 * no fix was waiting or `changeset version` was never run, and exits 0 either
 * way. Measured on the eight commits after `3a6cb8d`: Release green on seven,
 * publishing on none, `beyours-boilerplate` eight commits behind throughout
 * because nothing published means nothing tagged and the mirror's
 * `workflow_run` path requires a tag at HEAD.
 */
describe("owedBump", () => {
  const changeset = (file: string, ...names: string[]) => ({
    file,
    releases: names.map((name) => ({ name, bump: "patch" })),
  })

  test("a push that publishes owes nothing — the bump has been made", () => {
    expect(
      owedBump({ willPublish: true, changesets: [changeset("a.md", "@x/core")] }),
    ).toBeNull()
  })

  test("a push with an empty `.changeset/` owes nothing — the ordinary push", () => {
    // 281 of the 293 commits measured in `publish-plan.mjs`'s header. Staying
    // quiet here is the whole reason the warning below is worth reading.
    expect(owedBump({ willPublish: false, changesets: [] })).toBeNull()
  })

  test("changesets waiting and nothing to publish is the deadlock", () => {
    const verdict = owedBump({
      willPublish: false,
      changesets: [changeset("a.md", "@x/core", "@x/ui"), changeset("b.md", "@x/core")],
    })

    expect(verdict).not.toBeNull()
    expect(verdict!.files).toBe(2)
    // Deduplicated across changesets and sorted, so the list reads as packages
    // rather than as rows.
    expect(verdict!.packages).toEqual(["@x/core", "@x/ui"])
    expect(verdict!.unparseable).toBe(0)
  })

  test("an unparseable changeset still counts as waiting", () => {
    // It names no package this can read, but it is a file `changeset version`
    // will act on — reporting "nothing waiting" because it did not parse is
    // the false negative this check exists to prevent.
    const verdict = owedBump({
      willPublish: false,
      changesets: [{ file: "broken.md", releases: null }],
    })

    expect(verdict).not.toBeNull()
    expect(verdict!.files).toBe(1)
    expect(verdict!.packages).toEqual([])
    expect(verdict!.unparseable).toBe(1)
  })

  test("the message names the packages and the command that releases them", () => {
    const verdict = owedBump({
      willPublish: false,
      changesets: [changeset("a.md", "@be-in-digital/convex-functions")],
    })!

    const text = formatOwedBump(verdict)
    expect(text).toContain("@be-in-digital/convex-functions")
    expect(text).toContain("pnpm version-packages")
    // The mirror half is the part nobody connected: eight failing syncs whose
    // cause was an unreleased engine.
    expect(text).toContain("tagged")

    const summary = formatOwedBumpSummary(verdict)
    expect(summary).toContain("### A version bump is owed")
    expect(summary).toContain("@be-in-digital/convex-functions")
  })
})
