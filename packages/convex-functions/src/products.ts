/**
 * Product management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"
import { requireStorePermission } from "./auth"

// === QUERIES ===

/**
 * List all products for a store
 */
export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("products")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
  },
}

/**
 * Get product by ID
 */
export const getById = {
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
 * Get multiple products by IDs (batch query to avoid N+1)
 */
export const getManyByIds = {
  args: { ids: v.array(v.id("products")) },
  handler: async (ctx: any, args: { ids: string[] }) => {
    const products = await Promise.all(
      args.ids.map((id: string) => ctx.db.get(id))
    )
    return products.filter((p: unknown) => p !== null)
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
 * Get trending products based on 30-day order volume (automatic mode).
 * Only counts validated orders (confirmed, preparing, ready, out_for_delivery, delivered, completed).
 * Excludes pending and cancelled orders.
 */
export const getTrending = {
  args: {
    storeId: v.id("stores"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    const max = args.limit ?? 8
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

    const validStatuses = new Set([
      "confirmed",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "completed",
    ])

    // Fetch orders from the last 30 days
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_storeId_createdAt", (q: any) =>
        q.eq("storeId", args.storeId).gte("createdAt", thirtyDaysAgo)
      )
      .collect()

    // Aggregate product quantities from validated orders only
    const salesMap = new Map<string, number>()
    for (const order of orders) {
      if (!validStatuses.has(order.status)) continue
      for (const item of order.items) {
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
    for (const [productId] of sorted) {
      if (trending.length >= max) break
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

    const patch: Record<string, any> = {
      stock: {
        ...product.stock,
        quantity: args.quantity,
      },
      updatedAt: Date.now(),
    }

    if (product.stock.autoDisableWhenEmpty) {
      if (args.quantity <= 0 && product.isActive) {
        patch.isActive = false
      } else if (args.quantity > 0 && !product.isActive) {
        patch.isActive = true
      }
    }

    await ctx.db.patch(args.id, patch)
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

    await ctx.db.patch(args.id, {
      stock: {
        ...currentStock,
        tracked: args.tracked,
      },
      updatedAt: Date.now(),
    })
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
 * Delete a product
 */
export const remove = {
  args: { id: v.id("products") },
  handler: async (ctx: any, args: any) => {
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

    if (args.scope === "self") return { updated: 1 };

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

    return { updated: 1 + allRelated.length };
  },
}
