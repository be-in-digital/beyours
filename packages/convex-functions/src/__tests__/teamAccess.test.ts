import { describe, it, test, expect } from "vitest"
import { Role } from "@be-yours/core/auth/rbac"
import {
  assertCanManageMember,
  assertInvitationAcceptable,
  invitationGrant,
  invitationModules,
  membershipUpdateEffect,
  profileAllowsPermission,
  revocationEffect,
  INVITATION_LIFETIME_MS,
  INVITATION_RETENTION_MS,
  sweepInvitation,
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

  it("never demotes someone who already holds a higher role", () => {
    // The attack: a client admin invites the SUPER ADMIN as `kitchen` on their
    // own store. Accepting used to REPLACE the profile, so one click on the
    // invitation link stripped the deployment of its administrator.
    const grant = invitationGrant(
      { role: "kitchen", storeId: STORE_A, allStores: false },
      { role: Role.SUPER_ADMIN, storeIds: [] }
    )
    expect(grant.role).toBe(Role.SUPER_ADMIN)
  })

  it("adds the new restaurant instead of replacing the previous one", () => {
    // A manager invited to a second restaurant used to lose the first.
    const grant = invitationGrant(
      { role: "manager", storeId: STORE_B, allStores: false },
      { role: Role.MANAGER, storeIds: [STORE_A] }
    )
    expect(grant.storeIds.sort()).toEqual([STORE_A, STORE_B].sort())
  })

  it("promotes when the invitation is for a higher role", () => {
    const grant = invitationGrant(
      { role: "manager", storeId: STORE_A, allStores: false },
      { role: Role.CUSTOMER, storeIds: [] }
    )
    expect(grant.role).toBe(Role.MANAGER)
    expect(grant.storeIds).toEqual([STORE_A])
  })

  it("does not strip an existing profile on a chain-wide invitation", () => {
    // Chain-wide grants no store list, so replacing would leave the member with
    // nothing at all — the "decorative team screen" bug, recreated.
    const grant = invitationGrant(
      { role: "manager", allStores: true },
      { role: Role.MANAGER, storeIds: [STORE_A] }
    )
    expect(grant.storeIds).toEqual([STORE_A])
  })
})

// ============================================================================
// Revocation — the half that was missing
// ============================================================================

