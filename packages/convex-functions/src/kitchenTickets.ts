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
import { paginationOptsValidator } from "convex/server"
import { clampPagination } from "./pagination"

/**
 * The statuses the kitchen is actually working on.
 *
 * `getByStore` is a live subscription: every ticket it returns is re-serialised
 * to every open tablet on every write. Completed and cancelled tickets are
 * history, they only grow, and the KDS groups them into columns it never
 * renders — so they are not in the subscription at all. The "Terminées" tab
 * asks for them by the page.
 */
const ACTIVE_STATUSES = ["pending", "in_progress", "ready"] as const

/**
 * The ceiling on a single kitchen read.
 *
 * A pass working through more than this many live tickets at once has a
 * problem no query bound can fix; the point is that the read is bounded at all,
 * so a busy service degrades instead of going blank. Convex throws past its
 * per-transaction document ceiling, and that throw is not recoverable from the
 * admin side — it is the failure this bound exists to prevent.
 *
 * Which end is kept matters, and is not symmetric: every live read below takes
 * the OLDEST rows, because those are the orders people have been waiting for.
 * Keeping the newest would drop the longest-waiting orders off the screen, and
 * nobody would ever cook them.
 */
export const ACTIVE_TICKET_LIMIT = 200

// ============================================================
// QUERIES
// ============================================================

/**
 * Live kitchen tickets for a store: the pass, not the archive.
 *
 * Bounded on both axes — three index reads capped at `ACTIVE_TICKET_LIMIT`
 * each, oldest first, rather than one `.collect()` over the whole lifetime of
 * the establishment. At 60 orders a day the unbounded version passed 20,000
 * documents inside a year and took the display down mid-service.
 */
export const getByStore = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const perStatus = await Promise.all(
      ACTIVE_STATUSES.map((status) =>
        ctx.db
          .query("kitchenTickets")
          .withIndex("by_store_status_createdAt", (q: any) =>
            q.eq("storeId", args.storeId).eq("status", status)
          )
          .order("asc")
          .take(ACTIVE_TICKET_LIMIT)
      )
    )

    // Oldest first: the KDS renders the pass in the order it was ordered.
    return perStatus.flat().sort((a: any, b: any) => a.createdAt - b.createdAt)
  },
}

/**
 * Kitchen tickets by status, one page at a time.
 *
 * `completed` is the class that grows without limit, and the "Terminées" tab
 * read all of it: one `.collect()` over every ticket the establishment had ever
 * finished, materialised on the tablet. It is the query that dies first, and it
 * takes the kitchen's own screen down with it.
 *
 * Convex's own cursor pagination rather than a hand-rolled one, so the client
 * is `usePaginatedQuery` and there is no page-accumulating effect to get wrong.
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
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("kitchenTickets")
      .withIndex("by_store_status_createdAt", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", args.status)
      )
      // Newest first: the history is read backwards from now.
      .order("desc")
      .paginate(clampPagination(args.paginationOpts))
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
      .take(ACTIVE_TICKET_LIMIT)
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
 * How long a tablet may hold a claim before another one may take the ticket.
 *
 * Long enough for a print dialog a cook is reading, short enough that a tablet
 * that went to sleep mid-dialog does not strand the slip. `PRINT_TIMEOUT_MS` on
 * the client is 20s; this is that plus room for the round trip.
 */
export const PRINT_CLAIM_TTL_MS = 45_000

/** A print that failed is retried after this long, up to `MAX_PRINT_ATTEMPTS`. */
export const PRINT_RETRY_DELAY_MS = 30_000

/**
 * Attempts before a ticket stops being retried automatically.
 *
 * It stays `failed`, the alarm keeps counting it, and the reprint button still
 * works — this only ends the automatic loop, so a printer that is off does not
 * spin forever.
 */
export const MAX_PRINT_ATTEMPTS = 3

