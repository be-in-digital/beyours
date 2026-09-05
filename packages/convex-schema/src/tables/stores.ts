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

  // Where « Réserver une table » sends the guest.
  //
  // The product has no reservation feature — no table, no availability model,
  // no mutation — and building one means modelling capacity, which is where
  // double-bookings come from. Restaurants that take bookings already run
  // TheFork, Zenchef or Guestonline, so the storefront links out to whichever
  // they use and those tools keep the hard part.
  //
  // Unset means no reservation call to action is rendered at all. Absence is
  // the honest default: most establishments here take bookings by phone.
  //
  // Always validated against `assertReservationUrl` before it is stored — this
  // string reaches an href, so a `javascript:` scheme would be stored XSS.
  reservationUrl: v.optional(v.string()),

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

  // Which order reaches the kitchen, and when.
  //
  // "auto" sends a paid order straight to the pass. "manual" holds it until a
  // member of staff accepts it, which is what an establishment that batches
  // its service, or refuses out-of-stock orders, actually needs. Read by
  // `orders.releaseToKitchen` — the one seam every payment path goes through.
  //
  // This was withdrawn in #242 because it promised a workflow the product did
  // not have. The workflow exists now, so the promise is honoured rather than
  // withdrawn.
  orderConfirmation: v.optional(v.union(v.literal("auto"), v.literal("manual"))),

  // Kitchen stations, and which part of the menu each one cooks.
  //
  // `stations` is the establishment's own list — "chaud", "froid", "pizza".
  // `stationMapping` sends a category to one of them. An order is split into
  // one ticket per station it touches, so the cold station is not handed a
  // slip for a pizza. Unmapped categories fall to `undefined`, which is the
  // single-ticket behaviour every establishment has today.
  kitchenStations: v.optional(v.array(v.string())),
  stationMapping: v.optional(v.array(v.object({
    categoryId: v.id("categories"),
    station: v.string(),
  }))),

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

  // Untyped blobs (kept for backward compatibility with existing data)
  //
  // `displayConfig` had a mutation and an audit entry, and nothing anywhere
  // read the stored value. The only screen that wrote it lived in
  // `apps/themes/components/admin/settings/`, a folder no route rendered.
  //
  // `orderConfirmation` was withdrawn beside it and has come back typed, above
  // — the workflow it promised is implemented now.
  //
  // They stay declared, and optional, because documents already hold them: a
  // stored field absent from the schema fails validation on the next write to
  // that document. Nothing writes `displayConfig`, `integrations` or
  // `settings`.
  displayConfig: v.optional(v.any()),

  // `branding` IS live, and this block used to say otherwise. The Design
  // screen writes it through `stores.updateBranding`, whose `BRANDING_FIELDS`
  // validator is the real shape: `primaryColor`, `secondaryColor`,
  // `accentColor`, `fontHeading`, `fontBody`, `logoUrl`, `faviconUrl`. The
  // colours and the two fonts are read back by `buildBrandingCss`
  // (`packages/ui/src/lib/branding.ts`) and painted onto the storefront's CSS
  // custom properties by `StoreTheme`, so an establishment's palette is what a
  // diner sees.
  //
  // It stays `v.any()` on purpose, and the reason is in the doc comment on
  // `updateBranding`: Convex validates the whole document on every write, so
  // narrowing this to `BRANDING_FIELDS` would make one client deployment
  // holding an undeclared key fail its next unrelated edit — an opening-hours
  // change refused because of a colour. `apps/themes` is cloned per client,
  // one Convex instance each, and nothing here can see what those documents
  // hold. Narrowing needs an inventory of the deployed key sets first; until
  // then the writer is the narrow thing.
  branding: v.optional(v.any()),
  integrations: v.optional(v.any()),
  settings: v.optional(v.any()),

  /**
   * Daily GPT auto-translation budget for this establishment.
   *
   * The translator bills per document per language; a fifty-product import on
   * three languages is a hundred and fifty calls. `used` is incremented by the
   * translator itself and zeroed once `resetAt` has passed, so a store that is
   * never edited never needs the cron to run for it.
   */
  translationQuota: v.optional(v.object({
    dailyLimit: v.number(),
    used: v.number(),
    resetAt: v.number(), // epoch ms of the next reset (midnight UTC)
  })),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_slug", ["slug"])
  .index("by_status", ["status"])