describe("revocationEffect", () => {
  it("removes only the store the membership covered", () => {
    expect(
      revocationEffect({
        profile: { role: Role.MANAGER, storeIds: [STORE_A, STORE_B] },
        storeId: STORE_A,
        allStores: false,
      })
    ).toEqual({ role: Role.MANAGER, storeIds: [STORE_B] })
  })

  it("drops staff rights entirely when no workplace is left", () => {
    // A dismissed employee used to vanish from the roster and keep `manager` —
    // products, orders, customers — on the restaurant.
    expect(
      revocationEffect({
        profile: { role: Role.MANAGER, storeIds: [STORE_A] },
        storeId: STORE_A,
        allStores: false,
      })
    ).toEqual({ role: Role.CUSTOMER, storeIds: [] })
  })

  it("clears everything for a chain-wide membership", () => {
    expect(
      revocationEffect({
        profile: { role: Role.MANAGER, storeIds: [STORE_A, STORE_B] },
        allStores: true,
      })
    ).toEqual({ role: Role.CUSTOMER, storeIds: [] })
  })

  it.each([Role.SUPER_ADMIN, Role.CLIENT_ADMIN])(
    "never downgrades %s through a roster change",
    (role) => {
      // Their authority does not come from the roster in the first place.
      const profile = { role, storeIds: [STORE_A] }
      expect(
        revocationEffect({ profile, storeId: STORE_A, allStores: false })
      ).toEqual(profile)
    }
  )

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

/* ------------------------------------------------------------------ */
/* Module permissions                                                  */
/* ------------------------------------------------------------------ */

describe("profileAllowsPermission", () => {
  test("an empty list means unrestricted, not locked out", () => {
    // Every profile in every existing deployment carries `permissions: []`.
    // Reading that as "nothing allowed" would have shut out every member on
    // the day this shipped.
    expect(
      profileAllowsPermission({ role: Role.WAITER, permissions: [] }, "settings:write")
    ).toBe(true)
    expect(
      profileAllowsPermission({ role: Role.WAITER }, "settings:write")
    ).toBe(true)
  })

  test("a selected module allows its resources", () => {
    const profile = { role: Role.WAITER, permissions: ["orders"] }

    expect(profileAllowsPermission(profile, "orders:read")).toBe(true)
    expect(profileAllowsPermission(profile, "orders:update_status")).toBe(true)
    expect(profileAllowsPermission(profile, "customers:read")).toBe(true)
  })

  test("an unselected module refuses its resources — the whole point", () => {
    const profile = { role: Role.MANAGER, permissions: ["orders", "kitchen"] }

    // The owner unticked "Paramètres" and "Équipe" in the invite dialog. Until
    // now that changed nothing whatsoever.
    expect(profileAllowsPermission(profile, "settings:write")).toBe(false)
    expect(profileAllowsPermission(profile, "team:write")).toBe(false)
    expect(profileAllowsPermission(profile, "products:write")).toBe(false)
  })

  test("a resource reachable from two modules needs only one of them", () => {
    // `stores` is read from both the dashboard and the settings screen.
    expect(
      profileAllowsPermission({ role: Role.MANAGER, permissions: ["dashboard"] }, "stores:read")
    ).toBe(true)
    expect(
      profileAllowsPermission({ role: Role.MANAGER, permissions: ["settings"] }, "stores:read")
    ).toBe(true)
    expect(
      profileAllowsPermission({ role: Role.MANAGER, permissions: ["kitchen"] }, "stores:read")
    ).toBe(false)
  })

  test.each([Role.SUPER_ADMIN, Role.CLIENT_ADMIN])(
    "%s is never narrowed by a module list",
    (role) => {
      // Their authority does not come from the roster, and a stray list on an
      // owner's profile must not be able to shut them out of their own
      // restaurant.
      expect(
        profileAllowsPermission({ role, permissions: ["kitchen"] }, "settings:write")
      ).toBe(true)
    }
  )

  test("a resource no checkbox covers stays allowed", () => {
    // The owner was never shown a box for it, so they cannot have meant to
    // deny it — refusing would invent a restriction nobody asked for.
    expect(
      profileAllowsPermission(
        { role: Role.MANAGER, permissions: ["kitchen"] },
        "unmapped_resource:read"
      )
    ).toBe(true)
  })
})

describe("invitationModules", () => {
  test("a first invitation carries its own selection", () => {
    expect(invitationModules(["orders", "kitchen"], undefined)).toEqual([
      "orders",
      "kitchen",
    ])
  })

  test("an unrestricted invitation leaves the member unrestricted", () => {
    expect(invitationModules([], ["orders"])).toEqual([])
    expect(invitationModules(undefined, ["orders"])).toEqual([])
  })

  test("an unrestricted profile stays unrestricted", () => {
    // Intersecting "everything" with a narrower set would silently demote a
    // manager the first time they were invited somewhere as a waiter.
    expect(invitationModules(["orders"], [])).toEqual([])
  })

  test("a second restaurant adds modules rather than shrinking them", () => {
    expect(invitationModules(["kitchen"], ["orders"]).sort()).toEqual([
      "kitchen",
      "orders",
    ])
  })

  test("does not duplicate a module both sides selected", () => {
    expect(invitationModules(["orders"], ["orders"])).toEqual(["orders"])
  })
})

/* ------------------------------------------------------------------ */
/* Sweeping stale invitations                                          */
/* ------------------------------------------------------------------ */

describe("sweepInvitation", () => {
  const NOW_MS = 1_800_000_000_000
  const beyondLifetime = NOW_MS - INVITATION_LIFETIME_MS - 1
  const withinLifetime = NOW_MS - 1_000

  test("a live invitation is left alone", () => {
    expect(
      sweepInvitation(
        { invitationStatus: "pending", invitedAt: withinLifetime },
        NOW_MS
      )
    ).toBe("keep")
  })

  test("a pending invitation past its lifetime is expired", () => {
    // Nothing swept this table, so such a row kept `pending` — and kept its
    // TOKEN — forever.
    expect(
      sweepInvitation(
        { invitationStatus: "pending", invitedAt: beyondLifetime },
        NOW_MS
      )
    ).toBe("expire")
  })

  test("an expired invitation is purged only after the retention window", () => {
    const justExpired = { invitationStatus: "expired" as const, invitedAt: beyondLifetime }
    expect(sweepInvitation(justExpired, NOW_MS)).toBe("keep")

    const longDead = {
      invitationStatus: "expired" as const,
      invitedAt: NOW_MS - INVITATION_LIFETIME_MS - INVITATION_RETENTION_MS - 1,
    }
    expect(sweepInvitation(longDead, NOW_MS)).toBe("purge")
  })

  test("NEVER touches a row somebody holds, however old", () => {
    // The mistake this function exists to make impossible: a row carrying a
    // userId is a member of the team, not an invitation.
    const ancient = NOW_MS - INVITATION_LIFETIME_MS - INVITATION_RETENTION_MS - 1

    for (const status of ["pending", "expired", "accepted"] as const) {
      expect(
        sweepInvitation(
          { invitationStatus: status, invitedAt: ancient, userId: "user:yanis" },
          NOW_MS
        )
      ).toBe("keep")
    }
  })

  test("keeps a row whose age cannot be established", () => {
    // No `invitedAt` means no basis to age it against; deleting on a guess is
    // worse than keeping one stale row.
    expect(sweepInvitation({ invitationStatus: "pending" }, NOW_MS)).toBe("keep")
    expect(sweepInvitation({ invitationStatus: "expired" }, NOW_MS)).toBe("keep")
  })

  test("keeps an accepted row with no userId rather than guessing", () => {
    expect(
      sweepInvitation(
        { invitationStatus: "accepted", invitedAt: beyondLifetime },
        NOW_MS
      )
    ).toBe("keep")
  })
})


// ============================================================================
// Editing a membership that has already been accepted
// ============================================================================

describe("membershipUpdateEffect", () => {
  const base = {
    role: "manager" as const,
    storeId: STORE_A,
    allStores: false,
    permissions: [] as string[],
    isActive: true,
  }

  /** The common case: one membership, one establishment, nothing else. */
  function edit(
    profile: { role: Role; storeIds: string[]; permissions?: string[] },
    after: Partial<typeof base>,
    others: (typeof base)[] = []
  ) {
    return membershipUpdateEffect({
      profile,
      before: { storeId: STORE_A, allStores: false },
      after: { ...base, ...after },
      others,
    })
  }

  it("narrows the modules to exactly what is left ticked", () => {
    // Not a union with what the profile held: the whole defect was that
    // unticking a box changed nothing, and merging keeps it that way.
    expect(
      edit(
        { role: Role.MANAGER, storeIds: [STORE_A], permissions: ["dashboard", "orders", "products"] },
        { permissions: ["dashboard", "orders"] }
      )
    ).toEqual({
      role: Role.MANAGER,
      storeIds: [STORE_A],
      permissions: ["dashboard", "orders"],
    })
  })

  it("reads an emptied list as unrestricted, never as nothing allowed", () => {
    expect(
      edit(
        { role: Role.MANAGER, storeIds: [STORE_A], permissions: ["orders"] },
        { permissions: [] }
      )
    ).toEqual({ role: Role.MANAGER, storeIds: [STORE_A], permissions: [] })
  })

  it("follows a demotion", () => {
    expect(
      edit({ role: Role.MANAGER, storeIds: [STORE_A] }, { role: "waiter" })
    ).toEqual({ role: Role.WAITER, storeIds: [STORE_A], permissions: [] })
  })

  it("keeps the highest role the person still holds elsewhere", () => {
    // Manager in Lyon, demoted to waiter in Paris. The profile carries one
    // role, so Paris must not be able to spend Lyon's. The modules are narrowed
    // at the same time purely so the result is not a no-op — a `null` here
    // would prove the role survived too, but says nothing about which rule
    // produced it.
    expect(
      edit(
        {
          role: Role.MANAGER,
          storeIds: [STORE_A, STORE_B],
          permissions: ["dashboard", "orders", "products"],
        },
        { role: "waiter", permissions: ["dashboard", "orders"] },
        [{ ...base, storeId: STORE_B, permissions: ["dashboard", "orders"] }]
      )
    ).toEqual({
      role: Role.MANAGER,
      storeIds: [STORE_A, STORE_B],
      permissions: ["dashboard", "orders"],
    })
  })

  it("moves the establishment rather than adding to it", () => {
    expect(
      edit({ role: Role.MANAGER, storeIds: [STORE_A] }, { storeId: STORE_B })
    ).toEqual({ role: Role.MANAGER, storeIds: [STORE_B], permissions: [] })
  })

  it("leaves a store alone when another active membership still covers it", () => {
    expect(
      edit({ role: Role.MANAGER, storeIds: [STORE_A] }, { storeId: STORE_B }, [
        { ...base, storeId: STORE_A },
      ])
    ).toEqual({
      role: Role.MANAGER,
      storeIds: [STORE_A, STORE_B],
      permissions: [],
    })
  })

  it("keeps establishments the roster never granted", () => {
    // STORE_B came from somewhere else — a direct profile assignment. Rebuilding
    // the list from memberships alone would confiscate it.
    expect(
      edit({ role: Role.MANAGER, storeIds: [STORE_A, STORE_B] }, { storeId: "stores:c" })
    ).toEqual({
      role: Role.MANAGER,
      storeIds: [STORE_B, "stores:c"],
      permissions: [],
    })
  })

  it("drops to customer when the last position is deactivated", () => {
    expect(
      edit({ role: Role.MANAGER, storeIds: [STORE_A] }, { isActive: false })
    ).toEqual({ role: Role.CUSTOMER, storeIds: [], permissions: [] })
  })

  it("narrows nothing when a membership is widened to the whole chain", () => {
    // `allStores` has no representation in `userProfiles` — the gap is stated
    // on `invitationGrant`. Dropping someone to `customer` because we cannot
    // express their PROMOTION would be worse than the gap itself.
    expect(
      edit({ role: Role.MANAGER, storeIds: [STORE_A] }, { allStores: true, storeId: undefined })
    ).toBeNull()
  })

  it("leaves an admin's profile alone", () => {
    for (const role of [Role.SUPER_ADMIN, Role.CLIENT_ADMIN]) {
      expect(
        edit({ role, storeIds: [STORE_A] }, { role: "delivery", permissions: ["orders"] })
      ).toBeNull()
    }
  })

  it("reports nothing to do when nothing moved", () => {
    expect(
      edit(
        { role: Role.MANAGER, storeIds: [STORE_A], permissions: ["orders"] },
        { permissions: ["orders"] }
      )
    ).toBeNull()
  })
})
