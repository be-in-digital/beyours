/**
 * Kitchen Ticket management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers.
 *
 * Invariants:
 * - trackingToken is REQUIRED, generated at creation (nanoid 21+)
 * - printStatus="pending" MUST have printRequestedAt set
 * - Status transitions enforce timestamps: in_progress->startedAt, ready->readyAt, completed->completedAt
 */

import { v } from "convex/values"

// ============================================================
// QUERIES
// ============================================================

/**
 * Get all kitchen tickets for a store
 */
export const getByStore = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("kitchenTickets")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .order("asc")
      .collect()
  },
}

/**
 * Get kitchen tickets by status
 */
export const getByStatus = {
  args: {
    storeId: v.id("stores"),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("ready"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("kitchenTickets")
      .withIndex("by_storeId_status", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", args.status)
      )
      .order("asc")
      .collect()
  },
}

/**
 * Get kitchen tickets by station
 */
export const getByStation = {
  args: {
    storeId: v.id("stores"),
    station: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("kitchenTickets")
      .withIndex("by_storeId_station", (q: any) =>
        q.eq("storeId", args.storeId).eq("station", args.station)
      )
      .order("asc")
      .collect()
  },
}

/**
 * Get kitchen tickets by order
 */
export const getByOrder = {
  args: { orderId: v.id("orders") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("kitchenTickets")
      .withIndex("by_orderId", (q: any) => q.eq("orderId", args.orderId))
      .collect()
  },
}

/**
 * Print queue: tickets waiting to be printed, sorted by printRequestedAt ASC.
 * Returns everything needed to render PrintTicketLayout.
 */
export const getPrintQueue = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const tickets = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_store_printStatus_printRequestedAt", (q: any) =>
        q.eq("storeId", args.storeId).eq("printStatus", "pending")
      )
      .order("asc")
      .collect()

    // Filter: only tickets with printRequestedAt set (invariant, but defensive)
    return tickets.filter((t: any) => t.printRequestedAt != null)
  },
}

/**
 * Count overdue tickets (estimatedReadyAt < now, still in progress)
 */
export const getOverdueCount = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()

    // Get pending tickets
    const pendingTickets = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_storeId_status", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", "pending")
      )
      .collect()

    // Get in_progress tickets
    const inProgressTickets = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_storeId_status", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", "in_progress")
      )
      .collect()

    const allActive = [...pendingTickets, ...inProgressTickets]

    // Count tickets where estimatedReadyAt exists and is past
    return allActive.filter(
      (t: any) => t.estimatedReadyAt != null && t.estimatedReadyAt < now
    ).length
  },
}

/**
 * Count print-stuck tickets (pending > 30s or failed < 10min, excluding completed tickets)
 */
export const getPrintStuckCount = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    const STUCK_THRESHOLD = 30_000     // 30 seconds
    const FAILED_WINDOW = 600_000      // 10 minutes

    // Get pending print tickets
    const pendingPrint = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_store_printStatus_printRequestedAt", (q: any) =>
        q.eq("storeId", args.storeId).eq("printStatus", "pending")
      )
      .collect()

    const stuckPending = pendingPrint.filter(
      (t: any) =>
        t.printRequestedAt != null &&
        t.printRequestedAt < now - STUCK_THRESHOLD &&
        t.status !== "completed"
    ).length

    // Get failed print tickets
    const failedPrint = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_store_printStatus_printFailedAt", (q: any) =>
        q.eq("storeId", args.storeId).eq("printStatus", "failed")
      )
      .collect()

    const failedRecent = failedPrint.filter(
      (t: any) =>
        t.printFailedAt != null &&
        t.printFailedAt > now - FAILED_WINDOW &&
        t.status !== "completed"
    ).length

    return stuckPending + failedRecent
  },
}

/**
 * Display screen query: returns preparing + ready tickets for the customer-facing TV.
 * Minimal payload: no customer data, no items, no allergens.
 */
