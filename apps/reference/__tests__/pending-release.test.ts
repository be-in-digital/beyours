import { describe, expect, test } from "vitest"
import { existsSync } from "node:fs"
import { join } from "node:path"

import {
  ageInDays,
  CHANGESET_DIR,
  formatSummary,
  formatTable,
  isChangesetFile,
  parseChangeset,
  REPO_ROOT,
  summarise,
} from "../../../scripts/lib/pending-release.mjs"

/**
 * A merged fix to `packages/*` reaches no client until a release is cut, and
 * nothing said so. `apps/themes` links the engine with `workspace:^`, so this
 * repository goes green the moment the fix lands; the client installs the
 * published tarball and gets nothing. On 07/09/2026 that made a red mirror run
 * read as a fix failing when it was a fix that had never shipped (#387, #389).
 *
 * What matters here is the COUNT and the AGE, in that order. The count is the
 * fact that was missing. The age only decides how loudly to say it — and it is
 * routinely unavailable, because `actions/checkout` clones at depth 1, so a
 * changeset added before the tip has no commit to read. An undated changeset
 * must still be reported.
 */

const NOW = new Date("2026-09-07T10:00:00Z")
const days = (n: number) => new Date(NOW.getTime() - n * 86_400_000)

describe("where it looks", () => {
  test("resolves `.changeset/` from the script, not from the working directory", () => {
    // A relative path would make the check answer "nothing pending" whenever
    // it ran from a subdirectory — a false negative in the one check whose
    // entire job is to prevent a false negative. This test is here because the
    // first draft had exactly that bug.
    expect(CHANGESET_DIR.startsWith("/")).toBe(true)
    expect(CHANGESET_DIR.endsWith("/.changeset")).toBe(true)
    expect(CHANGESET_DIR.startsWith(REPO_ROOT)).toBe(true)
    expect(existsSync(join(REPO_ROOT, "pnpm-workspace.yaml"))).toBe(true)
  })
})

describe("isChangesetFile", () => {
  test("takes the release notes and leaves the furniture", () => {
    expect(isChangesetFile("product-choices-immutable.md")).toBe(true)
    expect(isChangesetFile("README.md")).toBe(false)
    expect(isChangesetFile("config.json")).toBe(false)
    expect(isChangesetFile("notes.txt")).toBe(false)
  })
})

describe("parseChangeset", () => {
  test("reads the shape changesets actually writes", () => {
    // Verbatim from `.changeset/product-choices-immutable.md`, the one #387
    // left and #388 consumed.
    const text = `---
"@be-in-digital/admin": patch
---

Fix the product form's "Ajouter un choix" button doing nothing.
`
    expect(parseChangeset(text)).toEqual([{ name: "@be-in-digital/admin", bump: "patch" }])
  })

  test("reads several packages, quoted or not, at any bump", () => {
    const text = `---
"@be-in-digital/core": major
@be-in-digital/ui: minor
'@be-in-digital/cms': patch
---

Summary.
`
    expect(parseChangeset(text)).toEqual([
      { name: "@be-in-digital/core", bump: "major" },
      { name: "@be-in-digital/ui", bump: "minor" },
      { name: "@be-in-digital/cms", bump: "patch" },
    ])
  })

  test("returns null rather than throwing on anything else", () => {
    // No fences, a bump changesets does not define, and an empty block. Each
    // is worth reporting; none is worth taking a CI job down over.
    expect(parseChangeset("just prose, no frontmatter")).toBeNull()
    expect(parseChangeset('---\n"@be-in-digital/ui": huge\n---\n\nSummary.\n')).toBeNull()
    expect(parseChangeset("---\n\n---\n\nSummary.\n")).toBeNull()
  })
})

describe("ageInDays", () => {
  test("floors to whole days and passes null through", () => {
    expect(ageInDays(days(3), NOW)).toBe(3)
    expect(ageInDays(new Date(NOW.getTime() - 23 * 3_600_000), NOW)).toBe(0)
    expect(ageInDays(null, NOW)).toBeNull()
  })
})

