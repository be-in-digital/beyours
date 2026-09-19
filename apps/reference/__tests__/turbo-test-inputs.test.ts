import { describe, expect, test } from "vitest"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { parse } from "yaml"

/**
 * Every file a suite reads is hashed into turbo's `test` task.
 *
 * The sibling of `turbo-test-env.test.ts`, and the same defect one axis over:
 * that file is about what turbo STRIPS from a task, this one is about what
 * turbo does not HASH into it. Both end in a green that was never earned.
 *
 * Turbo's default input set is a package's own git-tracked files, and `test`
 * declared no `inputs` at all. These suites read far outside their package —
 * the workflows, the root manifest, the lockfile, `CLAUDE.md`, `scripts/`,
 * `.changeset/`, every engine `package.json`, the whole of `apps/themes` — and
 * none of it was hashed. Measured at the time with `turbo run test --dry=json`,
 * which prints a task's hash without running it: appending one newline to
 * `.github/workflows/ci.yml`, to the root `package.json`, to `pnpm-lock.yaml`,
 * to `pnpm-workspace.yaml`, to `CLAUDE.md`, to `scripts/publish-mirror.mjs`, to
 * `apps/themes/package.json` or to `turbo.json` itself left
 * `@beyours/reference#test`'s hash byte-for-byte identical. So did bumping
 * `packages/mcp-server/package.json` to `99.9.9`.
 *
 * That last one is #392 in a sentence: **a version bump anywhere replayed a
 * green `Test` over a genuinely drifted tree**, because `Test` is a cached task
 * and the manifests its suites read were not inputs. A required check that
 * replays is worse than one that does not exist, because it is trusted.
 *
 * Why this asserts on `--dry=json` rather than on the `inputs` array: an
 * `inputs` glob that matches nothing is silently ignored by turbo, so a typo
 * would leave this file green over the exact hole it exists to close. The dry
 * run reports the files turbo ACTUALLY hashed, which is the property that
 * matters. It is one subprocess for the whole suite.
 *
 * Bench-only: it reads the monorepo root and would be meaningless on a client
 * site.
 */

const REPO_ROOT = path.join(__dirname, "../../..")

interface TurboTask {
  inputs?: string[]
}

function readTurboJson(): { tasks: Record<string, TurboTask | undefined> } {
  // turbo.json is JSONC. Whole-line comments only — a `//` mid-line could be
  // inside a URL, and eating the rest of that line could hide a declaration
  // from this guard, which would make it pass by blindness.
  const raw = fs.readFileSync(path.join(REPO_ROOT, "turbo.json"), "utf8")
  return JSON.parse(raw.replace(/^\s*\/\/.*$/gm, "")) as {
    tasks: Record<string, TurboTask | undefined>
  }
}

/**
 * What turbo hashed, per task, keyed by task id.
 *
 * `--dry=json` resolves the whole graph and runs nothing. `--filter` is
 * deliberately absent: the point is that the declaration reaches EVERY
 * workspace, and a filtered run could not tell.
 */
const hashedInputs: Map<string, { directory: string; files: Set<string> }> = (() => {
  const raw = execFileSync("npx", ["turbo", "run", "test", "--dry=json"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  })
  const plan = JSON.parse(raw) as {
    tasks: { taskId: string; directory: string; inputs?: Record<string, string> }[]
  }
  return new Map(
    plan.tasks
      .filter((task) => task.taskId.endsWith("#test"))
      .map((task) => [
        task.taskId,
        {
          directory: task.directory,
          // Turbo reports inputs relative to the PACKAGE, so the same file is
          // `../../apps/themes/package.json` for one task and `package.json`
          // for `@beyours/themes` itself. Normalised to repo-root-relative
          // here, so the list below can name each file once, as a person would.
          files: new Set(
            Object.keys(task.inputs ?? {}).map((file) =>
              path.posix.normalize(path.posix.join(task.directory, file)),
            ),
          ),
        },
      ]),
  )
})()

/**
 * Files outside any package that the suites read, with the suite that reads
 * each. Concrete paths, not globs: a glob would be checked against the same
 * matcher that is supposed to be under test.
 *
 * The declaration in `turbo.json` is one list shared by every workspace, so
 * every `#test` task is held to the whole of it. That is wider than any single
 * suite needs and deliberately so — an input that is too wide re-runs a test
 * that would have passed, one that is too narrow reports a pass for code
 * nobody ran.
 */
