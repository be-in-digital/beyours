/**
 * Product management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { ConvexError, v } from "convex/values"
import { recordStockMovement } from "./stockLedger"
import { requireStorePermission } from "./auth"
import { clampPageSize } from "./pagination"
import { WITHDRAWN_PROMOTION_PRODUCT_FIELDS } from "./promotionDiscount"

// === QUERIES ===

/**
 * List all products for a store
 */
export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("products")
      .withIndex("by_storeId_isActive", (q: any) =>
        q.eq("storeId", args.storeId).eq("isActive", true)
      )
      .collect()
  },
}

/**
 * The whole catalogue, drafts included — for the people who own it.
 *
 * `list` is the storefront's query and returns only what is on sale. The
 * owner's own product screen needs the other rows too: `isActive: false` is
 * how a draft, a discontinued dish and a seasonal one out of season all look,
 * and a back office that cannot see them cannot publish them.
 *
 * The split is two endpoints rather than one endpoint reading the caller,
 * deliberately. A query whose contents depend on who is asking is one an
 * anonymous caller can probe, and it would also have shown a signed-in owner
 * their own drafts on the PUBLIC carte — where the checkout then refuses
 * them, which is the bug this pair exists to end rather than move.
 *
 * Wrapped with `storeQuery` + `products:read` in each app's `convex/`.
 */
export const listAll = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("products")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
  },
}

/**
 * Get product by ID — the storefront's read, so a dish not on sale is absent.
 *
 * An id is not a secret: it is in every order line, in the favourites list and
 * in the DOM of the page that linked here. Returning the document to anyone
 * holding one put unpublished dishes on `/product/<id>` and into the JSON-LD
 * of that page. `null` is the same answer the route already handles for a
 * deleted product, so the 404 path is the one that was already tested.
 */
export const getById = {
  args: { id: v.id("products") },
  handler: async (ctx: any, args: any) => {
    const product = await ctx.db.get(args.id)
    return product && product.isActive ? product : null
  },
}

/**
 * Get product by ID, whatever its state — for the owner's edit screen.
 *
 * The counterpart to `listAll`: a draft has to be openable by the person
 * writing it. Guarded by `products:read` in the app wrappers.
 */
export const getAnyById = {
  args: { id: v.id("products") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.get(args.id)
  },
}

/**
 * Get products by category
 */
export const getByCategory = {
  args: {
    storeId: v.id("stores"),
    categoryId: v.id("categories")
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("products")
      .withIndex("by_storeId_categoryId", (q: any) =>
        q.eq("storeId", args.storeId).eq("categoryId", args.categoryId)
      )
      .collect()
  },
}

/**
 * Get product by slug
 */
export const getBySlug = {
  args: {
    storeId: v.id("stores"),
    slug: v.string()
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("products")
      .withIndex("by_storeId_slug", (q: any) =>
        q.eq("storeId", args.storeId).eq("slug", args.slug)
      )
      .unique()
  },
}

/**
 * The most ids `getManyByIds` will look up in one call.
 *
 * The query is public and the array comes off the wire, so "the screen only
 * ever sends a handful" is a statement about the screen, not about the query —
 * the same distinction `pagination.ts` was written for. One `ctx.db.get` per id
 * with no ceiling is a caller-chosen read count on an anonymous endpoint, and
 * past Convex's 16,384-document limit the transaction fails rather than
 * truncates. Well above any plate of favourites, well below that limit.
 */
export const MAX_PRODUCT_ID_LOOKUP = 200

/**
 * Get multiple products by IDs (batch query to avoid N+1).
 *
 * Unpublished products are dropped. This query is public — it is the one the
 * favourites grid calls, before any sign-in — and it took ids and returned
 * whole documents with no filter at all, so anything holding an id read the
 * document behind it whatever its state. `isActive: false` is the owner saying
 * a dish is not on sale: it is how a draft, a discontinued item and a seasonal
 * one out of season all look, and every other public read of this table
 * (`getFeatured`, `getManualTrending`, `getTrending`) already honours it. Ids
 * are not secret — they appear in order lines, in favourites and in the DOM —
 * so the filter has to be here rather than in the caller.
 *
 * Deliberately NOT scoped to one store. A deployment is one client's, and the
 * favourites grid reads across the chain on purpose: it splits the answer into
 * "this establishment" and "your other ones". Adding a `storeId` argument would
 * take that feature away without closing anything, since a sibling store in the
 * same deployment belongs to the same owner.
 */
export const getManyByIds = {
  args: { ids: v.array(v.id("products")) },
  handler: async (ctx: any, args: { ids: string[] }) => {
    const ids = args.ids.slice(0, MAX_PRODUCT_ID_LOOKUP)
    const products = await Promise.all(ids.map((id: string) => ctx.db.get(id)))
    return products.filter((p: any) => p !== null && p.isActive === true)
  },
}

