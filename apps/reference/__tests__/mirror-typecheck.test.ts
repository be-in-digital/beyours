import { describe, expect, test } from "vitest"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  assertTypecheckScript,
  checkPinnedTree,
  describePinnedTreeFailure,
  PINNED_TREE_STEPS,
} from "../../../scripts/lib/mirror-typecheck.mjs"

/**
 * The mirror must not ship a tree that does not COMPILE against the versions
 * it pins.
 *
 * `mirror-engine-exports.test.ts` covers the gate one step out: does every
 * `@be-yours/*` subpath the template imports resolve in the published
 * tarball, and does the file it points at ship? Both are questions about the
 * module. Neither can see inside one, and that is where #408 lives:
 *
 *   `apps/themes/convex/emailCampaigns.ts` imports
 *   `@be-yours/convex-functions/emailCampaigns` and reads
 *   `defs.markFailed` off it. `markFailed` entered that module in e569498
 *   (#400) with no version bump, so the published `convex-functions@5.0.0`
 *   does not have it. The subpath is exported; the file ships; the exports
 *   gate reported `9 package(s) verified` and the sync went out.
 *   `be-yours/beyours-boilerplate` has been failing its own Typecheck
 *   ever since with TS2339, on every run.
 *
 * Nothing about the packaging is wrong, so only a compiler can see it — which
 * is why the sync now installs the pinned versions and runs the template's own
 * `typecheck` before it pushes.
 *
 * Bench-only: it reads the monorepo root and would be meaningless — and red —
 * on a client site.
 */

const REPO_ROOT = path.join(__dirname, "../../..")

type Step = { name: string; cmd: string; args: string[]; failed: string }
type Result = { ok: boolean; ran?: boolean; output: string }

/** A runner that answers from a table, so sequencing is testable in memory. */
const runnerFor = (results: Record<string, Result>) => {
  const seen: string[] = []
  const run = (step: Step, _cwd: string): Result => {
    seen.push(step.name)
    return results[step.name] ?? { ok: true, output: "" }
  }
  return { run, seen }
}

/**
 * The failure `checkPinnedTree` returned, or a test failure saying it did not.
 *
 * `{ ok: true } | { ok: false, step, … }` is a discriminated union, and nothing
 * below wants to repeat the narrowing: a test that asserted `ok === false` and
 * then read `.step` off the union would not compile, and casting it away would
 * throw an unhelpful `undefined` when the gate wrongly passed.
 */
const refused = (result: ReturnType<typeof checkPinnedTree>) => {
  if (result.ok) throw new Error("expected the gate to refuse this tree, and it did not")
  return result
}

describe("the steps a pinned tree has to pass", () => {
  test("the install resolves from the registry rather than only writing a lockfile", () => {
    const install = PINNED_TREE_STEPS.find((step: Step) => step.name === "install")
    expect(install).toBeDefined()
    expect(install!.args).toContain("install")
    // `--lockfile-only` is what the sync already ran a few lines earlier. It
    // resolves versions and materialises nothing, so there is no node_modules
    // for a compiler to read — which is precisely why this second install
    // exists.
    expect(install!.args).not.toContain("--lockfile-only")
    // The client's own first command: it proves the generated lockfile is one
    // their CI can install.
    expect(install!.args).toContain("--frozen-lockfile")
    // A sync job holds a push token; it must not run lifecycle scripts out of
    // the dependency graph to answer a question about types.
    expect(install!.args).toContain("--ignore-scripts")
  })

  test("the typecheck runs the template's own script", () => {
    const typecheck = PINNED_TREE_STEPS.find((step: Step) => step.name === "typecheck")
    expect(typecheck).toBeDefined()
    expect(typecheck!.args).toEqual(["run", "typecheck"])
  })

  test("it installs before it compiles", () => {
    expect(PINNED_TREE_STEPS.map((step: Step) => step.name)).toEqual(["install", "typecheck"])
  })

  /**
   * The field nothing used to assert, and the cheapest way to neuter the gate.
   *
   * An adversarial pass on this change edited `cmd: "pnpm"` to `cmd: "true"` on
   * both steps, left `args` and `failed` untouched, and got the #408 tree
   * republished to the mirror with all 27 tests green and the publisher logging
   * `installs from the registry and typechecks`. Every other assertion in this
   * file read a field that edit did not touch.
   */
  test("both steps run pnpm, not something that exits 0", () => {
    expect(PINNED_TREE_STEPS.map((step: Step) => step.cmd)).toEqual(["pnpm", "pnpm"])
  })
})