const EXTERNAL_READS: [file: string, readBy: string][] = [
  ["turbo.json", "turbo-test-env.test.ts, and this file"],
  ["package.json", "workflow-publish-gates.test.ts, mirror-overrides.test.ts"],
  ["pnpm-lock.yaml", "mirror-overrides.test.ts parses its overrides block as text"],
  ["pnpm-workspace.yaml", "client-stylesheet.test.ts, pending-release.test.ts"],
  ["CLAUDE.md", "engine-doc-imports.test.ts compiles its import lines"],
  ["README.md", "engine-doc-imports.test.ts"],
  [".changeset/config.json", "pending-release.test.ts, through scripts/lib/pending-release.mjs"],
  [".github/workflows/ci.yml", "workflow-publish-gates.test.ts, client-stylesheet.test.ts"],
  [".github/workflows/publish-mirror.yml", "workflow-publish-gates.test.ts"],
  ["scripts/publish-mirror.mjs", "mirror-publisher.test.ts, mirror-typecheck.test.ts"],
  ["scripts/lib/mirror-tree.mjs", "mirror-publisher.test.ts"],
  ["packages/core/package.json", "mirror-engine-exports.test.ts — the version bump of #392"],
  ["packages/mcp-server/package.json", "publish-plan.test.ts, registry.test.ts"],
  ["packages/mcp-server/src/registry.ts", "mcp-registry-imports.test.ts — nothing depends on this package"],
  ["packages/mcp-server/CHANGELOG.md", "engine-doc-imports.test.ts compiles the imports in every packages/**.md"],
  ["packages/mcp-server/vitest.config.ts", "engine-doc-imports.test.ts walks every .ts under packages/"],
  ["apps/themes/package.json", "mirror-typecheck.test.ts, mirror-overrides.test.ts"],
  ["apps/themes/.github/workflows/ci.yml", "engine-version-diagnostic.test.ts"],
]

test("the dry run found the test tasks", () => {
  // Guards the guard. A plan that resolved no `#test` task would make every
  // assertion below pass against an empty set — which is how a check in this
  // repository has gone quietly blind before.
  expect(hashedInputs.size).toBeGreaterThanOrEqual(4)
})

test("every file named here exists", () => {
  // A path that has moved would be asserted as "not hashed" forever, or worse,
  // quietly dropped from the declaration with nobody noticing.
  const missing = EXTERNAL_READS.map(([file]) => file).filter(
    (file) => !fs.existsSync(path.join(REPO_ROOT, file)),
  )
  expect(missing).toEqual([])
})

describe.each([...hashedInputs.keys()].sort())("%s", (taskId) => {
  const { directory, files } = hashedInputs.get(taskId)!

  test.each(EXTERNAL_READS)("hashes %s", (file) => {
    expect(files.has(file)).toBe(true)
  })

  test("hashes no build artefact", () => {
    // An explicit `inputs` glob does NOT consult `.gitignore` — turbo's default
    // set does, so nobody meets this until the first explicit glob is written.
    // `apps/themes/**` then pulled in `node_modules/.vite/vitest/*/results.json`,
    // Vitest's cache of the PREVIOUS run's per-test durations, and `pnpm test`
    // rewrote one of its own inputs on every run: the cache could never hit
    // twice, for any of the thirteen workspaces.
    //
    // Worse than the hole it was closing. A missing input reports a false
    // green; an input that is not a function of the source tree destroys the
    // cache outright, and does it silently.
    const artefacts = [...files].filter((file) =>
      /(^|\/)(node_modules|\.next|\.turbo|\.vite|\.convex-build|coverage|test-results|playwright-report)\//.test(
        file,
      ),
    )
    expect(artefacts).toEqual([])
  })

  test("hashes no incremental-compiler state either", () => {
    // `tsconfig.tsbuildinfo` is not inside a directory, so the pattern above
    // could never have seen it — and it survived the first sweep for exactly
    // that reason. Every `pnpm typecheck` rewrites it, and `apps/themes/**`
    // was hashing the one in that app: appending a single space to it moved
    // all thirteen `#test` hashes (`bbaeceabd8549872` → `ff9e92c128b8dfad`),
    // so a local typecheck in the template threw the monorepo's whole test
    // cache away.
    //
    // The sibling `.convex-build/` — 135 files, written by `npx convex dev` —
    // is covered by the directory pattern above, now that it is named there.
    const buildInfo = [...files].filter((file) => file.endsWith(".tsbuildinfo"))
    expect(buildInfo).toEqual([])
  })

  test("still hashes its own source", () => {
    // `$TURBO_DEFAULT$` is what keeps the package's own files in the set once
    // `inputs` is declared. Drop it and a package's source stops being an
    // input — which would replace this defect with a far worse one, in
    // silence. Counted against the package's own directory rather than "any
    // file", because every task now hashes the shared list too.
    const own = [...files].filter(
      (file) => file.startsWith(`${directory}/`) && /\.(ts|tsx)$/.test(file),
    )
    expect(own.length).toBeGreaterThan(0)
  })
})

