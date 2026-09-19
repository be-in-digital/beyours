import { describe, expect, test } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { parse } from "yaml"
import { execFileSync } from "node:child_process"

/**
 * A job that installs the engine must say which versions it installed.
 *
 * The diagnostic (`apps/themes/scripts/engine-versions.mjs`) answers the one
 * question a red run in the boilerplate cannot answer for itself: the
 * application shell is synced from the engine at HEAD while the
 * `@be-yours/*` packages arrive from the registry at whatever was last
 * published, and those two can be days apart. On 07/09/2026 that cost a full
 * diagnostic cycle — three runs read as a fix failing when the fix had simply
 * never been released (#389).
 *
 * It was in the `e2e` job, and only there. `e2e` carries `needs: web`, and
 * GitHub skips a job whose dependency failed unless its `if:` uses a status
 * function — `e2e` has no `if:` at all. So whenever `web` (Lint, Typecheck,
 * Unit tests, Build) went red, the diagnostic never printed. The step's own
 * `if: always()` cannot help: `always()` is a STEP condition and cannot
 * resurrect a job that never started.
 *
 * That is exactly backwards. A wrong engine version breaks the build long
 * before it breaks Playwright — `scripts/check-mirror-build.mjs` records the
 * canonical case, `Cannot find module '@be-yours/admin/game'`, a
 * **Typecheck** failure in 71 of the boilerplate's last 100 runs. In all of
 * them `web` failed, `e2e` was skipped, and the log ended at a bare TS2307.
 * The answer was reachable only in the runs that did not need it.
 *
 * What is asserted here is the rule, not the repair: **any** job that installs
 * this manifest must carry the diagnostic, on `always()`. A job added next year
 * is measured against it without anyone remembering this paragraph — which is
 * the same reason `workflow-publish-gates.test.ts` exists rather than a second
 * one-line `needs:`.
 *
 * `apps/themes/.github/workflows/ci.yml` is the mirror's CI: it becomes the
 * repository root of `beyours-boilerplate` and of every client site cloned from
 * it. The monorepo's own `.github/workflows/ci.yml` is deliberately out of
 * scope — inside the workspace the engine is a `workspace:^` symlink to
 * `packages/*`, so "which version resolved?" has no interesting answer.
 *
 * Bench-only: it reads the monorepo root and would be meaningless on a client
 * site.
 */

const REPO_ROOT = path.join(__dirname, "../../..")
const CI = path.join(REPO_ROOT, "apps/themes/.github/workflows/ci.yml")
const DIAGNOSTIC = "scripts/engine-versions.mjs"

type Step = { name?: string; run?: string; uses?: string; if?: string; "working-directory"?: string }
type Job = { needs?: string | string[]; if?: string; uses?: string; steps?: Step[] }

const workflow = parse(fs.readFileSync(CI, "utf8")) as { jobs?: Record<string, Job> }
const jobs = Object.entries(workflow.jobs ?? {})

/**
 * Installs the manifest the diagnostic reads.
 *
 * `working-directory` is what separates this from the `mobile` job, which runs
 * `pnpm install` against `mobile/package.json` — a manifest with no
 * `@be-yours/*` dependency in it, so the diagnostic would print "No
 * @be-yours/* dependency is declared." and answer nothing. A
 * `working-directory: .` is the repository root and still counts.
 *
 * Spelled loosely on purpose. An adversarial pass defeated `/\bpnpm install\b/`
 * by changing one job's step to `pnpm i --frozen-lockfile` and deleting the
 * diagnostic: the tree went straight back to the #389 shape and the guard
 * stayed green, silently dropping from eight assertions to five. `pnpm i`,
 * `corepack pnpm install`, `npm ci` and a composite action that installs are
 * all the same event — a manifest resolved from the registry.
 */
const INSTALL = /(?:^|[\s;&|])(?:corepack\s+)?(?:pnpm|npm|yarn)\s+(?:install|i|ci|add)\b/

