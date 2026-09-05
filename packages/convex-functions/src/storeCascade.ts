/**
 * What has to go when an establishment goes.
 *
 * WHY THIS EXISTS: `stores.remove` deleted the store row and nothing else.
 * Forty-two `storeId` columns across twenty tables were left pointing at a
 * document that no longer existed, and the id stayed in
 * `userProfiles.storeIds`. Nothing complains: `v.id("stores")` validates the
 * encoding of an id, not that it resolves. So the products, the orders, the
 * kitchen tickets, the CMS pages and the email subscribers of a deleted
 * location survived it, invisible and unreachable, and the bulk delete did it
 * to N establishments at once (#169).
 *
 * Every table is swept through an index that starts with `storeId`, so the
 * cost is proportional to what is being deleted, not to the size of the table.
 * `favorites` gained a `by_storeId` index for exactly this — both of its
 * compound indexes start with `userId`.
 */

/**
 * Every store-scoped table, with the index to sweep it by.
 *
 * The order is deliberate: the tables an owner would notice first come first,
 * so that a cascade interrupted between batches leaves the least confusing
 * state — a half-deleted establishment is already gone from the dashboard, and
 * what remains is being carried away.
 *
 * Adding a table with a `storeId` column means adding it here. Nothing checks
 * that for you; `storeCascade.test.ts` compares this list against the schema.
 */
export const STORE_SCOPED_TABLES: ReadonlyArray<{ table: string; index: string }> = [
  // Catalogue
  { table: "products", index: "by_storeId" },
  { table: "categories", index: "by_storeId" },
  { table: "menus", index: "by_storeId" },
  // Selling
  { table: "orders", index: "by_storeId" },
  { table: "payments", index: "by_storeId" },
  { table: "kitchenTickets", index: "by_storeId" },
  { table: "printerSettings", index: "by_storeId" },
  { table: "deliveryQuotes", index: "by_storeId" },
  { table: "promotions", index: "by_storeId" },
  { table: "promotionUsages", index: "by_storeId" },
  // People
  { table: "teamMembers", index: "by_storeId" },
  { table: "favorites", index: "by_storeId" },
  { table: "contactMessages", index: "by_storeId" },
  // Platforms
  { table: "storeIntegrations", index: "by_store" },
  { table: "externalProductMappings", index: "by_store_platform" },
  { table: "orphanProducts", index: "by_store_platform" },
  // Gamification
  { table: "gameQRCodes", index: "by_storeId" },
  { table: "requiredActions", index: "by_storeId" },
  { table: "games", index: "by_storeId" },
  { table: "prizes", index: "by_storeId" },
  { table: "gamePlays", index: "by_storeId" },
  { table: "prizeRedemptions", index: "by_storeId" },
  { table: "gameReferrals", index: "by_storeId_referrerFingerprint" },
  { table: "prizeIssuance", index: "by_storeId" },
  // i18n
  { table: "languages", index: "by_storeId" },
  { table: "translations", index: "by_storeId_entity" },
  { table: "translationJobs", index: "by_storeId" },
  // Email marketing
  { table: "emailSubscribers", index: "by_storeId" },
  { table: "emailTemplates", index: "by_storeId" },
  { table: "emailCampaigns", index: "by_storeId" },
  { table: "emailSegments", index: "by_storeId" },
  { table: "emailAutomations", index: "by_storeId" },
  { table: "emailAutomationRuns", index: "by_storeId" },
  { table: "emailEvents", index: "by_storeId_type" },
  { table: "emailConfig", index: "by_storeId" },
  // Content
  { table: "cmsPages", index: "by_storeId" },
  { table: "cmsBlocks", index: "by_storeId" },
  { table: "cmsMedia", index: "by_storeId" },
  { table: "blogArticles", index: "by_storeId" },
  { table: "blogArticleTags", index: "by_storeId_tagId_isDraft_publishedAt" },
  { table: "blogCategories", index: "by_storeId" },
  { table: "blogTags", index: "by_storeId" },
  { table: "blogAutoConfig", index: "by_storeId" },
  { table: "blogAutoQueue", index: "by_storeId" },
]

/**
 * How many dependent documents one transaction will delete.
 *
 * A Convex mutation is one transaction with a bounded read and write budget,
 * and an established restaurant has more orders than that on its own. So the
 * cascade is a loop rather than a promise: this many rows per pass, then the
 * caller schedules the next pass. 512 is comfortably inside the limits and
 * still clears a small establishment in a single mutation.
 */
export const CASCADE_BATCH_SIZE = 512

export interface CascadeResult {
  /** Dependent documents deleted in this pass. */
  deleted: number
  /** Whether another pass is needed. */
  hasMore: boolean
}

/**
 * Delete up to `budget` documents belonging to `storeId`.
 *
 * Returns `hasMore` when the budget ran out with rows still standing, which is
 * the signal for the caller to schedule another pass. It does *not* delete the
 * store row itself — that is `stores.remove`'s to do, once, so the audit entry
 * and the deletion stay together.
 */
export async function deleteStoreDependents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  storeId: unknown,
  budget: number = CASCADE_BATCH_SIZE
): Promise<CascadeResult> {
  let remaining = budget
  let deleted = 0

  for (const { table, index } of STORE_SCOPED_TABLES) {
    if (remaining <= 0) return { deleted, hasMore: true }

    // `take(remaining + 1)`: the extra row is how we learn there is more to do
    // without paying for a count.
    const rows = await ctx.db
      .query(table)
      .withIndex(index, (q: { eq: (field: string, value: unknown) => unknown }) =>
        q.eq("storeId", storeId)
      )
      .take(remaining + 1)

    const overflow = rows.length > remaining
    for (const row of overflow ? rows.slice(0, remaining) : rows) {
      await ctx.db.delete(row._id)
      deleted++
      remaining--
    }

    if (overflow) return { deleted, hasMore: true }
  }

  return { deleted, hasMore: false }
}

/**
 * Take the establishment out of every profile that lists it.
 *
 * Left behind, the id makes `userProfiles.storeIds` point at nothing, and the
 * store-scoped seam matches membership against ids that no longer resolve —
 * which is how an owner ends up locked out of the locations they still have.
 */
export async function detachStoreFromProfiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  storeId: unknown
): Promise<number> {
  const profiles = await ctx.db.query("userProfiles").collect()
  let touched = 0

  for (const profile of profiles) {
    const storeIds: unknown[] = profile.storeIds ?? []
    if (!storeIds.includes(storeId)) continue
    await ctx.db.patch(profile._id, {
      storeIds: storeIds.filter((id) => id !== storeId),
      updatedAt: Date.now(),
    })
    touched++
  }

  return touched
}
