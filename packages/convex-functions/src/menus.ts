/**
 * Menu (combo/formule) management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers.
 * Menus use typed sections: fixed product, pick from products, or pick from category.
 */

import { ConvexError, v } from "convex/values"

/**
 * Shared section validator (mirrors menuSectionValidator in convex-schema)
 */
const sectionValidator = v.object({
  sectionId: v.string(),
  label: v.string(),
  type: v.union(
    v.literal("fixed"),
    v.literal("pick_products"),
    v.literal("pick_category")
  ),
  required: v.boolean(),
  minChoices: v.number(),
  maxChoices: v.number(),
  allowDuplicates: v.boolean(),
  sortOrder: v.number(),
  productId: v.optional(v.id("products")),
  productIds: v.optional(v.array(v.id("products"))),
  categoryId: v.optional(v.id("categories")),
  priceAdjustments: v.optional(
    v.array(v.object({
      productId: v.id("products"),
      adjustment: v.number(),
    }))
  ),
})

const sectionsArg = v.array(sectionValidator)

/**
 * Validate menu sections business rules.
 * Called in create/update mutations (Convex schema can't do conditional validation).
 */
function validateMenuSections(
  sections: Array<{
    sectionId: string
    label: string
    type: "fixed" | "pick_products" | "pick_category"
    required: boolean
    minChoices: number
    maxChoices: number
    allowDuplicates: boolean
    sortOrder: number
    productId?: string
    productIds?: string[]
    categoryId?: string
  }>
) {
  if (sections.length === 0) {
    throw new Error("A menu must have at least one section")
  }

  const ids = new Set<string>()
  for (const s of sections) {
    if (ids.has(s.sectionId)) {
      throw new Error(`Duplicate sectionId: ${s.sectionId}`)
    }
    ids.add(s.sectionId)
  }

  for (const s of sections) {
    if (!s.label.trim()) {
      throw new Error("Each section must have a label")
    }

    switch (s.type) {
      case "fixed":
        if (!s.productId) {
          throw new Error(`Section "${s.label}": fixed type requires a productId`)
        }
        if (s.minChoices !== 1 || s.maxChoices !== 1) {
          throw new Error(`Section "${s.label}": fixed type must have min=1, max=1`)
        }
        break

      case "pick_products":
        if (!s.productIds || s.productIds.length === 0) {
          throw new Error(`Section "${s.label}": pick_products requires at least one product`)
        }
        if (s.maxChoices < 1) {
          throw new Error(`Section "${s.label}": maxChoices must be >= 1`)
        }
        if (s.minChoices < 0 || s.minChoices > s.maxChoices) {
          throw new Error(`Section "${s.label}": invalid minChoices/maxChoices range`)
        }
        break

      case "pick_category":
        if (!s.categoryId) {
          throw new Error(`Section "${s.label}": pick_category requires a categoryId`)
        }
        if (s.maxChoices < 1) {
          throw new Error(`Section "${s.label}": maxChoices must be >= 1`)
        }
        if (s.minChoices < 0 || s.minChoices > s.maxChoices) {
          throw new Error(`Section "${s.label}": invalid minChoices/maxChoices range`)
        }
        break

      default:
        throw new Error(`Unknown section type: ${(s as any).type}`)
    }
  }
}

/**
 * Every product and category a menu points at must belong to the menu's own
 * establishment.
 *
 * Nothing checked it. A combo could be built from another restaurant's
 * products — priced from their catalogue, sold from ours, and cooked by a
 * kitchen that has never heard of the dish. Ids of both kinds are public: the
 * catalogue *is* the storefront.
 */
async function assertSectionsInStore(
  ctx: any,
  storeId: string,
  sections: Array<{
    label: string
    productId?: string
    productIds?: string[]
    categoryId?: string
  }>
): Promise<void> {
  for (const section of sections) {
    const productIds = [
      ...(section.productId ? [section.productId] : []),
      ...(section.productIds ?? []),
    ]

    for (const productId of productIds) {
      const product = await ctx.db.get(productId)
      if (!product) {
        throw new Error(`Section "${section.label}": product not found`)
      }
      if (product.storeId !== storeId) {
        throw new Error(
          `Section "${section.label}": "${product.name}" belongs to another store`
        )
      }
    }

    if (section.categoryId) {
      const category = await ctx.db.get(section.categoryId)
      if (!category) {
        throw new Error(`Section "${section.label}": category not found`)
      }
      if (category.storeId !== storeId) {
        throw new Error(
          `Section "${section.label}": "${category.name}" belongs to another store`
        )
      }
    }
  }
}

// === QUERIES ===

/**
 * List all menus for a store
 */
export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("menus")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
  },
}

/**
 * Get menu by ID
 */
export const getById = {
  args: { id: v.id("menus") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.get(args.id)
  },
}

// === MUTATIONS ===

/**
 * Create a new menu
 */
