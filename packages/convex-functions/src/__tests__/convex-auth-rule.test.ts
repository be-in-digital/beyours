/**
 * Tests for the ESLint rules that guard the Convex authorisation seam.
 *
 * The rules had none, which is how they came to be wrong in three ways at once
 * and stay that way: `httpAction` was never covered, a marker counted as a
 * substring of any comment, and `@guarded-inline` asserted something nothing
 * checked. A rule with no tests is a rule nobody can change safely, and this
 * one decides whether a Convex function is allowed to be reachable.
 *
 * The cases below are written as talking-around attempts, because that is what
 * the rule is for: not catching an honest mistake, but catching the shortcut
 * taken by someone who wants the error to go away.
 */

import { RuleTester } from "eslint"
import { describe, it } from "vitest"
// @ts-expect-error — the rule module is plain ESM JavaScript with no types.
import { noUnguardedConvexFunction, requireConvexPermission } from "../../eslint/convex-auth.mjs"

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module" },
})

describe("no-unguarded-convex-function", () => {
  it("applies the seam", () => {
    ruleTester.run("no-unguarded-convex-function", noUnguardedConvexFunction, {
      valid: [
        // The normal shape: scoped to a tenant, with a permission.
        `export const list = storeQuery({ permission: "team:read", handler: h })`,

        // A real escape hatch, with a reason long enough to weigh.
        `// @public-by-design: the storefront catalogue is open to anyone
         export const list = query({ handler: h })`,

        // `@guarded-inline` backed by a session lookup.
        `// @guarded-inline: derives the caller from the session, takes no id
         export const mine = query({ handler: async (ctx) => {
           const identity = await ctx.auth.getUserIdentity()
           return identity ? [] : []
         } })`,

        // Backed by an internal check instead — the only shape an action has.
        `// @guarded-inline: authorises through an internal query first
         export const send = action({ handler: async (ctx) => {
           await ctx.runQuery(internal.team.assertCanManage, {})
         } })`,

        // Backed by a require*/assert*/check* call.
        `// @guarded-inline: requireStaff applies the roster policy here
         export const all = query({ handler: async (ctx) => requireStaff(ctx) })`,

        // Rebuilding the declaration from tokens puts a space at every token
        // boundary, so a member expression the source writes tight arrives as
        // `ctx . auth . getUserIdentity ( )`. Every signal has to survive that,
        // and this is the case that says so.
        `// @guarded-inline: reads the session off the request context
         export const mine = action({ handler: async (ctx) => {
           const who = await ctx
             .auth
             .getUserIdentity()
           return who ? [] : []
         } })`,

        // `safeGetAuthUser` is the session lookup under another name, and the
        // first spelling this rule failed to recognise.
        `// @guarded-inline: returns the caller's own session user
         export const me = query({ handler: (ctx) => authComponent.safeGetAuthUser(ctx) })`,

        // An HTTP route that names the proof it relies on.
        `// @guarded-inline: verifies the HMAC over the raw body before reading it
         export const hook = httpAction(async (ctx, request) => {
           await ctx.runAction(internal.verify.signature, {})
         })`,

        // Internal functions are not publicly callable and are not the rule's business.
        `export const sweep = internalMutation({ handler: h })`,

        // A known hole, named and owned. The marker is not absolution — it is
        // the to-do list, and `grep -rn "@unguarded-tracked"` is how you read it.
        `// @unguarded-tracked: #162 — no CSRF state on this OAuth callback
         export const cb = httpAction(async () => new Response("ok"))`,
      ],

      invalid: [
        // The original habit.
        {
          code: `export const create = mutation({ handler: h })`,
          errors: [{ messageId: "bare" }],
        },
        {
          code: `export const list = authedQuery({ handler: h })`,
          errors: [{ messageId: "authOnly" }],
        },
        {
          code: `export const run = action({ handler: h })`,
          errors: [{ messageId: "bareAction" }],
        },

        // The blind spot: an HTTP route is the one surface reachable with
        // nothing but curl, and it was the one the rule never looked at.
        {
          code: `export const hook = httpAction(async () => new Response("ok"))`,
          errors: [{ messageId: "bareHttp" }],
        },

        // Prose ABOUT the marker used to silence the rule, because the check
        // was a substring match on the whole comment.
        {
          code: `// this endpoint is deliberately not @public-by-design, see the ticket
                 export const create = mutation({ handler: h })`,
          errors: [{ messageId: "bare" }],
        },

        // A marker with nothing after it says only "I wanted this to pass".
        {
          code: `// @public-by-design:
                 export const create = mutation({ handler: h })`,
          errors: [{ messageId: "missingReason" }],
        },
        {
          code: `// @guarded-inline: ok
                 export const create = mutation({ handler: h })`,
          errors: [{ messageId: "missingReason" }],
        },

        // The claim that used to cost nothing to make: "this is guarded"
        // pasted above a handler that guards nothing.
        {
          code: `// @guarded-inline: the caller is obviously allowed to do this
                 export const wipe = mutation({ handler: async (ctx) => {
                   await ctx.db.delete(args.id)
                 } })`,
          errors: [{ messageId: "guardedWithoutGuard" }],
        },
        {
          code: `// @guarded-inline: the provider signs every request it sends
                 export const hook = httpAction(async () => new Response("ok"))`,
          errors: [{ messageId: "guardedWithoutGuard" }],
        },

        // "We know, we know" with nobody on the hook for it.
        {
          code: `// @unguarded-tracked: we should really add a state check here
                 export const cb = httpAction(async () => new Response("ok"))`,
          errors: [{ messageId: "trackedWithoutIssue" }],
        },

        // The fourth way around, and the one the marker's own docblock says it
        // exists to stop: the guard signal was tested against the declaration's
        // TEXT, comments included, so writing the name of a guard in a comment
        // satisfied a check about code. Nothing here authorises anything.
        {
          code: `// @guarded-inline: the caller is checked before we get here
                 export const wide = action({ handler: async () => {
                   // the caller already went through ctx.auth.getUserIdentity()
                   return await fetch("https://example.test")
                 } })`,
          errors: [{ messageId: "guardedWithoutGuard" }],
        },
        {
          code: `// @guarded-inline: requireStaff is applied by the caller
                 export const wipe = mutation({ handler: async (ctx) => {
                   /* requireStaff(ctx) — see the admin route */
                   await ctx.db.delete(args.id)
                 } })`,
          errors: [{ messageId: "guardedWithoutGuard" }],
        },
      ],
    })
  })
})

describe("require-convex-permission", () => {
  it("makes a store-scoped function say what it allows", () => {
    ruleTester.run("require-convex-permission", requireConvexPermission, {
      valid: [`export const list = storeQuery({ permission: "orders:read", handler: h })`],
      invalid: [
        {
          code: `export const list = storeQuery({ handler: h })`,
          errors: [{ messageId: "missing" }],
        },
      ],
    })
  })
})
