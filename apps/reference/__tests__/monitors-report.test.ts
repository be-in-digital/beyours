/**
 * A monitor that cannot say anything is not a monitor.
 *
 * WHAT THIS HOLDS SHUT, measured on 2026-09-09.
 *
 * `env-store-health.yml` asks the Infisical store once a day whether it can
 * still answer. It had failed EVERY run it ever made — 2026-09-08 and
 * 2026-09-09, both `schedule`, both at "Log in as the CI machine identity":
 *
 *   error: unable to authenticate with universal auth
 *   [err=APIError: CallUniversalAuthLogin unsuccessful response
 *   [POST https://app.infisical.com/api/v1/auth/universal-auth/login]
 *   [status-code=401] [message="Invalid credentials"]]
 *
 * and told nobody. The file contained no `if: failure()` step, no
 * `gh issue create`, nothing. So the secrets store the whole fleet model
 * depends on could not be authenticated by CI, and the check built to say so
 * had been quietly red since the day it landed.
 *
 * The pattern was already in the repository: `mirror-health.yml` opens an issue
 * on failure, which is how #426 and #439 exist. It simply was not used here.
 *
 * WHY A TEST RATHER THAN A FIXED FILE. Because the next monitor will be written
 * the same way. A workflow whose whole purpose is to report a problem, and whose
 * only output is a red square in a tab nobody opens, looks finished to its
 * author and to review. This asserts the property that makes it a monitor:
 * there is a path from "the thing I watch is broken" to a human.
 */

import { expect, test } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { parse } from "yaml"

const WORKFLOW_DIR = path.join(__dirname, "../../../.github/workflows")

type Step = { id?: string; name?: string; run?: string; uses?: string; if?: string }
type Job = {
  if?: string
  needs?: string | string[]
  steps?: Step[]
  permissions?: Record<string, string>
}
type Workflow = { name?: string; on?: Record<string, unknown>; jobs?: Record<string, Job> }

const read = (file: string): Workflow =>
  parse(fs.readFileSync(path.join(WORKFLOW_DIR, file), "utf8")) as Workflow

/**
 * The workflows whose ONLY product is a finding.
 *
 * They run on a schedule, block no merge, and change nothing. If such a
 * workflow cannot reach a person, it does nothing at all — which is different
 * from `ci.yml`, whose red square stops a merge and is therefore its own
 * report.
 */
const MONITORS = ["env-store-health.yml", "mirror-health.yml"]

const steps = (workflow: Workflow): Step[] =>
  Object.values(workflow.jobs ?? {}).flatMap((job) => job.steps ?? [])

test.each(MONITORS)("%s exists and runs on a schedule", (file) => {
  const workflow = read(file)
  expect(workflow.on, `${file} has no triggers`).toBeDefined()
  expect(
    Object.keys(workflow.on ?? {}),
    `${file} is a monitor, so it has to fire on its own`
  ).toContain("schedule")
})

test.each(MONITORS)("%s can open an issue when what it watches is broken", (file) => {
  const workflow = read(file)
  const run = steps(workflow)
    .map((step) => step.run ?? "")
    .join("\n")
  expect(
    /gh issue (create|comment)/.test(run),
    `${file} reports nothing to anybody: it has no "gh issue create". A ` +
      `scheduled check that only goes red in the Actions tab is how ` +
      `env-store-health failed every run it ever made without a word.`
  ).toBe(true)
})

test.each(MONITORS)("%s is allowed to open one", (file) => {
  const workflow = read(file)
  // `permissions: issues: write` on the job or the workflow. Without it the
  // `gh issue create` above is a 403 at 06:15 every morning, which is the same
  // silence with more steps.
  const jobs = Object.values(workflow.jobs ?? {})
  const reporting = jobs.filter((job) =>
    (job.steps ?? []).some((step) => /gh issue (create|comment)/.test(step.run ?? ""))
  )
  expect(reporting.length, `${file} has no reporting job`).toBeGreaterThan(0)
  for (const job of reporting) {
    expect(
      job.permissions?.issues,
      `a job in ${file} runs "gh issue create" without "permissions: issues: write"`
    ).toBe("write")
  }
})