/**
 * The artefacts that are not on disk during a CI run.
 *
 * The two tests above filter what turbo hashed, so they can only see an
 * artefact that EXISTS while they run — and `.convex-build/` and
 * `tsconfig.tsbuildinfo` are written by `npx convex dev` and `pnpm typecheck`
 * in a developer's checkout, not by anything CI does before `Test`. Both were
 * therefore invisible to a guard that had already been written to catch exactly
 * their class, and both survived #424's sweep for that reason.
 *
 * So this one CREATES them, asks turbo what it would hash, and removes them
 * again. It is the only assertion here that can fail on a clean runner, which
 * is the only kind of runner this repository has.
 */
test("a local typecheck or convex build does not move a single test hash", () => {
  const probes = [
    path.join(REPO_ROOT, "apps/themes/.convex-build"),
    path.join(REPO_ROOT, "apps/themes/tsconfig.tsbuildinfo"),
  ]
  // Never clobber a real one: a developer running this suite has both, and
  // deleting their incremental state to prove a point is not this test's
  // business. Their presence is not a reason to skip — turbo is asked the same
  // question either way, and the answer must be the same.
  const preexisting = probes.filter((probe) => fs.existsSync(probe))

  const hashes = () => {
    const raw = execFileSync("npx", ["turbo", "run", "test", "--dry=json"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    })
    const plan = JSON.parse(raw) as { tasks: { taskId: string; hash: string }[] }
    return plan.tasks
      .filter((task) => task.taskId.endsWith("#test"))
      .map((task) => `${task.taskId}=${task.hash}`)
      .sort()
  }

  const before = hashes()
  expect(before.length).toBeGreaterThan(0)

  try {
    if (!preexisting.includes(probes[0]!)) {
      fs.mkdirSync(probes[0]!, { recursive: true })
      fs.writeFileSync(path.join(probes[0]!, "modules.json"), '{"probe":true}')
    }
    if (!preexisting.includes(probes[1]!)) {
      fs.writeFileSync(probes[1]!, '{"program":{"fileNames":[]}}')
    }

    expect(hashes()).toEqual(before)
  } finally {
    for (const probe of probes) {
      if (preexisting.includes(probe)) continue
      fs.rmSync(probe, { recursive: true, force: true })
    }
  }
})

test("`test:coverage` declares the same inputs as `test`", () => {
  // It runs the same suites. An input missing there replays the same false
  // green with a coverage report attached. turbo.json has no way to share one
  // list, which is why the same duplication exists for `env`.
  const tasks = readTurboJson().tasks
  expect(tasks["test:coverage"]?.inputs).toEqual(tasks.test?.inputs)
})

test("every workspace is two directories below the root", () => {
  // `../../` in the declaration is the repository root only because
  // `pnpm-workspace.yaml` says every workspace lives at `packages/*` or
  // `apps/*`. A workspace added at another depth would resolve those globs
  // somewhere else, match nothing, and lose the whole list without a word —
  // turbo ignores a glob that matches nothing.
  // Parsed, not pattern-matched. A regex over the whole file read
  // `ignoredBuiltDependencies` — `sharp`, `unrs-resolver` — as workspace globs
  // and failed on them: one-segment entries that are not workspaces at all.
  const workspaces = parse(
    fs.readFileSync(path.join(REPO_ROOT, "pnpm-workspace.yaml"), "utf8"),
  ) as { packages?: string[] }
  const globs = workspaces.packages ?? []
  expect(globs).not.toEqual([])
  expect(globs.filter((glob) => glob.split("/").length !== 2)).toEqual([])
})
