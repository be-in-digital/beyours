import { describe, expect, test } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { parse } from "yaml"

/**
 * No workflow may publish anything outside this repository without CI passing
 * first.
 *
 * `publish-mirror.yml` did. It triggers on every push to `main` that touches
 * `apps/themes/**`, and the job carried no `needs:` — its only `if:` guarded
 * the `workflow_run` path. So a push rsynced `apps/themes` to
 * `be-in-digital/beyours-boilerplate` IN PARALLEL with the checks that would
 * have said it was broken, and that repository is the one every client site is
 * cloned from and merges from with `pnpm update:template`. Branch protection
 * did not close it either: `enforce_admins` is off and zero reviews are
 * required, so the person doing the merging can push straight to `main`.
 *
 * `release.yml` had the identical shape and was fixed first, which is exactly
 * why this file exists rather than a second one-line `needs:`. Two workflows
 * grew the same hole independently; the third will too. What is asserted here
 * is not "publish-mirror has a needs:" but the rule — **any** job that runs a
 * publishing command is gated — so a workflow added next year is measured
 * against it without anyone remembering this paragraph.
 *
 * Bench-only, like `mirror-publisher.test.ts`: it reads the monorepo root and
 * would be meaningless on a client site.
 */

const REPO_ROOT = path.join(__dirname, "../../..")
const WORKFLOW_DIR = path.join(REPO_ROOT, ".github/workflows")

type Step = { run?: string; uses?: string; with?: Record<string, unknown> }
type Job = {
  name?: string
  needs?: string | string[]
  if?: string
  uses?: string
  steps?: Step[]
  permissions?: unknown
}
type Concurrency = string | { group?: string; "cancel-in-progress"?: unknown }
type Workflow = {
  name?: string
  on?: unknown
  concurrency?: Concurrency
  jobs?: Record<string, Job>
}

function readWorkflow(file: string): Workflow {
  return parse(fs.readFileSync(path.join(WORKFLOW_DIR, file), "utf8")) as Workflow
}

const WORKFLOW_FILES = fs
  .readdirSync(WORKFLOW_DIR)
  .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
  .sort()

/**
 * What counts as reaching outside this repository.
 *
 * Two independent rules, because one of them is defeatable and the other is
 * not. An adversarial pass got FOUR ungated publishers past the command rule
 * alone, each of them 19/19 green: a raw `git clone … && git push` (the same
 * effect as the script, spelled differently), the publish moved behind a local
 * composite action, a job that is itself a `uses:` of another workflow so it
 * has no `steps` to scan, and `run: pnpm mirror:sync` behind a package.json
 * alias. Broadening the regexes chases each of those and invites a fifth.
 *
 * So the second rule is about CAPABILITY rather than spelling: the mirror push
 * is impossible without `MIRROR_PUSH_TOKEN`, and publishing to GitHub Packages
 * is impossible without `packages: write`. A job that holds neither cannot
 * reach outside this repository however its commands are written; a job that
 * holds either must be gated whatever it claims to do with them.
 */
const PUBLISHING_COMMANDS: ReadonlyArray<{ pattern: RegExp; what: string }> = [
  { pattern: /changeset\s+publish/, what: "publishes packages to GitHub Packages" },
  { pattern: /\b(npm|pnpm|yarn)\s+(-r\s+|--recursive\s+)?publish\b/, what: "publishes packages to a registry" },
  { pattern: /publish-mirror\.mjs(?!.*--check)/, what: "pushes apps/themes to beyours-boilerplate" },
  // `git push` is now included. It used to be excluded because `release.yml`
  // pushes its own tags here — but that job is gated, so including it costs
  // nothing and closes the "clone the mirror and push it by hand" hole.
  { pattern: /git\s+push\b/, what: "pushes commits or tags" },
]

/** Every shell command a job runs, following local composite actions. */
function shellOf(job: Job, wf: Workflow): string[] {
  const commands: string[] = []
  for (const step of job.steps ?? []) {
    if (step.run) commands.push(step.run)
    // A local composite action is this repository's own code and is opaque to a
    // scan of the caller. Read it.
    if (step.uses?.startsWith("./")) {
      for (const candidate of ["action.yml", "action.yaml"]) {
        const file = path.join(REPO_ROOT, step.uses, candidate)
        if (!fs.existsSync(file)) continue
        const action = parse(fs.readFileSync(file, "utf8")) as { runs?: { steps?: Step[] } }
        for (const inner of action.runs?.steps ?? []) if (inner.run) commands.push(inner.run)
      }
    }
  }
  // A job that IS a `uses:` of another workflow has no steps of its own; what
  // it runs is that workflow's jobs.
  if (job.uses?.startsWith("./") && job.uses.endsWith(".yml")) {
    const file = path.join(REPO_ROOT, job.uses)
    if (fs.existsSync(file)) {
      const called = parse(fs.readFileSync(file, "utf8")) as Workflow
      for (const inner of Object.values(called.jobs ?? {})) commands.push(...shellOf(inner, called))
    }
  }
  return commands
}

/** Root package.json scripts, so `pnpm <alias>` is read as what it runs. */
const ROOT_SCRIPTS: Record<string, string> = (
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as {
    scripts?: Record<string, string>
  }
).scripts ?? {}

