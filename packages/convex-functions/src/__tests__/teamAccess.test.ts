import { describe, it, expect } from "vitest"
import { Role } from "@be-in-digital/core/auth/rbac"
import {
  assertCanManageMember,
  assertInvitationAcceptable,
  invitationGrant,
  INVITATION_LIFETIME_MS,
  TeamAccessError,
  type TeamActor,
} from "../teamAccess"

const STORE_A = "stores:a"
const STORE_B = "stores:b"
const NOW = 1_700_000_000_000

function actor(over: Partial<TeamActor> = {}): TeamActor {
  return { userId: "user:owner", role: Role.CLIENT_ADMIN, storeIds: [STORE_A], ...over }
}

function rejection(fn: () => unknown): TeamAccessError {
  try {
    fn()
  } catch (error) {
    if (error instanceof TeamAccessError) return error
    throw error
  }
  throw new Error("expected the action to be rejected, but it was allowed")
}

// ============================================================================
// Who may manage the roster
// ============================================================================

describe("assertCanManageMember", () => {
  it("lets an owner manage a member of their own store", () => {
    expect(() =>
      assertCanManageMember({
        actor: actor(),
        member: { storeId: STORE_A, allStores: false },
      })
    ).not.toThrow()
  })

  it("refuses a member of a store the actor does not administer", () => {
    const error = rejection(() =>
      assertCanManageMember({
        actor: actor({ storeIds: [STORE_A] }),
        member: { storeId: STORE_B, allStores: false },
      })
    )
    expect(error.reason).toBe("store_not_administered")
  })

  it.each([Role.MANAGER, Role.KITCHEN, Role.WAITER, Role.DELIVERY, Role.CUSTOMER])(
    "refuses %s outright",
    (role) => {
      // Every team mutation was an `authedMutation`, so any logged-in account
      // could invite, promote or remove staff in any restaurant.
      expect(
        rejection(() =>
          assertCanManageMember({
            actor: actor({ role }),
            member: { storeId: STORE_A, allStores: false },
          })
        ).reason
      ).toBe("not_permitted")
    }
  )

  it("refuses an owner granting chain-wide access", () => {
    // `allStores` spans every restaurant — an owner of one must not hand out
    // access to all of them.
    const error = rejection(() =>
      assertCanManageMember({ actor: actor(), member: { allStores: true } })
    )
    expect(error.reason).toBe("chain_wide_requires_super_admin")
  })

  it("lets a super admin grant chain-wide access", () => {
    expect(() =>
      assertCanManageMember({
        actor: actor({ role: Role.SUPER_ADMIN, storeIds: [] }),
        member: { allStores: true },
      })
    ).not.toThrow()
  })

  it("refuses a member with neither a store nor chain-wide access", () => {
    expect(
      rejection(() =>
        assertCanManageMember({ actor: actor(), member: { allStores: false } })
      ).reason
    ).toBe("store_not_administered")
  })
})

// ============================================================================
// Invitation validity
// ============================================================================

describe("assertInvitationAcceptable", () => {
  it("accepts a fresh pending invitation", () => {
    expect(() =>
      assertInvitationAcceptable({
        member: { invitationStatus: "pending", invitedAt: NOW - 1000 },
        now: NOW,
      })
    ).not.toThrow()
  })

  it("refuses one already accepted — an invitation is single use", () => {
    expect(
      rejection(() =>
        assertInvitationAcceptable({
          member: { invitationStatus: "accepted" },
          now: NOW,
        })
      ).reason
    ).toBe("invitation_not_pending")
  })

  it("refuses one already marked expired", () => {
    expect(
      rejection(() =>
        assertInvitationAcceptable({
          member: { invitationStatus: "expired" },
          now: NOW,
        })
      ).reason
    ).toBe("invitation_expired")
  })

  it("refuses one older than its lifetime", () => {
    expect(
      rejection(() =>
        assertInvitationAcceptable({
          member: {
            invitationStatus: "pending",
            invitedAt: NOW - INVITATION_LIFETIME_MS - 1,
          },
          now: NOW,
        })
      ).reason
    ).toBe("invitation_expired")
  })

  it("accepts one exactly on its expiry boundary", () => {
    expect(() =>
      assertInvitationAcceptable({
        member: {
          invitationStatus: "pending",
          invitedAt: NOW - INVITATION_LIFETIME_MS,
        },
        now: NOW,
      })
    ).not.toThrow()
  })

  it("accepts a pending invitation with no recorded date", () => {
    expect(() =>
      assertInvitationAcceptable({ member: { invitationStatus: "pending" }, now: NOW })
    ).not.toThrow()
  })
})

// ============================================================================
// The bridge that was missing
// ============================================================================

describe("invitationGrant", () => {
  it.each([
    ["manager", Role.MANAGER],
    ["kitchen", Role.KITCHEN],
    ["waiter", Role.WAITER],
    ["delivery", Role.DELIVERY],
  ] as const)("maps the %s invitation to its real role", (teamRole, expected) => {
    const grant = invitationGrant({
      role: teamRole,
      storeId: STORE_A,
      allStores: false,
    })
    expect(grant.role).toBe(expected)
    expect(grant.storeIds).toEqual([STORE_A])
  })

  it("grants access to exactly the invited store", () => {
    // Accepting used to set `teamMembers.userId` and nothing else, while the
    // authorisation chain reads `userProfiles` — so the member got no rights.
    expect(
      invitationGrant({ role: "manager", storeId: STORE_A, allStores: false }).storeIds
    ).toEqual([STORE_A])
  })

  it("grants no store list for a chain-wide membership", () => {
    // Enumerating every store here would silently widen access each time a new
    // restaurant is created. Chain-wide access stays a super admin's business.
    expect(invitationGrant({ role: "manager", allStores: true }).storeIds).toEqual([])
  })

  it("never grants an administrative role", () => {
    // The schema only allows these four, and this pins that the mapping cannot
    // quietly produce a client_admin or super_admin.
    for (const teamRole of ["manager", "kitchen", "waiter", "delivery"] as const) {
      const { role } = invitationGrant({
        role: teamRole,
        storeId: STORE_A,
        allStores: false,
      })
      expect([Role.SUPER_ADMIN, Role.CLIENT_ADMIN]).not.toContain(role)
    }
  })
})
