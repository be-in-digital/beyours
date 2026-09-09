import { describe, expect, test } from "vitest"
import fs from "node:fs"
import path from "node:path"

/**
 * Every environment variable a suite reads is declared on turbo's `test` task.
 *
 * `globalEnvMode` defaults to `strict`, and the `test` task declared no `env`
 * and no `passThroughEnv` at all — so turbo stripped every non-`NEXT_PUBLIC_`
 * variable before vitest started. Measured across the boundary with one
 * command: `DELIVEROO_CLIENT_SECRET` read `"s3cr3t"` from a straight vitest run
 * and `undefined` through `pnpm test`, which is what CI runs.
 *
 * The cost was not the three credential-gated Deliveroo suites being off. It was
 * that **setting a GitHub secret could not turn them on**: they self-skip on
 * `it.runIf(hasWebhookTarget)`, the variable never arrived, and a suite that
 * skipped reported the same green as a suite that passed. A secret would have
 * been created, looked load-bearing, and changed nothing.
 *
 * `build` and `test:e2e` had the identical shape and were each fixed once, by
 * hand, after the failure they caused. That is three occurrences of one defect,
 * which is why the rule is asserted here rather than a fourth list being typed
 * out. Adding `process.env.SOMETHING` to a suite without declaring it fails
 * this file.
 *
 * Bench-only: it reads the monorepo root and would be meaningless on a client
 * site.
 */

const REPO_ROOT = path.join(__dirname, "../../..")

// ── turbo.json is JSONC ──────────────────────────────────────────────────────
// Only whole-line comments are stripped. A `//` anywhere else could be inside a
// URL, and eating the rest of that line could hide a declaration from this
// guard — which would make it pass by blindness.
interface TurboTask {
  env?: string[]
  passThroughEnv?: string[]
  cache?: boolean
  outputs?: string[]
}

function readTurboJson(): { tasks: Record<string, TurboTask | undefined> } {
  const raw = fs.readFileSync(path.join(REPO_ROOT, "turbo.json"), "utf8")
  return JSON.parse(raw.replace(/^\s*\/\/.*$/gm, "")) as {
    tasks: Record<string, TurboTask | undefined>
  }
}

/**
 * The `test` task itself. Thrown for, not defaulted: a turbo.json with no
 * `test` task would otherwise make every assertion in this file pass against
 * an empty declaration list.
 */
function testTask(): TurboTask {
  const task = readTurboJson().tasks.test
  if (!task) throw new Error("turbo.json declares no `test` task")
  return task
}

/**
 * Turbo passes these through in strict mode whatever a task declares — measured,
 * not assumed: with `CI` unset in the parent shell the task sees nothing, with
 * `CI=custom-marker` it sees `"custom-marker"`. Kept short on purpose. Anything
 * that is not here has to be declared.
 */
const SYSTEM_VARIABLES = ["CI", "NODE_ENV"]

/** Directories vitest collects from. Discovered, so a new one is not missed. */
function testRoots(): string[] {
  const roots: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      if (["node_modules", ".next", "dist", ".turbo", ".git"].includes(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.name === "__tests__" || entry.name === "tests" || entry.name === "e2e") {
        roots.push(full)
        continue
      }
      walk(full)
    }
  }
  for (const workspace of ["apps", "packages"]) {
    for (const entry of fs.readdirSync(path.join(REPO_ROOT, workspace))) {
      const dir = path.join(REPO_ROOT, workspace, entry)
      if (fs.statSync(dir).isDirectory()) walk(dir)
    }
  }
  return roots.sort()
}

/** Every `.ts`/`.tsx` under a test root that vitest can load — Playwright's are not ours. */
function testSources(): string[] {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") walk(full)
        continue
      }
      if (!/\.(ts|tsx|mts)$/.test(entry.name)) continue
      if (/\.spec\.tsx?$/.test(entry.name) || /\.setup\.ts$/.test(entry.name)) continue
      files.push(full)
    }
  }
  for (const root of testRoots()) walk(root)
  return files
}

/**
 * Block comments go first: `apps/site/tests/env.test.ts` discusses
 * `process.env.X` in prose, and a guard that demanded `X` be declared would be
 * one nobody could keep green.
 */
/**
 * The source with its comments removed — both kinds.
 *
 * It used to strip `/* … *\/` and leave `//` alone, so a line comment that
 * NAMED a variable was counted as reading it. That is not academic: a test
 * asserting no dev origin is used as a fallback quotes the shape it forbids,
 * `process.env.BETTER_AUTH_URL ?? "http://localhost:3000"`, and the guard then
 * demanded a turbo declaration for a variable the suite never touches. The
 * reverse assertion below is the worse half — a declared variable could be
 * justified by a mention in prose.
 *
 * A regex cannot do this: `"http://localhost"` is a string, not a comment, and
 * naive stripping eats the rest of the line. So this walks the source with the
 * three states that matter, the same way the pipeline detector in
 * `mirror-staleness-watch.test.ts` walks a `run:` block for a bare `|`.
 */