/** Expands `pnpm <alias>` / `npm run <alias>` one level, then matches. */
function expandAliases(command: string): string {
  return command.replace(
    /\b(?:pnpm(?:\s+run)?|npm\s+run|yarn(?:\s+run)?)\s+([a-z][\w:-]*)/g,
    (whole, alias: string) => (alias in ROOT_SCRIPTS ? `${whole} ${ROOT_SCRIPTS[alias]}` : whole),
  )
}

/** The tokens and permissions that make a job able to reach outside this repo. */
const OUTWARD_CAPABILITIES: ReadonlyArray<{ pattern: RegExp; what: string }> = [
  { pattern: /secrets\.MIRROR_PUSH_TOKEN/, what: "holds MIRROR_PUSH_TOKEN, which can only push to the client mirror" },
]

function publishingStepsOf(job: Job, wf: Workflow): string[] {
  const found: string[] = []
  for (const raw of shellOf(job, wf)) {
    const command = expandAliases(raw)
    for (const { pattern, what } of PUBLISHING_COMMANDS) {
      if (pattern.test(command)) found.push(what)
    }
  }

  // Capability: read the job whole, so a token referenced anywhere in it —
  // a step env, a job env, a `with:` — counts.
  const serialised = JSON.stringify(job)
  for (const { pattern, what } of OUTWARD_CAPABILITIES) {
    if (pattern.test(serialised)) found.push(what)
  }
  if ((job.permissions as Record<string, string> | undefined)?.packages === "write") {
    found.push("holds packages: write, so it can publish to GitHub Packages")
  }

  return [...new Set(found)]
}

/** The reusable-workflow call that runs Lint / Type Check / Test / Build. */
function callsCi(job: Job): boolean {
  return typeof job.uses === "string" && job.uses.endsWith(".github/workflows/ci.yml")
}

describe("every workflow that publishes outside this repository is gated on CI", () => {
  const publishing = WORKFLOW_FILES.flatMap((file) => {
    const wf = readWorkflow(file)
    return Object.entries(wf.jobs ?? {})
      .map(([id, job]) => ({ file, id, job, effects: publishingStepsOf(job, wf) }))
      .filter((entry) => entry.effects.length > 0)
  })

  /**
   * If this drops to zero the rule above has stopped being enforced — either the
   * publishing steps were renamed out from under `PUBLISHING_COMMANDS`, or the
   * workflows moved. Either way every assertion below would pass vacuously.
   */
  test("the scan finds the jobs that publish", () => {
    expect(publishing.map((p) => `${p.file}:${p.id}`)).toEqual([
      "publish-mirror.yml:publish",
      "release.yml:release",
    ])
  })

  test.each(publishing)("$file / $id declares needs:", ({ job, effects }) => {
    const needs = typeof job.needs === "string" ? [job.needs] : (job.needs ?? [])
    expect(
      needs,
      `this job ${effects.join(" and ")} — it must wait on a CI job`,
    ).not.toHaveLength(0)
  })

  test.each(publishing)("$file / $id waits on a job that calls ci.yml", ({ file, job }) => {
    const wf = readWorkflow(file)
    const needs = typeof job.needs === "string" ? [job.needs] : (job.needs ?? [])
    const gates = needs.filter((id) => callsCi(wf.jobs?.[id] ?? {}))
    expect(
      gates,
      `none of [${needs.join(", ")}] calls ./.github/workflows/ci.yml, so nothing here runs Lint / Type Check / Test / Build`,
    ).not.toHaveLength(0)
  })
})

/**
 * A gate a job does not WAIT for is not a gate.
 *
 * WHAT WAS BROKEN. `publish-mirror.yml`'s `publish` job reads
 * `needs.delivered.result` twice in its `if:`, and three of the scenarios below
 * prove those clauses decide the run. All of it is inert unless `delivered` is
 * in that job's `needs:` list. The `needs` context holds only the jobs a job
 * DECLARES, so `needs.delivered.result` on a job that does not need
 * `delivered` reads as the empty string — `!= 'failure'` and `!= 'cancelled'`
 * are then both true and the gate passes on every run. Worse than passing: an
 * undeclared job is never waited for either, so `publish` would start alongside
 * `delivered` and could finish syncing the mirror before the delivered tree had
 * finished building.
 *
 * Measured at 29463f30: editing `needs: [verify, e2e, delivered]` to
 * `needs: [verify, e2e]` left this file at 61 tests, all green. The one gate
 * between a broken template and every client site was removable by a one-token
 * edit the required suite approved.
 *
 * TWO ASSERTIONS, because they fail on different edits. The rule catches an
 * `if:` that outlived its `needs:` — that one-token edit — for every job in
 * every workflow, including ones written later; it is the general shape, and
 * like the CI rule above it is stated once rather than per workflow. It cannot
 * see a gate removed CLEANLY, both halves in the same commit, because what is
 * left is self-consistent. That is what the by-name expectation is for.
 */
