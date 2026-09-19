import { describe, expect, it, test } from "vitest"

import {
  bumpedAhead,
  classifySubpathGap,
  describeDrift,
  describeSubpathGap,
  describeWaiting,
  formatSummary,
  formatTable,
  formatWaitingSummary,
  isReleasableSource,
  subpathGapMayMerge,
  summariseDrift,
} from "../../../scripts/lib/source-drift.mjs"

/** What `summariseDrift` returns. It is `.mjs`, so nothing here is inferred for us. */
interface Row {
  name: string
  version: string
  dir: string
  since: string | null
  changed: string[]
  state: "drifted" | "unknown" | "waiting" | "clean"
}

/**
 * Source that has moved since its last version bump with no changeset to move
 * it again.
 *
 * `changeset publish` answers `already published` and SKIPS a package whose
 * version has not changed, so that source is not published later — it is
 * published never. #209 records `integrations`, `marketing` and `ui` serving a
 * July build for two months while their source had moved on, with the whole
 * Uber Direct module (~950 lines) never reaching a client site.
 *
 * The arithmetic is pure so it can be tested without a git repository;
 * `scripts/check-source-drift.mjs` supplies the history and the changesets.
 */

const pkg = (name: string, changed: string[], since: string | null = "abc123") => ({
  name,
  dir: `packages/${name.split("/")[1]}`,
  version: "1.0.0",
  since,
  changed,
})

describe("isReleasableSource", () => {
  test("a file under src reaches a client", () => {
    expect(isReleasableSource("packages/core/src/aws/s3/client.ts")).toBe(true)
    expect(isReleasableSource("packages/ui/src/index.ts")).toBe(true)
  })

  test("a test does not", () => {
    // A published tarball is built from `src`; a test changes nothing a client
    // installs. Demanding a version bump for one would make this check noise,
    // and noise is how a check stops being read.
    expect(isReleasableSource("packages/core/src/__tests__/s3.test.ts")).toBe(false)
    expect(isReleasableSource("packages/core/src/aws/s3.test.ts")).toBe(false)
    expect(isReleasableSource("packages/core/src/aws/s3.spec.tsx")).toBe(false)
    expect(isReleasableSource("packages/core/src/__mocks__/aws.ts")).toBe(false)
  })

  test("everything outside src does not", () => {
    expect(isReleasableSource("packages/core/package.json")).toBe(false)
    expect(isReleasableSource("packages/core/README.md")).toBe(false)
    expect(isReleasableSource("packages/core/tsup.config.ts")).toBe(false)
  })
})

describe("summariseDrift", () => {
  test("a package with source changes and no changeset has drifted", () => {
    const { drifted } = summariseDrift([pkg("@be-yours/ui", ["packages/ui/src/button.tsx"])], new Set())

    expect(drifted.map((row: Row) => row.name)).toEqual(["@be-yours/ui"])
  })

  test("a changeset naming it stops it drifting, and does not make it released", () => {
    // The distinction this state exists for. `covered` sat here beside
    // `clean` and read as "shipped", while `publish-mirror --check` exited 1
    // on the same package: a changeset that still EXISTS is proof the release
    // has not been cut, because `changeset version` deletes the file when it
    // cuts one. So the registry is still serving the build made before these
    // files moved, under the version number the workspace already carries.
    const { drifted, waiting, rows } = summariseDrift(
      [pkg("@be-yours/ui", ["packages/ui/src/button.tsx"])],
      new Set(["@be-yours/ui"]),
    )

    expect(drifted).toEqual([])
    expect(rows[0].state).toBe("waiting")
    expect(waiting.map((row: Row) => row.name)).toEqual(["@be-yours/ui"])
  })

  test("a changeset naming a DIFFERENT package does not", () => {
    // The source that moved is this package's, so this package is the one
    // `changeset publish` will skip. A sibling's release carries nothing.
    const { drifted } = summariseDrift(
      [pkg("@be-yours/ui", ["packages/ui/src/button.tsx"])],
      new Set(["@be-yours/core"]),
    )

    expect(drifted.map((row: Row) => row.name)).toEqual(["@be-yours/ui"])
  })

  test("a package whose only change is a test is clean", () => {
    const { drifted, rows } = summariseDrift(
      [pkg("@be-yours/ui", ["packages/ui/src/__tests__/button.test.tsx"])],
      new Set(),
    )

    expect(drifted).toEqual([])
    expect(rows[0].state).toBe("clean")
    expect(rows[0].changed).toEqual([])
  })

  test("an unfindable bump is unknown, never drifted and never clean", () => {
    // `actions/checkout` clones at depth 1, where a bump older than the tip has
    // no commit to find. Guessing "drifted" fails every shallow run; guessing
    // "clean" answers "all well" precisely when the check knows nothing.
    const { drifted, unknown, rows } = summariseDrift([pkg("@be-yours/ui", [], null)], new Set())

    expect(drifted).toEqual([])
    expect(unknown.map((row: Row) => row.name)).toEqual(["@be-yours/ui"])
    expect(rows[0].state).toBe("unknown")
  })

  test("worst first, so a long list opens on what needs doing", () => {
    const { rows } = summariseDrift(
      [
        pkg("@be-yours/a", []),
        pkg("@be-yours/b", ["packages/b/src/x.ts"], null),
        pkg("@be-yours/c", ["packages/c/src/x.ts"]),
        pkg("@be-yours/d", ["packages/d/src/x.ts"]),
      ],
      new Set(["@be-yours/d"]),
    )

    expect(rows.map((row: Row) => row.state)).toEqual(["drifted", "unknown", "waiting", "clean"])
  })
})

