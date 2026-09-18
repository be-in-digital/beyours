/**
 * Something asks whether the mirror passes its OWN tests (#517).
 *
 * WHAT WAS MISSING. `mirror-health.yml` asks two questions and neither is this
 * one. The observer job fires on a non-success conclusion of *our* `Publish
 * mirror` run; the staleness job asks whether the mirror is CURRENT. Measured
 * on 15 September 2026 at `6707b699`: the boilerplate's CI had failed four runs
 * in a row while `Publish mirror` succeeded here — so the observer was skipped,
 * the mirror was current, and a red client template was reported to nobody.
 *
 * Current and red is the combination neither existing job can see, and it is
 * the one that matters most: every client repository is cloned from that tree
 * and merges from it with `pnpm update:template`.
 *
 * WHY THE DECISION IS A PURE FUNCTION. What goes wrong in a job like this is
 * never the API call — it is the reading of the answer. A run still in flight
 * read as red opens an issue every morning the sync happens to be running; a
 * token without `actions: read` read as green is the exact silence this closes.
 * So the three-way decision lives in `scripts/lib/mirror-ci.mjs` and is tested
 * here without a network or a token.
 */

import { describe, expect, test } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { parse } from "yaml"
import {
  classifyMirrorCi,
  failedJobNames,
} from "../../../scripts/lib/mirror-ci.mjs"

const REPO_ROOT = path.join(__dirname, "../../..")
const WORKFLOW = path.join(REPO_ROOT, ".github/workflows/mirror-health.yml")

function run(over: Record<string, unknown> = {}) {
  return {
    status: "completed",
    conclusion: "success",
    name: "Lint + Test + Build",
    html_url: "https://github.com/be-yours/beyours-boilerplate/actions/runs/1",
    head_sha: "d51b209f",
    ...over,
  }
}

describe("reading the mirror's latest CI run", () => {
  test("a successful run is green", () => {
    expect(classifyMirrorCi({ workflow_runs: [run()] }).state).toBe("green")
  })

  test("a failed run is red", () => {
    // The measured case: four of these in a row, reported to nobody.
    expect(
      classifyMirrorCi({ workflow_runs: [run({ conclusion: "failure" })] }).state
    ).toBe("red")
  })

  test("a cancelled, timed-out or startup-failed run is red too", () => {
    // None of the three is a pass, and a template nobody could build is as
    // unusable to a client as one whose tests fail.
    for (const conclusion of ["cancelled", "timed_out", "startup_failure", "action_required"]) {
      expect(
        classifyMirrorCi({ workflow_runs: [run({ conclusion })] }).state,
        conclusion
      ).toBe("red")
    }
  })

  test("a run still in flight is unknown, not red", () => {
    /*
     * The false alarm this avoids. The health schedule is at 05:40 and a sync
     * can be mid-flight; calling that red opens an issue every morning it
     * happens, which is how a report trains its readers to mute it.
     */
    for (const status of ["in_progress", "queued", "waiting", "requested"]) {
      expect(
        classifyMirrorCi({ workflow_runs: [run({ status, conclusion: null })] }).state,
        status
      ).toBe("unknown")
    }
  })

  test("a skipped or neutral run is unknown", () => {
    // A workflow that decided not to run says nothing about the tree.
    for (const conclusion of ["skipped", "neutral", "stale"]) {
      expect(
        classifyMirrorCi({ workflow_runs: [run({ conclusion })] }).state,
        conclusion
      ).toBe("unknown")
    }
  })

  test("no runs at all is unknown", () => {
    expect(classifyMirrorCi({ workflow_runs: [] }).state).toBe("unknown")
  })

  test("an answer we could not get is unknown, and never green", () => {
    /*
     * THE DIRECTION THAT MATTERS. `MIRROR_READ_TOKEN` unset, a token without
     * `actions: read`, a 404, a rate limit — every one of them has to read as
     * "we could not ask". Read as green, this job is the silence it exists to
     * end; read as red, it files an issue every day that no re-run can clear.
     */
    for (const payload of [null, undefined, {}, { workflow_runs: null }]) {
      expect(classifyMirrorCi(payload as never).state).toBe("unknown")
    }
  })

  test("says why, whenever it could not tell", () => {
    // A verdict of "unknown" with no reason is a job that ran and reported
    // nothing, which reads exactly like a job that found nothing.
    for (const payload of [null, {}, { workflow_runs: [] }]) {
      const verdict = classifyMirrorCi(payload as never)
      expect(verdict.state).toBe("unknown")
      expect(verdict.reason, JSON.stringify(payload)).toBeTruthy()
    }
  })

  test("carries the run it judged, so the report can link it", () => {
    const verdict = classifyMirrorCi({ workflow_runs: [run({ conclusion: "failure" })] })
    expect(verdict.run?.html_url).toContain("beyours-boilerplate")
  })
})