describe("a job waits for every gate its condition reads", () => {
  const conditional = WORKFLOW_FILES.flatMap((file) => {
    const wf = readWorkflow(file)
    return Object.entries(wf.jobs ?? {})
      .map(([id, job]) => ({
        file,
        id,
        needs: typeof job.needs === "string" ? [job.needs] : (job.needs ?? []),
        reads: [
          ...new Set(
            // Non-null: the group is what the pattern matched on.
            [...String(job.if ?? "").matchAll(/needs\.([\w-]+)\./g)].map((match) => match[1]!),
          ),
        ],
      }))
      .filter((entry) => entry.reads.length > 0)
  })

  /**
   * If this drops to zero every assertion below passes vacuously — the `if:`
   * conditions were rewritten, or the workflows moved. Same guard, and same
   * reason, as `the scan finds the jobs that publish` above.
   */
  test("the scan finds the jobs whose condition reads a dependency", () => {
    expect(conditional.map((entry) => `${entry.file}:${entry.id}`)).toEqual([
      "e2e.yml:e2e-report",
      "publish-mirror.yml:publish",
      "release.yml:e2e",
      "release.yml:release",
    ])
  })

  test.each(conditional)("$file / $id declares every job its if: reads", ({ needs, reads }) => {
    const undeclared = reads.filter((id) => !needs.includes(id))
    expect(
      undeclared,
      `its if: reads needs.${undeclared[0] ?? "?"}.result while needs: is [${needs.join(", ")}] — ` +
        `an undeclared job is not awaited, and its result reads as the empty string, so every ` +
        `comparison against it passes`,
    ).toEqual([])
  })

  /**
   * The one dependency this whole file exists to keep. `verify` and `e2e` are
   * held by the CI rule above — they call `ci.yml` — but `delivered` calls
   * nothing, so nothing above names it, and it is the only gate that runs on
   * BOTH trigger paths: the Release chain never runs `verify`, so on the
   * `workflow_run` path a missing `delivered` leaves the sync with no check at
   * all in front of it.
   */
  test("publish-mirror's sync waits on the delivered-tree check", () => {
    const publish = readWorkflow("publish-mirror.yml").jobs?.publish ?? {}
    const needs = typeof publish.needs === "string" ? [publish.needs] : (publish.needs ?? [])

    expect(
      needs,
      "`delivered` builds and tests the tree a client actually receives; without it in `needs:` " +
        "the sync neither waits for that job nor can read its result",
    ).toContain("delivered")

    // Exhaustive rather than `toContain`, so a gate cannot be dropped quietly.
    // Adding one is meant to fail here: the list of checks standing between a
    // broken template and every client site is edited deliberately or not at all.
    expect(needs).toEqual(["verify", "e2e", "delivered"])
  })
})

/**
 * `ci.yml` is only usable as a gate because it declares `workflow_call:`.
 * Removing that trigger would not fail any of the assertions above — both
 * callers would still name it — but every gate in the repository would stop
 * resolving.
 */
describe("ci.yml stays callable as a gate", () => {
  const ci = readWorkflow("ci.yml")

  test("it declares workflow_call", () => {
    expect(Object.keys((ci.on ?? {}) as Record<string, unknown>)).toContain("workflow_call")
  })

  test("it still carries the four required contexts", () => {
    const names = Object.values(ci.jobs ?? {}).map((j) => j.name)
    expect(names).toEqual(expect.arrayContaining(["Lint", "Type Check", "Test", "Build"]))
  })
})

/**
 * The `if:` on `publish-mirror.yml`'s publish job, evaluated.
 *
 * The assertions above prove a gate is wired. They cannot prove it lets the
 * right runs through, and that expression is the one piece of this change no
 * check in the repository can execute: GitHub evaluates it, and GitHub is not
 * here. Two ways to get it wrong, in opposite directions —
 *
 *   - too permissive: a push publishes over a red `verify`, which is the defect
 *     this whole file exists for;
 *   - too strict: `verify` is deliberately SKIPPED on the `workflow_run` path,
 *     and a job whose `needs:` was skipped is itself skipped unless its `if:`
 *     uses a status function. Drop `!cancelled()` and the mirror silently stops
 *     syncing after every Release — which looks exactly like a gate that works,
 *     and is how the mirror once went twelve days without a sync.
 *
 * So the expression is read out of the workflow and evaluated here, against the
 * scenarios that reach it. The evaluator understands precisely the grammar this
 * one expression uses and THROWS on anything else, so rewriting the condition
 * into a shape it cannot read fails this suite rather than passing it blindly.
 */

/**
 * `releaseConclusion` lists EVERY conclusion GitHub can report, not the three
 * that seemed relevant. An adversarial pass rewrote the condition to
 * `conclusion != 'failure' && conclusion != 'cancelled'` and the suite stayed
 * green while the mirror would publish on `skipped`, `neutral`,
 * `action_required`, `timed_out`, `stale` and `startup_failure` — because none
 * of those was ever fed to it. `''` is in the list too: a `workflow_run` event
 * carries no conclusion until the run completes.
 */
type ReleaseConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "skipped"
  | "neutral"
  | "action_required"
  | "timed_out"
  | "stale"
  | "startup_failure"
  | ""

type JobResult = "success" | "failure" | "skipped" | "cancelled"

