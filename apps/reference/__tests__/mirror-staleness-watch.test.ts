import { expect, test } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { parse } from "yaml"

/**
 * Something watches the mirror, and it is not the mirror.
 *
 * `be-in-digital/beyours-boilerplate` is the repository every client site is
 * cloned from and merges from with `pnpm update:template`. When it stops being
 * synced, nothing about this repository looks wrong: `main` is green, the last
 * `Publish mirror` run is in the Actions tab, and clients are simply on an
 * older template. That has now happened twice — twelve days once, and 90
 * minutes for #402's security floors, which reached no client until somebody
 * dispatched the sync by hand.
 *
 * Both times the run ended `cancelled`, which is the hole this file is about.
 * `cancelled` is neither a pass nor a failure, and — the part that makes it
 * unfixable from inside `publish-mirror.yml` — **a cancelled run executes
 * nothing at all**. Not an `if: failure()` step, not an `if: always()` job.
 * `timeout-minutes: 20` was added after the first incident and converts a
 * *hang* into a red job; it does nothing for a run somebody cancels, for a
 * queued run GitHub cancels when a third joins the concurrency group, or for a
 * sync that was never triggered.
 *
 * So the rule asserted here is not "mirror-health.yml exists". It is that the
 * two questions have an answer somewhere:
 *
 *   1. a workflow OTHER than the publisher observes the publisher's
 *      conclusions, and treats `cancelled` as actionable rather than as
 *      success;
 *   2. some workflow asks "is the mirror current?" on a schedule, without a
 *      human deciding to ask.
 *
 * The second matters on its own: `scripts/publish-mirror.mjs --check` has
 * existed for a long time — it clones the mirror, materialises the tree that
 * would be published and exits 1 on drift — and was reachable only through a
 * manual `workflow_dispatch`. A detector nobody runs detects nothing.
 *
 * Bench-only: it reads the monorepo root and would be meaningless on a client
 * site.
 */

const REPO_ROOT = path.join(__dirname, "../../..")
const WORKFLOW_DIR = path.join(REPO_ROOT, ".github/workflows")

/**
 * The template's own workflows, which are the CI every client site runs.
 *
 * `apps/themes/.github/workflows/` is published verbatim into
 * `beyours-boilerplate` and becomes the repository root there, so a step that
 * loses a failure in a pipe loses it in every client's build rather than in
 * ours. The pipefail rule below was written against this repository's
 * workflows alone and never looked at these — the same blind spot
 * `check:mirror-css` exists for one directory over.
 *
 * Only the pipefail assertion reads this list. The mirror-observer rules above
 * are about THIS repository publishing THAT one, and a client's clone
 * publishes nothing.
 */
const TEMPLATE_WORKFLOW_DIR = path.join(REPO_ROOT, "apps/themes/.github/workflows")

/** The workflow whose conclusions have to be watched. */
const PUBLISHER = "Publish mirror"

type Step = { id?: string; name?: string; run?: string; uses?: string; if?: string; shell?: string }
type Job = { if?: string; steps?: Step[] }
type Workflow = { name?: string; on?: Record<string, unknown>; jobs?: Record<string, Job> }

function readWorkflows(dir: string, label: string): { file: string; workflow: Workflow }[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
    .sort()
    .map((file) => ({
      file: `${label}${file}`,
      workflow: parse(fs.readFileSync(path.join(dir, file), "utf8")) as Workflow,
    }))
}

const workflows = readWorkflows(WORKFLOW_DIR, "")

/** Everything the pipefail rule judges: ours, and the one every client runs. */
const allWorkflows = [
  ...workflows,
  ...readWorkflows(TEMPLATE_WORKFLOW_DIR, "apps/themes/.github/workflows/"),
]

test("the publisher this file is about still exists", () => {
  // Guards the guard. Renaming `Publish mirror` would otherwise make every
  // assertion below pass by finding nothing to check.
  expect(workflows.map(({ workflow }) => workflow.name)).toContain(PUBLISHER)
})

