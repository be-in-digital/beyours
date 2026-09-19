/**
 * Who sees which establishments (#94).
 *
 * The administration list was gated on `requireStaff` alone: any staff role got
 * the name, address, phone, email, opening hours and delivery radius of every
 * establishment of the chain. One Convex instance per client means this was
 * never a cross-client leak — it was an employee of one restaurant reading
 * their employer's others.
 */

import { describe, expect, test } from "vitest"
import { Role } from "@be-yours/core/auth/rbac"
import { seesEveryStore } from "../auth"
import { listByIds } from "../stores"

describe("seesEveryStore", () => {
  test("the super admin's remit is the chain", () => {
    // On a fresh deployment the first administrator holds no store at all, so
    // scoping them to `storeIds` would leave the back office empty for the one
    // account meant to set it up.
    expect(seesEveryStore(Role.SUPER_ADMIN)).toBe(true)
  })

  test.each([Role.CLIENT_ADMIN, Role.MANAGER, Role.KITCHEN, Role.WAITER, Role.DELIVERY])(
    "%s is scoped to their own establishments",
    (role) => {
      expect(seesEveryStore(role)).toBe(false)
    }
  )

  test("the client admin is scoped too, not just the staff below them", () => {
    // Their profile's `storeIds` is the same list `requireStoreAccess` and
    // `assertCanManageMember` already read; widening it here would put the
    // administration list out of step with every other guard.
    expect(seesEveryStore(Role.CLIENT_ADMIN)).toBe(false)
  })
})

describe("listByIds", () => {
  const store = (id: string, creationTime: number) => ({
    _id: id,
    _creationTime: creationTime,
    name: `Store ${id}`,
  })

  /** A `ctx` with just the one method `listByIds` touches. */
  function ctxWith(rows: Record<string, unknown>) {
    const reads: string[] = []
    return {
      reads,
      ctx: {
        db: {
          get: async (id: string) => {
            reads.push(id)
            return rows[id] ?? null
          },
        },
      },
    }
  }

  test("returns the establishments asked for, in creation order", async () => {
    const { ctx } = ctxWith({
      b: store("b", 200),
      a: store("a", 100),
    })

    const result = await listByIds.handler(ctx, { ids: ["b", "a"] })

    // Creation order, not the order of the profile's list: the selector's
    // "first store" fallback depends on matching what `listAll` returns.
    expect(result.map((s: { _id: string }) => s._id)).toEqual(["a", "b"])
  })

  test("reads only the rows it was asked for", async () => {
    const { ctx, reads } = ctxWith({ a: store("a", 100), b: store("b", 200) })

    await listByIds.handler(ctx, { ids: ["a"] })

    // A member of one restaurant must not cause every restaurant to be read to
    // answer a question about theirs.
    expect(reads).toEqual(["a"])
  })

  test("drops an establishment that has been deleted", async () => {
    const { ctx } = ctxWith({ a: store("a", 100) })

    const result = await listByIds.handler(ctx, { ids: ["a", "gone"] })

    // One stale id on a profile must not blank the whole administration.
    expect(result.map((s: { _id: string }) => s._id)).toEqual(["a"])
  })

  test("an empty list is an empty answer, not an error", async () => {
    const { ctx } = ctxWith({})

    await expect(listByIds.handler(ctx, { ids: [] })).resolves.toEqual([])
  })
})