describe("checkPinnedTree", () => {
  test("every step green is a green tree", () => {
    const { run, seen } = runnerFor({})
    expect(checkPinnedTree("/tree", { run })).toEqual({ ok: true })
    expect(seen).toEqual(["install", "typecheck"])
  })

  test("it stops at the first failure", () => {
    const { run, seen } = runnerFor({ install: { ok: false, output: "ERR_PNPM_OUTDATED_LOCKFILE" } })
    expect(refused(checkPinnedTree("/tree", { run })).step.name).toBe("install")
    // A typecheck run against a failed install measures nothing and buries the
    // cause under its own noise.
    expect(seen).toEqual(["install"])
  })

  /**
   * A command that never reached a verdict is not a verdict.
   *
   * `execFileSync` throws the same way for "pnpm exited 2" and for "pnpm is not
   * on PATH" or "the 1 MiB output buffer overran" — and the second kind says
   * nothing at all about the tree. Reporting it as a type error sends whoever
   * reads it to release a package that is not broken, while the sync stays
   * refused. A wrong red here blocks delivery to every client site.
   */
  test("a command that could not run is not reported as a broken tree", () => {
    const { run } = runnerFor({})
    const spawnFailed = (step: Step, cwd: string): Result =>
      step.name === "install" ? { ok: false, ran: false, output: "spawn pnpm ENOENT" } : run(step, cwd)
    const result = refused(checkPinnedTree("/tree", { run: spawnFailed }))
    expect(result.ran).toBe(false)
    const message = describePinnedTreeFailure(result)
    expect(message).toContain("could not run its own compile gate")
    expect(message).toContain("spawn pnpm ENOENT")
    // None of the release advice, which would be about a defect that is not there.
    expect(message).not.toContain("changeset")
  })

  test("a command that did run and disagreed keeps its verdict", () => {
    const { run } = runnerFor({ typecheck: { ok: false, output: "error TS2339" } })
    expect(refused(checkPinnedTree("/tree", { run })).ran).toBe(true)
  })

  /**
   * The same distinction through the REAL runner, which is where it is actually
   * made: `execFileSync` throws identically for both, and only `error.status`
   * tells them apart.
   */
  test("the default runner tells a missing binary from a failing command", () => {
    const absent = refused(
      checkPinnedTree(os.tmpdir(), {
        steps: [{ name: "typecheck", cmd: "beyours-no-such-binary", args: [], failed: "x" }],
      }),
    )
    expect(absent.ran).toBe(false)
    expect(absent.output).toContain("ENOENT")

    const exited = refused(
      checkPinnedTree(os.tmpdir(), {
        steps: [
          {
            name: "typecheck",
            cmd: process.execPath,
            args: ["-e", "console.error('error TS2339: nope'); process.exit(2)"],
            failed: "x",
          },
        ],
      }),
    )
    expect(exited.ran).toBe(true)
    expect(exited.output).toContain("TS2339")
  })

  /**
   * Node buffers a captured child's output at 1 MiB by default and kills it
   * with ENOBUFS past that. A cold `pnpm install` of this template prints more,
   * so the default would turn every sync on a cold store into a refused one —
   * a wrong red, blocking delivery to every client, over the gate's own buffer.
   */
  test("a command that prints more than a megabyte still passes", () => {
    const noisy = checkPinnedTree(os.tmpdir(), {
      steps: [
        {
          name: "typecheck",
          cmd: process.execPath,
          args: ["-e", "process.stdout.write('x'.repeat(2 * 1024 * 1024))"],
          failed: "x",
        },
      ],
    })
    expect(noisy).toEqual({ ok: true })
  })

  /**
   * A registry hiccup is not a broken lockfile, and must not be reported as one.
   *
   * The install step fails identically for "the lockfile disagrees with the
   * manifest" and for "GitHub Packages returned 502" — and the second is not
   * this tree's fault. Told the first story, an operator goes looking at pinned
   * versions and overrides that are perfectly fine, while delivery to every
   * client site stays stopped.
   */
  test("a network failure is retried once, then reported as the environment", () => {
    let attempts = 0
    const flaky = (step: Step): Result => {
      if (step.name !== "install") return { ok: true, output: "" }
      attempts += 1
      return { ok: false, output: "ERR_PNPM_META_FETCH_FAIL  GET …: status code 502" }
    }
    const result = refused(checkPinnedTree("/tree", { run: flaky }))
    expect(attempts).toBe(2)
    expect(result.ran).toBe(false)
    const message = describePinnedTreeFailure(result)
    expect(message).toContain("could not run its own compile gate")
    expect(message).toContain("NODE_AUTH_TOKEN")
    // Never the lockfile story, which would send someone after a defect that is
    // not there.
    expect(message).not.toContain("check the pinned versions")
  })

  test("a network failure that clears on the retry lets the sync through", () => {
    let attempts = 0
    const flaky = (step: Step): Result => {
      if (step.name !== "install") return { ok: true, output: "" }
      attempts += 1
      return attempts === 1 ? { ok: false, output: "ECONNRESET" } : { ok: true, output: "" }
    }
    expect(checkPinnedTree("/tree", { run: flaky })).toEqual({ ok: true })
    expect(attempts).toBe(2)
  })

  /**
   * The compiler gets no such benefit of the doubt. `tsc` exiting non-zero has
   * JUDGED the tree, and its output is full of line and column numbers — one of
   * which must never be read as an HTTP status and retried away.
   */
  test("a compiler verdict is never reclassified, whatever numbers it prints", () => {
    let attempts = 0
    const run = (step: Step): Result => {
      if (step.name !== "typecheck") return { ok: true, output: "" }
      attempts += 1
      return { ok: false, output: "convex/orders.ts(503,401): error TS2339: nope" }
    }
    const result = refused(checkPinnedTree("/tree", { run }))
    expect(attempts).toBe(1)
    expect(result.ran).toBe(true)
    expect(describePinnedTreeFailure(result)).toContain("changeset")
  })

  test("it carries the failing command's own output back", () => {
    const compilerSaid = "convex/emailCampaigns.ts(136,49): error TS2339: Property 'markFailed' does not exist"
    const { run } = runnerFor({ typecheck: { ok: false, output: compilerSaid } })
    const result = refused(checkPinnedTree("/tree", { run }))
    expect(result.step.name).toBe("typecheck")
    expect(result.output).toBe(compilerSaid)
  })
})