/** Workflows listening for the publisher to finish, whatever its conclusion. */
const observers = workflows.filter(({ workflow }) => {
  const trigger = workflow.on?.["workflow_run"] as
    | { workflows?: string[]; types?: string[] }
    | undefined
  return (
    workflow.name !== PUBLISHER &&
    (trigger?.workflows ?? []).includes(PUBLISHER) &&
    (trigger?.types ?? []).includes("completed")
  )
})

test("another workflow observes the publisher's conclusions", () => {
  // It has to be another one. A cancelled run has no steps left to run, so the
  // publisher cannot report its own cancellation however its `if:` is written.
  expect(observers.map(({ file }) => file)).not.toEqual([])
})

test("the observer treats a cancelled sync as something to act on", () => {
  // The specific failure: `conclusion == 'success'` is the natural thing to
  // write and turns `cancelled` into silence — the same reading that let the
  // mirror sit twelve days stale.
  //
  // Matched as an EQUALITY, not a mention. An adversarial pass got a decoy past
  // the earlier version of this test with
  // `if: conclusion != 'cancelled'` — the exact inversion of the property —
  // because `.includes("cancelled")` is true of both.
  const conditions = observers.flatMap(({ workflow }) =>
    Object.values(workflow.jobs ?? {}).flatMap((job) => [
      job.if ?? "",
      ...(job.steps ?? []).map((step) => step.if ?? ""),
    ]),
  )
  const actsOnCancelled = /conclusion\s*==\s*'cancelled'/
  expect(conditions.some((condition) => actsOnCancelled.test(condition))).toBe(true)
  expect(
    conditions.filter((condition) => /conclusion\s*!=\s*'cancelled'/.test(condition)),
    "an observer that skips `cancelled` is the defect, not the fix",
  ).toEqual([])
})

/** A step GitHub can never reach — `if: false`, however it is spelled. */
function isDeadCondition(condition: string | undefined): boolean {
  return /^\s*(\$\{\{)?\s*false\s*(\}\})?\s*$/.test(condition ?? "x")
}

test("the observer can say so where somebody will see it", () => {
  // A red dot in the Actions tab is not a report. `security.yml` established
  // the shape: write the step summary, and carry it to an issue.
  //
  // Reachable steps only. The decoy that beat the earlier version of this test
  // carried both commands behind `if: ${{ false }}`, which satisfies a search
  // of the shell text and runs never.
  const shell = observers.flatMap(({ workflow }) =>
    Object.values(workflow.jobs ?? {}).flatMap((job) =>
      (job.steps ?? []).filter((step) => !isDeadCondition(step.if)).map((step) => step.run ?? ""),
    ),
  )
  expect(shell.some((run) => /gh issue (create|comment)/.test(run))).toBe(true)
  expect(shell.some((run) => run.includes("GITHUB_STEP_SUMMARY"))).toBe(true)
})

test("the observer retries the sync, and bounds the retry", () => {
  // `GITHUB_TOKEN` may create a `workflow_dispatch` — one of the two documented
  // exceptions to "events from GITHUB_TOKEN do not start workflows" — so a
  // retry is possible, and an earlier draft of this workflow wrongly said it
  // was not. Bounded, because an unbounded retry of a run that keeps being
  // cancelled is a loop.
  const steps = observers.flatMap(({ workflow }) =>
    Object.values(workflow.jobs ?? {}).flatMap((job) =>
      (job.steps ?? []).filter((step) => !isDeadCondition(step.if)),
    ),
  )
  const retry = steps.find((step) => /gh workflow run\s+publish-mirror\.yml/.test(step.run ?? ""))
  expect(retry, "nothing re-dispatches the sync").toBeDefined()
  expect(
    /workflow_run\.event\s*!=\s*'workflow_dispatch'/.test(retry?.if ?? ""),
    "the retry must not fire for a run that was itself a retry",
  ).toBe(true)
})

/**
 * The three rules #478 measured the cost of, in one hour on 11 September 2026.
 *
 * The mirror stopped at `2479f25` and stayed there through nine files of
 * `apps/themes`. `Publish mirror` failed twice on a real refusal, was cancelled
 * four times by retries joining its own concurrency group, and the run that
 * finally concluded `success` stood down without pushing. The issue collected
 * four comments, three of which describe superseded runs, and every one of them
 * promised that a retry would fix it.
 *
 * None of that was a missing observer. The observer worked. What it said was
 * wrong.
 */
