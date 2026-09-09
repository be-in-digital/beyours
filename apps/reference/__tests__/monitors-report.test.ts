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
type Job = { if?: string; steps?: Step[]; permissions?: Record<string, string> }
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

test("env-store-health survives the step that has actually been failing", () => {
  // The 401 was at the login step, and a step that aborts the job takes every
  // later step with it — including any reporting. So the workflow built to
  // report an unreachable store was, precisely when the store was unreachable,
  // unable to report anything. `continue-on-error` plus a reporter gated on
  // `always()` is what makes the failure survivable long enough to be told.
  const workflow = read("env-store-health.yml")
  const all = steps(workflow)

  const login = all.find((step) => /infisical login/.test(step.run ?? ""))
  expect(login, "the login step has gone").toBeDefined()
  expect(
    (login as Step & { "continue-on-error"?: boolean })["continue-on-error"],
    "the login step aborts the job, so nothing after it can report the failure"
  ).toBe(true)

  const reporter = all.find((step) => /gh issue (create|comment)/.test(step.run ?? ""))
  expect(reporter, "no reporting step").toBeDefined()
  expect(
    /always\(\)/.test(reporter?.if ?? ""),
    "the reporter is not gated on always(), so a failed step skips it"
  ).toBe(true)
})

test("env-store-health still fails the run when the store is unreachable", () => {
  // `continue-on-error` on the working steps means the job would otherwise show
  // GREEN while the store is down — trading one silence for a worse one.
  const workflow = read("env-store-health.yml")
  const verdict = steps(workflow).find((step) => /exit 1/.test(step.run ?? "") && /always\(\)/.test(step.if ?? ""))
  expect(
    verdict,
    "nothing fails the run after the reporting step, so an unreachable store reads as green"
  ).toBeDefined()
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
