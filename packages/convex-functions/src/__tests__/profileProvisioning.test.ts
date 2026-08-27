import { describe, it, expect } from "vitest"
import { Role } from "@be-in-digital/core/auth/rbac"
import {
  assertCanAssignProfile,
  canClaimFirstAdmin,
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
