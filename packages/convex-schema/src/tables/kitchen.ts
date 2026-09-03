import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Kitchen Tickets table
 * Real-time kitchen display with station routing
 */
export const kitchenTicketsTable = defineTable({
  storeId: v.id("stores"),
  orderId: v.id("orders"),
  station: v.optional(v.string()), // "starters", "mains", "desserts", "drinks"
  status: v.union(
    v.literal("pending"),
    v.literal("in_progress"),
    v.literal("ready"),
    v.literal("completed"),
    v.literal("cancelled")
  ),
  priority: v.union(
    v.literal("normal"),
    v.literal("urgent"),
    v.literal("vip")
  ),
  items: v.array(v.object({
    productName: v.string(),
    quantity: v.number(),
    options: v.array(v.string()),
    notes: v.optional(v.string()),
  })),
  assignedTo: v.optional(v.string()), // Reference to Better Auth component user
  estimatedPrepTime: v.optional(v.number()), // in minutes (max of item prep times)
  source: v.union(
    v.literal("website"),
    v.literal("uber_eats"),
    v.literal("deliveroo"),
    v.literal("pos")
  ),
  orderNumber: v.string(),
  orderType: v.union(
    v.literal("delivery"),
    v.literal("pickup"),
    v.literal("dine_in")
  ),

  // Lifecycle timestamps (enforced by updateStatus invariants)
  startedAt: v.optional(v.number()),    // set when status -> "in_progress" (if not already set)
  readyAt: v.optional(v.number()),      // set when status -> "ready"
  completedAt: v.optional(v.number()),  // set when status -> "completed"
  pickedUpAt: v.optional(v.number()),   // set by markPickedUp()
  cancelledAt: v.optional(v.number()),  // set when status -> "cancelled"

  // Tracking (client-facing)
  trackingToken: v.string(),            // nanoid(21), generated at creation, REQUIRED
  estimatedReadyAt: v.optional(v.number()), // timestamp = createdAt + max(prepTime of items)

  // Customer info for print ticket (delivery only)
  customerName: v.optional(v.string()),
  customerPhone: v.optional(v.string()),
  deliveryNotes: v.optional(v.string()),
  allergens: v.optional(v.array(v.string())),

  // Print management
  //
  // "printing" is a claim, not a state the kitchen cares about: two tablets
  // open on the same pass both saw `pending` and both printed the slip. A
  // tablet now takes the ticket by moving it to "printing" in one transaction,
  // and only one of them can win. `printClaimedAt` is what lets a claim from a
  // tablet that was then closed mid-dialog be reclaimed instead of stranding
  // the ticket forever.
  printStatus: v.union(
    v.literal("pending"),
    v.literal("printing"),
    v.literal("printed"),
    v.literal("failed"),
    v.literal("not_required")
  ),
  printAttempts: v.number(),            // default: 0
  printClaimedAt: v.optional(v.number()), // set when a tablet claims the ticket
  // Who holds the claim. A tablet whose dialog outlived its claim comes back
  // with a stale id and is refused, instead of closing a slip the tablet that
  // reclaimed it is still printing.
  printClaimId: v.optional(v.string()),
  printRequestedAt: v.optional(v.number()), // set at each trigger (confirmed/ready/reprint)
  printTrigger: v.optional(v.union(
    v.literal("confirmed"),
    v.literal("ready"),
    v.literal("reprint")
  )),
  lastPrintAt: v.optional(v.number()),     // timestamp of last markPrintSent
  printFailedAt: v.optional(v.number()),   // explicit failure timestamp
  lastPrintError: v.optional(v.string()),  // short error ("timeout", "window_closed", etc.)

  // Legacy field (kept for backward compatibility)
  printCount: v.optional(v.number()),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_status", ["storeId", "status"])
  .index("by_orderId", ["orderId"])
  .index("by_storeId_station", ["storeId", "station"])
  // KDS print queue
  .index("by_store_printStatus_printRequestedAt", ["storeId", "printStatus", "printRequestedAt"])
  // KDS kanban
  .index("by_store_status_createdAt", ["storeId", "status", "createdAt"])
  // Client tracking
  .index("by_trackingToken", ["trackingToken"])
  // Print alerts (failed recent)
  .index("by_store_printStatus_printFailedAt", ["storeId", "printStatus", "printFailedAt"])
  // Display screen (ready tickets)
  .index("by_store_status_readyAt", ["storeId", "status", "readyAt"])
  // Retention sweep: every store at once, oldest first. Store-scoped indexes
  // would make the nightly job walk the establishment list to find the rows it
  // is about to delete anyway.
  .index("by_status_createdAt", ["status", "createdAt"])

/**
 * Printer Settings table
 * ESC/POS thermal printer configuration
 */
export const printerSettingsTable = defineTable({
  storeId: v.id("stores"),
  name: v.string(),
  type: v.union(v.literal("network"), v.literal("usb"), v.literal("bluetooth")),
  connectionInfo: v.object({
    ipAddress: v.optional(v.string()),
    port: v.optional(v.number()),
    usbVendorId: v.optional(v.string()),
    usbProductId: v.optional(v.string()),
  }),
  station: v.optional(v.string()),
  autoPrint: v.boolean(),
  paperWidth: v.union(v.literal(58), v.literal(80)),
  isDefault: v.boolean(),
  isOnline: v.boolean(),
  lastSeenAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
