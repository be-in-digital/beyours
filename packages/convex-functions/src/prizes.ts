import { ConvexError, v } from "convex/values"

export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.query("prizes").withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId)).collect()
  },
}

/**
 * Which prize types name a thing, and which field names it.
 *
 * WHY THIS EXISTS (#432.7). `prizes.productId` and `prizes.menuId` were
 * declared in the schema and written by nothing:
 *
 *     $ grep -c menuId packages/convex-functions/src/prizes.ts
 *     0
 *
 * Two consequences, and the second is the one that reaches a diner.
 *
 * The guards were DEAD. `menus.remove` refuses `menu_in_prize` and
 * `products.remove` refuses a dish a prize gives away, and neither refusal
 * could fire outside its own test, because no production path could put a
 * prize in that state. Two green guards over a condition nothing could reach.
 *
 * And the product let an owner create a lie. `type` offered « Produit
 * offert » and « Menu offert » while nothing could say WHICH product or menu,
 * so a prize read « Menu offert » on the wheel, on the winning screen and on
 * the QR code the diner brought to the counter — and nobody at the counter
 * could tell which menu had been promised.
 *
 * The schema's own comment named the fix, and this is it: the engine already
 * has the pattern in `HONOURABLE_DISCOUNT_TYPES`
 * (`promotionDiscount.ts`), where a promotion type the order path cannot
 * honour is refused at creation, in the same file as the resolver that
 * enforces it. Same shape here — the rule lives beside the code that applies
 * it, so one cannot drift from the other.
 */
export const PRIZE_TARGET_FIELDS = {
  free_product: "productId",
  free_menu: "menuId",
} as const satisfies Record<string, "productId" | "menuId">

export type TargetedPrizeType = keyof typeof PRIZE_TARGET_FIELDS

/** Does this prize type name a product or a menu? */
export function needsTarget(type: string): type is TargetedPrizeType {
  return Object.prototype.hasOwnProperty.call(PRIZE_TARGET_FIELDS, type)
}

const PRIZE_TYPE_LABELS: Record<string, string> = {
  free_product: "Produit offert",
  free_menu: "Menu offert",
}

/**
 * Refuse a prize whose type and target disagree.
 *
 * Three ways they can, and each is refused for its own reason:
 *
 *  - a « Produit offert » with no product — the lie above;
 *  - a « Remise » naming a menu — the screens would render a target the type
 *    has no place for, which is the same lie in the other direction;
 *  - a target belonging to ANOTHER establishment — a deployment is one
 *    client's, and a prize is redeemed at a counter. `storeId` is checked
 *    rather than assumed, because the id arrives from the caller.
 */
async function assertTargetMatchesType(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  storeId: unknown,
  type: string,
  target: { productId?: unknown; menuId?: unknown }
): Promise<void> {
  const required = needsTarget(type) ? PRIZE_TARGET_FIELDS[type] : null

  for (const field of ["productId", "menuId"] as const) {
    const id = target[field]
    if (id == null) continue
    if (field !== required) {
      throw new ConvexError({
        code: "prize_target_not_applicable",
        message:
          `Un lot de ce type ne désigne ni produit ni formule. ` +
          `Choisissez « ${PRIZE_TYPE_LABELS.free_product} » ou ` +
          `« ${PRIZE_TYPE_LABELS.free_menu} » pour en désigner un.`,
      })
    }
    const row = await ctx.db.get(id)
    if (!row || row.storeId !== storeId) {
      throw new ConvexError({
        code: "prize_target_not_found",
        message:
          field === "productId"
            ? "Ce produit n'existe pas dans cet établissement."
            : "Cette formule n'existe pas dans cet établissement.",
      })
    }
  }

  if (required && target[required] == null) {
    throw new ConvexError({
      code: "prize_target_required",
      message:
        required === "productId"
          ? "Un « Produit offert » doit désigner le produit offert : sans lui, " +
            "personne au comptoir ne sait ce qui a été promis."
          : "Un « Menu offert » doit désigner la formule offerte : sans elle, " +
            "personne au comptoir ne sait ce qui a été promis.",
    })
  }
}

export const create = {
  args: {
    storeId: v.id("stores"),
    name: v.string(),
    description: v.optional(v.string()),
    type: v.union(
      v.literal("discount_percentage"),
      v.literal("discount_fixed"),
      v.literal("free_product"),
      v.literal("free_menu"),
      v.literal("custom")
    ),
    value: v.optional(v.number()),
    /** Required for `free_product`, refused for every other type. */
    productId: v.optional(v.id("products")),
    /** Required for `free_menu`, refused for every other type. */
    menuId: v.optional(v.id("menus")),
    validityDays: v.number(),
    totalAvailable: v.optional(v.number()),
    isActive: v.boolean(),
  },
  handler: async (ctx: any, args: any) => {
    await assertTargetMatchesType(ctx, args.storeId, args.type, args)
    const now = Date.now()
    return await ctx.db.insert("prizes", { ...args, createdAt: now, updatedAt: now })
  },
}

