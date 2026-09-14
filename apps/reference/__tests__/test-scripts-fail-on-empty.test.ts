import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

/**
 * A workspace whose suite has become empty must go RED (#102).
 *
 * WHAT WAS WRONG. Twelve of the thirteen workspaces ran `vitest run
 * --passWithNoTests`. That flag turns "this project has no tests" into a pass —
 * so deleting a test file, breaking an `include` glob, or renaming a directory
 * produced a green `Test` job over a suite that ran nothing at all. The audit
 * lists it as "`--passWithNoTests` masking empty suites", next to "0.21%
 * effective coverage", and the two are the same failure seen twice: nothing in CI
 * could tell a passing suite from an absent one.
 *
 * It was also load-bearing for nobody. Measured before removing it: every one of
 * the thirteen workspaces has test files, the smallest being `mcp-server` with
 * one. So the flag protected no real case and hid every hypothetical one.
 *
 * WHY A TEST AND NOT A README LINE. The flag is one word, it is what every
 * scaffold writes, and it is added back by anybody who hits "no test files found"
 * once. This is the only thing that would notice.
 *
 * This file lives in the bench and reads the whole monorepo, like
 * `documented-env-vars.test.ts` beside it: the question is about the repository,
 * and the bench is where the repository's own guards run in CI.
 */

const ROOT = path.resolve(__dirname, "..", "..", "..")

/** Every workspace manifest, apps and packages. */
function manifests(): Array<{ rel: string; json: Record<string, unknown> }> {
  const out: Array<{ rel: string; json: Record<string, unknown> }> = []
  for (const group of ["apps", "packages"]) {
    const dir = path.join(ROOT, group)
    if (!fs.existsSync(dir)) continue
    for (const entry of fs.readdirSync(dir)) {
      const file = path.join(dir, entry, "package.json")
      if (!fs.existsSync(file)) continue
      out.push({
        rel: `${group}/${entry}/package.json`,
        json: JSON.parse(fs.readFileSync(file, "utf8")),
      })
    }
  }
  return out
}

/** Test files a workspace actually has, ignoring anything installed. */
function testFileCount(dir: string): number {
  let count = 0
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".next") {
        continue
      }
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) count += 1
    }
  }
  walk(dir)
  return count
}

describe("a workspace with no tests must fail, not pass", () => {
  it("finds the workspaces at all", () => {
    // A sweep that resolves nothing reports no violations, which reads as the
    // same green as a clean repository.
    expect(manifests().length).toBeGreaterThan(10)
  })

  it("no test script carries --passWithNoTests", () => {
    const offenders = manifests()
      .filter(({ json }) => {
        const scripts = (json.scripts ?? {}) as Record<string, string>
        return Object.values(scripts).some((cmd) => cmd.includes("--passWithNoTests"))
      })
      .map(({ rel }) => rel)

    expect(offenders).toEqual([])
  })

  it("every workspace that declares a test script has tests to run", () => {
    /*
     * The other half. Removing the flag only helps if a workspace's suite is
     * non-empty TODAY — otherwise the first CI run after this lands is red for a
     * reason nobody chose. Asserted rather than assumed: this is the measurement
     * that made removing the flag safe.
     */
    const empty: string[] = []
    for (const { rel, json } of manifests()) {
      const scripts = (json.scripts ?? {}) as Record<string, string>
      if (!scripts.test) continue
      const dir = path.join(ROOT, path.dirname(rel))
      if (testFileCount(dir) === 0) empty.push(rel)
    }
    expect(empty).toEqual([])
  })
})
