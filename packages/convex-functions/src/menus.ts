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
/**
 * Every menu of a store, switched-off ones included.
 *
 * NOT filtered on `isActive`, and NOT public — the two facts are the same
 * decision. `products.list` and `categories.list` are filtered because the
 * storefront renders them to anonymous visitors; nothing renders menus to
 * anyone but the owner. So rather than a filtered public query beside a
 * guarded twin, this is one guarded query: `toggleStatus` exists precisely so
 * a menu can be taken off the carte and put back, and the screen with that
 * button has to see what it switched off.
 *
 * Wrapped with `storeQuery` + `products:read` in each app's `convex/`. The
 * storefront menu view exists now and reads `listActive` below — the separate
 * filtered query this comment asked for. Do not open this one up.
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
 * The formules a diner may actually order, with their sections resolved.
 *
 * THE SEPARATE QUERY THE COMMENT ABOVE ASKED FOR (#352). `list` is unfiltered
 * and guarded, which is right for the screen that switches a formule off and
 * wrong for a storefront: a diner must not be shown a deactivated bundle, and
 * must not need a session to be shown an active one.
 *
 * IT RESOLVES `pick_category` SECTIONS HERE. That section type means "anything
 * currently in this category", so the choices are not stored on the menu at all
 * — they are a query the storefront would otherwise have to make one of per
 * section, each of them a second round-trip before a diner can pick a dessert.
 * Resolved once, server-side, where the category read is an index lookup.
 *
 * IT LEAVES OUT WHAT CANNOT BE ORDERED. A formule whose fixed dish has been
 * deactivated cannot be composed, and offering it means a diner reaches the
 * checkout and is refused by `verifyMenuSelection` after choosing everything
 * else. An out-of-stock or out-of-window dish is NOT filtered out: those are
 * true right now and false in an hour, and the order path refuses them with a
 * sentence that says which dish — which is better than a formule that silently
 * disappears from the carte at 14:31.
 */
export const listActive = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const menus = await ctx.db
      .query("menus")
      .withIndex("by_storeId_isActive", (q: any) =>
        q.eq("storeId", args.storeId).eq("isActive", true)
      )
      .collect()

    // Products read once each across every formule: a lunch carte of six
    // formules over the same dozen dishes is a dozen reads, not seventy.
    const productCache = new Map<string, any>()
    const readProduct = async (productId: string) => {
      if (!productCache.has(productId)) {
        productCache.set(productId, await ctx.db.get(productId))
      }
      return productCache.get(productId)
    }

    const categoryCache = new Map<string, any[]>()
    const readCategory = async (categoryId: string) => {
      if (!categoryCache.has(categoryId)) {
        // `by_storeId_categoryId`, not a category-only index: there is none, and
        // a formule's category always belongs to the formule's own store, so
        // the compound key is both correct and the cheaper read.
        const products = await ctx.db
          .query("products")
          .withIndex("by_storeId_categoryId", (q: any) =>
            q.eq("storeId", args.storeId).eq("categoryId", categoryId)
          )
          .collect()
        categoryCache.set(
          categoryId,
          products.filter((product: any) => product.isActive)
        )
        for (const product of products) productCache.set(product._id, product)
      }
      return categoryCache.get(categoryId) ?? []
    }

    /** What the storefront needs about one choosable dish. */
    const choice = (product: any) => ({
      productId: product._id as string,
      name: product.name as string,
      description: product.description as string | undefined,
      imageUrl: (product.images?.[0] ?? undefined) as string | undefined,
      /**
       * The à-la-carte price, for information only.
       *
       * The diner pays the formule's price whatever they choose. It is shown so
       * a « supplément » is visible where one exists, and it is never summed on
       * the client: the split lives server-side in `allocateBundlePrice`.
       */
      price: product.price as number,
      allergens: (product.allergens ?? []) as string[],
      options: (product.options ?? []) as unknown[],
      isAvailable:
        product.isActive === true &&
        !(product.stock?.tracked === true && product.stock.quantity <= 0),
    })

    const resolved: any[] = []
    for (const menu of menus) {
      const sections: any[] = []
      let composable = true

      for (const section of [...menu.sections].sort(
        (a: any, b: any) => a.sortOrder - b.sortOrder
      )) {
        let choices: any[] = []

        if (section.type === "fixed") {
          const product = section.productId ? await readProduct(section.productId) : null
          // A formule whose mandatory dish is gone or switched off cannot be
          // composed at all, so it is not offered.
          if (!product || product.isActive !== true) {
            composable = false
            break
          }
          choices = [choice(product)]
        } else if (section.type === "pick_products") {
          for (const productId of section.productIds ?? []) {
            const product = await readProduct(productId)
            if (product && product.isActive === true) choices.push(choice(product))
          }
        } else if (section.type === "pick_category") {
          const products = section.categoryId ? await readCategory(section.categoryId) : []
          choices = products.map(choice)
        }

        // A row with nothing left to choose from is the same problem as a
        // missing fixed dish when it is required.
        if (choices.length === 0 && section.required) {
          composable = false
          break
        }
        if (choices.length === 0) continue

        sections.push({
          sectionId: section.sectionId,
          label: section.label,
          type: section.type,
          required: section.required,
          minChoices: section.minChoices,
          maxChoices: section.maxChoices,
          allowDuplicates: section.allowDuplicates,
          choices,
        })
      }

      if (!composable || sections.length === 0) continue

      resolved.push({
        _id: menu._id,
        name: menu.name,
        description: menu.description,
        price: menu.price,
        imageUrl: menu.imageUrl,
        sortOrder: menu.sortOrder,
        sections,
      })
    }

    return resolved.sort((a, b) => a.sortOrder - b.sortOrder)
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
