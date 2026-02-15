// NOTE: This file will be copied to the convex/ directory of each app
// Imports will be resolved by Convex

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
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
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
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .filter((q) => q.eq(q.field("status"), args.status))
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
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .filter((q) => q.eq(q.field("station"), args.station))
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
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
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
    items: v.array(v.object({
      productId: v.id("products"),
      name: v.string(),
      quantity: v.number(),
      selectedOptions: v.optional(v.array(v.object({
        optionName: v.string(),
        choiceName: v.string(),
      }))),
      notes: v.optional(v.string()),
    })),
    station: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
    priority: v.union(
      v.literal("low"),
      v.literal("normal"),
      v.literal("high"),
      v.literal("urgent")
    ),
    notes: v.optional(v.string()),
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
    userId: v.id("users"),
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