describe("describePinnedTreeFailure", () => {
  const failure = (name: string, output: string) => {
    const step = PINNED_TREE_STEPS.find((s: Step) => s.name === name)!
    return describePinnedTreeFailure({ step, ran: true, output })
  }

  test("a typecheck failure quotes the compiler and names the remedy", () => {
    const message = failure(
      "typecheck",
      "convex/emailCampaigns.ts(136,49): error TS2339: Property 'markFailed' does not exist",
    )
    expect(message).toContain("does not typecheck against the versions this sync pins")
    expect(message).toContain("TS2339")
    expect(message).toContain("convex/emailCampaigns.ts")
    // The remedy is a release, and saying so matters: the tempting fix is the
    // wrong one and it ships a template missing the feature.
    expect(message).toContain("changeset")
    expect(message).toContain("Do not remove")
  })

  test("an install failure says the lockfile is the thing that disagrees", () => {
    const message = failure("install", "ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with frozen-lockfile")
    expect(message).toContain("does not install")
    expect(message).toContain("ERR_PNPM_OUTDATED_LOCKFILE")
    expect(message).toContain("overrides")
  })

  /**
   * A compiler puts its errors last, and an install prints a thousand lines
   * before failing. Keeping the tail is what makes the message readable; the
   * count says plainly that something was dropped, so nobody reads a truncated
   * log as a complete one.
   */
  test("a long output is cut from the front, and says it was", () => {
    const output = Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n")
    const message = failure("typecheck", output)
    expect(message).toContain("line 499")
    expect(message).not.toContain("line 100\n")
    expect(message).toMatch(/\d+ earlier line\(s\) omitted/)
  })
})

