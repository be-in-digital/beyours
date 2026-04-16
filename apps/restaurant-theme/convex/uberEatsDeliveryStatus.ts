"use node"

import { v } from "convex/values"
import { action } from "./_generated/server"

/**
 * Uber Eats Restaurant Delivery Status actions
 * (eats.store.orders.restaurantdelivery.status scope)
 *
 * Used when the restaurant handles its own delivery instead of Uber couriers.
 * Allows the restaurant to push status updates back to Uber Eats so the
 * customer can track their order.
 */

export const updateDeliveryStatus = action({
  args: {
    externalOrderId: v.string(),
    status: v.union(
      v.literal("arriving"),
      v.literal("picked_up"),
      v.literal("delivered"),
    ),
  },
  handler: async (_ctx, args) => {
    const { getPackageEnv, getSiteEnv } = await import("@be-in-digital/core/env")
    const pkg = getPackageEnv()
    const site = getSiteEnv()
    const { uberEats } = await import("@be-in-digital/integrations")

    const clientId = pkg.UBER_EATS_CLIENT_ID
    const clientSecret = pkg.UBER_EATS_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new Error("Uber Eats credentials not configured")
    }

    const credentials = {
      clientId,
      clientSecret,
      sandboxMode: site.UBER_EATS_SANDBOX_MODE === "true",
    }

    await uberEats.updateDeliveryStatus(
      credentials,
      args.externalOrderId,
      args.status,
    )

    console.log(`Updated delivery status for order ${args.externalOrderId} → ${args.status}`)
    return { success: true, orderId: args.externalOrderId, status: args.status }
  },
})
