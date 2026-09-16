/**
 * A `push` mirror run does not go red because its own Release has not landed
 * yet (#559).
 *
 * WHAT HAPPENED. `publish-mirror.yml` runs on two triggers, deliberately:
 * `push` at merge, and `workflow_run` after `Release`. A commit that CUTS a
 * release is raced by its own `push` run — it reaches the registry before the
 * new versions are on it, pins the old ones, and the compile gate refuses a
 * template that would genuinely not build for a client.
 *
 * Measured on `0e9461f` (#557), the two runs for one commit:
 *
 *   549  push          21:52:07  pinned restaurant@^4.2.0  → refused
 *        Release #344  21:53:43  published restaurant@4.2.1
 *   550  workflow_run  21:59:54  pinned restaurant@^4.2.1  → pushed
 *
 * Ninety-six seconds. The refusal was right and the run was early, and `main`
 * kept a red `Publish mirror` for a commit that WAS delivered — which is
 * indistinguishable, at a glance, from the five-day outage #550 was about.
 *
 * WHY THIS TEST RUNS THE SCRIPT RATHER THAN READING IT. The grading job is
 * eleven lines of shell whose whole value is which exit code it picks in each
 * state. A regex over the YAML would assert that a branch exists, not that it
 * decides correctly — and the defect this guards against is not a missing
 * branch but a branch that swallows a real outage. So the `run:` block is
 * extracted from the workflow and executed, once per state, and the assertion
 * is the exit code.
 *
 * The two that matter most are the pair: a stand-down when a release is
 * pending, and a RED when one is not. A guard with only the first would turn
 * every genuinely refused sync green.
 */

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterAll, describe, expect, test } from "vitest"
import { parse } from "yaml"

const WORKFLOW = path.join(__dirname, "../../../.github/workflows/publish-mirror.yml")

/** The `report` job's grading script, as the runner would execute it. */
function gradingScript(): string {
  const workflow = parse(fs.readFileSync(WORKFLOW, "utf8")) as {
    jobs?: Record<string, { steps?: { name?: string; run?: string }[] }>
  }

  const steps = workflow.jobs?.report?.steps ?? []
  const grade = steps.find((step) => step.name === "Grade the run")
  return grade?.run ?? ""
}

const scriptPath = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "mirror-grade-")),
  "grade.sh"
)
fs.writeFileSync(scriptPath, gradingScript())

afterAll(() => {
  fs.rmSync(path.dirname(scriptPath), { recursive: true, force: true })
})

/** The state the `report` job reads, as environment. */
type State = {
  PUBLISH_RESULT: string
  SYNC_RAN: string
  OUTCOME: string
  CAN_PUSH: string
  DEFERRED: string
  CHECK_ONLY: string
  EVENT: string
}

const base: State = {
  PUBLISH_RESULT: "success",
  SYNC_RAN: "success",
  OUTCOME: "",
  CAN_PUSH: "true",
  DEFERRED: "false",
  CHECK_ONLY: "",
  EVENT: "push",
}

/** Run the grading script in one state. `true` means it graded the run green. */
function grades(state: Partial<State>): boolean {
  try {
    execFileSync("bash", [scriptPath], {
      env: { ...process.env, ...base, ...state, GITHUB_STEP_SUMMARY: "/dev/null" },
      stdio: "pipe",
    })
    return true
  } catch {
    return false
  }
}