describe("naming what broke", () => {
  test("lists the jobs that did not pass", () => {
    // « the mirror's CI is red » with no job names leaves the reader exactly
    // the work the report was meant to save.
    const names = failedJobNames({
      jobs: [
        { name: "Lint", status: "completed", conclusion: "success" },
        { name: "Test", status: "completed", conclusion: "failure" },
        { name: "E2E Tests (themes 3/8)", status: "completed", conclusion: "timed_out" },
      ],
    })
    expect(names).toEqual(["Test", "E2E Tests (themes 3/8)"])
  })

  test("ignores a job still running", () => {
    expect(
      failedJobNames({ jobs: [{ name: "Test", status: "in_progress", conclusion: null }] })
    ).toEqual([])
  })

  test("answers with an empty list rather than throwing on a shape it did not expect", () => {
    // This runs inside a reporting step. Throwing here loses the finding it was
    // called to describe.
    for (const payload of [null, undefined, {}, { jobs: "nope" }]) {
      expect(failedJobNames(payload as never)).toEqual([])
    }
  })
})

describe("the workflow that uses it", () => {
  const workflow = parse(fs.readFileSync(WORKFLOW, "utf8")) as {
    on?: Record<string, unknown>
    jobs?: Record<string, { name?: string; if?: string; steps?: { run?: string; name?: string }[] }>
  }

  test("has a job asking whether the mirror's own CI passes", () => {
    const job = Object.values(workflow.jobs ?? {}).find((entry) =>
      (entry.steps ?? []).some((step) => /mirror-ci\.mjs|check:mirror-ci/.test(step.run ?? ""))
    )
    expect(job, "no mirror-health job reads the mirror's CI conclusion").toBeDefined()
  })

  test("runs it on the schedule, not on a Publish mirror conclusion", () => {
    /*
     * The whole point. The observer half is gated on OUR run's conclusion, and
     * the measured incident had our run succeeding — so a job gated the same
     * way would have been skipped in exactly the case it exists for.
     */
    const job = Object.entries(workflow.jobs ?? {}).find(([, entry]) =>
      (entry.steps ?? []).some((step) => /mirror-ci\.mjs|check:mirror-ci/.test(step.run ?? ""))
    )?.[1]

    expect(job?.if ?? "").not.toMatch(/workflow_run\.conclusion/)
    expect(workflow.on).toHaveProperty("schedule")
  })

  test("asks on the same schedule whether a release is still owed (#519)", () => {
    /*
     * `--fail-waiting` existed at `check-source-drift.mjs:99` with no caller.
     * #519 asked for it in the required `Lint` job; measured on 15 September
     * 2026 at `a92a0e51`, `@be-yours/admin` was `waiting`, so that
     * placement would have turned `main` itself red that day and every branch
     * off it. `waiting` is not a defect — batching fixes into one release is
     * the intended workflow — it is a CLOCK, and a daily question is the right
     * shape for a clock. A red here blocks nobody's merge.
     */
    const job = Object.values(workflow.jobs ?? {}).find((entry) =>
      (entry.steps ?? []).some((step) => /--fail-waiting/.test(step.run ?? ""))
    )

    expect(job, "nothing passes --fail-waiting").toBeDefined()
    expect(job?.if ?? "").not.toMatch(/workflow_run\.conclusion/)
  })

  test("and not in the required Lint job, which would red-line main", () => {
    // The anti-regression for the paragraph above: the argument is only worth
    // as much as the thing that keeps it true.
    const ci = fs.readFileSync(path.join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8")
    expect(ci).not.toMatch(/--fail-waiting/)
  })

  test("fetches full history, or the check cannot answer at all", () => {
    // `check-source-drift` finds each bump with `git log -G`, and a depth-1
    // clone has no commit to find: it reports `unknown` and the job answers
    // nothing while looking like it answered.
    const source = fs.readFileSync(WORKFLOW, "utf8")
    const at = source.indexOf("release-waiting:")
    expect(at, "the release-waiting job is gone").toBeGreaterThan(-1)
    expect(source.slice(at, at + 2_000)).toMatch(/fetch-depth:\s*0/)
  })
})
