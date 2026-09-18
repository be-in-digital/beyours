/**
 * Does the tree the mirror is about to ship COMPILE against the versions it
 * pins?
 *
 * WHY A THIRD GATE. `lib/engine-exports.mjs` already asks whether every
 * `@be-yours/*` specifier the template imports resolves in the published
 * tarball, and whether the file each subpath points at was actually shipped.
 * Both questions are about the MODULE. Neither can see inside one.
 *
 * That is the hole, measured: `apps/themes/convex/emailCampaigns.ts` imports
 * `@be-yours/convex-functions/emailCampaigns` — a subpath the published
 * `convex-functions@5.0.0` exports, from a file it ships — and reads
 * `defs.markFailed` off it. `markFailed` was added to that module at HEAD
 * without a version bump, so the published 5.0.0 does not have it. The gate
 * reported `9 package(s) verified` against the very tarball the registry
 * serves, the sync went out, and `be-yours/beyours-boilerplate` has been
 * failing its own Typecheck ever since with
 *
 *   convex/emailCampaigns.ts(136,49): error TS2339: Property 'markFailed'
 *   does not exist on type 'typeof import(".../emailCampaigns")'
 *
 * A named export is invisible to any check that reasons about `exports` maps
 * and file lists, because nothing about the packaging is wrong. Only a compiler
 * reads a module's contents.
 *
 * IT DOES NOT SUBSUME THE OTHER TWO, and the tempting claim that it does is
 * false — measured, on this tree. `engineImportsIn` walks every `.ts .tsx .mts
 * .cts .js .jsx .mjs .cjs` file the mirror ships. `pnpm typecheck` reads 576 of
 * them and never opens 115: the 87 under `tests/` and 2 under `.template/` that
 * `tsconfig.json` excludes, plus all 26 `.js`/`.mjs`/`.cjs`, which no `include`
 * glob names and which `checkJs` (off) would be needed for. Two engine
 * specifiers live only in that gap today —
 * `@be-yours/convex-functions/eslint/convex-auth` in the mirror's own
 * `eslint.config.mjs`, and `@be-yours/core/status-labels` in
 * `tests/i18n/catalogue-keys.test.ts`. Drop either subpath from a published
 * `exports` map and a client's `pnpm lint` or `pnpm test` dies on
 * `ERR_PACKAGE_PATH_NOT_EXPORTED` while this gate stays green.
 *
 * The exports gate is what covers that, so it runs first and stays. Three
 * overlapping gates, none of them complete on its own — which is the honest
 * description, and the one a reader has to have before deciding any of them is
 * redundant.
 *
 * WHAT IT RUNS, and why it is the template's own script rather than a `tsc`
 * this module spells out itself:
 *
 *   1. `pnpm install --frozen-lockfile` — the client's own first command. It
 *      resolves `@be-yours/*` FROM THE REGISTRY at the versions this sync
 *      pinned a moment ago, which is the whole point: nothing else in this
 *      repository ever installs them. It also proves the lockfile the sync
 *      just generated is one a client's CI can install at all.
 *   2. `pnpm run typecheck` — the template's own script, which is
 *      `tsc --noEmit && tsc --noEmit -p convex/tsconfig.json`. Two projects,
 *      because the root `tsconfig.json` EXCLUDES `convex/`: it reaches a
 *      backend module only where app code transitively imports one. Today that
 *      is 144 of the 145 backend files, so the second invocation adds exactly
 *      one — `convex/convex.config.ts`. It is insurance against that ratio
 *      changing, not the bulk of the coverage; and it is the template's own
 *      script either way.
 *
 *      Spelling those two commands out here instead would mean keeping pace
 *      with the template by hand, and quietly under-checking the day it gains
 *      a third project. Running the script a client's CI runs cannot drift
 *      from a client's CI. The cost is one indirection — `assertTypecheckScript`
 *      refuses a mirror whose `typecheck` no longer invokes a compiler at all,
 *      and `apps/reference/__tests__/mirror-typecheck.test.ts` holds the
 *      template's script to both projects.
 *
 * WHAT IT CANNOT SEE. `next build` and `convex deploy`, which need an
 * application env and a live backend — a type error is what has broken every
 * recorded occurrence of this class (#209, #283, #321, #380, #408), and a check
 * that demands secrets is a check that gets switched off. It does not run the
 * template's test suite either; `check-mirror-build.mjs` does that against
 * locally packed tarballs before a release, and repeating it inside the sync
 * would add several minutes to the path a client's delivery waits on.
 *
 * Everything here takes its commands as data and its runner as an argument, so
 * the sequencing and the failure text are testable without an install.
 */