test("env-store-health reports even when the step that fails is the login", () => {
  /**
   * WHAT ACTUALLY FAILED, and a correction to what this test first asserted.
   *
   * Every run this workflow ever made went red at "Log in as the CI machine
   * identity" with `[status-code=401] [message="Invalid credentials"]`, and the
   * file carried no reporting at all — so the check built to say the secrets
   * store is unreachable was itself silent.
   *
   * This branch first concluded that a failing login "takes every later step
   * with it, including any reporting", and added `continue-on-error` plus an
   * `always()` reporter to work around it. THAT PREMISE WAS WRONG: a failed
   * step skips subsequent steps only where their condition does not admit
   * failure. `if: failure()` is exactly the condition that does — it is
   * defined as running when a previous step failed — so a plain
   * `if: failure()` reporter runs precisely when the login 401s, with no
   * `continue-on-error` anywhere.
   *
   * #446 landed that simpler shape, and it is the one asserted here: what
   * matters is not which mechanism is used but that the reporter's condition
   * ADMITS a failure, rather than being a plain expression that a failed step
   * skips.
   */
  const workflow = read("env-store-health.yml")
  const reporter = steps(workflow).find((step) =>
    /gh issue (create|comment)/.test(step.run ?? "")
  )
  expect(reporter, "no reporting step").toBeDefined()
  expect(
    /failure\(\)|always\(\)/.test(reporter?.if ?? ""),
    "the reporter's condition does not admit a failed step, so the one case it " +
      "exists for is the one case it is skipped in"
  ).toBe(true)
})

test("mirror-health does not title an issue with a fact it did not measure", () => {
  /**
   * #439 is the artefact of this. Its title asserts "the boilerplate is behind
   * apps/themes"; its own body says "`scripts/publish-mirror.mjs --check` did
   * not finish, so whether the mirror is current is unknown — this is not a
   * drift report." One `TITLE` env var served both outcomes, so a person
   * triaging from a list of titles is told a fact the body denies. #424's pull
   * request predicted this exact case before it happened.
   *
   * The two outcomes need different titles because they need different people:
   * drift is "run Publish mirror", a check that could not run is "this job
   * cannot reach the mirror", which no re-run fixes.
   */
  const workflow = read("mirror-health.yml")
  // The STALENESS reporter, not the observer next to it: both mention a run
  // that "did not finish", and only this one names the drift check.
  const reporter = steps(workflow).find((step) =>
    /publish-mirror\.mjs/.test(step.run ?? "") && /gh issue (create|comment)/.test(step.run ?? "")
  )
  expect(reporter, "the staleness reporter has gone").toBeDefined()

  const env = (reporter as Step & { env?: Record<string, string> }).env ?? {}
  const titles = Object.entries(env).filter(([key]) => /TITLE/.test(key))
  expect(
    titles.length,
    "the staleness reporter still has one title for both outcomes: a measured " +
      "drift and a check that could not run must not share a headline"
  ).toBeGreaterThan(1)

  // And the drift headline is only chosen when drift was actually found.
  const run = reporter?.run ?? ""
  expect(
    /grep -q "drift detected[^"]*"[\s\S]*?TITLE=/.test(run),
    "the title is not selected from what the check actually reported"
  ).toBe(true)
})

/**
 * A merged fix that reaches no client says so where somebody sees it.
 *
 * WHAT THIS HOLDS SHUT (#427, #389). `release.yml`'s `plan` job has always
 * computed `bump_owed` — "changesets are waiting and this push publishes
 * nothing" — and its only outputs were a `::warning::` annotation and a step
 * summary. Both are visible to whoever opens the run, and a push to `main` has
 * no pull request to annotate and no author to notify.
 *
 * Measured on 11 September 2026: six changesets sat on `main` for over an hour
 * with the mirror blocked behind them, `Release` went green four times in a row,
 * and the only thing that ever told anybody was `mirror-health.yml` opening an
 * issue AFTER a `Publish mirror` run had already failed. The warning printed on
 * every one of those four runs.
 *
 * WHY IT MUST NOT BE A GATE, and this is asserted rather than trusted to a
 * comment: the mirror's `workflow_run` path fires only on
 * `conclusion == 'success'`, so failing the Release would stop the sync it is
 * reporting on — the gate would cause the outage. So the property is "there is a
 * path to a human", not "the build goes red".
 */
