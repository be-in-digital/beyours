/**
 * Team Member management functions
 *
 * Handles invitation flow, role management, and module-level permissions.
 * Export plain { args, handler } objects for Convex query/mutation wrappers.
 */

import { v } from "convex/values"

// === PERMISSION CONSTANTS ===

export const TEAM_PERMISSION_MODULES = [
  "dashboard",
  "orders",
  "products",
  "kitchen",
  "team",
  "settings",
  "integrations",
  "marketing",
] as const

export const DEFAULT_ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  manager: TEAM_PERMISSION_MODULES as unknown as string[],
  kitchen: ["orders", "kitchen"],
  waiter: ["dashboard", "orders"],
  delivery: ["orders"],
}

// === QUERIES ===

/**
 * List all team members for a store (or all-stores members)
 */
export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    // Get store-specific members
    const storeMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()

    // Get all-stores members (storeId is undefined)
    const allMembers = await ctx.db
      .query("teamMembers")
      .collect()

    const chainWideMembers = allMembers.filter(
      (m: any) => m.allStores === true && m.storeId !== args.storeId
    )

    return [...storeMembers, ...chainWideMembers]
  },
}

/**
 * Get team member by user ID
 */
export const getByUser = {
  args: { userId: v.string() },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("teamMembers")
      .withIndex("by_userId", (q: any) => q.eq("userId", args.userId))
      .collect()
  },
}

/**
 * Find team member by invitation token
 */
// === MUTATIONS ===

/**
 * Invite a new team member (creates a pending record)
 */
export const invite = {
  args: {
    storeId: v.optional(v.id("stores")),
    allStores: v.boolean(),
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("manager"),
      v.literal("kitchen"),
      v.literal("waiter"),
      v.literal("delivery")
    ),
    permissions: v.array(v.string()),
    invitationToken: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    // Check for existing member with same email in same store
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .collect()

    const duplicate = existing.find(
      (m: any) =>
        (args.allStores && m.allStores) ||
        (!args.allStores && m.storeId === args.storeId)
    )

    if (duplicate) {
      throw new Error("A team member with this email already exists for this store")
    }

    const now = Date.now()
    return await ctx.db.insert("teamMembers", {
      storeId: args.allStores ? undefined : args.storeId,
      allStores: args.allStores,
      name: args.name,
      email: args.email,
      role: args.role,
      permissions: args.permissions,
      invitationStatus: "pending",
      invitationToken: args.invitationToken,
      invitedAt: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Accept an invitation (link userId to team member record)
 */
export const acceptInvitation = {
  args: {
    token: v.string(),
    userId: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const member = await ctx.db
      .query("teamMembers")
      .withIndex("by_invitationToken", (q: any) =>
        q.eq("invitationToken", args.token)
      )
      .first()

    if (!member) {
      throw new Error("Invalid invitation token")
    }

    if (member.invitationStatus === "expired") {
      throw new Error("This invitation has expired")
    }

    if (member.invitationStatus === "accepted") {
      throw new Error("This invitation has already been accepted")
    }

    // Check if invitation is older than 7 days
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    if (member.invitedAt && Date.now() - member.invitedAt > sevenDays) {
      await ctx.db.patch(member._id, {
        invitationStatus: "expired",
        updatedAt: Date.now(),
      })
      throw new Error("This invitation has expired")
    }

    await ctx.db.patch(member._id, {
      userId: args.userId,
      invitationStatus: "accepted",
      invitationToken: undefined,
      updatedAt: Date.now(),
    })
  },
}

/**
 * Resend an invitation (regenerate token)
 */
export const resendInvitation = {
  args: {
    id: v.id("teamMembers"),
    newToken: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    const member = await ctx.db.get(args.id)
    if (!member) throw new Error("Team member not found")

    if (member.invitationStatus === "accepted") {
      throw new Error("This member has already accepted the invitation")
    }

    await ctx.db.patch(args.id, {
      invitationToken: args.newToken,
      invitationStatus: "pending",
      invitedAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
}

/**
 * There is deliberately no `create`.
 *
 * The mutation that used to sit here took `userId` and `invitationStatus` from
 * the caller, so whoever could manage a roster could insert a row bound to an
 * account of their choosing, pre-marked "accepted", with no invitation and no
 * email. That row is not inert: `membershipUpdateEffect` derives a profile's
 * role from the highest-ranked active membership and its permissions by union,
 * so a planted row widens the person's rights the next time `update` runs on
 * any of their memberships.
 *
 * Members are minted one way only — `teamMembersEmail.sendInvitationEmail`
 * mints the token, sends the mail, and reaches the roster through
 * `inviteInternal`; `acceptInvitation` then derives the identity from the
 * session. Identity is never an argument. See #281, and #275 for the two
 * mutations removed before it.
 */

/**
 * Update team member (role, permissions, store assignment)
 */
export const update = {
  args: {
    id: v.id("teamMembers"),
    name: v.optional(v.string()),
    role: v.optional(v.union(
      v.literal("manager"),
      v.literal("kitchen"),
      v.literal("waiter"),
      v.literal("delivery")
    )),
    permissions: v.optional(v.array(v.string())),
    storeId: v.optional(v.id("stores")),
    allStores: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error("Team member not found")

    // If switching to allStores, clear storeId
    const patch: Record<string, any> = { ...fields, updatedAt: Date.now() }
    if (fields.allStores === true) {
      patch.storeId = undefined
    }

    await ctx.db.patch(id, patch)
  },
}

/**
 * Toggle team member active status
 */
export const toggleActive = {
  args: { id: v.id("teamMembers") },
  handler: async (ctx: any, args: any) => {
    const member = await ctx.db.get(args.id)
    if (!member) throw new Error("Team member not found")

    await ctx.db.patch(args.id, {
      isActive: !member.isActive,
      updatedAt: Date.now(),
    })
  },
}

/**
 * Delete a team member
 */
export const remove = {
  args: { id: v.id("teamMembers") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.delete(args.id)
  },
}