export const update = {
  args: {
    id: v.id("prizes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    value: v.optional(v.number()),
    productId: v.optional(v.id("products")),
    menuId: v.optional(v.id("menus")),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    const prize = await ctx.db.get(id)
    if (!prize) throw new Error("Prize not found")

    /* Checked against the row's OWN type, which `update` cannot change. A
       caller passing a target has to pass one this prize may hold — and the
       merge below is what makes that the right question: an absent field
       leaves whatever the prize already has. */
    if (fields.productId != null || fields.menuId != null) {
      await assertTargetMatchesType(ctx, prize.storeId, prize.type, {
        productId: fields.productId ?? prize.productId,
        menuId: fields.menuId ?? prize.menuId,
      })
    }

    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

/**
 * Delete a prize.
 *
 * This was a bare `ctx.db.delete(args.id)`, and `prizeRedemptions.prizeId` is
 * REQUIRED. So tidying the prize list voided prizes diners had actually won: the
 * redemption row survived at `pending`, holding an id that resolves to nothing,
 * and the staff scanner — `redeemByCode` dereferences `redemption.prizeId` —
 * had nothing to show the person standing at the till with a valid code. The
 * counter scan is where it surfaced, as a dangling `pending` redemption; the
 * customer's version was being told their prize did not exist.
 *
 * `v.id("prizes")` validates how an id is encoded, not that it still resolves,
 * so nothing anywhere complained.
 *
 * The split is the one `products.remove` established, on authorship:
 *
 *  - REFUSED — `prizeRedemptions` and `gamePlays`. Both record something that
 *    HAPPENED: a diner played, and a diner won. Neither is ours to rewrite to
 *    make a delete succeed, and `gamePlays.prizeId` being optional is not
 *    permission to null it — that field IS the record of what was won.
 *  - DETACHED — `games.config.wheelSections[].prizeId`. The section is a label
 *    and a colour the owner drew and it survives; only the dead link goes.
 *    Nothing pays out from it (`gamePlay.play` draws from the prizes table via
 *    `loadAvailablePrizes`), so this is a display link, not a payout one.
 *
 * The way out is the one that already exists and is already on the screen:
 * `isActive: false` takes the prize out of the draw immediately —
 * `loadAvailablePrizes` filters on it — and leaves every won prize claimable.
 * That is what the refusal tells the owner to do.
 *
 * The refusals are `ConvexError`, not plain `Error`: Convex redacts a plain
 * error's message in production, so the owner would read "Server Error" and
 * file a bug against the delete button. `data` survives, and the admin's
 * `convexErrorMessage` already renders an unrecognised code's own message.
 */
export const remove = {
  args: { id: v.id("prizes") },
  handler: async (ctx: any, args: any) => {
    const prize = await ctx.db.get(args.id)
    if (!prize) throw new Error("Prize not found")

    // `.first()` rather than a count: one row is all a refusal needs, and this
    // is a delete path — the cost must not grow with how long the game has run.
    const redemption = await ctx.db
      .query("prizeRedemptions")
      .withIndex("by_prizeId", (q: any) => q.eq("prizeId", args.id))
      .first()

    if (redemption) {
      throw new ConvexError({
        code: "prize_has_redemptions",
        message:
          `« ${prize.name} » a déjà été gagné par des joueurs : il ne peut pas être supprimé, ` +
          "sinon les lots remis restent introuvables au comptoir. " +
          "Désactivez-le pour le retirer du jeu — les lots déjà gagnés restent valables.",
      })
    }

    const play = await ctx.db
      .query("gamePlays")
      .withIndex("by_prizeId", (q: any) => q.eq("prizeId", args.id))
      .first()

    if (play) {
      throw new ConvexError({
        code: "prize_has_plays",
        message:
          `« ${prize.name} » figure dans l'historique des parties : il ne peut pas être supprimé ` +
          "sans falsifier ce que des joueurs ont gagné. " +
          "Désactivez-le pour le retirer du jeu.",
      })
    }

    // The wheel keeps its section; only the link to a prize that is going.
    // Read through the establishment's games, which is a handful of rows — the
    // same cost profile as the rest of this module.
    const games = await ctx.db
      .query("games")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", prize.storeId))
      .collect()

    for (const game of games) {
      const sections = game.config?.wheelSections
      if (!Array.isArray(sections)) continue
      if (!sections.some((section: any) => section.prizeId === args.id)) continue

      await ctx.db.patch(game._id, {
        config: {
          ...game.config,
          wheelSections: sections.map((section: any) =>
            section.prizeId === args.id ? { ...section, prizeId: undefined } : section
          ),
        },
        updatedAt: Date.now(),
      })
    }

    await ctx.db.delete(args.id)
  },
}
