/**
 * The rule that guards 154 markers, finally guarded itself.
 *
 * `eslint/convex-auth.mjs` had no test of any kind. #445 ran a synthetic
 * harness of twelve declarations against it on ESLint 9.39.4 — one control that
 * must error, one control that must pass, and ten known ways to talk past it —
 * and TEN OF THE TWELVE SLIPPED. A rule nothing tests is a rule whose green run
 * means nothing, and this one had a real exploit riding on it: the permission
 * check in `convex/validateIntegration.ts` sat inside `if (!identity) {…}`,
 * where no signed-in caller reaches it, and the rule passed the file because
 * the STRINGS `ctx.auth` and `ctx.runQuery(` appeared somewhere nearby.
 *
 * This file is that harness, kept. Each case states what a linter can and
 * cannot conclude, so a future relaxation of the rule has to argue with a named
 * failure rather than a silent one.
 *
 * IT SITS BESIDE `convex-auth-rule.test.ts` RATHER THAN REPLACING IT. That file
 * arrived on `main` in #446 and is a `RuleTester` suite of the shapes the rule
 * must ACCEPT — the honest guards, written the several ways this codebase
 * writes them. The two ask opposite questions, and a rule needs both: one that
 * it does not shout at correct code, one that it cannot be talked past. The
 * rule in this branch passes both.
 *
 * Case K is deliberately asserted as PASSING. A marker whose reason is long but
 * meaningless cannot be caught by a linter, and pretending otherwise would be
 * the same kind of decorative check this file exists to remove. It is review's
 * job, and it is now the ONLY part left to review.
 */

import { describe, expect, it } from "vitest"
import { Linter } from "eslint"

import convexAuth from "../../eslint/convex-auth.mjs"

const linter = new Linter()

/** Lint one snippet with both rules on, as an app's `convex/` config does. */
function lint(code: string): string[] {
  const messages = linter.verify(code, {
    plugins: { convex: convexAuth as never },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "convex/no-unguarded-convex-function": "error",
      "convex/require-convex-permission": "error",
    },
  })
  return messages.map((m) => String(m.messageId ?? m.message))
}

/** Did the rule object to this snippet at all? */
const rejects = (code: string) => lint(code).length > 0

describe("the two controls", () => {
  it("A — reports a bare mutation carrying no marker", () => {
    expect(
      rejects(`
        export const remove = mutation({
          args: {},
          handler: async (ctx) => { await ctx.db.delete("x") },
        })
      `),
    ).toBe(true)
  })

  it("J — reports @guarded-inline with no guard signal at all", () => {
    expect(
      rejects(`
        // @guarded-inline: this is checked somewhere else entirely
        export const remove = mutation({
          args: {},
          handler: async (ctx) => { await ctx.db.delete("x") },
        })
      `),
    ).toBe(true)
  })

  it("accepts a real inline guard, so the rule stays usable", () => {
    // The shape every honest guard in this repository already has: obtain the
    // caller, then refuse them. If this ever reports, the rule is too strict
    // and 98 `@guarded-inline` markers are about to be rewritten for nothing.
    expect(
      lint(`
        // @guarded-inline: stores:write checked in the handler; no store exists yet
        export const create = authedMutation({
          args: {},
          handler: async (ctx, args) => {
            const user = await getAuthUser(ctx)
            if (!hasPermission(user.role, "stores:write")) {
              throw new Error("Access denied")
            }
            return defs.create.handler(ctx, args)
          },
        })
      `),
    ).toEqual([])
  })

  it("accepts a storeMutation that names a write permission", () => {
    expect(
      lint(`
        export const update = storeMutation({
          args: {},
          permission: "products:write",
          handler: async (ctx) => { await ctx.db.patch("x", {}) },
        })
      `),
    ).toEqual([])
  })

  it("accepts internal builders, which no client can call", () => {
    expect(
      lint(`
        export const recount = internalMutation({
          args: {},
          handler: async (ctx) => { await ctx.db.patch("x", {}) },
        })
      `),
    ).toEqual([])
  })

  it("accepts the non-function exports a convex/ file also carries", () => {
    // Validators, routers and cron tables are not Convex functions, and
    // reporting them is how a rule gets switched off.
    expect(
      lint(`
        export const status = v.union(v.literal("a"), v.literal("b"))
        export const http = httpRouter()
        export const crons = cronJobs()
      `),
    ).toEqual([])
  })
})