type Scenario = {
  event: "push" | "workflow_dispatch" | "workflow_run"
  verify: JobResult
  /**
   * `needs.e2e.result` — the fifth required check, added to both publishing
   * chains in #307/#308.
   *
   * Defaults to whatever `verify` is, which is not a shortcut: on
   * `publish-mirror.yml` the two jobs carry the same skip condition apart from
   * a `--check` dispatch, so a scenario that does not say otherwise is one
   * where they agree. Every case where they DIVERGE says so explicitly, and
   * those are the interesting ones — a green `verify` beside a red suite is
   * exactly what this gate exists to refuse.
   */
  e2e?: JobResult
  /**
   * `needs.delivered.result` — publish-mirror.yml's `Verify the delivered
   * tree`, which installs the packed engine into a materialised copy of
   * `apps/themes` and runs the template's own suite there.
   *
   * Defaults to `success` rather than to `verify`, and the difference is the
   * point: unlike `verify` and `e2e` this job runs on the `workflow_run` path
   * too, because the Release chain never ran it. Modelling it as tracking
   * `verify` would quietly assert it is skipped exactly where it is the only
   * check left.
   */
  delivered?: JobResult
  /** `needs.plan.result` — release.yml only; decides whether E2E runs at all. */
  plan?: JobResult
  releaseConclusion?: ReleaseConclusion
  /** The branch `Release` ran on, for the `workflow_run` path. */
  releaseBranch?: string
  /** The ref the run itself is on, for the push and dispatch paths. */
  ref?: string
  cancelled?: boolean
}

/** Every `needs:` result the scenario implies, for the implicit-success rule. */
function resultsOf(scenario: Scenario): JobResult[] {
  return [
    scenario.verify,
    scenario.e2e ?? scenario.verify,
    scenario.delivered ?? "success",
    ...(scenario.plan ? [scenario.plan] : []),
  ]
}

/**
 * GitHub's rule, and the whole reason `!cancelled()` is in the condition: a
 * job-level `if:` is ANDed with an implicit `success()` — every `needs:` job
 * must have SUCCEEDED — unless the expression itself contains a status check
 * function. A skipped dependency is not a success, so an expression without one
 * can never run after `verify` skips itself.
 */
const STATUS_FUNCTIONS = /\b(success|always|cancelled|failure)\(\)/

function jobRuns(expression: string, scenario: Scenario): boolean {
  // ALL of them, not just `verify`. GitHub's implicit `success()` is over the
  // whole `needs:` list, so a chain that grew a second dependency and lost its
  // status function would be modelled wrongly by a rule that still only looked
  // at the first one.
  const impliedSuccess =
    STATUS_FUNCTIONS.test(expression) || resultsOf(scenario).every((result) => result === "success")
  return impliedSuccess && evaluate(expression, scenario)
}

function evaluate(expression: string, scenario: Scenario): boolean {
  const context: Record<string, string> = {
    "github.event_name": scenario.event,
    "github.event.workflow_run.conclusion": scenario.releaseConclusion ?? "",
    "github.event.workflow_run.head_branch": scenario.releaseBranch ?? "",
    "github.ref": scenario.ref ?? "refs/heads/main",
    "needs.verify.result": scenario.verify,
    "needs.e2e.result": scenario.e2e ?? scenario.verify,
    "needs.delivered.result": scenario.delivered ?? "success",
    // Absent from publish-mirror.yml's condition; naming it here anyway costs
    // nothing and lets one evaluator read both chains.
    "needs.plan.result": scenario.plan ?? "success",
  }

  const tokens = expression
    .replace(/^\$\{\{/, "")
    .replace(/\}\}$/, "")
    .match(/!?[A-Za-z_][\w.]*\(\)|[A-Za-z_][\w.]*|'[^']*'|&&|\|\||==|!=|\(|\)/g)
  if (!tokens) throw new Error(`unreadable expression: ${expression}`)

  let at = 0
  const peek = (): string | undefined => tokens[at]
  const take = (): string => {
    const token = tokens[at++]
    if (token === undefined) throw new Error("expression ended early")
    return token
  }

  const value = (token: string): string | boolean => {
    if (token === "cancelled()") return scenario.cancelled === true
    if (token === "!cancelled()") return scenario.cancelled !== true
    if (token.startsWith("'")) return token.slice(1, -1)
    const known = context[token]
    if (known !== undefined) return known
    throw new Error(`unknown token in the workflow condition: ${token}`)
  }

  // comparison := <atom> [ ('==' | '!=') <atom> ] | '(' or ')'
  const comparison = (): boolean => {
    if (peek() === "(") {
      take()
      const inner = disjunction()
      if (take() !== ")") throw new Error("unbalanced parentheses")
      return inner
    }
    const left = value(take())
    const operator = peek()
    if (operator === "==" || operator === "!=") {
      take()
      const right = value(take())
      return operator === "==" ? left === right : left !== right
    }
    if (typeof left !== "boolean") throw new Error(`bare non-boolean operand: ${String(left)}`)
    return left
  }

  const conjunction = (): boolean => {
    let result = comparison()
    while (peek() === "&&") {
      take()
      result = comparison() && result
    }
    return result
  }

  function disjunction(): boolean {
    let result = conjunction()
    while (peek() === "||") {
      take()
      result = conjunction() || result
    }
    return result
  }

  const result = disjunction()
  if (at !== tokens.length) throw new Error(`trailing tokens: ${tokens.slice(at).join(" ")}`)
  return result
}

