/**
 * Category management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

// === QUERIES ===

/**
 * List all categories for a store, ordered by sortOrder
 */
export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("categories")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .order("asc")
      .collect()
      .then((categories: any) =>
        categories
          // The storefront's read: a category the owner has switched off is
          // not a section of the carte. `listActiveWithCounts` next door has
          // always said so; this one returned the lot, and the menu page and
          // the JSON-LD are built from THIS query.
          //
          // There is no `by_storeId_isActive` index on this table and there
          // does not need to be: a store has tens of categories, not
          // thousands, and the sort below already walks the whole list.
          .filter((c: any) => c.isActive)
          .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      )
  },
}

/**
 * Every category, switched off ones included — for the people who own them.
 *
 * The counterpart to `products.listAll`, and needed by more than the back
 * office: the Uber Eats and Deliveroo importers match incoming categories
 * against the existing ones, and matching against the ACTIVE ones only would
 * create a second "Desserts" beside the switched-off first.
 *
 * Wrapped with `storeQuery` + `products:read` in each app's `convex/`.
 */
export const listAll = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("categories")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .order("asc")
      .collect()
      .then((categories: any) =>
        categories.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      )
  },
}

/**
 * Get category by ID
 */
export const getById = {
  args: { id: v.id("categories") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.get(args.id)
  },
}

/**
 * List active categories with product counts for storefront display
 */
export const listActiveWithCounts = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()

    const activeCategories = categories
      .filter((c: any) => c.isActive)
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

    const result = []
    for (const cat of activeCategories) {
      const products = await ctx.db
        .query("products")
        .withIndex("by_storeId_categoryId", (q: any) =>
          q.eq("storeId", args.storeId).eq("categoryId", cat._id)
        )
        .collect()
      const productCount = products.filter((p: any) => p.isActive).length
      result.push({ ...cat, productCount })
    }

    return result
  },
}

// === MUTATIONS ===

/**
 * Create a new category
 */
export const create = {
  args: {
    storeId: v.id("stores"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    sortOrder: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    return await ctx.db.insert("categories", {
      ...args,
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Update category
 */
export const update = {
  args: {
    id: v.id("categories"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error("Category not found")
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

/**
 * Reorder categories
 */
export const reorder = {
  args: {
    ids: v.array(v.id("categories")),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()

    // Update sortOrder for each category based on position in array
    for (let i = 0; i < args.ids.length; i++) {
      await ctx.db.patch(args.ids[i]!, {
        sortOrder: i,
        updatedAt: now,
      })
    }
  },
}

/**
 * Delete a category.
 *
 * A bare delete used to leave every product of that category pointing at a row
 * that no longer exists. The admin promised the opposite — "les produits
 * perdront leur assignation de catégorie" — and could not deliver it:
 * `categoryId` is a required column, so there is no unassigned state to fall
 * back to. What actually happened is that the products kept a dead id, stayed
 * orderable under "Tout" on the storefront, and rendered as "Inconnu" in the
 * admin, with no filter that could find them again.
 *
 * So the deletion refuses while the category still holds products, and says
 * how many. Moving them is the owner's decision — a cascade would delete a
 * menu they spent an afternoon writing, on a click meant to tidy up.
 */
export const remove = {
  args: { id: v.id("categories") },
  handler: async (ctx: any, args: any) => {
    const category = await ctx.db.get(args.id)
    if (!category) throw new Error("Category not found")

    const products = await ctx.db
      .query("products")
      .withIndex("by_storeId_categoryId", (q: any) =>
        q.eq("storeId", category.storeId).eq("categoryId", args.id)
      )
      .collect()

    if (products.length > 0) {
      throw new Error(
        `Cette catégorie contient ${products.length} produit${products.length > 1 ? "s" : ""}. Déplacez-les dans une autre catégorie avant de la supprimer.`
      )
    }

    await ctx.db.delete(args.id)
  },
}
