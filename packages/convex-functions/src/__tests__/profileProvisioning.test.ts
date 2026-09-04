import { describe, it, expect } from "vitest"
import { Role } from "@be-in-digital/core/auth/rbac"
import {
  assertCanAssignProfile,
  bootstrapTokenMatches,
  MAX_BOOTSTRAP_TOKEN_LENGTH,
  canClaimFirstAdmin,
  creatorAdministersNewStore,
  ProvisioningRejectedError,
  type ProvisioningActor,
  type ProvisioningTarget,
} from "../profileProvisioning"

const STORE_A = "stores:a"
const STORE_B = "stores:b"

function actor(over: Partial<ProvisioningActor> = {}): ProvisioningActor {
  return { userId: "user:admin", role: Role.CLIENT_ADMIN, storeIds: [STORE_A], ...over }
}

function target(over: Partial<ProvisioningTarget> = {}): ProvisioningTarget {
  return { userId: "user:target", role: Role.MANAGER, storeIds: [STORE_A], ...over }
}

function rejection(fn: () => unknown): ProvisioningRejectedError {
  try {
    fn()
  } catch (error) {
    if (error instanceof ProvisioningRejectedError) return error
    throw error
  }
  throw new Error("expected the assignment to be rejected, but it was allowed")
}

// ============================================================================
// The escalation this module exists to stop
// ============================================================================

describe("the audited escalation", () => {
  it("refuses a customer promoting themselves to manager", () => {
    // Sign up on the storefront, list the public stores, grant yourself
    // `manager` on someone else's restaurant. This was three calls.
    const error = rejection(() =>
      assertCanAssignProfile({
        actor: actor({ userId: "user:mallory", role: Role.CUSTOMER, storeIds: [] }),
        target: target({ userId: "user:mallory", role: Role.MANAGER, storeIds: [STORE_B] }),
      })
    )
    expect(error.reason).toBe("not_permitted")
  })

  it("refuses a manager minting another manager", () => {
    expect(
      rejection(() =>
        assertCanAssignProfile({
          actor: actor({ role: Role.MANAGER, storeIds: [STORE_A] }),
          target: target(),
        })
      ).reason
    ).toBe("not_permitted")
  })

  it("refuses a client admin granting access to a store they do not administer", () => {
    const error = rejection(() =>
      assertCanAssignProfile({
        actor: actor({ storeIds: [STORE_A] }),
        target: target({ storeIds: [STORE_B] }),
      })
    )
    expect(error.reason).toBe("store_not_owned")
  })

  it("refuses a mixed grant that smuggles in a foreign store", () => {
    expect(
      rejection(() =>
        assertCanAssignProfile({
          actor: actor({ storeIds: [STORE_A] }),
          target: target({ storeIds: [STORE_A, STORE_B] }),
        })
      ).reason
    ).toBe("store_not_owned")
  })

  it.each([Role.SUPER_ADMIN, Role.CLIENT_ADMIN])(
    "refuses a client admin granting %s",
    (role) => {
      expect(
        rejection(() =>
          assertCanAssignProfile({ actor: actor(), target: target({ role }) })
        ).reason
      ).toBe("cannot_grant_admin")
    }
  )

  it("refuses an owner demoting the super admin", () => {
    // The escalation the first version of this policy missed entirely: it only
    // looked at the REQUESTED role. `customer` is not an admin role, an empty
    // store list contains no foreign store — every check passed, and `upsert`
    // overwrites. One call and the deployment has no administrator.
    const error = rejection(() =>
      assertCanAssignProfile({
        actor: actor({ storeIds: [STORE_A] }),
        target: target({ userId: "user:root", role: Role.CUSTOMER, storeIds: [] }),
        existingTarget: { role: Role.SUPER_ADMIN, storeIds: [] },
      })
    )
    expect(error.reason).toBe("cannot_touch_admin")
  })

  it("refuses an owner demoting another client admin", () => {
    expect(
      rejection(() =>
        assertCanAssignProfile({
          actor: actor({ storeIds: [STORE_A] }),
          target: target({ role: Role.KITCHEN, storeIds: [STORE_A] }),
          existingTarget: { role: Role.CLIENT_ADMIN, storeIds: [STORE_A] },
        })
      ).reason
    ).toBe("cannot_touch_admin")
  })

  it("refuses poaching a member of a restaurant the actor does not administer", () => {
    // Requested stores are all owned, so the old check passed — but the person
    // belongs to someone else's team.
    const error = rejection(() =>
      assertCanAssignProfile({
        actor: actor({ storeIds: [STORE_A] }),
        target: target({ role: Role.MANAGER, storeIds: [STORE_A] }),
        existingTarget: { role: Role.MANAGER, storeIds: [STORE_B] },
      })
    )
    expect(error.reason).toBe("target_not_owned")
  })

  it("still lets an owner update a member of their own store", () => {
    expect(() =>
      assertCanAssignProfile({
        actor: actor({ storeIds: [STORE_A] }),
        target: target({ role: Role.KITCHEN, storeIds: [STORE_A] }),
        existingTarget: { role: Role.MANAGER, storeIds: [STORE_A] },
      })
    ).not.toThrow()
  })

  it("lets a super admin demote another admin", () => {
    expect(() =>
      assertCanAssignProfile({
        actor: actor({ userId: "user:root", role: Role.SUPER_ADMIN, storeIds: [] }),
        target: target({ role: Role.CUSTOMER, storeIds: [] }),
        existingTarget: { role: Role.CLIENT_ADMIN, storeIds: [STORE_B] },
      })
    ).not.toThrow()
  })

  it("refuses a client admin setting bespoke permissions", () => {
    // A permission list bypasses the role table entirely.
    expect(
      rejection(() =>
        assertCanAssignProfile({
          actor: actor(),
          target: target({ permissions: ["system:restore"] }),
        })
      ).reason
    ).toBe("custom_permissions_forbidden")
  })
})