describe("the mirror publishes on exactly the runs that passed CI", () => {
  const condition = readWorkflow("publish-mirror.yml").jobs?.publish?.if
  if (typeof condition !== "string") throw new Error("the publish job has no if:")

  const afterRelease = (releaseConclusion: ReleaseConclusion): Scenario => ({
    event: "workflow_run",
    verify: "skipped",
    releaseConclusion,
    releaseBranch: "main",
  })

  const cases: Array<[string, Scenario, boolean]> = [
    ["a push to main whose CI went green", { event: "push", verify: "success" }, true],
    ["a push to main whose CI went red", { event: "push", verify: "failure" }, false],
    [
      "a push whose CI was cancelled mid-run",
      { event: "push", verify: "cancelled", cancelled: true },
      false,
    ],
    [
      "a manual dispatch from main whose CI went green",
      { event: "workflow_dispatch", verify: "success" },
      true,
    ],
    [
      "a manual dispatch whose CI went red — the hole an admin could walk through",
      { event: "workflow_dispatch", verify: "failure" },
      false,
    ],
    [
      // `uses: ./…/ci.yml` resolves at the CALLER's ref, so a branch that guts
      // ci.yml supplies its own gate. Green CI on a branch must not publish.
      "a manual dispatch from a branch, with that branch's CI green",
      { event: "workflow_dispatch", verify: "success", ref: "refs/heads/feature/x" },
      false,
    ],
    // ── The E2E gate (#307, #308) ────────────────────────────────────────
    //
    // Every case below holds `verify` at success, so the only thing deciding
    // the outcome is the suite. Before this gate existed the mirror shipped
    // 35 seconds after the merge and the suite reported 11m02s later; all four
    // of these would have published.
    [
      "a push to main whose CI went green but whose E2E suite went red",
      { event: "push", verify: "success", e2e: "failure" },
      false,
    ],
    [
      "a push to main whose E2E suite was cancelled — not a pass",
      { event: "push", verify: "success", e2e: "cancelled", cancelled: false },
      false,
    ],
    [
      // The `--check` dispatch skips the suite deliberately: it reports drift
      // and pushes nothing, so it has nothing to gate. `skipped` must stay a
      // legitimate answer, or a dry run would be the one thing that cannot run.
      "a --check dispatch, where the suite is skipped on purpose",
      { event: "workflow_dispatch", verify: "success", e2e: "skipped" },
      true,
    ],
    [
      "a manual dispatch from a branch whose E2E went green — still refused, wrong ref",
      { event: "workflow_dispatch", verify: "success", e2e: "success", ref: "refs/heads/feature/x" },
      false,
    ],
    // ── The delivered-tree gate ──────────────────────────────────────────
    //
    // `check:mirror-build` packs the engine, installs it into a materialised
    // copy of `apps/themes` and runs the template's own suite against it. It
    // existed, was green, and ran nowhere: `grep -rn check:mirror-build
    // .github/` returned nothing while `beyours-boilerplate` had been red since
    // 7 September, because four shipped test files reached above the
    // application root and nothing in this repository ever ran outside the
    // workspace those paths resolve in.
    //
    // `verify` and `e2e` are held green in each case below, so the only thing
    // deciding the outcome is the delivered tree.
    [
      "a push to main whose CI and suite are green but whose delivered tree is red",
      { event: "push", verify: "success", delivered: "failure" },
      false,
    ],
    [
      "a push to main whose delivered-tree check was cancelled — not a pass",
      { event: "push", verify: "success", delivered: "cancelled", cancelled: false },
      false,
    ],
    [
      // Same reasoning as the `--check` dispatch above: that path pushes
      // nothing, so the job skips itself and `skipped` must stay legitimate.
      "a --check dispatch, where the delivered-tree check is skipped on purpose",
      { event: "workflow_dispatch", verify: "success", e2e: "skipped", delivered: "skipped" },
      true,
    ],
    ["a successful Release, where verify is skipped on purpose", afterRelease("success"), true],
    [
      // The case the gate is FOR on this path. `verify` and `e2e` are skipped
      // after a Release because the Release chain already ran them — it did not
      // run this one, so a red delivered tree here is the last thing standing
      // between a published engine and every client site.
      "a successful Release whose delivered tree is red",
      { ...afterRelease("success"), delivered: "failure" },
      false,
    ],
    [
      // `release.yml` triggers on main only today. One trigger line away, this
      // would otherwise sync a branch to every client site.
      "a successful Release that ran on a branch",
      { ...afterRelease("success"), releaseBranch: "feature/x" },
      false,
    ],
    ...(
      [
        "failure",
        "cancelled",
        "skipped",
        "neutral",
        "action_required",
        "timed_out",
        "stale",
        "startup_failure",
        "",
      ] as const
    ).map(
      (conclusion): [string, Scenario, boolean] => [
        `a Release concluding ${conclusion === "" ? "(nothing yet)" : conclusion}`,
        afterRelease(conclusion),
        false,
      ],
    ),
  ]

  test.each(cases)("%s", (_label, scenario, expected) => {
    expect(jobRuns(condition, scenario)).toBe(expected)
  })
})

/**
 * The `if:` on `release.yml`'s release job, evaluated.
 *
 * Same reasoning as the block above, and one wrinkle of its own. The E2E call
 * here is CONDITIONAL — `plan` asks the registry whether this push will publish
 * anything, and skips the suite when it will not, because 12 of the 293 commits
 * on `main` between 01/07/2026 and 07/09/2026 moved a package version and the
 * other 281 would have waited twelve minutes to publish nothing.
 *
 * That makes `skipped` a legitimate answer from `e2e` and creates a failure
 * mode with no counterpart in the mirror chain: a `plan` that ERRORED has not
 * said "nothing to publish", it has said nothing — and `e2e` skips itself on an
 * unset output, which reads identically. Without `needs.plan.result ==
 * 'success'` the release would then publish having gated on nothing at all.
 * That case is the last one below, and it fails the suite if the clause is
 * dropped.
 */