describe("the ten evasions #445 measured, all closed", () => {
  it("B — @guarded-inline whose only signal obtains an identity and never checks it", () => {
    expect(
      rejects(`
        // @guarded-inline: reads the caller's identity before acting
        export const probe = action({
          args: {},
          handler: async (ctx) => {
            await ctx.auth.getUserIdentity()
            return { ok: true }
          },
        })
      `),
    ).toBe(true)
  })

  it("C — @guarded-inline whose only guard signal is text inside a comment", () => {
    // The rule read `sourceCode.getText()`, which includes comments. Prose
    // about a guard counted as a guard.
    expect(
      rejects(`
        // @guarded-inline: the handler calls requirePermission and ctx.runQuery
        export const probe = action({
          args: {},
          // we would call ctx.auth.getUserIdentity() here
          handler: async () => ({ ok: true }),
        })
      `),
    ).toBe(true)
  })

  it("D — a read permission declared on an operation that deletes", () => {
    expect(
      rejects(`
        export const remove = storeMutation({
          args: {},
          permission: "orders:read",
          handler: async (ctx) => { await ctx.db.delete("x") },
        })
      `),
    ).toBe(true)
  })

  it("E — storeMutation with permission: undefined", () => {
    expect(
      rejects(`
        export const remove = storeMutation({
          args: {},
          permission: undefined,
          handler: async (ctx) => { await ctx.db.delete("x") },
        })
      `),
    ).toBe(true)
  })

  it("F — an unknown builder the rule had nothing to say about", () => {
    expect(
      rejects(`
        export const remove = publicMutation({
          args: {},
          handler: async (ctx) => { await ctx.db.delete("x") },
        })
      `),
    ).toBe(true)
  })

  it("G — a member-expression builder", () => {
    // `node.callee.type !== "Identifier"` returned early, so `server.mutation`
    // was invisible.
    expect(
      rejects(`
        export const remove = server.mutation({
          args: {},
          handler: async (ctx) => { await ctx.db.delete("x") },
        })
      `),
    ).toBe(true)
  })

  it("H — an aliased builder", () => {
    expect(
      rejects(`
        const m = mutation
        export const remove = m({
          args: {},
          handler: async (ctx) => { await ctx.db.delete("x") },
        })
      `),
    ).toBe(true)
  })

  it("I — a variable merely NAMED like a guard, never called", () => {
    expect(
      rejects(`
        // @guarded-inline: requireOwner is applied to every caller here
        export const probe = action({
          args: {},
          handler: async () => {
            const requireOwner = true
            return { ok: requireOwner }
          },
        })
      `),
    ).toBe(true)
  })

  it("L — @guarded-inline whose ctx.runQuery sits on a branch no caller takes", () => {
    // THE LIVE EXPLOIT, reduced. `validateIntegration` put the permission check
    // inside `if (!identity)`, so only unauthenticated callers reached it — and
    // they were rejected on the next line anyway.
    expect(
      rejects(`
        // @guarded-inline: checks settings:read by role — no store to scope against
        export const validate = action({
          args: {},
          handler: async (ctx) => {
            const identity = await ctx.auth.getUserIdentity()
            if (!identity) {
              await ctx.runQuery(internal.authHelpers.checkPermission, {
                permission: "settings:read",
              })
              return { valid: false, error: "Non authentifié" }
            }
            return { valid: true }
          },
        })
      `),
    ).toBe(true)
  })

  it("K — a long but meaningless reason still passes, and that is honest", () => {
    // Not a gap being tolerated quietly: a sentence cannot be graded by a
    // linter, and the length floor is a filter for shrugs. Asserting the true
    // behaviour here keeps the limit visible instead of implied.
    expect(
      lint(`
        // @public-by-design: this is fine for reasons that are described at length here
        export const list = query(defs.list)
      `),
    ).toEqual([])
  })
})

describe("the guard has to be on the path every caller takes", () => {
  it("accepts a guard called unconditionally", () => {
    expect(
      lint(`
        // @guarded-inline: settings:read checked by role before anything else runs
        export const validate = action({
          args: {},
          handler: async (ctx) => {
            await ctx.runQuery(internal.authHelpers.checkPermission, {
              permission: "settings:read",
            })
            return { valid: true }
          },
        })
      `),
    ).toEqual([])
  })

  it("accepts a guard called in an `if` CONDITION, which everyone evaluates", () => {
    expect(
      lint(`
        // @guarded-inline: refuses any caller the permission query rejects
        export const validate = action({
          args: {},
          handler: async (ctx) => {
            if (!(await ctx.runQuery(internal.authHelpers.checkPermission, {}))) {
              throw new Error("denied")
            }
            return { valid: true }
          },
        })
      `),
    ).toEqual([])
  })

  it("reports a guard reachable only from a catch block", () => {
    expect(
      rejects(`
        // @guarded-inline: the permission check runs when the call fails
        export const validate = action({
          args: {},
          handler: async (ctx) => {
            try {
              return { valid: true }
            } catch {
              await ctx.runQuery(internal.authHelpers.checkPermission, {})
            }
          },
        })
      `),
    ).toBe(true)
  })
})