/**
 * Decide whether a failed ticket is due for another automatic attempt.
 *
 * Pure, and exported, because "why did this slip never come back" is the
 * question the retry rule has to be able to answer on its own.
 */
export function isRetryable(
  ticket: { printAttempts?: number; printFailedAt?: number; status?: string },
  now: number
): boolean {
  if (ticket.status === "completed" || ticket.status === "cancelled") return false
  if ((ticket.printAttempts ?? 0) >= MAX_PRINT_ATTEMPTS) return false
  if (ticket.printFailedAt == null) return false
  return ticket.printFailedAt <= now - PRINT_RETRY_DELAY_MS
}

/**
 * Collapse an order's station tickets into the one the customer should see.
 *
 * "Least advanced wins", across every status including the finished ones: a
 * customer whose main is still being plated must not read "prête" — or
 * "Terminée" — because the drinks station got there first. Order matters only
 * within an order number; the caller's ordering is otherwise preserved.
 */
export function dedupeByOrder<T extends { orderNumber: string; status: string }>(
  tickets: T[]
): T[] {
  // Every status is ranked. A `?? 0` fallback put `completed` and `cancelled`
  // level with `pending`, so a cold station that had finished won the
  // "least advanced" comparison and `/track` announced the whole order
  // "Terminée" while the pizza had not been started — the same lie this
  // function exists to prevent, one status further along.
  const RANK: Record<string, number> = {
    pending: 0,
    in_progress: 1,
    ready: 2,
    completed: 3,
    cancelled: 4,
  }
  // An unknown status must not win by default either.
  const rankOf = (status: string) => RANK[status] ?? Number.MAX_SAFE_INTEGER

  const byOrder = new Map<string, T>()

  for (const ticket of tickets) {
    const held = byOrder.get(ticket.orderNumber)
    if (!held) {
      byOrder.set(ticket.orderNumber, ticket)
      continue
    }
    if (rankOf(ticket.status) < rankOf(held.status)) {
      byOrder.set(ticket.orderNumber, ticket)
    }
  }

  return [...byOrder.values()]
}

/**
 * A ceiling on how many station tickets one order can have.
 *
 * An establishment with more passes than this has a naming problem, not a
 * kitchen; the bound is here so a token lookup is a bounded read like every
 * other one on this screen.
 */
const MAX_STATION_TICKETS = 32

/** The earliest non-null value of `field`, or undefined if none is set. */
function earliestOf(tickets: any[], field: string): number | undefined {
  const values = tickets.map((t) => t[field]).filter((v) => v != null)
  return values.length > 0 ? Math.min(...values) : undefined
}

/**
 * The latest non-null value of `field` — but undefined while any ticket is
 * still missing it.
 *
 * "Ready at" for an order means every station is done. Returning the latest of
 * whatever happens to be set would announce the order ready the moment the
 * first station finished, which is the bug this whole function exists to stop.
 */
function latestOf(tickets: any[], field: string): number | undefined {
  const values = tickets.map((t) => t[field])
  if (values.some((v) => v == null)) return undefined
  return values.length > 0 ? Math.max(...values) : undefined
}

/**
 * Decide whether a caller still holds the claim it is reporting on.
 *
 * A missing `claimId` is accepted when the ticket is not claimed by anyone —
 * the manual paths (`requestReprint`, staff actions) legitimately have none,
 * and a ticket nobody holds cannot be stolen from.
 */
export function ownsClaim(
  ticket: { printClaimId?: string },
  claimId?: string
): boolean {
  if (ticket.printClaimId == null) return true
  return ticket.printClaimId === claimId
}

/**
 * Decide whether a claim has gone stale and the ticket may be taken again.
 */
export function isClaimExpired(
  ticket: { printClaimedAt?: number },
  now: number
): boolean {
  return (ticket.printClaimedAt ?? 0) <= now - PRINT_CLAIM_TTL_MS
}