describe("the release publishes on exactly the runs that passed CI", () => {
  const condition = readWorkflow("release.yml").jobs?.release?.if
  if (typeof condition !== "string") throw new Error("the release job has no if:")

  const push = (over: Partial<Scenario> = {}): Scenario => ({
    event: "push",
    verify: "success",
    plan: "success",
    e2e: "success",
    ...over,
  })

  const cases: Array<[string, Scenario, boolean]> = [
    ["a push that publishes, with everything green", push(), true],
    [
      // The 96% case: nothing to publish, so no suite was called. The job still
      // runs and `changeset publish` prints "No unpublished projects to publish".
      "a push that publishes nothing, so the suite was skipped",
      push({ e2e: "skipped" }),
      true,
    ],
    ["a push that publishes over a red E2E suite", push({ e2e: "failure" }), false],
    ["a push whose E2E suite was cancelled", push({ e2e: "cancelled" }), false],
    ["a push whose CI went red", push({ verify: "failure", e2e: "skipped" }), false],
    ["a push whose CI was skipped", push({ verify: "skipped", e2e: "skipped" }), false],
    ["a run cancelled outright", push({ cancelled: true }), false],
    ...(["failure", "cancelled", "skipped"] as const).map(
      (plan): [string, Scenario, boolean] => [
        // A plan that did not succeed cannot be read as "nothing to gate".
        `a push whose plan ${plan === "skipped" ? "was skipped" : plan === "failure" ? "errored" : "was cancelled"}`,
        push({ plan, e2e: "skipped" }),
        false,
      ],
    ),
  ]

  test.each(cases)("%s", (_label, scenario, expected) => {
    expect(jobRuns(condition, scenario)).toBe(expected)
  })
})

/**
 * `e2e.yml` is only usable as a gate because it declares `workflow_call:`, and
 * it did not until #307/#308 — which is the whole reason the release chain
 * gated on four of the five required checks for four days. Removing the trigger
 * again would not fail the `needs:` assertions above; both callers would still
 * name the job. It would just stop resolving.
 */
describe("e2e.yml stays callable as a gate", () => {
  const e2e = readWorkflow("e2e.yml")

  test("it declares workflow_call", () => {
    expect(Object.keys((e2e.on ?? {}) as Record<string, unknown>)).toContain("workflow_call")
  })

  test("it still produces the required context", () => {
    expect(Object.values(e2e.jobs ?? {}).map((j) => j.name)).toContain("E2E Status")
  })

  test("both publishing chains wait on a job that calls it", () => {
    for (const [file, jobId] of [
      ["publish-mirror.yml", "publish"],
      ["release.yml", "release"],
    ] as const) {
      const wf = readWorkflow(file)
      const job = wf.jobs?.[jobId] ?? {}
      const needs = typeof job.needs === "string" ? [job.needs] : (job.needs ?? [])
      const gates = needs.filter((id) => wf.jobs?.[id]?.uses?.endsWith(".github/workflows/e2e.yml"))
      expect(
        gates,
        `none of [${needs.join(", ")}] calls ./.github/workflows/e2e.yml, so ${file}:${jobId} publishes without E2E Status`,
      ).not.toHaveLength(0)
    }
  })
})

/**
 * The workflows `apps/themes` carries are payload, not configuration.
 *
 * GitHub Actions only reads `.github/workflows/` at a REPOSITORY root, so
 * `apps/themes/.github/workflows/` never runs here — but `apps/themes` is
 * published verbatim as the root of `beyours-boilerplate`, where those files
 * become that repository's CI, and every client site's after it. Nothing in
 * this repository has ever looked at them: they are excluded from no mirror
 * rule, so they ship, and they are inert here, so they are never parsed.
 *
 * They also sit inside the `apps/themes/**` path filter that triggers the
 * publish. Editing the client's CI is therefore itself a trigger to ship it.
 * The gate above now makes that wait for our CI; this makes our CI actually
 * read the file, so a client's checks cannot be broken by a YAML typo that
 * nothing on this side would ever have compiled.
 */
describe("the CI the mirror ships to clients stays intact", () => {
  const SHIPPED_DIR = path.join(REPO_ROOT, "apps/themes/.github/workflows")

  test("the directory is still there and still shipped", () => {
    expect(fs.existsSync(SHIPPED_DIR), "apps/themes/.github/workflows").toBe(true)
    expect(fs.readdirSync(SHIPPED_DIR).sort()).toEqual(["ci.yml", "demos.yml"])
  })

  test.each(["ci.yml", "demos.yml"])("%s parses", (file) => {
    const source = fs.readFileSync(path.join(SHIPPED_DIR, file), "utf8")
    const wf = parse(source) as Workflow
    expect(wf.on, `${file} declares no triggers`).toBeDefined()
    expect(Object.keys(wf.jobs ?? {}).length, `${file} declares no jobs`).toBeGreaterThan(0)
  })

  /**
   * `apps/themes/docs/SETUP-CI.md` tells the maintainer to require this exact
   * context on the boilerplate's `main`. Renaming the job here would leave every
   * client repository requiring a check that no longer reports — which GitHub
   * shows as permanently pending, not as red.
   */
  test("the job name SETUP-CI.md tells clients to require still exists", () => {
    const wf = parse(fs.readFileSync(path.join(SHIPPED_DIR, "ci.yml"), "utf8")) as Workflow
    const names = Object.values(wf.jobs ?? {}).map((j) => j.name)
    expect(names).toContain("Lint + Test + Build")

    const setup = fs.readFileSync(path.join(REPO_ROOT, "apps/themes/docs/SETUP-CI.md"), "utf8")
    expect(setup).toContain("Lint + Test + Build")
  })
})