import { execFileSync } from "node:child_process"

/**
 * One command the gate runs, and what to say when it fails.
 *
 * @typedef {object} PinnedTreeStep
 * @property {string} name    short handle, also what the message switches on
 * @property {string} cmd
 * @property {string[]} args
 * @property {string} failed  the first line of the failure message
 * @property {RegExp} [environmentFailure]  output that means the RUNNER failed,
 *           not the tree — retried once, then reported as `ran: false`
 */

/**
 * A step that did not pass.
 *
 * `ran` is what separates "the command disagreed with the tree" from "the
 * command never reached a verdict"; absent means it ran.
 *
 * @typedef {object} PinnedTreeFailure
 * @property {false} ok
 * @property {PinnedTreeStep} step
 * @property {boolean} [ran]
 * @property {string} output
 */

/** @typedef {{ ok: true }} PinnedTreePass */

/** @typedef {(step: PinnedTreeStep, cwd: string) => { ok: boolean, ran?: boolean, output: string }} StepRunner */

/**
 * The commands, in order, that prove a pinned tree is one a client can build.
 *
 * @type {PinnedTreeStep[]}
 *
 * `--ignore-scripts` on the install for the same reason
 * `check-mirror-build.mjs` uses it: nothing here needs a native build, and a
 * sync job holding a push token should not run arbitrary lifecycle scripts
 * from the dependency graph. It also skips the template's own `preinstall`,
 * whose job is to turn a missing NODE_AUTH_TOKEN into a sentence instead of a
 * 401 — so `environmentFailure` below has to say that itself, since this step
 * is exactly where a sync would hit it.
 */
export const PINNED_TREE_STEPS = [
  {
    name: "install",
    cmd: "pnpm",
    args: ["install", "--frozen-lockfile", "--ignore-scripts"],
    failed: "the lockfile this sync generated does not install",
    // A registry that refused, timed out or 502'd, and a token that is absent
    // or expired, all fail this step — and none of them says anything about the
    // lockfile. Without this the operator is told to "check the pinned versions
    // and the overrides" while the actual answer is that the network is down,
    // and one hiccup at GitHub Packages stops delivery to every client site.
    //
    // Only on the install. A compiler that exits non-zero has JUDGED the tree,
    // and a line number in its output must never be read as an HTTP status.
    environmentFailure:
      /ERR_PNPM_(FETCH|META_FETCH)|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|\bE40[13]\b|\bERR_INVALID_THIS\b|status code 5\d\d|Unauthorized|Forbidden/i,
  },
  {
    name: "typecheck",
    cmd: "pnpm",
    args: ["run", "typecheck"],
    failed: "the tree does not typecheck against the versions this sync pins",
  },
]

/** How much of a failing command's output the message carries. */
const OUTPUT_LINES = 80

/**
 * How much of a command's combined output is buffered.
 *
 * Node's default is 1 MiB, and a pnpm install of this template prints more
 * than that on a cold store. Overrun kills the child with ENOBUFS and throws
 * — indistinguishable, at the catch below, from the command having failed. A
 * gate that refuses the sync because its own buffer was too small is the worst
 * failure this file could have: a wrong red, blocking delivery to every client,
 * reported as a type error nobody can reproduce.
 */
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024

/**
 * Run one step, capturing stdout and stderr together.
 *
 * Combined and captured rather than inherited, because the failure message has
 * to carry the command's own words: a gate that says "typecheck failed, see
 * the log above" in a job that already scrolled past an install is a gate
 * people re-run rather than read. The cost is that a healthy run prints
 * nothing between the phase line and its verdict — which is also what makes a
 * hang legible, since the phase line is then the last thing in the log.
 *
 * A command that could not be RUN is not a command that failed, and the two
 * must not read alike: `spawn ENOENT` (no pnpm on PATH) and ENOBUFS are
 * reported as such rather than as a red tree, because the remedy is nothing
 * like releasing a package.
 */