export const getForDisplay = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()

    // Get store for branding and display config
    const store = await ctx.db.get(args.storeId)
    if (!store) throw new Error("Store not found")

    const displayConfig = store.displayConfig ?? {
      autoDismissEnabled: true,
      autoDismissMinutes: 15,
    }
    const autoDismissMs = displayConfig.autoDismissMinutes * 60_000

    // Preparing: status "pending" or "in_progress", sorted by createdAt ASC
    const pendingTickets = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_store_status_createdAt", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", "pending")
      )
      .order("asc")
      .collect()

    const inProgressTickets = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_store_status_createdAt", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", "in_progress")
      )
      .order("asc")
      .collect()

    const preparing = [...pendingTickets, ...inProgressTickets]
      .sort((a: any, b: any) => a.createdAt - b.createdAt)
      .map((t: any) => ({
        _id: t._id,
        orderNumber: t.orderNumber,
        status: t.status,
        createdAt: t.createdAt,
      }))

    // Ready: status "ready", not picked up, within auto-dismiss window
    const readyTickets = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_store_status_readyAt", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", "ready")
      )
      .order("desc")
      .collect()

    const ready = readyTickets
      .filter((t: any) => {
        // Exclude picked up tickets
        if (t.pickedUpAt != null) return false
        // Apply auto-dismiss if enabled
        if (displayConfig.autoDismissEnabled && t.readyAt != null) {
          return t.readyAt > now - autoDismissMs
        }
        return true
      })
      .map((t: any) => ({
        _id: t._id,
        orderNumber: t.orderNumber,
        status: t.status,
        createdAt: t.createdAt,
        readyAt: t.readyAt,
      }))

    return {
      preparing,
      ready,
      displayConfig,
      storeBranding: {
        name: store.name,
        slug: store.slug,
      },
      serverNow: now,
    }
  },
}

/**
 * Tracking: get ticket by opaque tracking token.
 * Returns only client-safe data (no staff info, no items, no payment).
 */
export const getByTrackingToken = {
  args: { token: v.string() },
  handler: async (ctx: any, args: any) => {
    const ticket = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_trackingToken", (q: any) =>
        q.eq("trackingToken", args.token)
      )
      .first()

    if (!ticket) return null

    // Get store for branding
    const store = await ctx.db.get(ticket.storeId)

    return {
      _id: ticket._id,
      orderNumber: ticket.orderNumber,
      status: ticket.status,
      orderType: ticket.orderType,
      createdAt: ticket.createdAt,
      startedAt: ticket.startedAt,
      readyAt: ticket.readyAt,
      completedAt: ticket.completedAt,
      estimatedReadyAt: ticket.estimatedReadyAt,
      storeBranding: store ? {
        name: store.name,
        slug: store.slug,
        address: store.address,
      } : null,
    }
  },
}

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Create a new kitchen ticket.
 * trackingToken and print status are set based on store config.
 */