/**
 * No caller may put two of the workflows it calls into the same concurrency
 * group.
 *
 * On a `workflow_call` the called workflow's `concurrency:` expression is
 * evaluated in the CALLER's context: `github.workflow` is the caller's name,
 * `github.event_name` the event that started the caller, `github.ref` the
 * caller's ref. Nothing in those tokens distinguishes WHICH workflow was
 * called. So two called workflows carrying the same expression are not merely
 * similar — they compute one identical string and share one slot.
 *
 * `ci.yml` and `e2e.yml` did, both spelling it
 * `${{ github.workflow }}-${{ github.event_name }}-${{ github.ref }}`, and
 * `publish-mirror.yml` calls both. With `cancel-in-progress: true` the second
 * call evicted the first: on `d89ade46` the mirror's four `Verify` jobs were
 * cancelled one second after creation, before a runner had picked them up, and
 * `publish` skipped on `needs.verify.result == 'cancelled'`. The release chain
 * carried the identical defect and did not fire, because its `e2e` job skips
 * when the registry says there is nothing to publish — so the first release
 * that actually published would have been the one to silently not publish.
 *
 * `cancel-in-progress: false` is not the safe side of this and the rule does
 * not exempt it. Two calls sharing a group then QUEUE against each other while
 * the caller waits on both, which is a deadlock rather than a cancellation.
 * Either way the answer is one group per called workflow, so the assertion is
 * unconditional.
 *
 * What is asserted is the rule, not the pair: any caller, any two of its calls.
 * A sixth workflow copying the same four-token expression — the obvious thing
 * to do, since it reads as correct and is the same line the other five carry —
 * fails here rather than in a mirror sync nobody watched.
 */
describe("two workflows called by one caller cannot share a concurrency slot", () => {
  const LOCAL_CALL = /^\.\/\.github\/workflows\/(.+\.ya?ml)$/

  /** The group expression, whitespace-normalised, or null when unset. */
  function groupOf(file: string): string | null {
    const { concurrency } = readWorkflow(file)
    const raw = typeof concurrency === "string" ? concurrency : concurrency?.group
    if (!raw) return null
    // `${{ github.ref }}` and `${{github.ref}}` are the same expression and
    // would collide identically at runtime, so compare them as equal here.
    return raw.replace(/\s+/g, " ").trim()
  }

  /** Which local reusable workflows this file calls, deduplicated. */
  function callsOf(file: string): string[] {
    const jobs = Object.values(readWorkflow(file).jobs ?? {})
    const called = jobs
      .map((job) => job.uses?.match(LOCAL_CALL)?.[1])
      .filter((f): f is string => Boolean(f))
    return [...new Set(called)].sort()
  }

  const CALLERS = WORKFLOW_FILES.filter((f) => callsOf(f).length > 1)

  test("some caller calls more than one workflow, or this suite proves nothing", () => {
    expect(CALLERS.length).toBeGreaterThan(0)
  })

  test.each(CALLERS)("%s gives each workflow it calls its own group", (caller) => {
    const seen = new Map<string, string>()
    for (const called of callsOf(caller)) {
      const group = groupOf(called)
      if (group === null) continue
      const other = seen.get(group)
      expect(
        other,
        `${caller} calls both ${other} and ${called}, and they compute the same ` +
          `concurrency group \`${group}\` — on a workflow_call every token in it ` +
          `resolves in ${caller}'s context, so one of the two calls will cancel ` +
          `or block the other. Give each called workflow a distinct literal ` +
          `prefix in its group.`,
      ).toBeUndefined()
      seen.set(group, called)
    }
  })

  /**
   * The other half of the same trap, and the one the original comment in
   * `e2e.yml` did reason about correctly: a called workflow must not land in
   * the group its own CALLER is already holding, or the call waits for a run
   * that is waiting for the call.
   */
  test.each(WORKFLOW_FILES.filter((f) => callsOf(f).length > 0))(
    "%s does not share its own group with anything it calls",
    (caller) => {
      const mine = groupOf(caller)
      if (mine === null) return
      for (const called of callsOf(caller)) {
        expect(
          groupOf(called),
          `${caller} holds concurrency group \`${mine}\` and calls ${called}, ` +
            `which computes the same group in ${caller}'s context — the call ` +
            `would queue behind the run that is waiting for it.`,
        ).not.toBe(mine)
      }
    },
  )
})

/**
 * A caller must grant every permission the workflow it calls asks for.
 *
 * GitHub refuses to START a run whose called workflow requests more than the
 * calling job was granted, and the refusal is a `startup_failure`: no jobs, no
 * steps, no logs, and no failing check to read. That is what makes it worth a
 * test rather than a review note — nothing about the run says what went wrong,
 * or even that anything ran.
 *
 * It cost three releases. #446 added `packages: read` to `ci.yml`'s `lint` job,
 * so the subpath half of `check:source-drift` could read published tarballs.
 * Both callers — `release.yml`'s and `publish-mirror.yml`'s `verify` — still
 * granted `contents: read` alone, so from e5394e5 onward EVERY `Release` and
 * every `Publish mirror` ended in `startup_failure`. No package published
 * across #446, #447 and #448, and the mirror stayed frozen the whole time.
 *
 * `ci.yml`'s own `push` and `pull_request` runs stayed green throughout, which
 * is precisely why nobody saw it: a reusable workflow is only narrowed when it
 * is CALLED, so the failure is invisible from the file that causes it.
 */
