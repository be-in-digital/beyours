/**
 * The audit trail for who may do what.
 *
 * `userProfiles` is where every guard resolves rights from, and nothing
 * recorded a change to it: a manager could be promoted, moved, narrowed or
 * dismissed and the log showed nothing. These tests pin the two decisions that
 * make such a trail worth reading — what counts as a change, and which of them
 * is a REVOCATION, the entry an owner actually comes looking for.
 */

import { describe, expect, test, vi } from "vitest"
import { Role } from "@be-yours/core/auth/rbac"
import {
  ACCESS_AUDIT_ACTIONS,
  ACCESS_AUDIT_OPERATIONS,
  classifyAccessChange,
  diffAccess,
  recordAccessAudit,
  serializeAccessDetails,
  SYSTEM_ACTOR,
} from "../accessAudit"

const STORE_A = "stores:a"
const STORE_B = "stores:b"

describe("diffAccess", () => {
  test("an unchanged profile produces no entry", () => {
    // Re-saving a profile unchanged is normal in the admin. A trail that fills
    // with "no change" is one nobody reads, which is the same as none.
    const same = { role: Role.MANAGER, storeIds: [STORE_A], permissions: ["orders"] }

    expect(diffAccess(same, { ...same })).toBeNull()
  })

  test("a first profile reads as coming from nothing", () => {
    expect(diffAccess(null, { role: Role.WAITER, storeIds: [STORE_A] })).toEqual({
      role: { from: "none", to: Role.WAITER },
      storeIds: { added: [STORE_A], removed: [] },
    })
  })

  test("records a promotion", () => {
    const change = diffAccess(
      { role: Role.WAITER, storeIds: [STORE_A] },
      { role: Role.MANAGER, storeIds: [STORE_A] }
    )

    expect(change).toEqual({ role: { from: Role.WAITER, to: Role.MANAGER } })
  })

  test("records establishments gained and lost in one entry", () => {
    const change = diffAccess(
      { role: Role.MANAGER, storeIds: [STORE_A] },
      { role: Role.MANAGER, storeIds: [STORE_B] }
    )

    expect(change).toEqual({
      storeIds: { added: [STORE_B], removed: [STORE_A] },
    })
  })

  test("records a narrowing of modules", () => {
    const change = diffAccess(
      { role: Role.MANAGER, storeIds: [STORE_A], permissions: ["orders", "settings"] },
      { role: Role.MANAGER, storeIds: [STORE_A], permissions: ["orders"] }
    )

    expect(change).toEqual({ permissions: { added: [], removed: ["settings"] } })
  })

  test("treats a missing module list as empty rather than as a change", () => {
    expect(
      diffAccess(
        { role: Role.MANAGER, storeIds: [STORE_A] },
        { role: Role.MANAGER, storeIds: [STORE_A], permissions: [] }
      )
    ).toBeNull()
  })
})

describe("classifyAccessChange", () => {
  test("a first profile is a grant", () => {
    expect(
      classifyAccessChange(null, { role: Role.MANAGER, storeIds: [STORE_A] })
    ).toBe(ACCESS_AUDIT_ACTIONS.granted)
  })

  test("dropping to customer is a revocation, not a change", () => {
    // Losing the role IS the loss of access; reading it as a mere change would
    // hide the event an owner most wants to find.
    expect(
      classifyAccessChange(
        { role: Role.MANAGER, storeIds: [STORE_A] },
        { role: Role.CUSTOMER, storeIds: [] }
      )
    ).toBe(ACCESS_AUDIT_ACTIONS.revoked)
  })

  test("losing the last establishment is a revocation too", () => {
    expect(
      classifyAccessChange(
        { role: Role.MANAGER, storeIds: [STORE_A] },
        { role: Role.MANAGER, storeIds: [] }
      )
    ).toBe(ACCESS_AUDIT_ACTIONS.revoked)
  })

  test("losing one of two establishments is a change", () => {
    expect(
      classifyAccessChange(
        { role: Role.MANAGER, storeIds: [STORE_A, STORE_B] },
        { role: Role.MANAGER, storeIds: [STORE_A] }
      )
    ).toBe(ACCESS_AUDIT_ACTIONS.changed)
  })

  test("a promotion is a change", () => {
    expect(
      classifyAccessChange(
        { role: Role.WAITER, storeIds: [STORE_A] },
        { role: Role.MANAGER, storeIds: [STORE_A] }
      )
    ).toBe(ACCESS_AUDIT_ACTIONS.changed)
  })
})

