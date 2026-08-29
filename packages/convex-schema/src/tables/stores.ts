import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Stores table
 * Each restaurant owner can have unlimited stores.
 * Settings inherit from globalSettings unless overridden.
 */
export const storesTable = defineTable({
  name: v.string(),
  slug: v.string(),
  description: v.optional(v.string()),
  address: v.object({
    street: v.string(),
    city: v.string(),
    postalCode: v.string(),
    country: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  }),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),

  // Hours: store-specific or inherited from globalSettings
  useGlobalHours: v.optional(v.boolean()),
  hours: v.array(v.object({
    day: v.number(), // 0=Sunday, 1=Monday, ..., 6=Saturday
    open: v.string(), // "09:00"
    close: v.string(), // "22:00"
    isClosed: v.boolean(),
  })),

  status: v.union(
    v.literal("draft"),
    v.literal("open"),
    v.literal("closed"),
    v.literal("temporarily_unavailable")
  ),

  // Optional overrides for globalSettings values
  // If a field is present here, it overrides the global default
  overrides: v.optional(v.object({
    services: v.optional(v.object({
      dineIn: v.boolean(),
      takeaway: v.boolean(),
      delivery: v.boolean(),
      clickAndCollect: v.boolean(),
    })),
    minimumOrderAmount: v.optional(v.number()),
    deliveryRadius: v.optional(v.number()),
    deliveryFee: v.optional(v.number()),
    deliveryFreeAbove: v.optional(v.number()),
  })),

  themeId: v.optional(v.string()),

  // Global order mode for all sources (website, Uber Eats, Deliveroo)
  // Per-platform override in storeIntegrations.orderMode takes priority
  orderMode: v.optional(v.union(
    v.literal("auto_accept"),
    v.literal("auto_reject"),
    v.literal("manual")
  )),

  // Print configuration for thermal printers
  printConfig: v.optional(v.object({
    provider: v.union(
      v.literal("browser"),
      v.literal("star_cloud"),
      v.literal("epson_cloud"),
      v.literal("sunmi_cloud")
    ),
    printerId: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    triggers: v.array(v.union(
      v.literal("confirmed"),
      v.literal("ready"),
      v.literal("reprint")
    )),
    paperSize: v.union(v.literal("80mm"), v.literal("58mm")),
    enabled: v.boolean(),
  })),

  // Sound alerts configuration for KDS.
  //
  // Read by `KitchenContent` -> `KitchenSoundManager` in both apps: it decides
  // which alerts sound and how loudly. No editor writes it yet, so every
  // deployment runs on the component's fallbacks.
  soundConfig: v.optional(v.object({
    newTicket: v.object({ enabled: v.boolean(), volume: v.number() }),
    overdue: v.object({ enabled: v.boolean(), volume: v.number() }),
    printerOffline: v.object({ enabled: v.boolean(), volume: v.number() }),
  })),

  // Homepage trending section mode
  trendingMode: v.optional(v.union(v.literal("manual"), v.literal("automatic"))),

  // Legacy fields (kept for backward compatibility with existing data)
  // Will be removed after data migration
  //
  // `orderConfirmation` and `displayConfig` joined them: both had a mutation
  // and an audit entry, and nothing anywhere read the stored value. The only
  // screens that wrote them lived in `apps/themes/components/admin/settings/`,
  // a folder no route rendered. `orderConfirmation: "manual"` in particular
  // promised that staff would validate an order before the kitchen saw it, and
  // no code made that true — a promise the product could not keep.
  //
  // They stay declared, and optional, because documents already hold them: a
  // stored field absent from the schema fails validation on the next write to
  // that document. Nothing writes them now.
  orderConfirmation: v.optional(v.any()),
  displayConfig: v.optional(v.any()),
  branding: v.optional(v.any()),
  integrations: v.optional(v.any()),
  settings: v.optional(v.any()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_slug", ["slug"])
  .index("by_status", ["status"])