const RELEASE = "release.yml"

test("Release reports an owed version bump to a person", () => {
  const workflow = read(RELEASE)
  const reporting = Object.values(workflow.jobs ?? {}).filter((job) =>
    (job.steps ?? []).some((step) => /gh issue (create|comment)/.test(step.run ?? "")),
  )
  expect(reporting.length, "no job in release.yml opens an issue").toBeGreaterThan(0)
})

test("and it fires on the verdict the plan job already computed", () => {
  // Not on a failure: this is the case where everything is green and nothing
  // shipped, which is the whole finding.
  const workflow = read(RELEASE)
  const job = Object.values(workflow.jobs ?? {}).find((entry) =>
    (entry.steps ?? []).some((step) => /gh issue (create|comment)/.test(step.run ?? "")),
  )
  expect(job?.if ?? "").toMatch(/bump_owed/)
})

test("the report is continue-on-error, so a refused issue does not hide it", () => {
  // The same reason the two monitors above carry it: this organisation forbids
  // Actions from opening pull requests and whether that extends to issues is not
  // something this repository can read.
  const workflow = read(RELEASE)
  const step = Object.values(workflow.jobs ?? {})
    .flatMap((job) => job.steps ?? [])
    .find((entry) => /gh issue (create|comment)/.test(entry.run ?? ""))
  expect((step as { "continue-on-error"?: boolean })?.["continue-on-error"]).toBe(true)
})

test("and the Release itself is not gated on it", () => {
  // Asserted, not left to the comment: failing on an owed bump would stop the
  // mirror sync, because `publish-mirror.yml`'s `workflow_run` path fires only
  // on a green Release. The gate would cause the outage it reports.
  const workflow = read(RELEASE)
  const publish = workflow.jobs?.["release"]
  expect(publish, "release.yml has no `release` job").toBeDefined()
  expect(JSON.stringify(publish?.needs ?? [])).not.toMatch(/owed-bump/)
})

/**
 * The client template's own CI says which engine it tested.
 *
 * WHAT THIS HOLDS SHUT (#389). `apps/themes/.github/workflows/ci.yml` is
 * published verbatim into `beyours-boilerplate`, where `package.json` pins
 * `"@be-yours/admin": "^9.0.0"` — a RANGE — while this repository links the
 * engine with `workspace:^` and tests the current source.
 *
 * So on 7 September 2026, #387 fixed `addChoice`, merged green here, and the
 * boilerplate's suite then failed three times on the spec that fix was written
 * for — while installing `admin@9.0.0`, the version from before it. The run read
 * as the fix failing. It was executing the unfixed component with the fixed
 * spec, and the log recorded the Playwright summary and the Convex backend and
 * never the resolved versions.
 *
 * The issue's own words: *"Three lines of YAML; it turns 'why is this red' from
 * an investigation into a glance."*
 */
test("the template's e2e job prints the engine versions it installed", () => {
  const template = parse(
    fs.readFileSync(
      path.join(__dirname, "../../themes/.github/workflows/ci.yml"),
      "utf8",
    ),
  ) as Workflow

  const e2e = template.jobs?.["e2e"]
  expect(e2e, "the template has no e2e job").toBeDefined()

  const printing = (e2e?.steps ?? []).filter((step) =>
    /@be-yours\//.test(step.run ?? ""),
  )
  expect(printing.length, "no step reads the installed engine versions").toBeGreaterThan(0)
})

test("and it prints them before anything can fail", () => {
  // A report that only runs after the build is absent from the log of a run
  // that died at the build — which is one of the ways this goes red.
  const template = parse(
    fs.readFileSync(
      path.join(__dirname, "../../themes/.github/workflows/ci.yml"),
      "utf8",
    ),
  ) as Workflow
  const steps = template.jobs?.["e2e"]?.steps ?? []

  const reportAt = steps.findIndex((step) => /@be-yours\//.test(step.run ?? ""))
  const buildAt = steps.findIndex((step) => /^pnpm build$/m.test(step.run ?? ""))

  expect(reportAt).toBeGreaterThanOrEqual(0)
  expect(buildAt).toBeGreaterThanOrEqual(0)
  expect(reportAt).toBeLessThan(buildAt)
})
