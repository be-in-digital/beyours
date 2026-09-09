import { describe, expect, it, test } from "vitest"

import {
  bumpedAhead,
  describeDrift,
  formatSummary,
  formatTable,
  isReleasableSource,
  summariseDrift,
} from "../../../scripts/lib/source-drift.mjs"

/** What `summariseDrift` returns. It is `.mjs`, so nothing here is inferred for us. */
interface Row {
  name: string
  version: string
  dir: string
  since: string | null
  changed: string[]
  state: "drifted" | "unknown" | "covered" | "clean"
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
    const { drifted } = summariseDrift([pkg("@be-in-digital/ui", ["packages/ui/src/button.tsx"])], new Set())

    expect(drifted.map((row: Row) => row.name)).toEqual(["@be-in-digital/ui"])
  })

  test("a changeset naming it covers it", () => {
    const { drifted, rows } = summariseDrift(
      [pkg("@be-in-digital/ui", ["packages/ui/src/button.tsx"])],
      new Set(["@be-in-digital/ui"]),
    )

    expect(drifted).toEqual([])
    expect(rows[0].state).toBe("covered")
  })

  test("a changeset naming a DIFFERENT package does not", () => {
    // The source that moved is this package's, so this package is the one
    // `changeset publish` will skip. A sibling's release carries nothing.
    const { drifted } = summariseDrift(
      [pkg("@be-in-digital/ui", ["packages/ui/src/button.tsx"])],
      new Set(["@be-in-digital/core"]),
    )

    expect(drifted.map((row: Row) => row.name)).toEqual(["@be-in-digital/ui"])
  })

  test("a package whose only change is a test is clean", () => {
    const { drifted, rows } = summariseDrift(
      [pkg("@be-in-digital/ui", ["packages/ui/src/__tests__/button.test.tsx"])],
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
    const { drifted, unknown, rows } = summariseDrift([pkg("@be-in-digital/ui", [], null)], new Set())

    expect(drifted).toEqual([])
    expect(unknown.map((row: Row) => row.name)).toEqual(["@be-in-digital/ui"])
    expect(rows[0].state).toBe("unknown")
  })

  test("worst first, so a long list opens on what needs doing", () => {
    const { rows } = summariseDrift(
      [
        pkg("@be-in-digital/a", []),
        pkg("@be-in-digital/b", ["packages/b/src/x.ts"], null),
        pkg("@be-in-digital/c", ["packages/c/src/x.ts"]),
        pkg("@be-in-digital/d", ["packages/d/src/x.ts"]),
      ],
      new Set(["@be-in-digital/d"]),
    )

    expect(rows.map((row: Row) => row.state)).toEqual(["drifted", "unknown", "covered", "clean"])
  })
})

describe("what it tells the reader", () => {
  const { rows, drifted } = summariseDrift(
    [pkg("@be-in-digital/ui", ["packages/ui/src/a.ts", "packages/ui/src/b.ts"])],
    new Set(),
  )

  test("the log names the package, the version and the files", () => {
    expect(formatTable(rows)).toContain("@be-in-digital/ui")
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
      [pkg("@be-in-digital/ui", Array.from({ length: 9 }, (_, i) => `packages/ui/src/f${i}.ts`))],
      new Set(),
    )

    expect(describeDrift(many.drifted[0])).toContain("and 4 more")
  })

  test("no packages at all is a sentence, not a crash on Math.max", () => {
    expect(formatTable([])).toContain("No publishable packages")
  })
})

/**
 * A release already cut is not "no changeset".
 *
 * The subpath half of `check:source-drift` asks whether a changeset is waiting
 * to move a package's version. That is the right question for the normal path
 * and the wrong one for the path `publish-mirror.mjs` prints in its own failure
 * text: run `pnpm version-packages`, commit the bumped manifests, merge.
 *
 * Doing that CONSUMES the changesets — versioning is what consumes them — so
 * `.changeset/` empties and the check reported a finished release as
 * "no changeset will move its version". Measured on #445: `convex-functions`
 * at 6.2.0 against a published 6.0.0 and `ui` at 4.2.0 against 4.0.0, both
 * called deadlocks by the very commit that unblocks them. Two guards, each
 * demanding what the other forbids, and following either made the other red.
 */
describe("bumpedAhead", () => {
  it("accepts a version already bumped past the registry's", () => {
    // The two real rows from #445.
    expect(bumpedAhead("6.2.0", "6.0.0")).toBe(true)
    expect(bumpedAhead("4.2.0", "4.0.0")).toBe(true)
    expect(bumpedAhead("1.1.2", "1.1.1")).toBe(true)
  })

  it("does not accept a version that has not moved", () => {
    // The case the error exists for: the subpath is declared, the version is
    // what a client already installs, and nothing will carry it.
    expect(bumpedAhead("6.0.0", "6.0.0")).toBe(false)
  })

  it("does not accept a version behind the registry", () => {
    expect(bumpedAhead("6.0.0", "6.1.0")).toBe(false)
  })

  it("compares segments numerically, not lexically", () => {
    // A string compare puts "1.10.0" below "1.9.0" and would call a real
    // release un-cut.
    expect(bumpedAhead("1.10.0", "1.9.0")).toBe(true)
    expect(bumpedAhead("2.0.0", "1.9.9")).toBe(true)
  })

  it("refuses what it cannot read, rather than waving it through", () => {
    // Every unreadable answer has to fall on the reporting side: a check that
    // silently passes on a question it could not answer is the defect this
    // whole file exists about.
    expect(bumpedAhead("not.a.version", "1.0.0")).toBe(false)
    expect(bumpedAhead("1.0.0", "")).toBe(false)
    expect(bumpedAhead(undefined as unknown as string, "1.0.0")).toBe(false)
    // A prerelease of the same version is not ahead of the release.
    expect(bumpedAhead("1.0.0-rc.1", "1.0.0")).toBe(false)
  })
})