describe("assertTypecheckScript", () => {
  test("the template's own script passes", () => {
    const themes = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, "apps/themes/package.json"), "utf8"),
    )
    expect(assertTypecheckScript(themes.scripts)).toBeNull()
  })

  test("a mirror with no typecheck script is refused", () => {
    expect(assertTypecheckScript({})).toContain("no `typecheck` script")
    expect(assertTypecheckScript({ typecheck: "   " })).toContain("no `typecheck` script")
  })

  test("a typecheck script that runs no compiler is refused", () => {
    // The gate runs the template's script rather than a `tsc` of its own, so
    // this is the floor under that indirection: without it, a `typecheck`
    // reduced to `echo ok` turns the whole gate into a green no-op.
    expect(assertTypecheckScript({ typecheck: "echo ok" })).toContain("runs no compiler")
  })

  /**
   * Every one of these passed the first version of this guard, which tested the
   * script for the substring "tsc". An adversarial pass on this change found
   * them; `tsc --noEmit || true` is the one somebody writes for real, to unblock
   * a red CI, and it turns the gate into a green no-op over a broken template.
   */
  test.each([
    ["tsc --noEmit || true", "discards"],
    ["tsc --noEmit || :", "discards"],
    ["tsc --noEmit || exit 0", "discards"],
    ["tsc --noEmit || echo failed", "discards"],
    ["echo tsc", "runs no compiler"],
    ["true # tsc", "runs no compiler"],
    ["exit 0 # tsc --noEmit", "runs no compiler"],
    ["echo 'skipping tsc for now'", "runs no compiler"],
    ["tsc --version", "runs no compiler"],
  ])("a script that compiles nothing is refused: %s", (script, because) => {
    expect(assertTypecheckScript({ typecheck: script })).toContain(because)
  })

  /**
   * The other half. A guard that refuses a sound script costs a refused sync,
   * which stops delivery to every client site — strictly worse than the miss.
   */
  test.each([
    "tsc --noEmit && tsc --noEmit -p convex/tsconfig.json",
    "npx tsc --noEmit",
    "pnpm exec tsc -p tsconfig.json",
    "NODE_OPTIONS=--max-old-space-size=4096 tsc --noEmit",
    "tsc -p tsconfig.json && tsc -p convex/tsconfig.json",
  ])("a script that does compile is accepted: %s", (script) => {
    expect(assertTypecheckScript({ typecheck: script })).toBeNull()
  })
})

/**
 * The coverage claim the gate leans on, asserted where a wrong answer costs a
 * red test rather than a refused sync.
 *
 * `apps/themes/tsconfig.json` EXCLUDES `convex/`. The root project therefore
 * reaches a backend module only when app code transitively imports one — its
 * coverage of the backend is incidental, and `convex/` is where every recorded
 * occurrence of this class has landed. The second invocation is what compiles
 * all of it.
 */