describe("what it tells the reader", () => {
  const { rows, drifted } = summariseDrift(
    [pkg("@be-yours/ui", ["packages/ui/src/a.ts", "packages/ui/src/b.ts"])],
    new Set(),
  )

  test("the log names the package, the version and the files", () => {
    expect(formatTable(rows)).toContain("@be-yours/ui")
    expect(formatTable(rows)).toContain("2 source file(s) changed")
  })

  test("the annotation says what to run", () => {
    expect(describeDrift(drifted[0])).toContain("pnpm changeset")
    expect(describeDrift(drifted[0])).toContain("packages/ui/src/a.ts")
  })

  test("the summary says why it matters, not just that it happened", () => {
    expect(formatSummary(drifted)).toContain("reaches no client site")
  })

  test("more than five changed files are counted, not listed", () => {
    const many = summariseDrift(
      [pkg("@be-yours/ui", Array.from({ length: 9 }, (_, i) => `packages/ui/src/f${i}.ts`))],
      new Set(),
    )

    expect(describeDrift(many.drifted[0])).toContain("and 4 more")
  })

  test("no packages at all is a sentence, not a crash on Math.max", () => {
    expect(formatTable([])).toContain("No publishable packages")
  })
})

/**
 * The half of the report that used to be a single reassuring word.
 *
 * `covered` was printed in the same column as `clean`, under "Every package
 * with source changes since its last release carries a changeset." — and the
 * run exited 0 with no annotation of any kind, while `publish-mirror --check`
 * exited 1 on the same package. Nothing here gates: batching fixes into one
 * release is the intended workflow. What is asserted is that the run SAYS it.
 */
describe("a release that has not been cut", () => {
  const { rows, waiting } = summariseDrift(
    [pkg("@be-yours/ui", ["packages/ui/src/a.ts", "packages/ui/src/b.ts"])],
    new Set(["@be-yours/ui"]),
  )

  test("the row says what the registry is serving, not that all is well", () => {
    const table = formatTable(rows)

    expect(table).toContain("waiting")
    expect(table).toContain("registry still serves the 1.0.0 built before them")
    // The word that made a reader stop reading.
    expect(table).not.toContain("covered")
  })

  test("the annotation names the packages and what a client installs", () => {
    const line = describeWaiting(waiting)

    expect(line).toContain("@be-yours/ui@1.0.0")
    expect(line).toContain("2 file(s)")
    expect(line).toContain("a client site installs that one")
  })

  test("the summary says the release has not happened, not that it has", () => {
    const summary = formatWaitingSummary(waiting)

    expect(summary).toContain("waiting on a release")
    expect(summary).toContain("BEFORE")
    expect(summary).toContain("pnpm version-packages")
  })
})

/**
 * A release already cut is not "no changeset".
 *
 * The SUBPATH half of `check:source-drift` asks whether a changeset is waiting
 * to move a package's version — the right question for the normal path and the
 * wrong one for the path `publish-mirror.mjs` prints in its own failure text:
 * run `pnpm version-packages`, commit the bumped manifests, merge.
 *
 * Doing that CONSUMES the changesets — versioning is what consumes them — so
 * `.changeset/` empties and the check reported a finished release as "no
 * changeset will move its version". Measured on #445: `convex-functions` at
 * 6.2.0 against a published 6.0.0 and `ui` at 4.2.0 against 4.0.0, both called
 * deadlocks by the very commit that unblocks them. Two guards, each demanding
 * what the other forbids, and following either made the other red.
 *
 * Distinct from `waiting` above, which is the DRIFT half's answer to the
 * neighbouring question — a changeset that exists and has not shipped yet.
 */