describe("the mirror's push run defers to the Release that is about to publish", () => {
  test("the grading script was found and is not empty", () => {
    // Anti-vacuity: a renamed job or step would make every case below run an
    // empty file, which exits 0 and would read as "everything is green".
    const script = gradingScript()
    expect(script, "no `Grade the run` step in the report job").not.toBe("")
    expect(script).toContain("DEFERRED")
  })

  test("stands down when a Release for this commit has not published yet", () => {
    expect(
      grades({ EVENT: "push", DEFERRED: "true", SYNC_RAN: "skipped", OUTCOME: "" }),
      "a push run whose Release is still to publish must not go red: the " +
        "workflow_run run that follows it owns this commit"
    ).toBe(true)
  })

  test("still goes red when no Release is pending and the sync failed", () => {
    // The half that keeps the stand-down honest. Without this case, a branch
    // that always exited 0 would satisfy the test above.
    expect(
      grades({
        EVENT: "push",
        DEFERRED: "false",
        PUBLISH_RESULT: "failure",
        SYNC_RAN: "failure",
        OUTCOME: "failed",
      }),
      "a refused sync with no release coming is a real outage and must stay red"
    ).toBe(false)
  })

  test("still goes red when the push token is missing", () => {
    // A dry run on `main` delivers nothing. The stand-down reads the plan, not
    // the outcome, so this must be untouched by it.
    expect(
      grades({ EVENT: "push", DEFERRED: "false", CAN_PUSH: "false", OUTCOME: "" })
    ).toBe(false)
  })

  test("a person's dispatch is never stood down", () => {
    // A `workflow_dispatch` that is not a dry run is somebody asking for a sync
    // now. Grading that green because a release is pending would hand them the
    // exact ambiguity the report job was built to remove.
    expect(
      grades({
        EVENT: "workflow_dispatch",
        DEFERRED: "true",
        PUBLISH_RESULT: "failure",
        SYNC_RAN: "failure",
        OUTCOME: "failed",
      }),
      "a dispatch that synced nothing must say so"
    ).toBe(false)
  })

  test("the stand-down does not reach the workflow_run path", () => {
    // `DEFERRED` is empty there — the plan step is confined to the push path —
    // but a branch that read the event wrongly would hide a failed sync on the
    // one path that actually carries a release.
    expect(
      grades({
        EVENT: "workflow_run",
        DEFERRED: "true",
        PUBLISH_RESULT: "failure",
        SYNC_RAN: "failure",
        OUTCOME: "failed",
      }),
      "a failed sync after a Release must stay red whatever DEFERRED says"
    ).toBe(false)
  })

  test("a real push still reads as a delivery", () => {
    expect(grades({ EVENT: "push", OUTCOME: "pushed" })).toBe(true)
    expect(grades({ EVENT: "push", OUTCOME: "current" })).toBe(true)
  })

  test("the Release-published-nothing stand-down still passes", () => {
    expect(
      grades({ EVENT: "workflow_run", SYNC_RAN: "skipped", DEFERRED: "", OUTCOME: "" })
    ).toBe(true)
  })
})

describe("the sync itself is gated on the plan, not only the grading", () => {
  const workflow = () => fs.readFileSync(WORKFLOW, "utf8")

  test("the push path asks whether a Release will carry this commit", () => {
    // Grading alone would leave the job red: the run's conclusion is failure if
    // any job failed, so the sync has to stand down too, not just be forgiven.
    const yaml = parse(workflow()) as {
      jobs?: { publish?: { steps?: { name?: string; id?: string; if?: string; run?: string }[] } }
    }
    const steps = yaml.jobs?.publish?.steps ?? []

    const plan = steps.find((step) => step.id === "plan")
    expect(plan, "no `plan` step in the publish job").toBeDefined()
    expect(plan?.run).toContain("publish-plan.mjs")
    // `push` only. A `workflow_dispatch` is a person asking for a sync now, and
    // a green run that pushed nothing is the ambiguity `report` exists to end.
    expect(plan?.if, "the plan is the push path's question alone").toContain("'push'")

    const sync = steps.find((step) => step.id === "sync")
    expect(sync?.if, "the sync must read the plan").toContain("plan.outputs.publishing")
  })

  test("the plan runs before the sync it gates", () => {
    const steps = (parse(workflow()) as {
      jobs?: { publish?: { steps?: { id?: string }[] } }
    }).jobs?.publish?.steps ?? []

    const planAt = steps.findIndex((step) => step.id === "plan")
    const syncAt = steps.findIndex((step) => step.id === "sync")

    expect(planAt).toBeGreaterThan(-1)
    expect(syncAt).toBeGreaterThan(planAt)
  })

  test("the publish job publishes the plan's answer to the report job", () => {
    const outputs = (parse(workflow()) as {
      jobs?: { publish?: { outputs?: Record<string, string> } }
    }).jobs?.publish?.outputs ?? {}

    expect(outputs.deferred, "report cannot grade what publish does not expose").toContain(
      "plan.outputs.publishing"
    )
  })
})
