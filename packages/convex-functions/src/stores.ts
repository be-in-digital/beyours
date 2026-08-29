/**
 * Store management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 *
 * Every mutation here appends an entry to `systemAuditLog` through
 * `./storeAudit`. See that module for why the write lives with the change
 * rather than in the app wrappers.
 */

import { v } from "convex/values"
import { isPublishedStore } from "@be-in-digital/convex-schema"
import { grantCreatedStoreAccess } from "./auth"
import {
  deleteStoreDependents,
  detachStoreFromProfiles,
} from "./storeCascade"
import {
  STORE_AUDIT_ACTIONS,
  STORE_AUDIT_OPERATIONS,
  prepareStoreFieldUpdate,
  recordStoreAudit,
  snapshotStore,
} from "./storeAudit"

// === QUERIES ===

/**
 * The establishments a visitor may order from.
 *
 * Drafts are removed here, not in the storefront, because this query is the
 * only thing standing between `stores.create` — which opens every new
 * establishment in `draft` — and a "Commander ici" button. Every storefront
 * surface reads this list: the selector page, the header dropdown, the
 * automatic selection, the sitemap. Filtering in any one of them leaves the
 * other three wrong.
 *
 * The admin needs the drafts, and asks `listAll` for them.
 */
export const list = {
  args: {},
  handler: async (ctx: any) => {
    const stores = await ctx.db.query("stores").collect()
    return stores.filter(isPublishedStore)
  },
}

/**
 * Every establishment, drafts included — the administration view.
 *
 * This is the list an owner manages: a draft has to be visible to whoever is
 * about to publish it. The app wrappers gate it on `requireStaff`; nothing
 * customer-facing may call it.
 */
export const listAll = {
  args: {},
  handler: async (ctx: any) => {
    return await ctx.db.query("stores").collect()
  },
}

/**
 * The establishments named by `ids`, in creation order.
 *
 * The scoped counterpart of `listAll`. It reads the rows it was asked for
 * rather than collecting the table and filtering afterwards — a member of one
 * restaurant should not cause a scan of every restaurant to answer a question
 * about theirs.
 *
 * A missing id is dropped rather than refused: a profile can name a store that
 * has since been deleted, and one stale entry must not blank the whole admin.
 * Sorted by creation time so the order matches what `listAll` returns, which is
 * what the selector's "first store" fallback depends on.
 */
export const listByIds = {
  args: { ids: v.array(v.id("stores")) },
  handler: async (ctx: any, args: any) => {
    const stores = await Promise.all(
      args.ids.map((id: any) => ctx.db.get(id))
    )
    return stores
      .filter((store: any) => store !== null)
      .sort((a: any, b: any) => a._creationTime - b._creationTime)
  },
}

/**
 * Get store by ID
 */
export const getById = {
  args: { id: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.get(args.id)
  },
}

/**
 * Get store by slug
 */
export const getBySlug = {
  args: { slug: v.string() },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("stores")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
      .unique()
  },
}

// === MUTATIONS ===

/**
 * Load the store an edit targets, or refuse the edit.
 *
 * Every single-field update already did this to reject a missing store; the
 * audit trail needs the same document for its "before" side, so the lookup is
 * shared instead of doubled.
 */
async function requireStore(ctx: any, id: any) {
  const existing = await ctx.db.get(id)
  if (!existing) throw new Error("Store not found")
  return existing
}

/**
 * Create a new store
 */
export const create = {
  args: {
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
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    const storeId = await ctx.db.insert("stores", {
      ...args,
      useGlobalHours: true,
      hours: [
        { day: 0, open: "00:00", close: "00:00", isClosed: true },
        { day: 1, open: "09:00", close: "22:00", isClosed: false },
        { day: 2, open: "09:00", close: "22:00", isClosed: false },
        { day: 3, open: "09:00", close: "22:00", isClosed: false },
        { day: 4, open: "09:00", close: "22:00", isClosed: false },
        { day: 5, open: "09:00", close: "23:00", isClosed: false },
        { day: 6, open: "09:00", close: "23:00", isClosed: false },
      ],
      overrides: undefined,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    })

    // The creator administers what they just created (#117). `stores.create`
    // is the one mutation the store-scoped seam cannot guard — there is no
    // store yet to check membership against — so without this an owner opening
    // a second location is refused by every screen that shows it to them.
    await grantCreatedStoreAccess(ctx, storeId)

    // Snapshot the stored document rather than the arguments, so the entry
    // records what the establishment actually became, defaults included.
    const created = await ctx.db.get(storeId)
    await recordStoreAudit(ctx, {
      action: STORE_AUDIT_ACTIONS.created,
      operation: STORE_AUDIT_OPERATIONS.create,
      storeId,
      storeName: created?.name ?? args.name,
      snapshot: snapshotStore(created),
    })

    return storeId
  },
}