function stepsOf(job: Job): Step[] {
  const steps = [...(job.steps ?? [])]
  // A local composite action is this repository's own code and is opaque to a
  // scan of the caller. Read it — `workflow-publish-gates.test.ts` had to learn
  // the same lesson.
  for (const step of job.steps ?? []) {
    if (!step.uses?.startsWith("./")) continue
    for (const candidate of ["action.yml", "action.yaml"]) {
      const file = path.join(REPO_ROOT, step.uses, candidate)
      if (!fs.existsSync(file)) continue
      const action = parse(fs.readFileSync(file, "utf8")) as { runs?: { steps?: Step[] } }
      steps.push(...(action.runs?.steps ?? []))
    }
  }
  return steps
}

function installsTheEngine(job: Job): boolean {
  return stepsOf(job).some(
    (step) =>
      INSTALL.test(step.run ?? "") &&
      (!step["working-directory"] || step["working-directory"] === "."),
  )
}

function diagnosticStep(job: Job): Step | undefined {
  return stepsOf(job).find((step) => (step.run ?? "").includes(DIAGNOSTIC))
}

const installing = jobs.filter(([, job]) => installsTheEngine(job))

test("the mirror's CI has jobs that install the engine", () => {
  // Guards the guard, and counts rather than merely existing. The earlier
  // version asserted "not empty", so silently dropping ONE installing job from
  // the set left it green while the assertion count fell from eight to five —
  // a guard quietly measuring less than it did yesterday is how this whole
  // class of defect survives.
  expect(installing.map(([id]) => id).sort()).toEqual(["e2e", "web"])
})

test("no job that installs the engine also carries a `uses:` we cannot read", () => {
  // A job that IS a `uses:` of another workflow has no steps of its own, so
  // `installsTheEngine` cannot see its install and the whole rule below skips
  // it. Refuse the shape rather than pretend to check it.
  const opaque = jobs.filter(([, job]) => job.uses && !job.uses.startsWith("./"))
  expect(opaque.map(([id]) => id)).toEqual([])
})

describe.each(installing)("apps/themes CI job %s", (_id, job) => {
  test("prints which engine versions it installed", () => {
    expect(diagnosticStep(job)).toBeDefined()
  })

  test("prints them even when the job failed", () => {
    // Without `always()` the diagnostic is skipped by the very failure it
    // exists to explain — the step-level version of the job-level mistake this
    // file is about.
    expect(diagnosticStep(job)?.if).toBe("always()")
  })

  test("prints them after the work, not beside the install", () => {
    // A red run is read from the END of its log. Placed beside `pnpm install`
    // this sits ~1400 lines from the end, which is the same as not printing it.
    //
    // "After the work" rather than "last": the trailing steps of a job are all
    // reporters — `Prove the suite actually ran`, `Upload Playwright report`,
    // `Convex backend log` — and they are recognisable by carrying a status
    // function of their own. Anything that does actual work must come first.
    const steps = job.steps ?? []
    const index = steps.findIndex((step) => (step.run ?? "").includes(DIAGNOSTIC))
    const doesWork = (step: Step) => !/\b(always|failure|cancelled|success)\(\)/.test(step.if ?? "")
    expect(steps.slice(index + 1).filter(doesWork).map((s) => s.name ?? s.uses)).toEqual([])
  })
})

test("the diagnostic ships with the template", () => {
  // `apps/themes` is published verbatim to `beyours-boilerplate`, where these
  // workflows run. A step calling a script the mirror does not carry is a job
  // that dies on `MODULE_NOT_FOUND` in every client repository.
  //
  // TRACKED, not merely present. The mirror publisher runs on
  // `actions/checkout`, which carries committed files only — so `existsSync`
  // answers a different question from the one that matters, and answers it
  // green over a tree where every client's CI would die.
  const tracked = execFileSync("git", ["ls-files", "--", `apps/themes/${DIAGNOSTIC}`], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim()
  expect(tracked, `apps/themes/${DIAGNOSTIC} is not committed; the mirror ships a checkout`).toBe(
    `apps/themes/${DIAGNOSTIC}`,
  )
})
