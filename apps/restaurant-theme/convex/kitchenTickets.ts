/**
 * Kitchen Ticket management functions
 *
 * NOTE: Originated from packages/convex-functions/src/kitchenTickets.ts
 * Imports are resolved by Convex in the app's convex/ directory
 */

import { v } from "convex/values"
import { query, mutation } from "./_generated/server"

// === QUERIES ===

/**
 * Get all kitchen tickets for a store
 */
export const getByStore = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("kitchenTickets")
      .withIndex("by_storeId", (q) => q.eq("storeId", args.storeId))
      .order("asc")
      .collect()
  },
})

/**
 * Get kitchen tickets by status
 */
export const getByStatus = query({
  args: {
    storeId: v.id("stores"),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("ready"),
      v.literal("completed")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("kitchenTickets")
      .withIndex("by_storeId_status", (q) =>
        q.eq("storeId", args.storeId).eq("status", args.status)
      )
      .order("asc")
      .collect()
  },
})

/**
 * Get kitchen tickets by station
 */
export const getByStation = query({
  args: {
    storeId: v.id("stores"),
    station: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("kitchenTickets")
      .withIndex("by_storeId_station", (q) =>
        q.eq("storeId", args.storeId).eq("station", args.station)
      )
      .order("asc")
      .collect()
  },
})

/**
 * Get kitchen tickets by order
 */
export const getByOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("kitchenTickets")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .collect()
  },
})

// === MUTATIONS ===

/**
 * Create a new kitchen ticket
 */
export const create = mutation({
  args: {
    storeId: v.id("stores"),
    orderId: v.id("orders"),
    orderNumber: v.string(),
    orderType: v.union(
      v.literal("delivery"),
      v.literal("pickup"),
      v.literal("dine_in")
    ),
    items: v.array(v.object({
      productName: v.string(),
      quantity: v.number(),
      options: v.array(v.string()),
      notes: v.optional(v.string()),
    })),
    station: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    priority: v.union(
      v.literal("normal"),
      v.literal("urgent"),
      v.literal("vip")
    ),
    source: v.union(
      v.literal("website"),
      v.literal("uber_eats"),
      v.literal("deliveroo"),
      v.literal("pos")
    ),
    estimatedPrepTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("kitchenTickets", {
      ...args,
      status: "pending",
      printCount: 0,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Update kitchen ticket status
 */
export const updateStatus = mutation({
  args: {
    id: v.id("kitchenTickets"),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("ready"),
      v.literal("completed")
    ),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.id)
    if (!ticket) throw new Error("Kitchen ticket not found")

    const now = Date.now()
    const updates: any = {
      status: args.status,
      updatedAt: now,
    }

    // Set timestamps based on status
    if (args.status === "in_progress" && !ticket.startedAt) {
      updates.startedAt = now
    } else if ((args.status === "completed" || args.status === "ready") && !ticket.completedAt) {
      updates.completedAt = now
    }

    await ctx.db.patch(args.id, updates)
  },
})

/**
 * Assign kitchen ticket to a station
 */
export const assignStation = mutation({
  args: {
    id: v.id("kitchenTickets"),
    station: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      station: args.station,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Assign kitchen ticket to a user
 */
export const assignTo = mutation({
  args: {
    id: v.id("kitchenTickets"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      assignedTo: args.userId,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Increment print count for a kitchen ticket
 */
export const incrementPrintCount = mutation({
  args: { id: v.id("kitchenTickets") },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.id)
    if (!ticket) throw new Error("Kitchen ticket not found")

    await ctx.db.patch(args.id, {
      printCount: ticket.printCount + 1,
      updatedAt: Date.now(),
    })
  },
})