export const create = {
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
    trackingToken: v.string(),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    deliveryNotes: v.optional(v.string()),
    allergens: v.optional(v.array(v.string())),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()

    // Get store to determine print config
    const store = await ctx.db.get(args.storeId)
    const printConfig = store?.printConfig

    // Determine initial print status
    const shouldPrint = printConfig?.enabled === true &&
      printConfig.triggers?.includes("confirmed")

    // Calculate estimatedReadyAt from estimatedPrepTime
    const estimatedReadyAt = args.estimatedPrepTime
      ? now + args.estimatedPrepTime * 60_000
      : undefined

    return await ctx.db.insert("kitchenTickets", {
      storeId: args.storeId,
      orderId: args.orderId,
      orderNumber: args.orderNumber,
      orderType: args.orderType,
      items: args.items,
      station: args.station,
      assignedTo: args.assignedTo,
      priority: args.priority,
      source: args.source,
      estimatedPrepTime: args.estimatedPrepTime,
      trackingToken: args.trackingToken,
      estimatedReadyAt,
      customerName: args.customerName,
      customerPhone: args.customerPhone,
      deliveryNotes: args.deliveryNotes,
      allergens: args.allergens,
      status: "pending",
      printStatus: shouldPrint ? "pending" : "not_required",
      printAttempts: 0,
      printRequestedAt: shouldPrint ? now : undefined,
      printTrigger: shouldPrint ? "confirmed" : undefined,
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Update kitchen ticket status with timestamp invariants.
 * - "in_progress" -> startedAt (if not already set)
 * - "ready" -> readyAt (always set) + trigger "ready" print if configured
 * - "completed" -> completedAt (always set)
 * - "cancelled" -> cancelledAt (always set)
 */
export const updateStatus = {
  args: {
    id: v.id("kitchenTickets"),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("ready"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx: any, args: any) => {
    const ticket = await ctx.db.get(args.id)
    if (!ticket) throw new Error("Kitchen ticket not found")

    const now = Date.now()
    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    }

    // Enforce timestamp invariants
    if (args.status === "in_progress" && !ticket.startedAt) {
      updates.startedAt = now
    }
    if (args.status === "ready") {
      updates.readyAt = now

      // Trigger "ready" print if configured
      const store = await ctx.db.get(ticket.storeId)
      const printConfig = store?.printConfig
      if (printConfig?.enabled === true && printConfig.triggers?.includes("ready")) {
        updates.printStatus = "pending"
        updates.printRequestedAt = now
        updates.printTrigger = "ready"
      }
    }
    if (args.status === "completed") {
      updates.completedAt = now
    }
    if (args.status === "cancelled") {
      updates.cancelledAt = now
    }

    await ctx.db.patch(args.id, updates)
  },
}

/**
 * Mark a ticket as picked up by the customer (from KDS or admin orders page)
 */
export const markPickedUp = {
  args: { id: v.id("kitchenTickets") },
  handler: async (ctx: any, args: any) => {
    const ticket = await ctx.db.get(args.id)
    if (!ticket) throw new Error("Kitchen ticket not found")

    await ctx.db.patch(args.id, {
      pickedUpAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
}

/**
 * Mark print as sent (browser triggered print dialog successfully).
 * Does NOT modify printRequestedAt (preserved for audit).
 */
export const markPrintSent = {
  args: { id: v.id("kitchenTickets") },
  handler: async (ctx: any, args: any) => {
    const ticket = await ctx.db.get(args.id)
    if (!ticket) throw new Error("Kitchen ticket not found")

    await ctx.db.patch(args.id, {
      printStatus: "printed",
      lastPrintAt: Date.now(),
      printAttempts: (ticket.printAttempts ?? 0) + 1,
      printFailedAt: undefined,
      lastPrintError: undefined,
      updatedAt: Date.now(),
    })
  },
}

/**
 * Mark print as failed (timeout without onafterprint, or other error).
 */
export const markPrintFailed = {
  args: {
    id: v.id("kitchenTickets"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const ticket = await ctx.db.get(args.id)
    if (!ticket) throw new Error("Kitchen ticket not found")

    await ctx.db.patch(args.id, {
      printStatus: "failed",
      printAttempts: (ticket.printAttempts ?? 0) + 1,
      printFailedAt: Date.now(),
      lastPrintError: args.reason,
      updatedAt: Date.now(),
    })
  },
}

/**
 * Request a reprint of a ticket.
 * Allowed even if printConfig.enabled=false (manual staff action).
 */
export const requestReprint = {
  args: { id: v.id("kitchenTickets") },
  handler: async (ctx: any, args: any) => {
    const ticket = await ctx.db.get(args.id)
    if (!ticket) throw new Error("Kitchen ticket not found")

    await ctx.db.patch(args.id, {
      printStatus: "pending",
      printRequestedAt: Date.now(),
      printTrigger: "reprint",
      updatedAt: Date.now(),
    })
  },
}

/**
 * Assign kitchen ticket to a station
 */
export const assignStation = {
  args: {
    id: v.id("kitchenTickets"),
    station: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, {
      station: args.station,
      updatedAt: Date.now(),
    })
  },
}

/**
 * Assign kitchen ticket to a user
 */
export const assignTo = {
  args: {
    id: v.id("kitchenTickets"),
    userId: v.string(),
  },
  handler: async (ctx: any, args: any) => {
    await ctx.db.patch(args.id, {
      assignedTo: args.userId,
      updatedAt: Date.now(),
    })
  },
}

/**
 * @deprecated Use markPrintSent instead. Kept for backward compatibility.
 */
export const incrementPrintCount = {
  args: { id: v.id("kitchenTickets") },
  handler: async (ctx: any, args: any) => {
    const ticket = await ctx.db.get(args.id)
    if (!ticket) throw new Error("Kitchen ticket not found")

    await ctx.db.patch(args.id, {
      printCount: (ticket.printCount ?? 0) + 1,
      updatedAt: Date.now(),
    })
  },
}
