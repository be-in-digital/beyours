"use node"

import { v } from "convex/values"
import { action } from "./_generated/server"

/**
 * Uber Eats Reporting actions (eats.report scope)
 * Fetches financial data and order-level transactions from Uber Eats API.
 */

export const getOrdersReport = action({
  args: {
    platformStoreId: v.string(),
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(),   // YYYY-MM-DD
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

    const report = await uberEats.getOrdersReport(
      credentials,
      args.platformStoreId,
      args.startDate,
      args.endDate,
    )

    console.log(`Fetched Uber Eats orders report for store ${args.platformStoreId}: ${args.startDate} → ${args.endDate}`)
    return report
  },
})

export const getFinancialSummary = action({
  args: {
    platformStoreId: v.string(),
    startDate: v.string(),
    endDate: v.string(),
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

    const summary = await uberEats.getFinancialSummary(
      credentials,
      args.platformStoreId,
      args.startDate,
      args.endDate,
    )

    console.log(`Fetched Uber Eats financial summary for store ${args.platformStoreId}`)
    return summary
  },
})