/**
 * Get featured products
 */
export const getFeatured = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("products")
      .withIndex("by_storeId_isFeatured", (q: any) =>
        q.eq("storeId", args.storeId).eq("isFeatured", true)
      )
      .filter((q: any) => q.eq(q.field("isActive"), true))
      .collect()
  },
}

/**
 * Get manually selected trending products (homepageTrendingRank defined)
 */
export const getManualTrending = {
  args: {
    storeId: v.id("stores"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const max = args.limit ?? 8
    const products = await ctx.db
      .query("products")
      .withIndex("by_storeId_trendingRank", (q: any) =>
        q.eq("storeId", args.storeId)
      )
      .collect()

    return products
      .filter((p: any) => p.homepageTrendingRank != null && p.isActive)
      .sort((a: any, b: any) => a.homepageTrendingRank - b.homepageTrendingRank)
      .slice(0, max)
  },
}

/**
 * The most orders `getTrending` will read to rank a homepage carousel.
 *
 * This is the public storefront's own query — one live subscription per open
 * tab, re-run whenever any order in the store changes — and it used to
 * `.collect()` every order of the last thirty days to return three products.
 * On a store taking 200 orders a day that is 6,000 documents scanned per
 * diner per new order, and past Convex's 16,384-document limit the homepage
 * simply stopped rendering: the busier the restaurant, the surer the failure.
 *
 * Newest-first, so what the cap drops is the far end of the month rather than
 * this week. "What is selling" is a question about recent trade, and the
 * thousand most recent orders answer it as well as thirty days of them do.
 */
export const TRENDING_ORDER_SCAN_LIMIT = 1_000

/**
 * The most products it will fetch while filling the carousel.
 *
 * The ranking is over product ids, and a product that has since been
 * de-listed is skipped — so a catalogue that has been reworked can make the
 * walk fetch far more rows than the carousel shows. The carousel is at most
 * `MAX_TRENDING_PRODUCTS`; this is the budget for finding that many.
 */
export const TRENDING_PRODUCT_LOOKUP_LIMIT = 100

/** The largest carousel any caller may ask for. */
export const MAX_TRENDING_PRODUCTS = 24

/**
 * Get trending products based on recent order volume (automatic mode).
 * Only counts validated orders (confirmed, preparing, ready, out_for_delivery, delivered, completed).
 * Excludes pending and cancelled orders.
 */
export const getTrending = {
  args: {
    storeId: v.id("stores"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: any, args: { storeId: string; limit?: number }) => {
    // Clamped rather than trusted: this is a public query, and `v.number()`
    // accepts NaN and 1,000,000 alike. An unclamped `limit` turns the lookup
    // walk below back into the unbounded read the scan limit just removed.
    const max = clampPageSize(args.limit, 8, MAX_TRENDING_PRODUCTS)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

    const validStatuses = new Set([
      "confirmed",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "completed",
    ])

    // The most recent orders of the last thirty days, newest first.
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_storeId_createdAt", (q: any) =>
        q.eq("storeId", args.storeId).gte("createdAt", thirtyDaysAgo)
      )
      .order("desc")
      .take(TRENDING_ORDER_SCAN_LIMIT)

    // Aggregate product quantities from validated orders only
    const salesMap = new Map<string, number>()
    for (const order of orders) {
      if (!validStatuses.has(order.status)) continue
      for (const item of order.items ?? []) {
        if (!item.productId) continue
        salesMap.set(
          item.productId,
          (salesMap.get(item.productId) ?? 0) + item.quantity
        )
      }
    }

    // Sort by sales volume descending
    const sorted = [...salesMap.entries()].sort((a, b) => b[1] - a[1])

    // Load products and filter out inactive ones
    const trending = []
    let lookups = 0
    for (const [productId] of sorted) {
      if (trending.length >= max) break
      if (lookups >= TRENDING_PRODUCT_LOOKUP_LIMIT) break
      lookups++
      const product = await ctx.db.get(productId)
      if (product && product.isActive) {
        trending.push(product)
      }
    }

    return trending
  },
}

/**
 * Set trending products in batch.
 * Receives an ordered array of product IDs.
 * Clears previous trending ranks for the store, then sets new ones.
 */
export const setTrendingProducts = {
  args: {
    storeId: v.id("stores"),
    productIds: v.array(v.id("products")),
  },
  handler: async (ctx: any, args: any) => {
    // Clear all existing trending ranks for this store
    const existing = await ctx.db
      .query("products")
      .withIndex("by_storeId_trendingRank", (q: any) =>
        q.eq("storeId", args.storeId)
      )
      .collect()

    for (const product of existing) {
      if (product.homepageTrendingRank != null) {
        await ctx.db.patch(product._id, {
          homepageTrendingRank: undefined,
          updatedAt: Date.now(),
        })
      }
    }

    // Set new trending ranks (1-based)
    for (let i = 0; i < args.productIds.length; i++) {
      const product = await ctx.db.get(args.productIds[i])
      if (product && product.storeId === args.storeId) {
        await ctx.db.patch(args.productIds[i], {
          homepageTrendingRank: i + 1,
          updatedAt: Date.now(),
        })
      }
    }
  },
}

// === MUTATIONS ===

/**
 * Refuse a category that belongs to another establishment.
 *
 * A category id is public — `categories.list` is the storefront menu — and
 * nothing checked that the one being assigned belonged to the same restaurant.
 * A product filed under someone else's category is invisible in its own admin
 * (the name resolves to "Inconnu"), unreachable from its own menu, and it
 * leaks the fact that the other establishment has that category at all.
 */
async function assertCategoryInStore(
  ctx: any,
  categoryId: string,
  storeId: string
): Promise<void> {
  const category = await ctx.db.get(categoryId)
  if (!category) throw new Error("Category not found")
  if (category.storeId !== storeId) {
    throw new Error("Category belongs to another store")
  }
}

/**
 * Create a new product
 */
export const create = {
  args: {
    storeId: v.id("stores"),
    categoryId: v.id("categories"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    compareAtPrice: v.optional(v.number()),
    taxRate: v.number(),
    preparationTime: v.optional(v.number()),
    sku: v.optional(v.string()),
    images: v.array(v.string()),
    options: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      required: v.boolean(),
      maxSelections: v.optional(v.number()),
      externalIds: v.optional(v.object({
        uberEatsId: v.optional(v.string()),
        deliverooId: v.optional(v.string()),
      })),
      choices: v.array(v.object({
        id: v.string(),
        name: v.string(),
        priceModifier: v.number(),
        externalIds: v.optional(v.object({
          uberEatsId: v.optional(v.string()),
          deliverooId: v.optional(v.string()),
        })),
      })),
    }))),
    allergens: v.optional(v.array(v.string())),
    nutritionalInfo: v.optional(v.object({
      calories: v.optional(v.number()),
      protein: v.optional(v.number()),
      carbs: v.optional(v.number()),
      fat: v.optional(v.number()),
      fiber: v.optional(v.number()),
    })),
    tags: v.optional(v.array(v.string())),
    stock: v.optional(v.object({
      tracked: v.boolean(),
      quantity: v.number(),
      lowStockThreshold: v.number(),
      autoDisableWhenEmpty: v.optional(v.boolean()),
    })),
    scheduling: v.optional(v.object({
      availableFrom: v.optional(v.string()),
      availableUntil: v.optional(v.string()),
      availableDays: v.optional(v.array(v.number())),
    })),
    spiceLevel: v.optional(v.number()),
    isActive: v.boolean(),
    isFeatured: v.boolean(),
    sortOrder: v.number(),
    source: v.optional(v.string()),
    externalIds: v.optional(v.object({
      uberEatsId: v.optional(v.string()),
      deliverooId: v.optional(v.string()),
    })),
  },
  handler: async (ctx: any, args: any) => {
    if (args.price < 0) throw new Error("Price cannot be negative")
    await assertCategoryInStore(ctx, args.categoryId, args.storeId)
    const now = Date.now()
    return await ctx.db.insert("products", {
      ...args,
      source: args.source ?? "manual",
      options: args.options ?? [],
      allergens: args.allergens ?? [],
      tags: args.tags ?? [],
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Update product
 */
export const update = {
  args: {
    id: v.id("products"),
    categoryId: v.optional(v.id("categories")),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    compareAtPrice: v.optional(v.number()),
    taxRate: v.optional(v.number()),
    preparationTime: v.optional(v.number()),
    sku: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    options: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      required: v.boolean(),
      maxSelections: v.optional(v.number()),
      externalIds: v.optional(v.object({
        uberEatsId: v.optional(v.string()),
        deliverooId: v.optional(v.string()),
      })),
      choices: v.array(v.object({
        id: v.string(),
        name: v.string(),
        priceModifier: v.number(),
        externalIds: v.optional(v.object({
          uberEatsId: v.optional(v.string()),
          deliverooId: v.optional(v.string()),
        })),
      })),
    }))),
    allergens: v.optional(v.array(v.string())),
    nutritionalInfo: v.optional(v.object({
      calories: v.optional(v.number()),
      protein: v.optional(v.number()),
      carbs: v.optional(v.number()),
      fat: v.optional(v.number()),
      fiber: v.optional(v.number()),
    })),
    tags: v.optional(v.array(v.string())),
    stock: v.optional(v.object({
      tracked: v.boolean(),
      quantity: v.number(),
      lowStockThreshold: v.number(),
      autoDisableWhenEmpty: v.optional(v.boolean()),
    })),
    scheduling: v.optional(v.object({
      availableFrom: v.optional(v.string()),
      availableUntil: v.optional(v.string()),
      availableDays: v.optional(v.array(v.number())),
    })),
    spiceLevel: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    isFeatured: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    if (args.price !== undefined && args.price < 0) throw new Error("Price cannot be negative")
    const { id, ...fields } = args
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error("Product not found")
    if (fields.categoryId !== undefined) {
      await assertCategoryInStore(ctx, fields.categoryId, existing.storeId)
    }
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

/** A product's stock counter, as the catalogue stores it. */
export interface ProductStockCount {
  tracked: boolean
  quantity: number
  lowStockThreshold: number
  autoDisableWhenEmpty?: boolean
}

/**
 * The patch that leaves a tracked product holding `quantity`.
 *
 * WHY THIS IS A FUNCTION: the auto-disable rule used to live inline in
 * `updateStock`'s handler, which is why it only ever ran when an owner retyped
 * the number in the Inventaire screen. It is a rule about stock, not about that
 * screen. `orders.create` now sells stock too — the decrement that never
 * existed — and a dish that runs out has to come off the menu whichever of the
 * two took the last portion.
 *
 * Pure, so both callers get the same answer and it is testable without a
 * database. It does not clamp: `updateStock` never did, and the order path
 * hands it a quantity it has already floored at zero.
 */
export function stockPatch(
  product: { stock: ProductStockCount; isActive: boolean },
  quantity: number
): { stock: ProductStockCount; isActive?: boolean } {
  const patch: { stock: ProductStockCount; isActive?: boolean } = {
    stock: { ...product.stock, quantity },
  }

  if (product.stock.autoDisableWhenEmpty) {
    if (quantity <= 0 && product.isActive) {
      patch.isActive = false
    } else if (quantity > 0 && !product.isActive) {
      patch.isActive = true
    }
  }

  return patch
}

/**
 * Update product stock quantity.
 * When autoDisableWhenEmpty is enabled:
 *   - quantity reaches 0 → set isActive = false
 *   - quantity goes above 0 → set isActive = true
 */
export const updateStock = {
  args: {
    id: v.id("products"),
    quantity: v.number(),
  },
  handler: async (ctx: any, args: any) => {
    const product = await ctx.db.get(args.id)
    if (!product) throw new Error("Product not found")
    if (!product.stock) throw new Error("Product does not track stock")

    const now = Date.now()
    await ctx.db.patch(args.id, {
      ...stockPatch(product, args.quantity),
      updatedAt: now,
    })

    // The ledger (#99). An owner retyping the number is the movement that most
    // needs recording: it is the one with no order behind it, and the one a
    // reconciliation later has to account for.
    const identity = await ctx.auth.getUserIdentity()
    await recordStockMovement(ctx, {
      storeId: product.storeId,
      productId: args.id,
      productName: product.name,
      reason: "adjustment",
      before: product.stock.quantity,
      after: args.quantity,
      ...(identity?.subject ? { actorId: String(identity.subject) } : {}),
      now,
    })
  },
}

/**
 * Toggle stock tracking on/off for a product
 */
export const toggleStockTracking = {
  args: {
    id: v.id("products"),
    tracked: v.boolean(),
  },
  handler: async (ctx: any, args: any) => {
    const product = await ctx.db.get(args.id)
    if (!product) throw new Error("Product not found")

    const currentStock = product.stock ?? {
      tracked: false,
      quantity: 0,
      lowStockThreshold: 5,
    }

    const now = Date.now()
    await ctx.db.patch(args.id, {
      stock: {
        ...currentStock,
        tracked: args.tracked,
      },
      updatedAt: now,
    })

    // Recorded even though the quantity does not move: the switch IS the
    // movement here. The number stops meaning anything until tracking is turned
    // back on, and an owner reading the ledger a week later needs to see where
    // it went quiet. Nothing is written when the switch was already in that
    // position.
    if (currentStock.tracked !== args.tracked) {
      const identity = await ctx.auth.getUserIdentity()
      await recordStockMovement(ctx, {
        storeId: product.storeId,
        productId: args.id,
        productName: product.name,
        reason: args.tracked ? "tracking_on" : "tracking_off",
        before: currentStock.quantity,
        after: currentStock.quantity,
        ...(identity?.subject ? { actorId: String(identity.subject) } : {}),
        now,
      })
    }
  },
}

/**
 * Toggle autoDisableWhenEmpty for a product
 */
export const updateAutoDisable = {
  args: {
    id: v.id("products"),
    autoDisableWhenEmpty: v.boolean(),
  },
  handler: async (ctx: any, args: any) => {
    const product = await ctx.db.get(args.id)
    if (!product) throw new Error("Product not found")
    if (!product.stock) throw new Error("Product does not track stock")

    await ctx.db.patch(args.id, {
      stock: {
        ...product.stock,
        autoDisableWhenEmpty: args.autoDisableWhenEmpty,
      },
      updatedAt: Date.now(),
    })
  },
}

/**
 * Update low stock threshold for a product
 */
export const updateLowStockThreshold = {
  args: {
    id: v.id("products"),
    lowStockThreshold: v.number(),
  },
  handler: async (ctx: any, args: any) => {
    const product = await ctx.db.get(args.id)
    if (!product) throw new Error("Product not found")
    if (!product.stock) throw new Error("Product does not track stock")

    await ctx.db.patch(args.id, {
      stock: {
        ...product.stock,
        lowStockThreshold: args.lowStockThreshold,
      },
      updatedAt: Date.now(),
    })
  },
}

/**
 * Toggle product active status
 */
export const toggleStatus = {
  args: { id: v.id("products") },
  handler: async (ctx: any, args: any) => {
    const product = await ctx.db.get(args.id)
    if (!product) throw new Error("Product not found")

    await ctx.db.patch(args.id, {
      isActive: !product.isActive,
      updatedAt: Date.now(),
    })
  },
}

/**
 * Reorder the products of one store.
 *
 * `sortOrder` is what the storefront's default sort — "Recommandé" — reads
 * after featured products (`sortProducts` in `@be-in-digital/restaurant`). The
 * column existed, the form schema declared it, and nothing rendered an input
 * or a reorder control: every product kept the 0 the creation form sent, so
 * the owner's menu was ordered by nothing at all.
 *
 * Takes the store explicitly and refuses any id outside it, rather than
 * inferring the store from the first product — the ids arrive from a client.
 */
export const reorder = {
  args: {
    storeId: v.id("stores"),
    ids: v.array(v.id("products")),
  },
  handler: async (ctx: any, args: any) => {
    for (const id of args.ids) {
      const product = await ctx.db.get(id)
      if (!product) throw new Error(`Product not found: ${id}`)
      if (product.storeId !== args.storeId) {
        throw new Error("All products must belong to the same store")
      }
    }

    const now = Date.now()
    for (let i = 0; i < args.ids.length; i++) {
      await ctx.db.patch(args.ids[i], { sortOrder: i, updatedAt: now })
    }
  },
}

/**
 * Delete a product.
 *
 * This was a bare `ctx.db.delete(args.id)`. Thirteen columns across nine tables
 * point at `products`, and two of them — `externalProductMappings
 * .internalProductId` and `favorites.productId` — are REQUIRED, so the rows
 * survived holding an id that resolves to nothing and could not be repaired
 * field by field. A routine catalogue tidy-up did all of the following in
 * silence:
 *
 *  - **Deliveroo kept selling the dish.** `getByExternal` returned the surviving
 *    mapping without dereferencing it, so the webhook's PLU check counted zero
 *    unmatched items and answered `sendSyncStatus(..., "succeeded")` for an
 *    order the kitchen cannot cook.
 *  - **The formule became permanently uneditable.** `menus.update` re-validates
 *    every stored section as a unit (`assertSectionsInStore`), so one dead id
 *    refused every subsequent write — including the one removing that section.
 *
 * `categories.remove` set the precedent and the reasoning: refuse rather than
 * cascade when the referrer is something the owner sat down and wrote, because
 * a cascade destroys an afternoon's work on a click meant to tidy up. The
 * decision is per table, and it splits on authorship:
 *
 *  - REFUSED while they point here — `menus`, `promotions`, `prizes`. Each is a
 *    selling decision the owner made, and each has a screen to unmake it on.
 *  - CASCADED — `externalProductMappings` and `favorites` (machine-kept rows
 *    that mean nothing without the dish), `orphanProducts` (the platform match
 *    is void, so the import goes back to `pending` for review) and the
 *    `linkedProductId` provenance link on twins in other stores.
 *  - LEFT ALONE — `orders.items[].productId`. What was sold is history, the
 *    column is already optional, and rewriting it would falsify the receipt.
 *
 * The refusals are `ConvexError`, not plain `Error`: Convex redacts a plain
 * error's message in production, so a carefully counted refusal would reach the
 * owner as "Server Error" and read as a bug in the product. `data` survives —
 * the same reasoning `auth.ts`'s `denied()` records.
 *
 * `favorites` gained a `by_productId` index for this, so the customers who
 * favourited one dish are reached directly rather than by collecting the whole
 * establishment's. `menus`, `promotions` and `prizes` have no product index and
 * are read through their store — bounded by one establishment's catalogue,
 * which is the same cost profile as the rest of this module.
 */
export const remove = {
  args: { id: v.id("products") },
  handler: async (ctx: any, args: any) => {
    const product = await ctx.db.get(args.id)
    if (!product) throw new Error("Product not found")

    const storeId = product.storeId

    // --- Refusals: owner-authored content that names this product ---

    const menus = await ctx.db
      .query("menus")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", storeId))
      .collect()

    const blockingMenus = menus.filter((menu: any) =>
      (menu.sections ?? []).some(
        (section: any) =>
          section.productId === args.id ||
          (section.productIds ?? []).includes(args.id) ||
          (section.priceAdjustments ?? []).some(
            (adjustment: any) => adjustment.productId === args.id
          )
      )
    )

    if (blockingMenus.length > 0) {
      const names = blockingMenus.map((menu: any) => `"${menu.name}"`).join(", ")
      throw new ConvexError({
        code: "product_in_menu",
        message: `Ce produit est utilisé dans ${blockingMenus.length} formule${blockingMenus.length > 1 ? "s" : ""} : ${names}. Retirez-le de ${blockingMenus.length > 1 ? "ces formules" : "cette formule"} avant de le supprimer.`,
      })
    }

    const promotions = await ctx.db
      .query("promotions")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", storeId))
      .collect()

    /**
     * Two references, and only one of them is on a screen.
     *
     * `targetProductIds` is the promotion's product scope: the form renders it,
     * the owner picked the dish there, and they can go and unpick it. The other
     * three — `freeProductId`, `bogoTriggerProductId`, `bogoRewardProductId` —
     * belong to « Produit offert » and « Offre BOGO », the two discount types
     * withdrawn in #403. They are on no form, `promotions.update` has no way to
     * clear an optional field, and a row still carrying a withdrawn TYPE cannot
     * be saved at all. So « Modifiez la promotion » was an instruction that
     * could not be followed, about a promotion that names the dish nowhere the
     * owner can see.
     *
     * The protection stays — a legacy row pointing at a deleted dish is a
     * dangling reference, which is the whole reason this guard exists — but the
     * sentence now names the one action that is actually available: delete the
     * promotion. It is a lame duck either way, since no order can be given a
     * discount of a withdrawn type. `promotions.remove` refuses a promotion that
     * has already been redeemed, and that combination — a redeemed promotion
     * carrying a withdrawn reference — is the one case an owner cannot resolve
     * alone; it is also the only one where the dish is genuinely still on a
     * paid order. Deactivating does not clear it, so the message does not
     * suggest it.
     */
    const withdrawnRef = (promotion: any) =>
      WITHDRAWN_PROMOTION_PRODUCT_FIELDS.some((field) => promotion[field] === args.id)

    const scopedRef = (promotion: any) =>
      (promotion.targetProductIds ?? []).includes(args.id)

    const blockingPromotions = promotions.filter(
      (promotion: any) => withdrawnRef(promotion) || scopedRef(promotion)
    )

    if (blockingPromotions.length > 0) {
      const names = (rows: any[]) => rows.map((p: any) => `"${p.name}"`).join(", ")
      const scoped = blockingPromotions.filter(scopedRef)
      // A promotion counted once: scope first, because that is the one the
      // owner can fix on the promotion screen.
      const withdrawn = blockingPromotions.filter(
        (promotion: any) => !scopedRef(promotion) && withdrawnRef(promotion)
      )

      const sentences: string[] = []
      if (scoped.length > 0) {
        sentences.push(
          `Ce produit est utilisé dans ${scoped.length} promotion${scoped.length > 1 ? "s" : ""} : ${names(scoped)}. ` +
            `Modifiez ou supprimez ${scoped.length > 1 ? "ces promotions" : "cette promotion"} avant de supprimer le produit.`
        )
      }
      if (withdrawn.length > 0) {
        sentences.push(
          `${withdrawn.length} promotion${withdrawn.length > 1 ? "s" : ""} le référence${withdrawn.length > 1 ? "nt" : ""} au titre d'une offre « Produit offert » ou « BOGO » : ${names(withdrawn)}. ` +
            `Ces offres ne sont plus proposées et aucune remise n'est appliquée. ` +
            `Cette référence n'apparaît pas dans le formulaire de promotion et ne peut pas y être retirée : supprimez ${withdrawn.length > 1 ? "ces promotions" : "cette promotion"} pour libérer le produit.`
        )
      }

      throw new ConvexError({
        code: "product_in_promotion",
        message: sentences.join(" "),
      })
    }

    const prizes = await ctx.db
      .query("prizes")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", storeId))
      .collect()

    const blockingPrizes = prizes.filter((prize: any) => prize.productId === args.id)

    if (blockingPrizes.length > 0) {
      const names = blockingPrizes.map((prize: any) => `"${prize.name}"`).join(", ")
      throw new ConvexError({
        code: "product_in_prize",
        message: `Ce produit est offert par ${blockingPrizes.length} lot${blockingPrizes.length > 1 ? "s" : ""} du jeu : ${names}. Modifiez ou supprimez ${blockingPrizes.length > 1 ? "ces lots" : "ce lot"} avant de supprimer le produit.`,
      })
    }

    // --- Cascade: machine-kept rows that mean nothing without the dish ---

    // The platform mapping first. It is the row that told Deliveroo the order
    // was fine, and it is required-typed, so nulling it is not an option.
    const mappings = await ctx.db
      .query("externalProductMappings")
      .withIndex("by_internal", (q: any) => q.eq("internalProductId", args.id))
      .collect()
    for (const mapping of mappings) {
      await ctx.db.delete(mapping._id)
    }

    // Every `favorites` index started at `userId`, so reaching the customers who
    // favourited one dish meant collecting the whole establishment's favourites
    // inside a mutation that deletes one row. `by_productId` was added for this.
    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_productId", (q: any) => q.eq("productId", args.id))
      .collect()
    for (const favorite of favorites) {
      await ctx.db.delete(favorite._id)
    }

    // An imported platform item matched to this dish is unmatched again, and
    // goes back into the review queue rather than keeping a dead match.
    const orphans = await ctx.db
      .query("orphanProducts")
      .withIndex("by_status", (q: any) => q.eq("storeId", storeId).eq("status", "matched"))
      .collect()
    for (const orphan of orphans) {
      if (orphan.matchedProductId === args.id) {
        await ctx.db.patch(orphan._id, {
          matchedProductId: undefined,
          status: "pending",
          updatedAt: Date.now(),
        })
      }
    }

    // Twins in other establishments keep their own copy of the dish; only the
    // provenance link back to this one goes.
    const twins = await ctx.db
      .query("products")
      .withIndex("by_linkedProductId", (q: any) => q.eq("linkedProductId", args.id))
      .collect()
    for (const twin of twins) {
      await ctx.db.patch(twin._id, { linkedProductId: undefined, updatedAt: Date.now() })
    }

    await ctx.db.delete(args.id)
  },
}

/**
 * Duplicate all categories and products from one store to another.
 *
 * Categories are recreated in the target store and a mapping from old IDs to
 * new IDs is maintained so that products can be inserted with the correct
 * target category reference.
 *
 * Each duplicated product receives a `linkedProductId` pointing to the
 * original source product, enabling future propagation across stores.
 *
 * External platform IDs (uberEatsId, deliverooId) and platformOverrides are
 * intentionally excluded — the target store manages its own platform config.
 */
export const duplicateCatalog = {
  args: {
    sourceStoreId: v.id("stores"),
    targetStoreId: v.id("stores"),
  },
  handler: async (ctx: any, args: any) => {
    if (args.sourceStoreId === args.targetStoreId) {
      throw new Error("Source and target stores must be different");
    }

    // 1. Get all categories from source store
    const sourceCategories = await ctx.db
      .query("categories")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.sourceStoreId))
      .collect();

    // 2. Create categories in target store, building an old→new ID mapping
    const categoryIdMap = new Map<string, string>();
    for (const cat of sourceCategories) {
      // `image` is not a column and `createdAt`/`updatedAt` are required: this
      // insert threw on every store that had a single category, and the test
      // that covered it only ever copied an empty catalogue.
      const catNow = Date.now();
      const newCatId = await ctx.db.insert("categories", {
        storeId: args.targetStoreId,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        imageUrl: cat.imageUrl,
        sortOrder: cat.sortOrder,
        isActive: cat.isActive,
        createdAt: catNow,
        updatedAt: catNow,
      });
      categoryIdMap.set(cat._id, newCatId);
    }

    // 3. Get all products from source store
    const sourceProducts = await ctx.db
      .query("products")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.sourceStoreId))
      .collect();

    // 4. Duplicate each product into the target store with a linked reference
    let productsCreated = 0;
    for (const product of sourceProducts) {
      const newCategoryId = categoryIdMap.get(product.categoryId);
      // Skip products whose category was not mapped (should not happen in normal flow)
      if (!newCategoryId) continue;

      const now = Date.now();
      await ctx.db.insert("products", {
        storeId: args.targetStoreId,
        categoryId: newCategoryId,
        linkedProductId: product._id, // link back to the source product
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        taxRate: product.taxRate,
        preparationTime: product.preparationTime,
        sku: product.sku,
        images: product.images,
        options: product.options,
        allergens: product.allergens,
        nutritionalInfo: product.nutritionalInfo,
        tags: product.tags,
        spiceLevel: product.spiceLevel,
        // Copy stock config but reset quantity — each store manages its own inventory
        stock: product.stock
          ? { ...product.stock, quantity: 0 }
          : undefined,
        scheduling: product.scheduling,
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        sortOrder: product.sortOrder,
        source: "manual", // duplicated products are treated as manual entries
        // externalIds intentionally omitted — target store has its own platform IDs
        // platformOverrides intentionally omitted — target store has its own config
        createdAt: now,
        updatedAt: now,
      });
      productsCreated++;
    }

    return {
      categoriesCreated: sourceCategories.length,
      productsCreated,
    };
  },
}