describe("summarise", () => {
  const entry = (file: string, name: string, bump: string, addedAt: Date | null) => ({
    file,
    releases: [{ name, bump }],
    addedAt,
  })

  test("one row per package, oldest first, undated last", () => {
    const { rows } = summarise(
      [
        entry("recent.md", "@be-in-digital/ui", "patch", days(1)),
        entry("undated.md", "@be-in-digital/cms", "patch", null),
        entry("old.md", "@be-in-digital/admin", "minor", days(30)),
      ],
      { now: NOW, maxAgeDays: 7 },
    )

    expect(rows.map((row) => row.name)).toEqual([
      "@be-in-digital/admin",
      "@be-in-digital/ui",
      "@be-in-digital/cms",
    ])
  })

  test("a changeset naming several packages becomes several rows", () => {
    const { rows } = summarise(
      [
        {
          file: "wide.md",
          releases: [
            { name: "@be-in-digital/core", bump: "patch" },
            { name: "@be-in-digital/ui", bump: "patch" },
          ],
          addedAt: days(2),
        },
      ],
      { now: NOW, maxAgeDays: 7 },
    )

    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.file === "wide.md" && row.ageDays === 2)).toBe(true)
  })

  test("stale is the threshold and its boundary, not a guess", () => {
    const at = (n: number) => entry(`d${n}.md`, `@be-in-digital/p${n}`, "patch", days(n))
    const { stale } = summarise([at(6), at(7), at(8)], { now: NOW, maxAgeDays: 7 })

    // 7 days is stale at exactly 7, so the threshold means what it says.
    expect(stale.map((row) => row.ageDays)).toEqual([8, 7])
  })

  test("an undated changeset is reported and never called stale", () => {
    // The shallow-clone case. Losing the age must not lose the row — the count
    // is the fact this whole check exists to surface.
    const { rows, stale, oldestDays } = summarise(
      [entry("undated.md", "@be-in-digital/admin", "patch", null)],
      { now: NOW, maxAgeDays: 0 },
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]!.ageDays).toBeNull()
    expect(stale).toEqual([])
    expect(oldestDays).toBeNull()
  })

  test("an unparseable file is set aside, not counted as a release", () => {
    const { rows, unparseable } = summarise(
      [
        { file: "broken.md", releases: null, addedAt: days(1) },
        entry("fine.md", "@be-in-digital/ui", "patch", days(1)),
      ],
      { now: NOW, maxAgeDays: 7 },
    )

    expect(unparseable).toEqual(["broken.md"])
    expect(rows.map((row) => row.name)).toEqual(["@be-in-digital/ui"])
  })

  test("nothing pending is the healthy case and says nothing", () => {
    expect(summarise([], { now: NOW, maxAgeDays: 7 })).toEqual({
      rows: [],
      stale: [],
      unparseable: [],
      oldestDays: null,
    })
  })
})

describe("formatting", () => {
  const rows = [
    {
      name: "@be-in-digital/admin",
      bump: "patch",
      file: "product-choices-immutable.md",
      addedAt: days(9),
      ageDays: 9,
    },
    { name: "@be-in-digital/ui", bump: "minor", file: "later.md", addedAt: null, ageDays: null },
  ]

  test("the log block names the package, the bump and the wait", () => {
    const table = formatTable(rows)

    expect(table).toContain("@be-in-digital/admin")
    expect(table).toContain("patch")
    expect(table).toContain("9d")
    expect(table).toContain("product-choices-immutable.md")
    expect(table).toContain("age unknown")
  })

  test("an empty list says so rather than printing a header over nothing", () => {
    expect(formatTable([])).toBe("No unreleased engine fixes: `.changeset/` is empty.")
  })

  test("the summary is a markdown table a reader can scan", () => {
    const summary = formatSummary(rows)

    expect(summary).toContain("| Package | Bump | Waiting | Changeset |")
    expect(summary).toContain("| `@be-in-digital/admin` | patch | 9 day(s) |")
    expect(summary).toContain("| `@be-in-digital/ui` | minor | unknown |")
  })
})