describe("the template's typecheck script", () => {
  const themes = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "apps/themes/package.json"), "utf8"))

  test("it compiles the app and the backend, as two projects", () => {
    expect(themes.scripts.typecheck).toContain("tsc --noEmit")
    expect(themes.scripts.typecheck).toContain("-p convex/tsconfig.json")
  })

  test("the root project still excludes convex, which is why the second one exists", () => {
    const tsconfig = fs.readFileSync(path.join(REPO_ROOT, "apps/themes/tsconfig.json"), "utf8")
    // Trailing commas and comments — read for the exclusion, not parsed.
    expect(tsconfig).toMatch(/"exclude"[\s\S]*"convex"/)
  })
})

/**
 * The one test here that runs a real compiler, on a miniature of the real
 * defect: a dependency in `node_modules` that resolves, ships its file, and
 * simply does not have the symbol the tree reads off it.
 *
 * Everything above this point is arithmetic over an injected runner, and
 * arithmetic cannot tell you that `execFileSync` captures a compiler's output,
 * that a non-zero exit is seen as a failure, or that TS2339 is what a missing
 * named export actually produces. `tsc` on eight lines answers all three in a
 * couple of seconds.
 *
 * No install: the fixture writes `node_modules` itself, which is what an
 * install would have produced. `--frozen-lockfile` against a registry belongs
 * to the sync, not to a unit suite.
 */
describe("a real compiler, against a dependency missing a named export", () => {
  /**
   * The workspace's own tsc, by absolute path.
   *
   * `npx tsc` would resolve against the FIXTURE's cwd — a bare directory under
   * /tmp with no node_modules — and so pick up whatever tsc is global, or
   * download `typescript@latest` from the network mid-test. Measured here: 6.0.2
   * in /tmp against the 5.9.3 this workspace pins. A suite that silently
   * compiles with a different compiler from the one the product uses is not
   * measuring the product.
   */
  const TSC = path.join(REPO_ROOT, "node_modules/.bin/tsc")

  const TYPECHECK_ONLY = [
    { name: "typecheck", cmd: TSC, args: ["--noEmit"], failed: "the tree does not typecheck" },
  ]

  const stage = (engineSource: string) => {
    const tree = fs.mkdtempSync(path.join(os.tmpdir(), "beyours-pinned-tree-"))
    const engine = path.join(tree, "node_modules/@be-yours/convex-functions")
    fs.mkdirSync(path.join(engine, "src"), { recursive: true })
    fs.writeFileSync(
      path.join(engine, "package.json"),
      JSON.stringify({
        name: "@be-yours/convex-functions",
        version: "5.0.0",
        types: "./src/emailCampaigns.ts",
        exports: { "./emailCampaigns": "./src/emailCampaigns.ts" },
      }),
    )
    fs.writeFileSync(path.join(engine, "src/emailCampaigns.ts"), engineSource)
    fs.writeFileSync(
      path.join(tree, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          noEmit: true,
          strict: true,
          module: "esnext",
          moduleResolution: "bundler",
          target: "ES2022",
        },
        include: ["convex/**/*.ts"],
      }),
    )
    fs.mkdirSync(path.join(tree, "convex"))
    fs.writeFileSync(
      path.join(tree, "convex/emailCampaigns.ts"),
      [
        'import * as defs from "@be-yours/convex-functions/emailCampaigns"',
        "export const markFailed = defs.markFailed",
        "",
      ].join("\n"),
    )
    return tree
  }

  const shipped = 'export const markSent = { name: "markSent" }\n'
  const withMarkFailed = shipped + 'export const markFailed = { name: "markFailed" }\n'

  test("the version without the symbol is refused, and the message names it", () => {
    const tree = stage(shipped)
    try {
      const result = refused(checkPinnedTree(tree, { steps: TYPECHECK_ONLY }))
      expect(result.output).toContain("TS2339")
      expect(result.output).toContain("markFailed")
      expect(describePinnedTreeFailure(result)).toContain("markFailed")
    } finally {
      fs.rmSync(tree, { recursive: true, force: true })
    }
  })

  test("the version that ships it passes — so the red above is the symbol, not the fixture", () => {
    const tree = stage(withMarkFailed)
    try {
      expect(checkPinnedTree(tree, { steps: TYPECHECK_ONLY })).toEqual({ ok: true })
    } finally {
      fs.rmSync(tree, { recursive: true, force: true })
    }
  })

  test("the compiler the two tests above ran is this workspace's own", () => {
    // The same binary, asked for its version: a guard that checked a different
    // tsc from the one under test would be exactly the defect it exists to
    // prevent.
    expect(fs.existsSync(TSC)).toBe(true)
    const version = execFileSync(TSC, ["--version"], { encoding: "utf8" }).trim()
    const pinned = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, "apps/themes/package.json"), "utf8"),
    ).devDependencies.typescript
    expect(version).toMatch(/^Version \d+\./)
    // `^5.9.3` and `Version 5.9.3` — majors must agree, which is what a
    // silently downloaded `typescript@latest` would break.
    expect(version.replace("Version ", "").split(".")[0]).toBe(pinned.replace(/^[\^~]/, "").split(".")[0])
  })
})