// ============================================================================
// What remains possible
// ============================================================================

describe("legitimate provisioning", () => {
  it.each([Role.MANAGER, Role.KITCHEN, Role.WAITER, Role.DELIVERY, Role.CUSTOMER])(
    "lets a client admin grant %s on their own store",
    (role) => {
      expect(() =>
        assertCanAssignProfile({ actor: actor(), target: target({ role }) })
      ).not.toThrow()
    }
  )

  it("lets a client admin create a profile with no store access at all", () => {
    expect(() =>
      assertCanAssignProfile({ actor: actor(), target: target({ storeIds: [] }) })
    ).not.toThrow()
  })

  it("accepts an empty permission list as no permissions", () => {
    expect(() =>
      assertCanAssignProfile({ actor: actor(), target: target({ permissions: [] }) })
    ).not.toThrow()
  })

  it("lets a super admin do what a client admin cannot", () => {
    expect(() =>
      assertCanAssignProfile({
        actor: actor({ userId: "user:root", role: Role.SUPER_ADMIN, storeIds: [] }),
        target: target({ role: Role.CLIENT_ADMIN, storeIds: [STORE_B] }),
      })
    ).not.toThrow()
  })
})

// ============================================================================
// Guarding against locking everyone out
// ============================================================================

describe("self-demotion", () => {
  it("stops a super admin removing their own super-admin role", () => {
    // Otherwise the last administrator can leave the deployment with none.
    const error = rejection(() =>
      assertCanAssignProfile({
        actor: actor({ userId: "user:root", role: Role.SUPER_ADMIN, storeIds: [] }),
        target: target({ userId: "user:root", role: Role.CLIENT_ADMIN }),
      })
    )
    expect(error.reason).toBe("cannot_demote_self")
  })

  it("still lets a super admin update their own profile as super admin", () => {
    expect(() =>
      assertCanAssignProfile({
        actor: actor({ userId: "user:root", role: Role.SUPER_ADMIN, storeIds: [] }),
        target: target({ userId: "user:root", role: Role.SUPER_ADMIN }),
      })
    ).not.toThrow()
  })

  it("lets a super admin demote somebody else", () => {
    expect(() =>
      assertCanAssignProfile({
        actor: actor({ userId: "user:root", role: Role.SUPER_ADMIN, storeIds: [] }),
        target: target({ userId: "user:other", role: Role.CUSTOMER, storeIds: [] }),
      })
    ).not.toThrow()
  })
})

describe("canClaimFirstAdmin", () => {
  it("allows the claim on a deployment with no super admin", () => {
    // Provisioning needs a super admin and a fresh deployment has none.
    expect(canClaimFirstAdmin({ existingSuperAdminCount: 0 })).toBe(true)
  })

  it("closes as soon as one exists", () => {
    expect(canClaimFirstAdmin({ existingSuperAdminCount: 1 })).toBe(false)
    expect(canClaimFirstAdmin({ existingSuperAdminCount: 7 })).toBe(false)
  })
})

describe("creatorAdministersNewStore", () => {
  it("grants the establishment to the owner who created it", () => {
    expect(creatorAdministersNewStore(Role.CLIENT_ADMIN)).toBe(true)
  })

  it("leaves a super admin's profile alone", () => {
    // requireStoreAccess already waves them through every store, and the
    // mutation cannot know which owner a store created on someone's behalf is
    // meant for.
    expect(creatorAdministersNewStore(Role.SUPER_ADMIN)).toBe(false)
  })

  it("grants nothing to a role that could not have created a store anyway", () => {
    // Only super admin and client admin hold `stores:write`, but the predicate
    // fails closed rather than trusting that to stay true.
    for (const role of [Role.MANAGER, Role.KITCHEN, Role.WAITER, Role.DELIVERY, Role.CUSTOMER]) {
      expect(creatorAdministersNewStore(role)).toBe(false)
    }
  })
})

