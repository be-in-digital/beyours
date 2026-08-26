/**
 * Customer delivery addresses
 *
 * Plain { args, handler } objects, wrapped by each app's Convex layer, which
 * resolves the authenticated user — same shape as `favorites`.
 *
 * One invariant runs through every mutation here: **exactly one address is the
 * default, and only when the list is non-empty.** Deleting the default promotes
 * the next one; adding to an empty list makes the newcomer the default. The
 * checkout preselects the default, so two defaults or none is a visible bug.
 */

import { v } from "convex/values"

const addressFields = {
  label: v.optional(v.string()),
  street: v.string(),
  city: v.string(),
  postalCode: v.string(),
  country: v.string(),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  instructions: v.optional(v.string()),
}

interface AddressInput {
  label?: string
  street: string
  city: string
  postalCode: string
  country: string
  latitude?: number
  longitude?: number
  instructions?: string
}

async function listForUser(ctx: any, userId: string) {
  return await ctx.db
    .query("customerAddresses")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .collect()
}

/** Make `addressId` the only default among the user's addresses. */
async function promoteToDefault(ctx: any, userId: string, addressId: string) {
  const all = await listForUser(ctx, userId)
  for (const address of all) {
    const shouldBeDefault = address._id === addressId
    if (address.isDefault !== shouldBeDefault) {
      await ctx.db.patch(address._id, {
        isDefault: shouldBeDefault,
        updatedAt: Date.now(),
      })
    }
  }
}

/** List the user's addresses, default first, then most recent. */
export const listByUser = {
  args: { userId: v.string() },
  handler: async (ctx: any, args: { userId: string }) => {
    const addresses = await listForUser(ctx, args.userId)
    return addresses.sort((a: any, b: any) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
      return b.createdAt - a.createdAt
    })
  },
}

export const add = {
  args: { userId: v.string(), ...addressFields },
  handler: async (ctx: any, args: { userId: string } & AddressInput) => {
    const { userId, ...fields } = args
    const existing = await listForUser(ctx, userId)
    const now = Date.now()

    return await ctx.db.insert("customerAddresses", {
      userId,
      ...fields,
      // First address wins the default slot; nothing else changes.
      isDefault: existing.length === 0,
      createdAt: now,
      updatedAt: now,
    })
  },
}

export const update = {
  args: { userId: v.string(), addressId: v.id("customerAddresses"), ...addressFields },
  handler: async (
    ctx: any,
    args: { userId: string; addressId: string } & AddressInput
  ) => {
    const { userId, addressId, ...fields } = args
    const address = await ctx.db.get(addressId)
    if (!address) throw new Error("ADDRESS_NOT_FOUND")
    // Never trust the id alone: it would let one customer edit another's.
    if (address.userId !== userId) throw new Error("FORBIDDEN")

    await ctx.db.patch(addressId, { ...fields, updatedAt: Date.now() })
  },
}

export const remove = {
  args: { userId: v.string(), addressId: v.id("customerAddresses") },
  handler: async (ctx: any, args: { userId: string; addressId: string }) => {
    const address = await ctx.db.get(args.addressId)
    if (!address) return
    if (address.userId !== args.userId) throw new Error("FORBIDDEN")

    const wasDefault = address.isDefault
    await ctx.db.delete(args.addressId)

    if (!wasDefault) return
    // Promote the most recent survivor, so the checkout still preselects one.
    const remaining = await listForUser(ctx, args.userId)
    if (remaining.length === 0) return
    const next = remaining.sort((a: any, b: any) => b.createdAt - a.createdAt)[0]
    await ctx.db.patch(next._id, { isDefault: true, updatedAt: Date.now() })
  },
}

export const setDefault = {
  args: { userId: v.string(), addressId: v.id("customerAddresses") },
  handler: async (ctx: any, args: { userId: string; addressId: string }) => {
    const address = await ctx.db.get(args.addressId)
    if (!address) throw new Error("ADDRESS_NOT_FOUND")
    if (address.userId !== args.userId) throw new Error("FORBIDDEN")

    await promoteToDefault(ctx, args.userId, args.addressId)
  },
}

/**
 * Import addresses a guest had saved in their browser.
 *
 * Idempotent on `localId`: a customer who signs in on three devices ends up
 * with one row per address, not three. Runs once per device on first
 * authenticated load, and the caller clears local storage afterwards.
 */
export const importFromLocal = {
  args: {
    userId: v.string(),
    addresses: v.array(
      v.object({
        localId: v.string(),
        isDefault: v.optional(v.boolean()),
        ...addressFields,
      })
    ),
  },
  handler: async (
    ctx: any,
    args: {
      userId: string
      addresses: Array<{ localId: string; isDefault?: boolean } & AddressInput>
    }
  ) => {
    const now = Date.now()
    const existing = await listForUser(ctx, args.userId)
    const byLocalId = new Map<string, any>(
      existing
        .filter((a: any) => a.importedFromLocalId)
        .map((a: any) => [a.importedFromLocalId as string, a] as const)
    )

    let imported = 0
    let hasDefault = existing.some((a: any) => a.isDefault)

    for (const incoming of args.addresses) {
      const { localId, isDefault, ...fields } = incoming
      const already = byLocalId.get(localId)

      if (already) {
        // Re-import refreshes the fields — coordinates may have been added
        // since — without touching which address is the default.
        await ctx.db.patch(already._id, { ...fields, updatedAt: now })
        continue
      }

      // The local default only carries over when the account has none yet:
      // an address already chosen on the server outranks a device's opinion.
      const takesDefault = !hasDefault && (isDefault ?? false)
      await ctx.db.insert("customerAddresses", {
        userId: args.userId,
        ...fields,
        isDefault: takesDefault,
        importedFromLocalId: localId,
        createdAt: now,
        updatedAt: now,
      })
      if (takesDefault) hasDefault = true
      imported++
    }

    // An account must never end up with addresses and no default.
    if (!hasDefault) {
      const all = await listForUser(ctx, args.userId)
      if (all.length > 0) {
        const first = all.sort((a: any, b: any) => a.createdAt - b.createdAt)[0]
        await ctx.db.patch(first._id, { isDefault: true, updatedAt: now })
      }
    }

    return { imported }
  },
}
