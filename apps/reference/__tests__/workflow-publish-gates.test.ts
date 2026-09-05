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
type Workflow = { name?: string; on?: unknown; jobs?: Record<string, Job> }

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

type Scenario = {
  event: "push" | "workflow_dispatch" | "workflow_run"
  verify: "success" | "failure" | "skipped" | "cancelled"
  releaseConclusion?: ReleaseConclusion
  /** The branch `Release` ran on, for the `workflow_run` path. */
  releaseBranch?: string
  /** The ref the run itself is on, for the push and dispatch paths. */
  ref?: string
  cancelled?: boolean
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
  const impliedSuccess = STATUS_FUNCTIONS.test(expression) || scenario.verify === "success"
  return impliedSuccess && evaluate(expression, scenario)
}

function evaluate(expression: string, scenario: Scenario): boolean {
  const context: Record<string, string> = {
    "github.event_name": scenario.event,
    "github.event.workflow_run.conclusion": scenario.releaseConclusion ?? "",
    "github.event.workflow_run.head_branch": scenario.releaseBranch ?? "",
    "github.ref": scenario.ref ?? "refs/heads/main",
    "needs.verify.result": scenario.verify,
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
    ["a successful Release, where verify is skipped on purpose", afterRelease("success"), true],
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