const observerSteps = observers.flatMap(({ workflow }) =>
  Object.values(workflow.jobs ?? {}).flatMap((job) =>
    (job.steps ?? []).filter((step) => !isDeadCondition(step.if)),
  ),
)

test("the observer does not retry a conclusion a retry cannot change", () => {
  // `cancelled` and `timed_out` mean no step reached a verdict — re-running is
  // exactly right. `failure` means a step RAN and REFUSED, and the commonest
  // refusal here is the version-pin deadlock (#427, #389), which no number of
  // re-runs clears. #478 dispatched four into it.
  const retry = observerSteps.find((step) =>
    /gh workflow run\s+publish-mirror\.yml/.test(step.run ?? ""),
  )
  expect(retry, "nothing re-dispatches the sync").toBeDefined()
  expect(
    /conclusion\s*!=\s*'failure'/.test(retry?.if ?? ""),
    "a run that refused must not be retried into the same refusal",
  ).toBe(true)
})

/** The `gh run list` lookup that decides whether a cancellation is news. */
const supersessionLookup = observerSteps.find((step) =>
  /gh run list[^\n]*--commit/.test(step.run ?? ""),
)

/** Each `jq` selector inside that lookup, one per line it appears on. */
function selectors(): string[] {
  return (supersessionLookup?.run ?? "")
    .split("\n")
    .filter((line) => /select\(/.test(line))
}

test("the observer asks whether a run for the same commit already succeeded", () => {
  // The concurrency group cancels a queued run whenever a third joins it, so a
  // busy hour on `main` produces cancellations that say nothing about the
  // mirror. Reporting them is how a staleness alarm stops being read.
  expect(
    supersessionLookup,
    "nothing checks whether the cancellation was superseded, so every one is reported",
  ).toBeDefined()
  expect(
    /conclusion ==[^\n]*success/.test(supersessionLookup?.run ?? ""),
    "the lookup must ask for a SUCCESSFUL run, not merely another one",
  ).toBe(true)
})

test("a success counts whenever it ran, not only after the cancellation", () => {
  // #508. `aea6981` was published by a run at 18:34; a `workflow_run` for the
  // SAME commit was cancelled at 18:45. The lookup demanded
  // `.databaseId > RUN_ID`, saw no LATER success, and reported a stale mirror
  // that was already current — the sixth report of that title.
  //
  // The mirror is keyed on the COMMIT, not on run order. A successful run
  // pushed that tree and a cancellation afterwards cannot unpush it.
  const success = selectors().filter((line) => /conclusion ==[^\n]*success/.test(line))

  expect(success).toHaveLength(1)
  expect(
    /databaseId/.test(success[0] ?? ""),
    "the success arm must not be ordered against this run — an EARLIER success still means the mirror carries the tree",
  ).toBe(false)
})

test("a later run still going is left to report its own conclusion", () => {
  // Without this the observer reports every link in a chain it is itself
  // forging: the retry joins `concurrency: publish-mirror`, cancels the run in
  // flight, and that cancellation dispatches another retry. Measured on
  // `38b76bd6` — four runs, three cancelled by their own successor, on a commit
  // whose sync went on to succeed.
  const inFlight = selectors().filter((line) => /status !=[^\n]*completed/.test(line))

  expect(
    inFlight,
    "nothing notices that a successor is already running, so a burst reports once per run",
  ).toHaveLength(1)

  // This arm MUST stay ordered. An unfinished run reaches its own conclusion
  // and is observed in its turn, so the last run of a burst always reports and
  // no cancellation is swallowed. Drop the ordering and an EARLIER unfinished
  // run — there is no such thing, but a future edit could invent one — would
  // silence the alarm permanently.
  expect(
    /databaseId >/.test(inFlight[0] ?? ""),
    "only a LATER unfinished run supersedes: it is the one that will report next",
  ).toBe(true)
})

test("and it stays quiet when one did", () => {
  const report = observerSteps.find((step) =>
    /gh issue (create|comment)/.test(step.run ?? ""),
  )
  expect(report, "nothing reports a stale mirror").toBeDefined()
  expect(
    /superseded/.test(report?.if ?? ""),
    "the report must be gated on the supersession lookup, or the lookup changes nothing",
  ).toBe(true)
})

test("the report names the one cause a re-run cannot clear", () => {
  // `mirror-typecheck.mjs` prints this line, and only it, when the staged tree
  // needs a symbol the pinned version does not carry. The observer reads it
  // back out of the run it reports on rather than paraphrasing, so the two
  // cannot drift apart — which is why the same string is asserted on both
  // sides here.
  const marker = "would NOT compile for a client"
  const publisher = fs.readFileSync(
    path.join(REPO_ROOT, "scripts/lib/mirror-typecheck.mjs"),
    "utf8",
  )
  expect(
    publisher.includes(marker),
    "the publisher no longer prints the line the observer greps for",
  ).toBe(true)
  expect(
    observerSteps.some((step) => (step.run ?? "").includes(marker)),
    "the observer does not recognise the version-pin deadlock, so it reports it as a stall",
  ).toBe(true)
})

test("something asks whether the mirror is current, on a schedule", () => {
  // The backstop, and the half that does not depend on a conclusion existing to
  // observe: a sync that was never triggered at all produces no run and no
  // event. `--check` is the read-only mode — it pushes nothing, which is why
  // `workflow-publish-gates.test.ts` exempts it from the publishing rule.
  const scheduled = workflows.filter(({ workflow }) => workflow.on?.["schedule"])
  const checks = scheduled.filter(({ workflow }) =>
    Object.values(workflow.jobs ?? {}).some((job) =>
      (job.steps ?? []).some((step) => /publish-mirror\.mjs.*--check/.test(step.run ?? "")),
    ),
  )
  expect(checks.map(({ file }) => file)).not.toEqual([])
})

/**
 * Whether a `run:` block contains a real shell pipeline.
 *
 * Spelled out rather than `/\S\s\|\s\S/`, which is what this was: that
 * pattern needs a space on BOTH sides, so `2>&1|tee /tmp/log` — the same
 * command, two characters shorter — was invisible to it. Removing the spaces
 * and the `set -o pipefail` left the suite 8/8 green over exactly the defect
 * it was written for.
 *
 * What has to be excluded instead is everything that is a `|` but not a
 * pipeline, and the list is short and closed:
 *
 *   - `||`, which is an or-else and never loses a status;
 *   - `|&`, bash's shorthand for `2>&1 |`, which IS a pipeline and stays;
 *   - a `|` inside single or double quotes — a regex handed to `grep`, an
 *     alternation in a `sed` script, a Markdown table in an `echo`;
 *   - a `|` in a comment line, which the shell never sees;
 *   - YAML's own `run: |` block scalar, which the parser has already consumed
 *     by the time we see the string, so it cannot appear here at all.
 */
function hasPipeline(run: string): boolean {
  return run.split("\n").some((rawLine) => {
    const line = rawLine.trim()
    if (line.startsWith("#")) return false

    let quote: string | null = null
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!
      if (ch === "\\") {
        i++
        continue
      }
      if (quote) {
        if (ch === quote) quote = null
        continue
      }
      if (ch === "'" || ch === '"') {
        quote = ch
        continue
      }
      if (ch !== "|") continue
      // `||` is an or-else: skip both characters so the second `|` is not
      // read as a pipeline on its own.
      if (line[i + 1] === "|") {
        i++
        continue
      }
      // A bare `|` at the end of a line is bash's line continuation: the
      // right-hand side is on the next line, and it is still a pipeline.
      return true
    }
    return false
  })
}