describe("recordAccessAudit", () => {
  function ctxWith(identity: { subject: string } | null) {
    const inserted: Array<{ table: string; doc: Record<string, unknown> }> = []
    return {
      inserted,
      ctx: {
        auth: { getUserIdentity: async () => identity },
        db: {
          insert: async (table: string, doc: Record<string, unknown>) => {
            inserted.push({ table, doc })
            return "audit:1"
          },
        },
      },
    }
  }

  test("writes one entry naming the target, the actor and the action", async () => {
    const { ctx, inserted } = ctxWith({ subject: "user:owner" })

    const written = await recordAccessAudit(ctx, {
      targetUserId: "user:yanis",
      operation: ACCESS_AUDIT_OPERATIONS.assign,
      before: { role: Role.WAITER, storeIds: [STORE_A] },
      after: { role: Role.MANAGER, storeIds: [STORE_A] },
    })

    expect(written).toBe(true)
    expect(inserted).toHaveLength(1)
    expect(inserted[0]?.table).toBe("systemAuditLog")
    expect(inserted[0]?.doc).toMatchObject({
      action: ACCESS_AUDIT_ACTIONS.changed,
      performedBy: "user:owner",
      targetUserId: "user:yanis",
      result: "success",
    })
  })

  test("writes nothing when nothing changed", async () => {
    const { ctx, inserted } = ctxWith({ subject: "user:owner" })
    const same = { role: Role.MANAGER, storeIds: [STORE_A] }

    const written = await recordAccessAudit(ctx, {
      targetUserId: "user:yanis",
      operation: ACCESS_AUDIT_OPERATIONS.assign,
      before: same,
      after: { ...same },
    })

    expect(written).toBe(false)
    expect(inserted).toHaveLength(0)
  })

  test("names the actor 'system' when no session is attached", async () => {
    // Seeds, imports and scheduled jobs legitimately run without one.
    const { ctx, inserted } = ctxWith(null)

    await recordAccessAudit(ctx, {
      targetUserId: "user:yanis",
      operation: ACCESS_AUDIT_OPERATIONS.invitationAccepted,
      before: null,
      after: { role: Role.KITCHEN, storeIds: [STORE_A] },
    })

    expect(inserted[0]?.doc).toMatchObject({ performedBy: SYSTEM_ACTOR })
  })

  test("records the resulting state alongside the diff", async () => {
    const { ctx, inserted } = ctxWith({ subject: "user:owner" })

    await recordAccessAudit(ctx, {
      targetUserId: "user:yanis",
      operation: ACCESS_AUDIT_OPERATIONS.bootstrap,
      before: null,
      after: { role: Role.SUPER_ADMIN, storeIds: [], permissions: [] },
    })

    const details = JSON.parse(String(inserted[0]?.doc.details))
    expect(details).toMatchObject({
      operation: ACCESS_AUDIT_OPERATIONS.bootstrap,
      resulting: { role: Role.SUPER_ADMIN, storeCount: 0, moduleCount: 0 },
    })
  })
})

describe("serializeAccessDetails", () => {
  test("degrades rather than blowing the column on a huge change", () => {
    const many = Array.from({ length: 500 }, (_, i) => `stores:${i}`)

    const out = serializeAccessDetails(
      {
        operation: ACCESS_AUDIT_OPERATIONS.assign,
        changes: { storeIds: { added: many, removed: [] } },
        resulting: { role: Role.SUPER_ADMIN, storeCount: 500, moduleCount: 0 },
      },
      200
    )

    expect(out.length).toBeLessThanOrEqual(200)
    expect(JSON.parse(out)).toMatchObject({ truncated: true })
  })
})