describe("a called workflow never asks for more than its caller grants", () => {
  type Perms = Record<string, string>

  const asMap = (p: unknown): Perms | null =>
    p && typeof p === "object" && !Array.isArray(p) ? (p as Perms) : null

  /** Every `uses: ./.github/workflows/x.yml` in this repo, with its caller. */
  const localCalls = WORKFLOW_FILES.flatMap((file) => {
    const wf = readWorkflow(file)
    return Object.entries(wf.jobs ?? {})
      .filter(([, job]) => typeof job.uses === "string" && job.uses.startsWith("./.github/workflows/"))
      .map(([jobName, job]) => ({
        file,
        jobName,
        called: (job.uses as string).replace("./.github/workflows/", ""),
        granted: asMap(job.permissions),
      }))
  })

  test("there are local reusable-workflow calls to check", () => {
    // If this ever hits zero the suite below is vacuous and would pass forever.
    expect(localCalls.length).toBeGreaterThan(0)
  })

  test.each(localCalls)(
    "$file job $jobName calling $called",
    ({ called, granted }) => {
      const callee = readWorkflow(called)
      const needed = new Map<string, string>()
      for (const [, job] of Object.entries(callee.jobs ?? {})) {
        for (const [scope, level] of Object.entries(asMap(job.permissions) ?? {})) {
          // `write` outranks `read`; anything already recorded as write stays.
          if (needed.get(scope) !== "write") needed.set(scope, level)
        }
      }

      for (const [scope, level] of needed) {
        // `none` asks for nothing, so a caller need not name it.
        if (level === "none") continue
        expect(
          granted?.[scope],
          `${called} requests \`${scope}: ${level}\`, but ${granted === null ? "the caller sets no permissions block" : `the calling job grants ${JSON.stringify(granted)}`}. ` +
            `GitHub will refuse to start the run — a startup_failure with no jobs and no logs.`,
        ).toBeDefined()
        if (level === "write") expect(granted?.[scope]).toBe("write")
      }
    },
  )
})

/**
 * A step that reads git tags must fetch them first.
 *
 * `publish-mirror.yml`'s `workflow_run` path decides whether to sync by asking
 * `git tag --points-at HEAD`. Its checkout sets `fetch-tags: true`, and that
 * input does not survive a `ref:` that is a SHA — actions/checkout then runs a
 * fetch carrying no tag refspec at all. Measured on run 34407658142:
 *
 *   git … fetch --prune --no-recurse-submodules --depth=1 origin de6de57…
 *
 * So the tag namespace was empty, the step answered "that Release published
 * nothing", the sync was skipped, and the job reported SUCCESS. The Release had
 * published eight packages including the one the mirror's export gate had been
 * failing on all day.
 *
 * The condition was unreachable, not merely wrong: with no tags ever fetched,
 * that path could never answer "published", so it could never sync. Every
 * `workflow_run` sync since the check was introduced was a no-op wearing a
 * green tick — which is the same defect class as the one the `report` job was
 * added for, one layer further in, and invisible to it because a stand-down
 * after "nothing was published" is a legitimate green.
 */
describe("a step that reads tags it did not create fetches them first", () => {
  /** YAML comments stripped, so prose about tags is not read as code. */
  const codeOf = (text: string) =>
    text
      .split("\n")
      .map((line) => (/^\s*#/.test(line) ? "" : line.replace(/\s+#.*$/, "")))
      .join("\n")

  const RAW_WORKFLOWS = WORKFLOW_FILES.map((file) => ({
    file,
    code: codeOf(fs.readFileSync(path.join(WORKFLOW_DIR, file), "utf8")),
  }))

  /**
   * Only workflows that read tags SOMEBODY ELSE wrote.
   *
   * `release.yml` reads `git tag --points-at HEAD` too, and correctly needs no
   * fetch: `changeset publish` creates those tags in that same job moments
   * earlier, then it pushes them. Requiring a fetch there would be a false
   * positive — the first draft of this test produced exactly that.
   */
  const readsForeignTags = RAW_WORKFLOWS.filter(
    ({ code }) =>
      /git tag\s+--points-at/.test(code) &&
      !/changeset publish|git tag\s+-[am]/.test(code),
  )

  test("there is a tag-reading step to check", () => {
    // If this hits zero the assertion below is vacuous and passes for ever.
    expect(readsForeignTags.length).toBeGreaterThan(0)
  })

  test.each(readsForeignTags)("$file fetches tags before reading them", ({ code }) => {
    const readAt = code.search(/git tag\s+--points-at/)
    const fetchAt = code.search(/git fetch[^\n]*(refs\/tags|--tags)/)

    expect(
      fetchAt,
      "this workflow reads tags it did not create, and never fetches them. " +
        "`fetch-tags: true` on actions/checkout does NOT apply when `ref:` is a SHA, " +
        "so the tag namespace is empty and the read silently answers 'nothing published'.",
    ).toBeGreaterThan(-1)
    expect(fetchAt, "the fetch has to come before the read").toBeLessThan(readAt)
  })
})