/**
 * A guard nobody calls is a comment. These assert the publisher runs this one,
 * fails on it, and does so before the push — the same shape as the block at
 * the foot of `mirror-engine-exports.test.ts`, for the same reason.
 */
describe("the publisher runs the guard", () => {
  const publisher = fs.readFileSync(path.join(REPO_ROOT, "scripts/publish-mirror.mjs"), "utf8")

  test("it imports the check", () => {
    expect(publisher).toContain("mirror-typecheck.mjs")
    expect(publisher).toContain("checkPinnedTree")
  })

  test("it fails the run rather than warning", () => {
    expect(publisher).toContain("if (!compiled.ok) fail(describePinnedTreeFailure(compiled))")
    expect(publisher).toContain("if (badScript) fail(badScript)")
  })

  /**
   * Before `git status`, and so before both exits below it: the "already up to
   * date" one, which would otherwise report success over a delivered template
   * that cannot compile — the exact state #408 describes — and the push.
   */
  test("it compiles before it decides there is nothing to do", () => {
    expect(publisher.indexOf("checkPinnedTree(")).toBeLessThan(
      publisher.indexOf('run("git", ["status", "--porcelain"]'),
    )
  })

  test("it compiles before it pushes", () => {
    expect(publisher.indexOf("checkPinnedTree(")).toBeLessThan(
      publisher.indexOf('run("git", ["push"'),
    )
  })

  /**
   * In a sandbox, never in the clone. The clone is committed and pushed to the
   * repository every client site merges from, and an install leaves
   * `node_modules` and build state behind in it. That those are gitignored
   * today is not a property worth betting a client's repository on.
   */
  test("it installs into a sandbox, not into the clone it is about to push", () => {
    expect(publisher).toContain("const sandbox = join(work, \"typecheck\")")
    // `tracked` too: the sandbox has to be the same FILE SET as the push, not
    // just the same source directory. `mirror-publisher.test.ts` asserts both
    // calls take it.
    expect(publisher).toContain(
      "materializeMirror(SOURCE, sandbox, { prune: false, tracked })",
    )
    expect(publisher).toContain("checkPinnedTree(sandbox)")
    expect(publisher).not.toContain("checkPinnedTree(clone)")
  })

  /**
   * The sandbox is the tree being pushed, or it measures nothing: the same
   * source through the same `materializeMirror`, the same rewritten
   * package.json string, and the lockfile the clone just generated.
   */
  test("the sandbox carries the rewritten package.json and the generated lockfile", () => {
    expect(publisher).toContain('writeFileSync(join(sandbox, "package.json"), contents)')
    expect(publisher).toContain('copyFileSync(lockfile, join(sandbox, "pnpm-lock.yaml"))')
  })
})