export const create = {
  args: {
    storeId: v.id("stores"),
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    imageUrl: v.optional(v.string()),
    sections: sectionsArg,
    platformVisibility: v.optional(v.object({
      uberEats: v.optional(v.boolean()),
      deliveroo: v.optional(v.boolean()),
    })),
    isActive: v.boolean(),
    sortOrder: v.number(),
  },
  handler: async (ctx: any, args: any) => {
    if (args.price < 0) throw new Error("Price cannot be negative")
    validateMenuSections(args.sections)
    await assertSectionsInStore(ctx, args.storeId, args.sections)
    const now = Date.now()
    return await ctx.db.insert("menus", {
      ...args,
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Update a menu
 */
export const update = {
  args: {
    id: v.id("menus"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    sections: v.optional(sectionsArg),
    platformVisibility: v.optional(v.object({
      uberEats: v.optional(v.boolean()),
      deliveroo: v.optional(v.boolean()),
    })),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx: any, args: any) => {
    if (args.price !== undefined && args.price < 0) throw new Error("Price cannot be negative")
    if (args.sections !== undefined) validateMenuSections(args.sections)
    const { id, ...fields } = args
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error("Menu not found")
    if (fields.sections !== undefined) {
      await assertSectionsInStore(ctx, existing.storeId, fields.sections)
    }
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

/**
 * Toggle menu active status
 */
export const toggleStatus = {
  args: { id: v.id("menus") },
  handler: async (ctx: any, args: any) => {
    const menu = await ctx.db.get(args.id)
    if (!menu) throw new Error("Menu not found")
    await ctx.db.patch(args.id, {
      isActive: !menu.isActive,
      updatedAt: Date.now(),
    })
  },
}

/**
 * How many translation rows one pass of a menu delete clears.
 *
 * A menu is translated field by field, per language, so the row count is
 * (fields x languages) — dozens, not thousands. The cap is there so the number
 * cannot become unbounded if either side grows, and `hasMore` is the caller's
 * signal to schedule the next pass.
 */
export const MENU_TRANSLATION_BATCH = 256

export interface MenuPurgeResult {
  /** Translation rows cleared in this pass. */
  deleted: number
  /** Whether another pass is needed. */
  hasMore: boolean
}

/** Clear up to `budget` translation rows belonging to one menu. */
async function deleteTranslationBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  storeId: unknown,
  menuId: unknown,
  budget: number = MENU_TRANSLATION_BATCH
): Promise<MenuPurgeResult> {
  // `take(budget + 1)`: the extra row is how we learn there is more to do
  // without paying for a count.
  const translations = await ctx.db
    .query("translations")
    .withIndex("by_storeId_entity", (q: any) =>
      q.eq("storeId", storeId).eq("entityType", "menus").eq("entityId", menuId)
    )
    .take(budget + 1)

  const hasMore = translations.length > budget
  const batch = hasMore ? translations.slice(0, budget) : translations
  for (const translation of batch) {
    await ctx.db.delete(translation._id)
  }
  return { deleted: batch.length, hasMore }
}

/**
 * Delete a menu, and the translations that only ever described it.
 *
 * WHAT WENT WRONG (#412 P3-F4). A bare `ctx.db.delete(args.id)`, leaving two
 * kinds of row behind.
 *
 *  - REFUSED — `prizes.menuId`. A « Menu offert » prize names the formule it
 *    gives away, and a prize is what a diner has been promised. Deleting the
 *    menu under it leaves the prize naming nothing, which is the same shape
 *    `products.remove` already refuses for a dish that a formule, a promotion
 *    or a prize still points at. Prizes are read through the establishment's
 *    own list, as `products.remove` reads menus and promotions: dozens of rows,
 *    and no index that would be written on every insert to serve one delete.
 *  - CASCADED — `translations`, keyed `entityType: "menus"` with the menu's id
 *    as `entityId`. `entityId` is a `v.string()`, so the schema cannot see that
 *    it is a foreign key and nothing ever complained; the rows are the menu's
 *    own name and description in every language the owner added, they are of no
 *    use to anything else, and nothing but a whole-store delete ever cleared
 *    them. They go with it.
 */
export const remove = {
  args: { id: v.id("menus") },
  handler: async (ctx: any, args: any): Promise<MenuPurgeResult> => {
    const menu = await ctx.db.get(args.id)
    if (!menu) throw new Error("Menu not found")

    const prizes = await ctx.db
      .query("prizes")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", menu.storeId))
      .collect()

    const blockingPrizes = prizes.filter((prize: any) => prize.menuId === args.id)
    if (blockingPrizes.length > 0) {
      const plural = blockingPrizes.length > 1
      const names = blockingPrizes.map((prize: any) => `« ${prize.name} »`).join(", ")
      throw new ConvexError({
        code: "menu_in_prize",
        message:
          `Cette formule est offerte par ${blockingPrizes.length} lot${plural ? "s" : ""} : ` +
          `${names}. Changez ${plural ? "ces lots" : "ce lot"} avant de supprimer la formule.`,
      })
    }

    const result = await deleteTranslationBatch(ctx, menu.storeId, args.id)
    await ctx.db.delete(args.id)
    return result
  },
}

/**
 * The rest of the translation sweep, one batch per run.
 *
 * Internal only: it takes an id that no longer resolves — the menu row goes in
 * the first transaction — and it is nobody's to call but the scheduler's.
 */
export const purgeTranslations = {
  args: { menuId: v.id("menus"), storeId: v.id("stores") },
  handler: async (ctx: any, args: any): Promise<MenuPurgeResult> =>
    await deleteTranslationBatch(ctx, args.storeId, args.menuId),
}