function execCapture(step, cwd) {
  try {
    const stdout = execFileSync(step.cmd, step.args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: MAX_OUTPUT_BYTES,
    })
    return { ok: true, output: stdout ?? "" }
  } catch (error) {
    // An exit status means the command ran and disagreed with the tree. No
    // status — a signal, a spawn failure, a buffer overrun — means it never
    // reached a verdict, and saying otherwise invents one.
    if (typeof error.status !== "number") {
      return {
        ok: false,
        ran: false,
        output:
          `\`${step.cmd} ${step.args.join(" ")}\` could not be run to completion: ` +
          `${error.code ?? error.signal ?? "unknown failure"}\n${error.message ?? ""}`.trim(),
      }
    }
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim()
    return { ok: false, ran: true, output: output || String(error.message ?? error) }
  }
}

/**
 * Every step, in order, stopping at the first failure.
 *
 * Stopping is deliberate: a typecheck after a failed install measures nothing,
 * and reporting its noise alongside the real cause is how a two-line diagnosis
 * turns into a hundred.
 *
 * @param {string} tree  a materialised mirror tree — the shipped files, the
 *                        rewritten package.json, and the lockfile the sync
 *                        generated
 * @param {{ steps?: PinnedTreeStep[], run?: StepRunner }} [options]
 * @returns {PinnedTreePass | PinnedTreeFailure} — `ran` is false for a step
 *          that never reached a verdict at all
 */
export function checkPinnedTree(tree, { steps = PINNED_TREE_STEPS, run = execCapture } = {}) {
  for (const step of steps) {
    let result = run(step, tree)

    // A step that failed on the environment gets one more go, and is then
    // reported as an environment failure rather than as a broken tree. Both
    // halves matter: refusing a sync over a single 502 stops delivery to every
    // client site, and mis-naming the cause sends whoever reads it to release a
    // package that was never broken.
    if (!result.ok && result.ran !== false && step.environmentFailure?.test(result.output)) {
      result = run(step, tree)
      if (!result.ok && step.environmentFailure.test(result.output)) {
        return { ok: false, step, ran: false, output: result.output }
      }
    }

    if (!result.ok) return { ok: false, step, ran: result.ran !== false, output: result.output }
  }
  return { ok: true }
}

/** The tail of `output`, since a compiler puts its errors last. */
function tail(output) {
  const lines = String(output ?? "").split("\n")
  if (lines.length <= OUTPUT_LINES) return lines.join("\n")
  return [`… ${lines.length - OUTPUT_LINES} earlier line(s) omitted`, ...lines.slice(-OUTPUT_LINES)].join("\n")
}

/**
 * The failure message, written to be actionable without opening this file.
 *
 * The remedy is the same one `describeUnresolvable` gives and it is worth
 * repeating here, because the tempting fix is the wrong one: the import is
 * correct and the mirror's pinned version is behind. Deleting the import to
 * get green ships a template missing the feature.
 *
 * @param {{ step: PinnedTreeStep, ran?: boolean, output: string }} failure
 * @returns {string}
 */
export function describePinnedTreeFailure({ step, ran, output }) {
  // A command that never reached a verdict says nothing about the tree, and
  // the advice below — release a package — would send someone after a defect
  // that is not there.
  if (ran === false) {
    return [
      "the sync could not run its own compile gate, so it does not know whether the tree is sound.",
      "",
      tail(output),
      "",
      "This is the environment, not the template: the registry unreachable or",
      "refusing, NODE_AUTH_TOKEN absent or expired (the template's own preinstall",
      "guard is skipped here, so a 401 arrives bare), pnpm missing from PATH, or a",
      "runner out of memory or disk. A network-shaped failure was already retried",
      "once and failed the same way.",
      "",
      "Nothing here says the tree is broken and nothing says it is fine — fix the",
      "runner and re-run rather than reading the silence either way.",
    ].join("\n")
  }

  const lines = [`${step.failed}.`, "", tail(output), ""]

  if (step.name === "typecheck") {
    lines.push(
      "The template compiles in this workspace and would NOT compile for a client.",
      "CI builds `apps/themes` against `packages/*` at HEAD through the pnpm",
      "workspace link; a client installs the versions the registry serves, which is",
      "what this tree pins. A symbol added to a package's source without a version",
      "bump exists in the first and not in the second — `exports` maps and file",
      "lists both look perfect, because nothing about the packaging is wrong.",
      "",
      "Fix by releasing the engine first. `pnpm check:pending-release` says whether a",
      "changeset for the package the error names is already waiting — merge it and let",
      "Release publish; write one if there is none. Then re-run this sync.",
      "",
      "Do not remove the import. The import is correct and the pinned version is what",
      "is behind: removing it delivers a template missing whatever it was reaching for,",
      "and this gate goes green over a product that lost a feature.",
    )
  } else {
    lines.push(
      "The mirror's lockfile is generated a few steps above this one, from the very",
      "package.json it sits beside, so a client's `pnpm install --frozen-lockfile`",
      "— the first command their CI runs — should never be able to reject it.",
      "That it does means the two disagree: check the pinned versions and the",
      "overrides carried from the monorepo root.",
    )
  }

  return lines.join("\n")
}