test("a step whose exit code is read survives its own pipeline", () => {
  // The defect this catches shipped in the first draft of `mirror-health.yml`:
  //
  //   run: node scripts/publish-mirror.mjs --check 2>&1 | tee /tmp/…
  //
  // GitHub's default `run:` shell on Linux is `bash -e {0}` — NOT
  // `-o pipefail`, which you get only by writing `shell: bash`. So the step
  // reported *tee's* status, `--check`'s exit 1 was swallowed, the reporting
  // step behind `if: failure()` never ran, and the daily job was a no-op in the
  // one case it exists for. Measured: `bash -e` on a failing pipeline exits 0.
  //
  // The rule, not the repair: any step another condition reads the outcome of
  // must not lose a failure in a pipe.
  //
  // Two ways this rule was evaded, both found by an audit rather than by a
  // failure:
  //
  //  - `apps/themes/.github/workflows/` was not read at all. That is the CI
  //    every CLIENT runs, published verbatim into the boilerplate, so a
  //    swallowed failure there is worse than one here. `allWorkflows` now
  //    covers both.
  //  - The detector required spaces around the pipe, so removing two
  //    characters walked through it: `2>&1|tee /tmp/log` with `pipefail` gone
  //    passed all eight cases. A guard a formatting change defeats is not a
  //    guard.
  for (const { file, workflow } of allWorkflows) {
    for (const [id, job] of Object.entries(workflow.jobs ?? {})) {
      const conditions = (job.steps ?? []).map((step) => step.if ?? "").join(" ")
      for (const step of job.steps ?? []) {
        const run = step.run ?? ""
        if (!hasPipeline(run) || run.includes("|| true")) continue
        const read =
          (step.id && conditions.includes(`steps.${step.id}.`)) || conditions.includes("failure()")
        if (!read) continue
        expect(
          step.shell === "bash" || /set -[a-z]*o pipefail|set -o pipefail/.test(run),
          `${file}: job ${id}, step "${step.name ?? step.id}" pipes but does not set pipefail, ` +
            `so a failure on the left of the pipe reports success`,
        ).toBe(true)
      }
    }
  }
})

