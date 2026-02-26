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
  estimatedPrepTime: v.optional(v.number()),
  estimatedReadyAt: v.optional(v.number()),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  cancelledAt: v.optional(v.number()),
  readyAt: v.optional(v.number()),
  printCount: v.optional(v.number()),
  printAttempts: v.optional(v.number()),
  printStatus: v.optional(v.string()),
  customerName: v.optional(v.string()),
  customerPhone: v.optional(v.string()),
  customerEmail: v.optional(v.string()),
  trackingToken: v.optional(v.string()),
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
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_status", ["storeId", "status"])
  .index("by_orderId", ["orderId"])
  .index("by_storeId_station", ["storeId", "station"])

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