/**
 * Update store basic information
 */
export const update = {
  args: {
    id: v.id("stores"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    useGlobalHours: v.optional(v.boolean()),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("open"),
      v.literal("closed"),
      v.literal("temporarily_unavailable")
    )),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    const existing = await requireStore(ctx, id)
    const audit = prepareStoreFieldUpdate(existing, STORE_AUDIT_OPERATIONS.update, fields)
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
    await recordStoreAudit(ctx, audit)
  },
}

/**
 * Update store opening hours
 */
export const updateHours = {
  args: {
    id: v.id("stores"),
    hours: v.array(v.object({
      day: v.number(),
      open: v.string(),
      close: v.string(),
      isClosed: v.boolean(),
    })),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await requireStore(ctx, args.id)
    const audit = prepareStoreFieldUpdate(existing, STORE_AUDIT_OPERATIONS.updateHours, { hours: args.hours })
    await ctx.db.patch(args.id, { hours: args.hours, updatedAt: Date.now() })
    await recordStoreAudit(ctx, audit)
  },
}

/**
 * Update store overrides (store-specific settings that override global settings)
 */
export const updateOverrides = {
  args: {
    id: v.id("stores"),
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
  },
  handler: async (ctx: any, args: any) => {
    const existing = await requireStore(ctx, args.id)
    const audit = prepareStoreFieldUpdate(existing, STORE_AUDIT_OPERATIONS.updateOverrides, { overrides: args.overrides })
    await ctx.db.patch(args.id, { overrides: args.overrides, updatedAt: Date.now() })
    await recordStoreAudit(ctx, audit)
  },
}

/**
 * Update store address
 */
export const updateAddress = {
  args: {
    id: v.id("stores"),
    address: v.object({
      street: v.string(),
      city: v.string(),
      postalCode: v.string(),
      country: v.string(),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
    }),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await requireStore(ctx, args.id)
    const audit = prepareStoreFieldUpdate(existing, STORE_AUDIT_OPERATIONS.updateAddress, { address: args.address })
    await ctx.db.patch(args.id, { address: args.address, updatedAt: Date.now() })
    await recordStoreAudit(ctx, audit)
  },
}

/**
 * Update store print configuration
 */
export const updatePrintConfig = {
  args: {
    id: v.id("stores"),
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
  },
  handler: async (ctx: any, args: any) => {
    const existing = await requireStore(ctx, args.id)
    // `printConfig.apiKey` is a printer credential; `storeAudit` redacts it on
    // both sides of the diff before it reaches the log.
    const audit = prepareStoreFieldUpdate(existing, STORE_AUDIT_OPERATIONS.updatePrintConfig, { printConfig: args.printConfig })
    await ctx.db.patch(args.id, { printConfig: args.printConfig, updatedAt: Date.now() })
    await recordStoreAudit(ctx, audit)
  },
}

/**
 * Update store display configuration
 */
export const updateDisplayConfig = {
  args: {
    id: v.id("stores"),
    displayConfig: v.optional(v.object({
      autoDismissEnabled: v.boolean(),
      autoDismissMinutes: v.number(),
    })),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await requireStore(ctx, args.id)
    const audit = prepareStoreFieldUpdate(existing, STORE_AUDIT_OPERATIONS.updateDisplayConfig, { displayConfig: args.displayConfig })
    await ctx.db.patch(args.id, { displayConfig: args.displayConfig, updatedAt: Date.now() })
    await recordStoreAudit(ctx, audit)
  },
}

/**
 * Update store sound configuration
 */