/** Shell constructs that throw away the exit status of whatever precedes them. */
const SWALLOWS_FAILURE = /\|\|\s*(true\b|:\s|:$|exit\s+0\b|echo\b)/

/** Flags that make `tsc` print something and check nothing. */
const COMPILES_NOTHING = /(^|\s)--?(version|help|init|showConfig)(\s|$)/

/** Wrappers and env assignments that stand in front of the real command. */
const NOT_THE_COMMAND = /^(npx|pnpm|yarn|bun|exec|dlx|run|x|-{1,2}[\w-]+|[A-Za-z_][A-Za-z0-9_]*=.*)$/

/**
 * True when this one command actually runs the compiler over a project.
 *
 * The command, not a mention of it: `echo tsc` and `true # tsc` both contain
 * the word and compile nothing, which is the whole reason a substring test is
 * not enough.
 */
function invokesCompiler(segment) {
  const tokens = segment.split(/\s+/).filter(Boolean)
  const at = tokens.findIndex((token) => !NOT_THE_COMMAND.test(token))
  if (at === -1) return false
  const command = tokens[at].split("/").pop()
  if (command !== "tsc" && command !== "tsc.cmd") return false
  return !COMPILES_NOTHING.test(" " + tokens.slice(at + 1).join(" ") + " ")
}

/**
 * Refuse a mirror whose `typecheck` script would not fail on a broken tree.
 *
 * The gate runs the template's own script rather than a `tsc` of its own, so
 * that it cannot drift from what a client's CI runs. This is the floor under
 * that indirection, and it has to be a real floor: an adversarial pass on this
 * file got the #408 tree published again through a `typecheck` of `echo tsc`,
 * and `tsc --noEmit || true` is the version somebody writes for real, at 2am,
 * to unblock a red CI. Both used to pass a substring test for "tsc".
 *
 * So: at least one command in the script must BE `tsc` — after stepping over
 * `npx`, `pnpm exec` and env assignments — with none of the flags that print
 * instead of compiling; and nothing in the script may discard an exit status.
 *
 * Deliberately no stricter than that. WHICH projects the script covers is
 * asserted by a test over `apps/themes/package.json`, where a wrong answer
 * costs a red test; asserting it here would cost a refused sync, and a wrong
 * red stops delivery to every client site.
 *
 * @param {Record<string, string> | undefined} scripts  the mirror's `scripts` block
 * @returns {string | null} null when the script is sound, or the reason it is not
 */
export function assertTypecheckScript(scripts) {
  const script = scripts?.typecheck
  if (typeof script !== "string" || script.trim() === "") {
    return (
      "the mirror declares no `typecheck` script, so the sync has nothing to gate on.\n" +
      "It is `apps/themes`'s own script and the one a client's CI runs; restore it."
    )
  }

  if (SWALLOWS_FAILURE.test(script)) {
    return (
      "the mirror's `typecheck` script discards the compiler's exit status, so the\n" +
      `gate above it would pass on a tree that does not compile:\n  ${script}\n` +
      "Remove the `|| true` (or `|| :`, `|| exit 0`, `|| echo …`). A typecheck that\n" +
      "cannot fail is the same as no typecheck, and this one decides what reaches\n" +
      "every client site."
    )
  }

  const commands = script
    .split(/&&|\|\||;|\n|\|/)
    .map((segment) => segment.replace(/#.*$/, "").trim())
    .filter(Boolean)
  if (!commands.some(invokesCompiler)) {
    return (
      "the mirror's `typecheck` script runs no compiler, so the gate above it would\n" +
      `pass on anything:\n  ${script}\n` +
      "It must invoke `tsc` as a command — mentioning it in an `echo` or a comment,\n" +
      "or running it with --version, compiles nothing."
    )
  }

  return null
}
