/**
 * Global settings management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

import { effectiveDeliveryFeeMode } from "./deliveryQuote"

/**
 * Percentage delivery pricing bills a share of an Uber Direct quote. Stored
 * without the integration, it leaves the shop unable to take a delivery order
 * at all: `orders.create` asks for an estimate id the storefront has no way to
 * obtain, and every delivery customer is turned away with "un devis de
 * livraison est requis".
 *
 * The settings page already refuses to offer the mode while Uber Direct is
 * off. This closes the other door — the one an owner walks through by
 * configuring percentage mode and then switching the integration off, which
 * leaves the mode behind with nothing to price it.
 *
 * Coerced, not refused: an owner switching Uber Direct off must be able to
 * switch it off. What survives is the mode the shop can still honour.
 */
function honourableDelivery(
  delivery: { feeMode?: string } | undefined,
  integrations: { uberDirect?: { enabled?: boolean } } | undefined
) {
  if (!delivery || delivery.feeMode !== "percentage") return delivery
  const mode = effectiveDeliveryFeeMode({
    feeMode: delivery.feeMode,
    uberDirectEnabled: integrations?.uberDirect?.enabled,
  })
  return mode === "percentage" ? delivery : { ...delivery, feeMode: "fixed" }
}

// === QUERIES ===

/**
 * Get the global settings (there's only one row)
 */
export const get = {
  args: {},
  handler: async (ctx: any) => {
    const settings = await ctx.db.query("globalSettings").first()
    return settings
  },
}

// === MUTATIONS ===

/**
 * Create or update global settings
 * Uses upsert pattern: if settings exist, patch them; otherwise create new
 */
export const upsert = {
  args: {
    currency: v.optional(v.string()),
    timezone: v.optional(v.string()),
    taxRate: v.optional(v.number()),
    services: v.optional(v.object({
      dineIn: v.boolean(),
      takeaway: v.boolean(),
      delivery: v.boolean(),
      clickAndCollect: v.boolean(),
    })),
    minimumOrderAmount: v.optional(v.number()),
    hours: v.optional(v.array(v.object({
      day: v.number(),
      open: v.string(),
      close: v.string(),
      isClosed: v.boolean(),
    }))),
    delivery: v.optional(v.object({
      feeMode: v.optional(v.union(v.literal("fixed"), v.literal("percentage"))),
      fee: v.optional(v.number()),
      percentage: v.optional(v.number()),
      maxFee: v.optional(v.number()),
      freeAbove: v.optional(v.number()),
      radius: v.optional(v.number()),
    })),
    payments: v.optional(v.object({
      cardProvider: v.union(v.literal("stripe"), v.literal("sumup")),
      paypal: v.boolean(),
      paypalEmail: v.optional(v.string()),
      cash: v.boolean(),
    })),
    integrations: v.optional(v.object({
      uberDirect: v.optional(v.object({
        customerId: v.optional(v.string()),
        clientId: v.optional(v.string()),
        clientSecret: v.optional(v.string()),
        enabled: v.boolean(),
      })),
      uberEats: v.optional(v.object({
        enabled: v.boolean(),
        priceMarkup: v.optional(v.number()), // platform price markup percentage
      })),
      deliveroo: v.optional(v.object({
        enabled: v.boolean(),
        priceMarkup: v.optional(v.number()), // platform price markup percentage
      })),
    })),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await ctx.db.query("globalSettings").first()
    if (existing) {
      const updates: Record<string, unknown> = { updatedAt: Date.now() }
      for (const [key, value] of Object.entries(args)) {
        if (value === undefined) continue
        // `integrations` is patched platform by platform, not as one blob.
        //
        // `ctx.db.patch` replaces a whole object field, so a caller sending
        // only `{ uberDirect }` erased the Uber Eats and Deliveroo settings
        // beside it — a tab saving its own section took out the others. Each
        // platform is still replaced whole, so clearing a field inside one
        // works: absent means "not this tab's business", not "keep this".
        if (key === "integrations" && existing.integrations) {
          updates.integrations = { ...existing.integrations, ...(value as object) }
          continue
        }
        updates[key] = value
      }
      // Read back what this write actually leaves behind — `delivery` is
      // replaced whole, `integrations` merged above — so turning Uber Direct
      // off in the integrations tab drops the orphaned percentage mode with it,
      // even though that save never mentioned delivery.
      const writtenDelivery = (updates.delivery ?? existing.delivery) as
        | { feeMode?: string }
        | undefined
      const resolvedDelivery = honourableDelivery(
        writtenDelivery,
        (updates.integrations ?? existing.integrations) as
          | { uberDirect?: { enabled?: boolean } }
          | undefined
      )
      // A new object only comes back when the mode was actually dropped, so an
      // unrelated save leaves `delivery` untouched instead of rewriting it.
      if (resolvedDelivery !== writtenDelivery) updates.delivery = resolvedDelivery

      await ctx.db.patch(existing._id, updates)
      return existing._id
    }
    // Create with defaults
    return await ctx.db.insert("globalSettings", {
      currency: args.currency ?? "EUR",
      timezone: args.timezone ?? "Europe/Paris",
      taxRate: args.taxRate ?? 20,
      services: args.services ?? {
        dineIn: true,
        takeaway: true,
        delivery: false,
        clickAndCollect: false,
      },
      minimumOrderAmount: args.minimumOrderAmount,
      hours: args.hours ?? [
        { day: 0, open: "00:00", close: "00:00", isClosed: true },
        { day: 1, open: "09:00", close: "22:00", isClosed: false },
        { day: 2, open: "09:00", close: "22:00", isClosed: false },
        { day: 3, open: "09:00", close: "22:00", isClosed: false },
        { day: 4, open: "09:00", close: "22:00", isClosed: false },
        { day: 5, open: "09:00", close: "23:00", isClosed: false },
        { day: 6, open: "09:00", close: "23:00", isClosed: false },
      ],
      delivery: honourableDelivery(
        args.delivery ?? { feeMode: "fixed", radius: 10, fee: 350, freeAbove: 3000 },
        args.integrations
      ),
      payments: args.payments ?? { cardProvider: "stripe", paypal: false, cash: false },
      integrations: args.integrations ?? {},
      updatedAt: Date.now(),
    })
  },
}