test.each([
  // The evasion the audit measured: the same command, two spaces shorter.
  ["node scripts/publish-mirror.mjs --check 2>&1|tee /tmp/mirror.log", true],
  ["node scripts/publish-mirror.mjs --check 2>&1 | tee /tmp/mirror.log", true],
  ["set -euo pipefail\ncurl -s https://x |jq .", true],
  // `|&` is bash for `2>&1 |`. Still a pipeline.
  ["make build |& tee build.log", true],
  // A pipeline continued onto the next line.
  ["cat file |\n  grep -c x", true],
  // Not pipelines.
  ["pnpm test || echo failed", false],
  ["pnpm build", false],
  // A `|` inside quotes: a regex, an alternation, a Markdown table.
  ['grep -E "a|b" file', false],
  ["sed 's/a|b/c/' file", false],
  ['echo "| col | col |" >> "$GITHUB_STEP_SUMMARY"', false],
  // A commented-out pipeline. The shell never sees it.
  ["# node scripts/publish-mirror.mjs | tee /tmp/log\npnpm test", false],
])("recognises %j as a pipeline: %s", (run, expected) => {
  // The detector on its own, because the workflow sweep above can only fail on
  // a defect somebody has already committed — and the first version of this
  // rule was defeated by a formatting change nobody would think to commit
  // deliberately.
  expect(hasPipeline(run)).toBe(expected)
})

test("the template's own workflows are inside the pipefail rule", () => {
  // The other half of the audit: `apps/themes/.github/workflows/` is the CI
  // every CLIENT runs, published verbatim into the boilerplate, and the sweep
  // above never read it. A rule that skips the tree it matters most in is a
  // rule about this repository's convenience.
  const template = allWorkflows.filter(({ file }) =>
    file.startsWith("apps/themes/.github/workflows/"),
  )
  expect(template.map(({ file }) => file)).not.toEqual([])
  // And they parsed — an unreadable file would silently contribute no steps.
  expect(template.every(({ workflow }) => Object.keys(workflow.jobs ?? {}).length > 0)).toBe(true)
})

test("the staleness check does not join the publisher's concurrency group", () => {
  // A check that shares the group would be cancelled by the very sync it is
  // there to watch — and would then report nothing, in exactly the way this
  // file exists to prevent.
  const publisher = workflows.find(({ workflow }) => workflow.name === PUBLISHER)
  const group = (publisher?.workflow as { concurrency?: unknown } | undefined)?.concurrency
  const publisherGroup = typeof group === "string" ? group : (group as { group?: string })?.group

  for (const { file, workflow } of observers) {
    const own = (workflow as { concurrency?: unknown }).concurrency
    const ownGroup = typeof own === "string" ? own : (own as { group?: string } | undefined)?.group
    expect(ownGroup, `${file} shares the publisher's concurrency group`).not.toBe(publisherGroup)
  }
})