/**
 * Print queue: what this tablet may print, oldest request first.
 *
 * Three classes, and the last two are the reason the queue used to lie:
 *  - `pending` — asked for, nobody has taken it;
 *  - `printing` whose claim has expired — the tablet that took it is gone;
 *  - `failed` and due for a retry — `printAttempts` was incremented on every
 *    failure and read by nobody, so a slip that failed once never came back.
 *
 * Returning a ticket here is not permission to print it. The tablet must win
 * `claimForPrint` first; two tablets watching the same queue see the same rows.
 */
export const getPrintQueue = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()

    const [pending, claimed, failed] = await Promise.all([
      ctx.db
        .query("kitchenTickets")
        .withIndex("by_store_printStatus_printRequestedAt", (q: any) =>
          q.eq("storeId", args.storeId).eq("printStatus", "pending")
        )
        .order("asc")
        .take(ACTIVE_TICKET_LIMIT),
      ctx.db
        .query("kitchenTickets")
        .withIndex("by_store_printStatus_printRequestedAt", (q: any) =>
          q.eq("storeId", args.storeId).eq("printStatus", "printing")
        )
        .order("asc")
        .take(ACTIVE_TICKET_LIMIT),
      ctx.db
        .query("kitchenTickets")
        .withIndex("by_store_printStatus_printFailedAt", (q: any) =>
          q.eq("storeId", args.storeId).eq("printStatus", "failed")
        )
        .order("asc")
        .take(ACTIVE_TICKET_LIMIT),
    ])

    // Cancelling an order leaves its ticket `printStatus: "pending"` — the
    // cascade in `orders.updateStatus` moves the ticket's own status and
    // nothing else — so without this the kitchen prints a slip for a dinner
    // that has just been called off. `isRetryable` already excluded them; the
    // pending branch did not.
    const isLive = (t: any) => t.status !== "cancelled" && t.status !== "completed"

    const queue = [
      // The invariant is that a "pending" ticket has printRequestedAt; the
      // filter is defensive, and cheap.
      ...pending.filter((t: any) => t.printRequestedAt != null && isLive(t)),
      ...claimed.filter((t: any) => isClaimExpired(t, now) && isLive(t)),
      ...failed.filter((t: any) => isRetryable(t, now)),
    ]

    return queue.sort(
      (a: any, b: any) => (a.printRequestedAt ?? 0) - (b.printRequestedAt ?? 0)
    )
  },
}

/**
 * Count overdue tickets (estimatedReadyAt < now, still in progress)
 */