describe("bumpedAhead", () => {
  it("accepts a version already bumped past the registry's", () => {
    expect(bumpedAhead("6.2.0", "6.0.0")).toBe(true)
    expect(bumpedAhead("4.2.0", "4.0.0")).toBe(true)
    expect(bumpedAhead("1.1.2", "1.1.1")).toBe(true)
  })

  it("does not accept a version that has not moved", () => {
    expect(bumpedAhead("6.0.0", "6.0.0")).toBe(false)
  })

  it("does not accept a version behind the registry", () => {
    expect(bumpedAhead("6.0.0", "6.1.0")).toBe(false)
  })

  it("compares segments numerically, not lexically", () => {
    // A string compare puts "1.10.0" below "1.9.0" and calls a real release
    // un-cut.
    expect(bumpedAhead("1.10.0", "1.9.0")).toBe(true)
    expect(bumpedAhead("2.0.0", "1.9.9")).toBe(true)
  })

  it("refuses what it cannot read, rather than waving it through", () => {
    expect(bumpedAhead("not.a.version", "1.0.0")).toBe(false)
    expect(bumpedAhead("1.0.0", "")).toBe(false)
    expect(bumpedAhead(undefined as unknown as string, "1.0.0")).toBe(false)
    expect(bumpedAhead("1.0.0-rc.1", "1.0.0")).toBe(false)
  })
})

/**
 * A subpath a client cannot resolve may not merge on a promise.
 *
 * WHAT WAS BROKEN. `publish-mirror.mjs` refuses EVERY sync while a package
 * declares an `exports` subpath its published version lacks — not just the
 * change that added it, but a storefront fix by somebody else that happens to
 * queue behind it. The gate let that merge on a warning whenever a changeset
 * was waiting, on the reasoning this file applies to ordinary drift: a waiting
 * changeset is the intended workflow.
 *
 * A subpath is not ordinary drift, and #427 measured the difference. Eight
 * commits and 129 files under `apps/themes` reached no client site for two
 * days because three subpaths sat unpublished — `./contrast`, `./contrast-scan`
 * and `./paymentLedger` — while every signal a human would check, this one
 * included, was green. Five occurrences merged that way.
 *
 * The remedy was always one command, and `publish-mirror.mjs` prints it in its
 * own failure text: `pnpm version-packages`, commit the bumped manifests,
 * merge. That turns a promise into a release the merge itself publishes. So
 * only a bump already in the tree may merge.
 */
describe("a subpath the published version does not carry", () => {
  const gap = (workspaceVersion: string, hasChangeset: boolean) =>
    classifySubpathGap({ workspaceVersion, publishedVersion: "3.1.0", hasChangeset })

  test("a bump already in the tree is a release, and may merge", () => {
    // `changeset publish` compares each version against the registry and pushes
    // whatever is missing, so merging this IS the release.
    expect(gap("3.2.0", false)).toBe("released-here")
    expect(subpathGapMayMerge("released-here")).toBe(true)
  })

  test("a waiting changeset is a promise, and may NOT", () => {
    // The rule that changed. This used to be a warning and exit 0.
    expect(gap("3.1.0", true)).toBe("promised")
    expect(subpathGapMayMerge("promised")).toBe(false)
  })

  test("no changeset at all may not either", () => {
    expect(gap("3.1.0", false)).toBe("unclaimed")
    expect(subpathGapMayMerge("unclaimed")).toBe(false)
  })

  test("a bump outranks the absence of a changeset", () => {
    // Versioning CONSUMES changesets, so the commit that cuts a release has an
    // empty `.changeset/` — and used to be reported as the deadlock it ends.
    expect(gap("4.0.0", false)).toBe("released-here")
  })

  test("a version that is not ahead is not a bump", () => {
    // Equal, behind, and unparseable all fail towards reporting.
    expect(gap("3.1.0", false)).toBe("unclaimed")
    expect(gap("3.0.9", false)).toBe("unclaimed")
    expect(gap("not-a-version", false)).toBe("unclaimed")
  })

  describe("what it tells whoever tripped it", () => {
    const row = {
      name: "@be-yours/ui",
      version: "3.1.0",
      workspaceVersion: "3.1.0",
      missing: ["./contrast", "./contrast-scan"],
    }

    test("a promise is told to cut the release here, not to write another changeset", () => {
      const said = describeSubpathGap(row, "promised")
      expect(said).toContain("pnpm version-packages")
      // The wrong advice would be `pnpm changeset` — there already is one.
      expect(said).toContain("promise rather than a release")
      expect(said).toContain("./contrast")
    })

    test("an unclaimed subpath is told to write one first", () => {
      const said = describeSubpathGap(row, "unclaimed")
      expect(said).toContain("pnpm changeset")
      expect(said).toContain("pnpm version-packages")
    })

    test("both say why it is not only their problem", () => {
      // The sentence that makes the rule land: the queue behind it is other
      // people's work.
      for (const verdict of ["promised", "unclaimed"] as const) {
        expect(describeSubpathGap(row, verdict)).toContain("refuses EVERY sync")
      }
    })

    test("a release cut here is told it is fine, and why the mirror still waits", () => {
      const said = describeSubpathGap({ ...row, workspaceVersion: "3.2.0" }, "released-here")
      expect(said).toContain("already bumped to 3.2.0")
      expect(said).toContain("changeset publish")
      expect(said).not.toContain("pnpm version-packages")
    })
  })
})
