import { describe, expect, test } from "vitest"

import { classifyLookup, lookupPublishedVersion } from "../../../scripts/lib/registry.mjs"

/**
 * "The registry has no such package" and "the registry did not answer" are
 * different answers, and `publishedVersion` returns `null` for both.
 *
 * WHY THIS FILE EXISTS. `check:source-drift` was extended to fail when a
 * package declares a subpath its published version does not carry — the
 * deadlock that has now stalled the mirror five times. The first version of
 * that gate called `publishedVersion`, read its `null` as "never published,
 * nothing to check", and passed. Run on a machine with no `NODE_AUTH_TOKEN` it
 * reported a clean bill of health for ten packages it had not looked at once.
 * That is worse than not having the gate: a green tick with nothing behind it,
 * which is the exact shape of the failure the gate was written to catch.
 *
 * WHY IT DOES NOT TOUCH THE NETWORK, which the first version of this file did.
 * It asked npm for a name nobody has published and asserted the 404. Run alone
 * it passed; run inside `pnpm test` it failed after 140 seconds, because a
 * loaded runner got a timeout instead — and a timeout is `known: false`, which
 * is the correct answer to a question this test was pretending to ask. A guard
 * about whether the registry answered must not depend on the registry
 * answering. `classifyLookup` is the judgement, `ask` is the call, and only the
 * judgement is tested here.
 */

/** An npm invocation that failed with this on stderr. */
const failing = (stderr: string) => () => {
  const error = new Error("npm view failed") as Error & { stderr: string }
  error.stderr = stderr
  throw error
}

describe("classifyLookup", () => {
  test("a version npm printed is a version", () => {
    expect(classifyLookup({ stdout: "4.0.0\n" })).toEqual({ version: "4.0.0", known: true })
  })

  test("a 404 is the registry answering: known, and absent", () => {
    for (const stderr of [
      "npm error code E404\nnpm error 404 Not Found - GET https://npm.pkg.github.com/@be-yours%2fnope",
      "npm ERR! 404 Not Found - GET https://registry.npmjs.org/nope",
    ]) {
      expect(classifyLookup({ failure: stderr })).toEqual({ version: null, known: true })
    }
  })

  test("anything else is the registry declining to say", () => {
    // Every one of these produced the same `null` from `publishedVersion` as a
    // genuine 404, and the first draft of the subpath gate read all of them as
    // "nothing to check".
    for (const stderr of [
      "npm error code ENEEDAUTH\nnpm error need auth This command requires you to be logged in",
      "npm error code E401\nnpm error 401 Unauthorized",
      "npm error code E403\nnpm error 403 Forbidden",
      "npm error network request to https://npm.pkg.github.com/ failed, reason: ETIMEDOUT",
    ]) {
      const result = classifyLookup({ failure: stderr })
      expect(result.known).toBe(false)
      expect(result.version).toBeNull()
      expect(result.reason).toBeTruthy()
    }
  })

  test("an empty answer is not a version", () => {
    // `npm view` printing nothing is not a package at version "".
    expect(classifyLookup({ stdout: "   \n" })).toEqual({ version: null, known: true })
  })

  test("a failure with nothing on stderr still says it did not know", () => {
    expect(classifyLookup({ failure: "\n\n" })).toEqual({
      version: null,
      known: false,
      reason: "npm view failed",
    })
  })
})

describe("lookupPublishedVersion", () => {
  test("passes the package name to the call and returns its judgement", () => {
    const asked: string[] = []
    const result = lookupPublishedVersion("@be-yours/ui", {
      ask: (pkg: string) => {
        asked.push(pkg)
        return "4.0.0\n"
      },
    })

    expect(asked).toEqual(["@be-yours/ui"])
    expect(result).toEqual({ version: "4.0.0", known: true })
  })

  test("turns a thrown npm invocation into an answer rather than a crash", () => {
    // The caller is a check that must report; an exception here would take the
    // whole run down over one unreachable package.
    expect(
      lookupPublishedVersion("@be-yours/ui", { ask: failing("npm error code ENEEDAUTH") }),
    ).toMatchObject({ known: false, version: null })
  })
})