/**
 * Update a product and optionally propagate the changes to linked products
 * in other stores (same restaurant owner).
 *
 * Propagation scopes:
 *   - "self"     : only update the current product (no propagation)
 *   - "selected" : propagate to products in the specified target stores
 *   - "all"      : propagate to all linked products across every store
 *
 * Store-specific fields (platformOverrides) are intentionally excluded
 * from propagation because each store may have different platform configs.
 */
export const updateWithPropagation = {
  args: {
    productId: v.id("products"),
    updates: v.object({
      name: v.optional(v.string()),
      description: v.optional(v.string()),
      price: v.optional(v.number()),
      compareAtPrice: v.optional(v.number()),
      taxRate: v.optional(v.number()),
      images: v.optional(v.array(v.string())),
      isActive: v.optional(v.boolean()),
      isFeatured: v.optional(v.boolean()),
      preparationTime: v.optional(v.number()),
      allergens: v.optional(v.array(v.string())),
      tags: v.optional(v.array(v.string())),
      platformOverrides: v.optional(v.object({
        uberEats: v.optional(v.object({ price: v.optional(v.number()) })),
        deliveroo: v.optional(v.object({ price: v.optional(v.number()) })),
      })),
    }),
    scope: v.union(v.literal("self"), v.literal("selected"), v.literal("all")),
    targetStoreIds: v.optional(v.array(v.id("stores"))),
  },
  handler: async (ctx: any, args: any) => {
    // 1. Fetch and validate the target product
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    // The same guard `update` has carried since the beginning. This path
    // skipped it, so the one mutation that writes a price into several stores
    // at once was also the one that accepted a negative one.
    if (args.updates.price !== undefined && args.updates.price < 0) {
      throw new Error("Price cannot be negative");
    }

    const updates = { ...args.updates, updatedAt: Date.now() };

    // Apply updates to the current product
    await ctx.db.patch(args.productId, updates);

    // The store whose catalogue changed — the caller's wrapper schedules the
    // platform push against it, and against nothing else.
    if (args.scope === "self") return { updated: 1, storeIds: [product.storeId] };

    // 2. Resolve the root product ID used to find all sibling products.
    // If this product itself is a linked copy, follow to the original root.
    const rootId = product.linkedProductId ?? args.productId;

    // Find all products that share the same root (siblings across stores)
    const linkedProducts = await ctx.db
      .query("products")
      .withIndex("by_linkedProductId", (q: any) => q.eq("linkedProductId", rootId))
      .collect();

    // Also include the root product itself when the current product is a copy
    let allRelated = [...linkedProducts];
    if (rootId !== args.productId) {
      const rootProduct = await ctx.db.get(rootId);
      if (rootProduct) allRelated.push(rootProduct);
    }

    // Exclude the product that was already updated above
    allRelated = allRelated.filter((p: any) => p._id !== args.productId);

    // 3. Narrow down targets when scope is "selected"
    if (args.scope === "selected" && args.targetStoreIds) {
      const targetSet = new Set(args.targetStoreIds);
      allRelated = allRelated.filter((p: any) => targetSet.has(p.storeId));
    }

    // 4. The caller proved rights over the store of the *named* product, and
    // the wrapper's guard stops there. Every twin below lives in a different
    // establishment, and this handler was writing names, prices and
    // availability into all of them. A manager of one location could reprice a
    // sister restaurant they do not administer — the mutation is public, and
    // product ids are public via `products.list`.
    //
    // Each target store is checked once, and a store out of reach refuses the
    // whole propagation rather than being skipped: a caller who asked to
    // propagate must not be told "updated: 3" while two were silently dropped.
    const targetStoreIds = new Set<string>(
      allRelated.map((p: any) => p.storeId)
    );
    for (const storeId of targetStoreIds) {
      await requireStorePermission(ctx, storeId, "products:write");
    }

    // 5. Build the propagated patch — strip store-specific overrides so that
    // each store keeps its own platform pricing configuration intact.
    const propagatedUpdates = { ...updates };
    delete propagatedUpdates.platformOverrides;

    for (const linked of allRelated) {
      await ctx.db.patch(linked._id, propagatedUpdates);
    }

    // Every establishment this write touched, so the caller can push exactly
    // those menus. This mutation is the one place a single call changes the
    // catalogue of several restaurants at once; a sync scoped to the named
    // product's store alone would leave every twin stale on the platforms.
    return {
      updated: 1 + allRelated.length,
      storeIds: Array.from(new Set<string>([product.storeId, ...targetStoreIds])),
    };
  },
}