/**
 * The staleness check can reach the mirror, or says out loud that it cannot.
 *
 * WHAT WAS BROKEN (#439, #426, #459). `--check` clones
 * `be-in-digital/beyours-boilerplate`, that repository is PRIVATE, and this
 * job deliberately holds no `MIRROR_PUSH_TOKEN` — so it cloned anonymously and
 * every run of its life died at
 * `fatal: could not read Username for 'https://github.com'`. The check written
 * to notice a stale mirror has never once said whether the mirror was stale,
 * and it filed an issue saying so every morning. Three of them are open.
 *
 * The fix is a SECOND credential, not the push one: `MIRROR_READ_TOKEN`,
 * `contents: read` and nothing else. That distinction is the whole design —
 * `workflow-publish-gates.test.ts` requires any job holding the push token to
 * be gated on CI, because such a job can reach every client site, and gating a
 * daily question behind a twelve-minute suite makes a tool nobody reaches for
 * twice.
 *
 * And when the secret is absent the job must neither fail nor pretend: it
 * skips the clone and writes what it could not do into the step summary.
 */
const staleJob = (() => {
  const health = workflows.find(({ file }) => file === "mirror-health.yml")
  if (!health) return undefined
  return Object.values(health.workflow.jobs ?? {}).find((job) =>
    (job.steps ?? []).some((step) => /publish-mirror\.mjs.*--check/.test(step.run ?? "")),
  )
})()

test("the staleness check has a credential for a private mirror", () => {
  expect(staleJob).toBeDefined()
  const serialised = JSON.stringify(staleJob)
  // The clone is authenticated. Without this the job cannot answer its own
  // question at all, which is the state #439 and #459 report.
  expect(serialised).toMatch(/secrets\.MIRROR_READ_TOKEN/)
})

test("and it is the read-only one, never the push token", () => {
  // A job that can push to the mirror can reach every client site, and
  // `workflow-publish-gates.test.ts` refuses that to any job not gated on CI.
  // This job runs daily on a schedule and is gated on nothing, so it must hold
  // no such capability.
  expect(JSON.stringify(staleJob)).not.toMatch(/secrets\.MIRROR_PUSH_TOKEN/)
})

test("without that secret it skips rather than failing every night", () => {
  // The check must not run when it cannot succeed. A step that fails daily
  // over a missing credential is not a signal about the mirror; it is noise
  // that buries one.
  const check = (staleJob?.steps ?? []).find((step) =>
    /publish-mirror\.mjs.*--check/.test(step.run ?? ""),
  )
  expect(check?.if).toMatch(/steps\.[A-Za-z0-9_-]+\.outputs\./)
})

test("and it says in its own summary that it did not look", () => {
  // Skipping silently would be worse than failing: a green job with no output
  // reads as "the mirror is current". So the same absence that switches the
  // check off has to write what it could not do where a person sees it, and
  // name the secret to add.
  const steps = staleJob?.steps ?? []
  const skipNotice = steps.find(
    (step) =>
      /GITHUB_STEP_SUMMARY/.test(step.run ?? "") &&
      /MIRROR_READ_TOKEN/.test(step.run ?? "") &&
      typeof step.if === "string" &&
      /!=\s*'true'|==\s*'false'/.test(step.if),
  )
  expect(skipNotice).toBeDefined()
})

test("`publish-mirror.mjs` actually reads the secret the workflow passes", () => {
  // The workflow can set an env var the script ignores, and everything above
  // would still pass while the clone stayed anonymous. This is the seam.
  const script = fs.readFileSync(path.join(REPO_ROOT, "scripts/publish-mirror.mjs"), "utf8")
  expect(script).toMatch(/process\.env\.MIRROR_READ_TOKEN\b(?!_)/)
})