describe("bootstrapTokenMatches", () => {
  it("accepts the exact token", () => {
    expect(bootstrapTokenMatches("s3cr3t-bootstrap", "s3cr3t-bootstrap")).toBe(true)
  })

  it("refuses a token that differs in one byte", () => {
    expect(bootstrapTokenMatches("s3cr3t-bootstrap", "s3cr3t-bootstrbp")).toBe(false)
  })

  it("refuses a correct prefix", () => {
    // The whole reason the comparison is constant-time: a prefix must be worth
    // no more to an attacker than a wrong first byte.
    expect(bootstrapTokenMatches("s3cr3t", "s3cr3t-bootstrap")).toBe(false)
  })

  it("refuses a supplied token that merely extends the real one", () => {
    expect(bootstrapTokenMatches("s3cr3t-bootstrap-and-more", "s3cr3t-bootstrap")).toBe(
      false
    )
  })

  it("refuses two empty strings rather than calling them equal", () => {
    // Fail-closed on its own account. `claimFirstAdmin` already refuses an
    // unset ADMIN_BOOTSTRAP_TOKEN before reaching here, but an empty-equals-
    // empty comparison would hand the deployment to whoever submits a blank
    // field the day that ordering changes.
    expect(bootstrapTokenMatches("", "")).toBe(false)
  })

  it("refuses an empty supplied token against a configured one", () => {
    expect(bootstrapTokenMatches("", "s3cr3t-bootstrap")).toBe(false)
  })

  it("refuses any token when none is configured", () => {
    expect(bootstrapTokenMatches("anything", "")).toBe(false)
  })

  it("reads past the end of the shorter string without throwing", () => {
    // `charCodeAt` past the end is NaN and `NaN | 0` is 0. The loop runs over
    // the LONGER string on purpose — returning early on a length mismatch is
    // what leaked the token's length in the version this replaced.
    expect(() => bootstrapTokenMatches("a", "abcdefghijklmnop")).not.toThrow()
    expect(bootstrapTokenMatches("a", "abcdefghijklmnop")).toBe(false)
  })

  it("refuses a token longer than the bound rather than truncating to it", () => {
    // Truncating would call two different tokens equal. Refusing is the only
    // safe answer, and the bound is what stops a caller buying backend CPU by
    // the megabyte — `v.string()` permits ~1 MiB, and an earlier version ran
    // one loop iteration per character of it.
    const tooLong = "a".repeat(MAX_BOOTSTRAP_TOKEN_LENGTH + 1)
    expect(bootstrapTokenMatches(tooLong, tooLong)).toBe(false)
    expect(bootstrapTokenMatches(tooLong, "s3cr3t-bootstrap")).toBe(false)
    expect(bootstrapTokenMatches("s3cr3t-bootstrap", tooLong)).toBe(false)
  })

  it("still matches a token sitting exactly on the bound", () => {
    const atLimit = "a".repeat(MAX_BOOTSTRAP_TOKEN_LENGTH)
    expect(bootstrapTokenMatches(atLimit, atLimit)).toBe(true)
    // ...and still notices a difference in its very last character, which is
    // what an off-by-one in the round count would hide.
    expect(
      bootstrapTokenMatches("a".repeat(MAX_BOOTSTRAP_TOKEN_LENGTH - 1) + "b", atLimit)
    ).toBe(false)
  })

  it("does the same amount of work whatever the secret's length", () => {
    // The property the docblock claims, asserted rather than asserted-in-prose.
    // An earlier version ran `max(supplied.length, expected.length)` rounds, so
    // a one-character guess against a long secret took time proportional to the
    // secret — the length oracle it was written to remove, moved rather than
    // closed. Measured at 291x across these three; the bar here is deliberately
    // loose so a busy machine cannot make it flap.
    const time = (secretLength: number) => {
      const secret = "a".repeat(secretLength)
      const start = performance.now()
      for (let i = 0; i < 20_000; i++) bootstrapTokenMatches("x", secret)
      return performance.now() - start
    }
    const samples = [time(8), time(64), time(MAX_BOOTSTRAP_TOKEN_LENGTH)]
    expect(Math.max(...samples)).toBeLessThan(Math.min(...samples) * 4 + 25)
  })

  it("compares over the longer of the two, whichever side that is", () => {
    // A NUL-padded guess must not compare equal to the real token: folding the
    // length difference into the accumulator is what stops it.
    expect(bootstrapTokenMatches("token\u0000\u0000", "token")).toBe(false)
    expect(bootstrapTokenMatches("token", "token\u0000\u0000")).toBe(false)
  })
})