export const updateSoundConfig = {
  args: {
    id: v.id("stores"),
    soundConfig: v.optional(v.object({
      newTicket: v.object({ enabled: v.boolean(), volume: v.number() }),
      overdue: v.object({ enabled: v.boolean(), volume: v.number() }),
      printerOffline: v.object({ enabled: v.boolean(), volume: v.number() }),
    })),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await requireStore(ctx, args.id)
    const audit = prepareStoreFieldUpdate(existing, STORE_AUDIT_OPERATIONS.updateSoundConfig, { soundConfig: args.soundConfig })
    await ctx.db.patch(args.id, { soundConfig: args.soundConfig, updatedAt: Date.now() })
    await recordStoreAudit(ctx, audit)
  },
}

/**
 * Update store order confirmation mode
 */
export const updateOrderConfirmation = {
  args: {
    id: v.id("stores"),
    orderConfirmation: v.union(v.literal("auto"), v.literal("manual")),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await requireStore(ctx, args.id)
    const audit = prepareStoreFieldUpdate(existing, STORE_AUDIT_OPERATIONS.updateOrderConfirmation, { orderConfirmation: args.orderConfirmation })
    await ctx.db.patch(args.id, { orderConfirmation: args.orderConfirmation, updatedAt: Date.now() })
    await recordStoreAudit(ctx, audit)
  },
}

/**
 * Update store global order mode (applies to all sources unless overridden per-platform)
 */
export const updateOrderMode = {
  args: {
    id: v.id("stores"),
    orderMode: v.union(
      v.literal("auto_accept"),
      v.literal("auto_reject"),
      v.literal("manual")
    ),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await requireStore(ctx, args.id)
    const audit = prepareStoreFieldUpdate(existing, STORE_AUDIT_OPERATIONS.updateOrderMode, { orderMode: args.orderMode })
    await ctx.db.patch(args.id, { orderMode: args.orderMode, updatedAt: Date.now() })
    await recordStoreAudit(ctx, audit)
  },
}

/**
 * Update store trending mode (manual or automatic)
 */
export const updateTrendingMode = {
  args: {
    id: v.id("stores"),
    trendingMode: v.union(v.literal("manual"), v.literal("automatic")),
  },
  handler: async (ctx: any, args: any) => {
    const existing = await requireStore(ctx, args.id)
    const audit = prepareStoreFieldUpdate(existing, STORE_AUDIT_OPERATIONS.updateTrendingMode, { trendingMode: args.trendingMode })
    await ctx.db.patch(args.id, { trendingMode: args.trendingMode, updatedAt: Date.now() })
    await recordStoreAudit(ctx, audit)
  },
}

/**
 * Delete a store, and everything that belonged to it.
 *
 * This used to delete the store row alone. Forty-two `storeId` columns across
 * twenty tables were left pointing at a document that no longer existed, and
 * the id stayed in `userProfiles.storeIds` — `v.id("stores")` validates how an
 * id is encoded, not that it resolves, so nothing ever complained. The bulk
 * delete did it to N establishments at once (#169).
 *
 * A mutation is one transaction with a bounded budget, and an established
 * restaurant has more orders than that. So the sweep is a loop: this call
 * clears one batch and reports whether there is more, and the app wrapper
 * schedules `purgeStoreData` until there is not. The store row goes first, in
 * this transaction, because that is what makes the establishment disappear from
 * every screen — the rest is carried away behind it.
 */
export const remove = {
  args: { id: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    // Read before deleting: once the document is gone the log could only say
    // that *an* establishment was removed, not which one.
    const existing = await requireStore(ctx, args.id)
    const audit = {
      action: STORE_AUDIT_ACTIONS.deleted,
      operation: STORE_AUDIT_OPERATIONS.remove,
      storeId: args.id,
      storeName: existing.name as string,
      snapshot: snapshotStore(existing),
    }

    const { hasMore } = await deleteStoreDependents(ctx, args.id)
    await detachStoreFromProfiles(ctx, args.id)
    await ctx.db.delete(args.id)
    await recordStoreAudit(ctx, audit)

    return { hasMore }
  },
}

/**
 * Carry away what one transaction could not.
 *
 * Called only by the scheduler, from the wrapper around `remove` and from
 * itself, until `hasMore` is false. The store row is already gone by then;
 * `args.storeId` is a dangling id on purpose, and the sweep is by index, so it
 * finds exactly the rows that were left.
 */
export const purgeStoreData = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const { deleted, hasMore } = await deleteStoreDependents(ctx, args.storeId)
    return { deleted, hasMore }
  },
}