function stripComments(source: string): string {
  let out = ""
  let i = 0
  let quote: string | null = null

  while (i < source.length) {
    const ch = source[i]
    const next = source[i + 1]

    if (quote) {
      out += ch
      if (ch === "\\") {
        out += next ?? ""
        i += 2
        continue
      }
      if (ch === quote) quote = null
      i += 1
      continue
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch
      out += ch
      i += 1
      continue
    }

    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2)
      i = end === -1 ? source.length : end + 2
      continue
    }

    if (ch === "/" && next === "/") {
      const end = source.indexOf("\n", i)
      i = end === -1 ? source.length : end
      continue
    }

    out += ch
    i += 1
  }

  return out
}

function readsOf(source: string): string[] {
  const code = stripComments(source)
  const matches = code.matchAll(/process\.env(?:\.([A-Z_][A-Z0-9_]*)|\[["']([A-Z_][A-Z0-9_]*)["']\])/g)
  return [...matches].flatMap((m) => {
    const name = m[1] ?? m[2]
    return name === undefined ? [] : [name]
  })
}

const declared = (() => {
  const task = testTask()
  return new Set([...(task.env ?? []), ...(task.passThroughEnv ?? []), ...SYSTEM_VARIABLES])
})()

const reads = (() => {
  const byVariable = new Map<string, string[]>()
  for (const file of testSources()) {
    for (const name of readsOf(fs.readFileSync(file, "utf8"))) {
      const where = path.relative(REPO_ROOT, file)
      byVariable.set(name, [...(byVariable.get(name) ?? []), where])
    }
  }
  return byVariable
})()

describe("turbo's test task declares what the suites read", () => {
  /**
   * A scan that finds nothing would make every assertion below pass. It has
   * happened to checks in this repository before.
   */
  test("the scan actually finds suites and reads", () => {
    expect(testSources().length).toBeGreaterThan(300)
    expect(reads.size).toBeGreaterThan(15)
  })

  test.each([...reads.keys()].sort())("%s is declared", (name) => {
    expect(
      declared.has(name),
      `read by ${reads.get(name)?.slice(0, 3).join(", ")} — turbo strips it before vitest starts, so the read returns undefined. Add it to the test task's "env" in turbo.json.`,
    ).toBe(true)
  })

  /**
   * The other direction, so the list cannot rot into a wish. A declared
   * variable nobody reads still sits in the cache key, where changing it
   * silently invalidates every cached test result.
   */
  test("nothing is declared that no suite reads", () => {
    const orphans = (testTask().env ?? []).filter((name) => !reads.has(name))
    expect(orphans, "declared in turbo.json but read by no suite").toEqual([])
  })
})

/**
 * The half that makes a secret usable, and the half that was actually broken.
 *
 * `passThroughEnv` would have delivered the value and left this open: `test` is
 * a CACHED task, a passed-through variable is not part of the cache key, and so
 * the first run after a secret appeared would have replayed the cached result of
 * the run that skipped everything. Measured on the real task — secret unset
 * `6eb64a67…`, set `a1007d97…`, rotated `ddf256b1…`; an undeclared variable
 * moved nothing.
 */
describe("a secret can switch a suite on", () => {
  const task = testTask()

  test("the gated Deliveroo variables are in the cache key, not merely passed through", () => {
    const gates = [
      "CONVEX_SITE_URL",
      "DELIVEROO_WEBHOOK_SECRET",
      "DELIVEROO_CLIENT_SECRET",
    ]
    for (const gate of gates) {
      expect(
        task.env ?? [],
        `${gate} gates it.runIf(hasWebhookTarget); in passThroughEnv turbo would replay the cached skip`,
      ).toContain(gate)
      expect(task.passThroughEnv ?? []).not.toContain(gate)
    }
  })

  /**
   * `test` declares no `outputs` — #362 moved `coverage/**` to `test:coverage`,
   * because `pnpm test` writes no coverage and a cache slot for an artefact no
   * command produces is a fiction. It is still CACHED: a turbo task without
   * outputs replays its success and skips the command entirely. That is what
   * makes `env` rather than `passThroughEnv` the load-bearing choice, so the
   * assertion is about `cache`, never about the outputs it no longer has.
   */
  test("the task is cached, which is what makes the distinction matter", () => {
    expect(task.cache).not.toBe(false)
  })
})

/**
 * `test:coverage` runs the same suites and needs the same variables.
 *
 * turbo.json cannot share one list between two tasks, so it is written twice —
 * and a list written twice drifts. It drifted the moment it existed: #362 split
 * this task out of `test` while this branch was adding the `env` block to
 * `test`, and git merged both cleanly into a file where `test` had lost every
 * declaration and `test:coverage` had gained them. Nothing failed. `pnpm test`
 * silently went back to stripping the secrets, which is the exact defect the
 * `env` block exists to fix.
 *
 * Equality is asserted rather than each entry, so the next person to add a
 * variable to one is told about the other.
 */
describe("test:coverage carries the same declarations as test", () => {
  const coverage = readTurboJson().tasks["test:coverage"]

  test("the task exists", () => {
    expect(coverage, "turbo.json declares no `test:coverage` task").toBeDefined()
  })

  test("its env list is identical to test's", () => {
    expect(coverage?.env ?? []).toEqual(testTask().env ?? [])
  })

  test("it passes through the same variables", () => {
    expect(coverage?.passThroughEnv ?? []).toEqual(testTask().passThroughEnv ?? [])
  })

  /** The reason it is a separate task at all. */
  test("it is the one that writes coverage", () => {
    expect(coverage?.outputs).toContain("coverage/**")
  })
})