export const getOverdueCount = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()

    // Bounded for the same reason `getByStore` is: this runs on the live KDS,
    // and an unbounded scan of the two active classes is the same unbounded
    // scan whether it returns rows or a number.
    const [pendingTickets, inProgressTickets] = await Promise.all([
      ctx.db
        .query("kitchenTickets")
        .withIndex("by_store_status_createdAt", (q: any) =>
          q.eq("storeId", args.storeId).eq("status", "pending")
        )
        .order("asc")
        .take(ACTIVE_TICKET_LIMIT),
      ctx.db
        .query("kitchenTickets")
        .withIndex("by_store_status_createdAt", (q: any) =>
          q.eq("storeId", args.storeId).eq("status", "in_progress")
        )
        .order("asc")
        .take(ACTIVE_TICKET_LIMIT),
    ])

    // Per ORDER, not per ticket: an order split across two stations is one late
    // order, and counting it twice makes the badge overstate by exactly the
    // number of stations the establishment has configured.
    const allActive = dedupeByOrder([...pendingTickets, ...inProgressTickets])

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
      .order("asc")
      .take(ACTIVE_TICKET_LIMIT)

    const stuckPending = pendingPrint.filter(
      (t: any) =>
        t.printRequestedAt != null &&
        t.printRequestedAt < now - STUCK_THRESHOLD &&
        t.status !== "completed"
    ).length

    // Get failed print tickets — newest first: the alarm is about the last ten
    // minutes, so an old backlog must not crowd a fresh failure out of the read.
    const failedPrint = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_store_printStatus_printFailedAt", (q: any) =>
        q.eq("storeId", args.storeId).eq("printStatus", "failed")
      )
      .order("desc")
      .take(ACTIVE_TICKET_LIMIT)

    const failedRecent = failedPrint.filter(
      (t: any) =>
        t.status !== "completed" &&
        t.status !== "cancelled" &&
        t.printFailedAt != null &&
        // A recent failure, OR one that has spent its retries: the ten-minute
        // window assumes the automatic loop will bring the slip back, and past
        // `MAX_PRINT_ATTEMPTS` it never will. Dropping those from the count is
        // how a permanently unprinted order became silent — the promise made
        // beside `MAX_PRINT_ATTEMPTS` is that the alarm keeps counting it.
        (t.printFailedAt > now - FAILED_WINDOW ||
          (t.printAttempts ?? 0) >= MAX_PRINT_ATTEMPTS)
    ).length

    // A ticket a tablet took and never finished used to sit at "pending" and be
    // counted here. It sits at "printing" now, so without this the claim lock
    // would have made the alarm blind to exactly the case it exists for: the
    // tablet that went to sleep with the dialog open.
    const claimed = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_store_printStatus_printRequestedAt", (q: any) =>
        q.eq("storeId", args.storeId).eq("printStatus", "printing")
      )
      .order("asc")
      .take(ACTIVE_TICKET_LIMIT)

    const stuckClaimed = claimed.filter(
      (t: any) => isClaimExpired(t, now) && t.status !== "completed"
    ).length

    return stuckPending + failedRecent + stuckClaimed
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

    // Preparing: status "pending" or "in_progress", sorted by createdAt ASC.
    // Bounded like every other live read — this one hangs on a wall in the
    // dining room, so it is the screen a customer watches go blank.
    const [pendingTickets, inProgressTickets] = await Promise.all([
      ctx.db
        .query("kitchenTickets")
        .withIndex("by_store_status_createdAt", (q: any) =>
          q.eq("storeId", args.storeId).eq("status", "pending")
        )
        .order("asc")
        .take(ACTIVE_TICKET_LIMIT),
      ctx.db
        .query("kitchenTickets")
        .withIndex("by_store_status_createdAt", (q: any) =>
          q.eq("storeId", args.storeId).eq("status", "in_progress")
        )
        .order("asc")
        .take(ACTIVE_TICKET_LIMIT),
    ])

    // One row per ORDER, not per ticket.
    //
    // An order routed across stations is several tickets — the pizza at the hot
    // pass, the salad at the cold one — and this screen hangs in the dining
    // room, where a customer reads their own order number. Two rows saying
    // "A17" is not information, it is a bug they can see. `dedupeByOrder` keeps
    // the least advanced of them, because an order is only as ready as its
    // slowest station.
    const preparing = dedupeByOrder(
      [...pendingTickets, ...inProgressTickets].sort(
        (a: any, b: any) => a.createdAt - b.createdAt
      )
    ).map((t: any) => ({
      _id: t._id,
      orderNumber: t.orderNumber,
      status: t.status,
      createdAt: t.createdAt,
    }))

    // Ready: status "ready", not picked up, within auto-dismiss window.
    // Newest first, so the auto-dismiss window is read from the right end.
    const readyTickets = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_store_status_readyAt", (q: any) =>
        q.eq("storeId", args.storeId).eq("status", "ready")
      )
      .order("desc")
      .take(ACTIVE_TICKET_LIMIT)

    const readyVisible = readyTickets.filter((t: any) => {
      // Exclude picked up tickets
      if (t.pickedUpAt != null) return false
      // Apply auto-dismiss if enabled
      if (displayConfig.autoDismissEnabled && t.readyAt != null) {
        return t.readyAt > now - autoDismissMs
      }
      return true
    })

    // An order still cooking at another station is not ready, whatever this
    // station says. `preparing` already holds it, so announcing it here as well
    // would put the same order number in both columns of the same screen.
    const stillPreparing = new Set(preparing.map((t: any) => t.orderNumber))

    const ready = dedupeByOrder(readyVisible)
      .filter((t: any) => !stillPreparing.has(t.orderNumber))
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
    // An order routed across stations is several tickets sharing one token, so
    // this reads all of them and answers for the order.
    //
    // Reading `.first()` here was a lie the customer could see: the cold
    // station finishes the salad, the token happens to point at that ticket,
    // and `/track` says "prête" while the pizza is still in the oven. The
    // customer walks in for food that is not made.
    // Annotated because `dedupeByOrder` is generic over its constraint: left to
    // infer from the untyped ctx it narrows the row to the two fields the
    // constraint names, and every other field read below stops compiling.
    const tickets: any[] = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_trackingToken", (q: any) =>
        q.eq("trackingToken", args.token)
      )
      .take(MAX_STATION_TICKETS)

    if (tickets.length === 0) return null

    // An order is only as ready as its slowest station.
    const ticket = dedupeByOrder(tickets)[0]!

    // Get store for branding
    const store = await ctx.db.get(ticket.storeId)

    return {
      _id: ticket._id,
      orderNumber: ticket.orderNumber,
      status: ticket.status,
      orderType: ticket.orderType,
      createdAt: ticket.createdAt,
      // The whole order's timings, not the station this row happens to be:
      // it starts when the first station starts and is ready when the last is.
      startedAt: earliestOf(tickets, "startedAt"),
      readyAt: latestOf(tickets, "readyAt"),
      completedAt: latestOf(tickets, "completedAt"),
      estimatedReadyAt: latestOf(tickets, "estimatedReadyAt"),
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
 * Take a ticket for printing, or lose the race.
 *
 * Two tablets open on the same pass both read `pending` from `getPrintQueue`
 * and both printed the slip: the ticket was only claimed in `onafterprint`,
 * one to twenty seconds later, and nothing held it in between. Every dinner
 * with two screens in the kitchen printed twice.
 *
 * A Convex mutation is a transaction, so the read and the write below cannot
 * interleave with another tablet's. The loser gets `null` and prints nothing.
 *
 * Returns a claim id to exactly one caller per claim window, and `null` to
 * everyone else. The id is what `markPrintSent` and `markPrintFailed` check:
 * a tablet whose claim expired while its dialog was open would otherwise come
 * back and close a slip a second tablet is in the middle of printing, which is
 * the duplicate this whole mechanism exists to stop.
 */
export const claimForPrint = {
  args: { id: v.id("kitchenTickets") },
  handler: async (ctx: any, args: any): Promise<string | null> => {
    const ticket = await ctx.db.get(args.id)
    if (!ticket) throw new Error("Kitchen ticket not found")

    const now = Date.now()

    // A cancelled or completed order has nothing to print.
    if (ticket.status === "cancelled" || ticket.status === "completed") return null

    const claimable =
      ticket.printStatus === "pending" ||
      // The tablet that held it is gone — its dialog was never answered.
      (ticket.printStatus === "printing" && isClaimExpired(ticket, now)) ||
      // A retry that has served its delay.
      (ticket.printStatus === "failed" && isRetryable(ticket, now))

    if (!claimable) return null

    const claimId = crypto.randomUUID()

    await ctx.db.patch(args.id, {
      printStatus: "printing",
      printClaimedAt: now,
      printClaimId: claimId,
      updatedAt: now,
    })
    return claimId
  },
}

/**
 * Mark print as sent (browser triggered print dialog successfully).
 * Does NOT modify printRequestedAt (preserved for audit).
 */
export const markPrintSent = {
  args: {
    id: v.id("kitchenTickets"),
    claimId: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const ticket = await ctx.db.get(args.id)
    if (!ticket) throw new Error("Kitchen ticket not found")

    // Somebody else holds this slip: this tablet's dialog outlived its claim.
    // Reporting success now would file a ticket the other tablet is still
    // printing, and both would put paper on the pass.
    if (!ownsClaim(ticket, args.claimId)) return

    await ctx.db.patch(args.id, {
      printStatus: "printed",
      lastPrintAt: Date.now(),
      printAttempts: (ticket.printAttempts ?? 0) + 1,
      printClaimedAt: undefined,
      printFailedAt: undefined,
      lastPrintError: undefined,
      printClaimId: undefined,
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
    claimId: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const ticket = await ctx.db.get(args.id)
    if (!ticket) throw new Error("Kitchen ticket not found")

    // Same rule as `markPrintSent`: a late tablet must not fail a slip that
    // now belongs to another one.
    if (!ownsClaim(ticket, args.claimId)) return

    await ctx.db.patch(args.id, {
      printStatus: "failed",
      printAttempts: (ticket.printAttempts ?? 0) + 1,
      printFailedAt: Date.now(),
      lastPrintError: args.reason,
      // Release the claim: the retry is a fresh race, not this tablet's.
      printClaimedAt: undefined,
      printClaimId: undefined,
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
      // A staff member asking for the slip again starts the attempt count
      // over: the automatic retry ceiling is about a printer that is off, and
      // this is a person who has just looked at it.
      printAttempts: 0,
      printClaimedAt: undefined,
      printClaimId: undefined,
      printFailedAt: undefined,
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

// ============================================================
// RETENTION
// ============================================================

/**
 * How long a finished ticket is kept.
 *
 * The kitchen's own record of service, not the business record — `orders` is
 * that, and it is untouched by this. Thirty days covers "what did we send out
 * last month", which is the longest question the "Terminées" tab is ever asked.
 */
export const TICKET_RETENTION_DAYS = 30

/** Deletions per run. Convex bounds a mutation; the cron catches up nightly. */
export const RETENTION_BATCH_SIZE = 200

/**
 * Delete finished tickets older than the retention window.
 *
 * Without this the two bounds added to `getByStore` and `getByStatus` only move
 * the failure: the table still grows without limit, the completed history
 * becomes unreadable by the page, and a store's row count climbs for ever with
 * no way for the owner to bring it down. Bounding the read and never deleting
 * would have been half a fix.
 *
 * One batch per call, oldest first, so a deployment turning this on for the
 * first time does not die inside one transaction. `hasMore` says there is more
 * to do, and the caller is expected to act on it: a single nightly batch of
 * `RETENTION_BATCH_SIZE` against a year of history at 60 orders a day would
 * take months to drain and would never catch up. The app wrapper reschedules
 * itself while `hasMore` is true.
 */
export const purgeExpiredTickets = {
  args: {
    olderThanDays: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx: any,
    args: { olderThanDays?: number; limit?: number }
  ): Promise<{ deleted: number; hasMore: boolean }> => {
    const days = args.olderThanDays ?? TICKET_RETENTION_DAYS
    const limit = Math.min(args.limit ?? RETENTION_BATCH_SIZE, RETENTION_BATCH_SIZE)
    const cutoff = Date.now() - days * 86_400_000

    let deleted = 0
    let hasMore = false

    // "completed" and "cancelled" only. A ticket still on the pass is never
    // swept, however old it is: an establishment that left one open overnight
    // has a problem, and silently deleting it is not the answer.
    for (const status of ["completed", "cancelled"] as const) {
      const remaining = limit - deleted
      if (remaining <= 0) {
        hasMore = true
        break
      }

      const batch = await ctx.db
        .query("kitchenTickets")
        .withIndex("by_status_createdAt", (q: any) =>
          q.eq("status", status).lt("createdAt", cutoff)
        )
        .order("asc")
        .take(remaining + 1)

      if (batch.length > remaining) hasMore = true

      for (const ticket of batch.slice(0, remaining)) {
        await ctx.db.delete(ticket._id)
        deleted++
      }
    }

    return { deleted, hasMore }
  },
}
