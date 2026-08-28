/**
 * Menu (combo/formule) management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers.
 * Menus use typed sections: fixed product, pick from products, or pick from category.
 */

import { v } from "convex/values"

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
 * Delete a menu
 */
export const remove = {
  args: { id: v.id("menus") },
  handler: async (ctx: any, args: any) => {
    await ctx.db.delete(args.id)
  },
}
