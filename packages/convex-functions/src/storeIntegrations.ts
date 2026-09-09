/**
 * Store integrations management functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"

// === QUERIES ===

/** The two platforms a store can be listed on. */
export type DeliveryPlatform = "uberEats" | "deliveroo"

/**
 * Where a platform's own public restaurant pages live.
 *
 * Checked because the field's whole purpose is to be a link to THIS
 * establishment. A URL on any other host is not that, and the failure it
 * replaces — the platform's home page, hard-coded, on every menu — is exactly
 * what an unvalidated field would let an owner paste back in.
 *
 * Deliveroo runs one domain per market (`deliveroo.fr`, `deliveroo.co.uk`,
 * `deliveroo.be`, …), so it is matched as a brand plus any public suffix
 * rather than as a fixed list that would refuse a market we have not thought
 * of.
 */
const PLATFORM_LINK_BRANDS: Record<DeliveryPlatform, string> = {
  uberEats: "ubereats",
  deliveroo: "deliveroo",
}

/** French for the operator, since this is what a failed save says. */
const PLATFORM_LABELS: Record<DeliveryPlatform, string> = {
  uberEats: "Uber Eats",
  deliveroo: "Deliveroo",
}

/**
 * Second-level labels that are part of a public suffix rather than a name
 * somebody registered — `deliveroo.co.uk`, `deliveroo.com.hk`.
 *
 * A closed set on purpose. Allowing any two-label suffix would accept
 * `deliveroo.evil.io`, which is a domain an attacker registers, and the whole
 * point of this check is that the link belongs to the platform.
 */
const PUBLIC_SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "edu"])

/**
 * Is this host the platform's own, rather than one that merely mentions it?
 *
 * Matched on LABELS, not on a substring or a regex over the whole name.
 * `deliveroo.com.evil.com` contains "deliveroo." and ends in a plausible TLD,
 * and a pattern-over-the-string check accepts it — which would let an owner
 * (or anyone who could write that field) point the storefront's own
 * « Commander » button at a domain they control.
 *
 * The brand label must be the registrable name: the last label before a public
 * suffix of one label (`deliveroo.fr`) or two (`deliveroo.co.uk`). Subdomains
 * of it are fine — `fr.deliveroo.fr` is Deliveroo.
 */
function isOnPlatformDomain(host: string, brand: string): boolean {
  const labels = host.split(".")
  const brandIndex = labels.lastIndexOf(brand)
  if (brandIndex === -1) return false

  const suffix = labels.slice(brandIndex + 1)
  if (suffix.length === 1) return /^[a-z]{2,6}$/.test(suffix[0] as string)
  if (suffix.length === 2) {
    return (
      PUBLIC_SECOND_LEVEL.has(suffix[0] as string) &&
      /^[a-z]{2}$/.test(suffix[1] as string)
    )
  }
  return false
}

/**
 * Read an owner-supplied platform link, or refuse it.
 *
 * Returns `undefined` for an empty value — "this restaurant has no public page
 * on that platform", which is a legitimate answer and removes the tile.
 *
 * Four rules, and every one of them is a way the hard-coded links were wrong:
 *
 *   https only        — the tile opens in a new tab from a payment-bearing
 *                       site; `javascript:` and `http:` have no business here.
 *   the platform's    — a link to somewhere else is not this establishment's
 *   own host            page on this platform.
 *   a real path       — `https://www.ubereats.com/` IS the defect. The
 *                       marketplace home page is where a diner is offered
 *                       every other restaurant in the street.
 *   no credentials    — a `user:pass@` authority in a link the storefront
 *                       renders is never intentional.
 */
export function normalisePlatformStorefrontUrl(
  platform: DeliveryPlatform,
  raw: string | null | undefined
): string | undefined {
  const trimmed = (raw ?? "").trim()
  if (!trimmed) return undefined

  const label = PLATFORM_LABELS[platform]
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error(
      `Le lien ${label} doit être une adresse complète, commençant par https://.`
    )
  }

  if (url.protocol !== "https:") {
    throw new Error(`Le lien ${label} doit commencer par https://.`)
  }
  if (url.username || url.password) {
    throw new Error(`Le lien ${label} ne doit pas contenir d'identifiants.`)
  }

  const brand = PLATFORM_LINK_BRANDS[platform]
  const host = url.hostname.toLowerCase()
  if (!isOnPlatformDomain(host, brand)) {
    throw new Error(
      `Le lien ${label} doit pointer vers ${label} (${host} n'est pas un domaine ${label}).`
    )
  }

  // The home page is the defect this field exists to remove, not a valid value
  // for it.
  if (url.pathname === "/" || url.pathname === "") {
    throw new Error(
      `Le lien ${label} doit pointer vers la page de VOTRE établissement, ` +
        `pas vers l'accueil de ${label}.`
    )
  }

  return url.toString()
}

/**
 * The platform links a storefront may show, for one store.
 *
 * PUBLIC, and deliberately the narrowest possible answer: a platform name and
 * a URL the owner typed, for the integrations that are switched on and have
 * one. Nothing else on the row is a diner's business — `platformStoreId` is an
 * API identifier, and the sync status is operational detail.
 *
 * The section this feeds used to be hard-coded: two tiles pointing at
 * `ubereats.com` and `deliveroo.com`, the marketplaces' own home pages, shown
 * on every menu whether or not the restaurant was listed on either. A
 * restaurant's own site sending its own customers to a marketplace is the
 * opposite of what it is for.
 */
export const publicLinks = {
  args: { storeId: v.id("stores") },
  handler: async (
    ctx: any,
    args: { storeId: string }
  ): Promise<Array<{ platform: DeliveryPlatform; url: string }>> => {
    const rows = await ctx.db
      .query("storeIntegrations")
      .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
      .collect()

    return rows
      .filter((row: any) => row.enabled && typeof row.storefrontUrl === "string")
      .map((row: any) => ({
        platform: row.platform as DeliveryPlatform,
        url: row.storefrontUrl as string,
      }))
  },
}

/**
 * List integrations for a store
 */
export const listByStore = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: { storeId: string }) => {
    return await ctx.db
      .query("storeIntegrations")
      .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
      .collect()
  },
}

/**
 * List all enabled integrations for a given platform
 * Uses the by_platform_enabled index for efficient lookup
 */
export const listByPlatformEnabled = {
  args: {
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
  },
  handler: async (ctx: any, args: { platform: "uberEats" | "deliveroo" }) => {
    return await ctx.db
      .query("storeIntegrations")
      .withIndex("by_platform_enabled", (q: any) =>
        q.eq("platform", args.platform).eq("enabled", true)
      )
      .collect()
  },
}

/**
 * Get integration for a store + platform
 */
export const getByStorePlatform = {
  args: {
    storeId: v.id("stores"),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
  },
  handler: async (ctx: any, args: { storeId: string; platform: "uberEats" | "deliveroo" }) => {
    return await ctx.db
      .query("storeIntegrations")
      .withIndex("by_store_platform", (q: any) =>
        q.eq("storeId", args.storeId).eq("platform", args.platform)
      )
      .unique()
  },
}

/**
 * Get integration by platformStoreId (site_id for Deliveroo)
 *
 * `withIndex` on the platform, THEN a filter for the id. It was a bare
 * `.query().filter().first()` — the shape Convex charges the whole table for,
 * because `.filter()` is applied after the scan and `.first()` keeps pulling
 * until something matches, so a miss reads every row there is. That was
 * invisible until the read-counting double stopped counting matches and started
 * counting documents walked (#412 P3-F6), and this is the first live path it
 * caught: both platform webhooks resolve their store through here on every
 * delivery.
 *
 * `by_platform_enabled` is the index because `platform` is its first field;
 * nothing new is declared. The scan that remains is one platform's rows for one
 * deployment — a handful — instead of the table.
 */
export const getBySiteId = {
  args: {
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    platformStoreId: v.string(),
  },
  handler: async (ctx: any, args: { platform: "uberEats" | "deliveroo"; platformStoreId: string }) => {
    return await ctx.db
      .query("storeIntegrations")
      .withIndex("by_platform_enabled", (q: any) => q.eq("platform", args.platform))
      .filter((q: any) => q.eq(q.field("platformStoreId"), args.platformStoreId))
      .first()
  },
}

/**
 * Get integration by brandId (for Deliveroo)
 *
 * Same shape and same fix as `getBySiteId` above.
 */
export const getByBrandId = {
  args: {
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    brandId: v.string(),
  },
  handler: async (ctx: any, args: { platform: "uberEats" | "deliveroo"; brandId: string }) => {
    return await ctx.db
      .query("storeIntegrations")
      .withIndex("by_platform_enabled", (q: any) => q.eq("platform", args.platform))
      .filter((q: any) => q.eq(q.field("brandId"), args.brandId))
      .first()
  },
}

// === MUTATIONS ===

/**
 * Create or update a store integration
 */
export const upsert = {
  args: {
    storeId: v.id("stores"),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    platformStoreId: v.string(),
    syncMenu: v.boolean(),
    autoAccept: v.boolean(),
    enabled: v.boolean(),
    storeStatus: v.optional(v.union(
      v.literal("ONLINE"),
      v.literal("PAUSED"),
      v.literal("OFFLINE")
    )),
    prepTime: v.optional(v.number()),
    brandId: v.optional(v.string()),
    /** This restaurant's own public page on the platform — see the schema. */
    storefrontUrl: v.optional(v.string()),
  },
  handler: async (ctx: any, args: {
    storeId: string
    platform: "uberEats" | "deliveroo"
    platformStoreId: string
    syncMenu: boolean
    autoAccept: boolean
    enabled: boolean
    storeStatus?: "ONLINE" | "PAUSED" | "OFFLINE"
    prepTime?: number
    brandId?: string
    storefrontUrl?: string
  }) => {
    // Refused here as well as in the form: the storefront renders this value
    // as an anchor, and a link that is not this establishment's page is the
    // defect the field exists to remove.
    const storefrontUrl = normalisePlatformStorefrontUrl(
      args.platform,
      args.storefrontUrl
    )
    const existing = await ctx.db
      .query("storeIntegrations")
      .withIndex("by_store_platform", (q: any) =>
        q.eq("storeId", args.storeId).eq("platform", args.platform)
      )
      .unique()

    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        platformStoreId: args.platformStoreId,
        syncMenu: args.syncMenu,
        autoAccept: args.autoAccept,
        enabled: args.enabled,
        storeStatus: args.storeStatus,
        prepTime: args.prepTime,
        brandId: args.brandId,
        storefrontUrl,
        updatedAt: now,
      })
      return existing._id
    }
    return await ctx.db.insert("storeIntegrations", {
      ...args,
      storefrontUrl,
      lastSyncAt: undefined,
      lastMenuSyncAt: undefined,
      menuSyncStatus: "idle" as const,
      menuSyncError: undefined,
      createdAt: now,
      updatedAt: now,
    })
  },
}

/**
 * Update menu sync status
 */
export const updateMenuSyncStatus = {
  args: {
    storeId: v.id("stores"),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    menuSyncStatus: v.union(
      v.literal("idle"),
      v.literal("syncing"),
      v.literal("success"),
      v.literal("error")
    ),
    menuSyncError: v.optional(v.string()),
  },
  handler: async (ctx: any, args: {
    storeId: string
    platform: "uberEats" | "deliveroo"
    menuSyncStatus: "idle" | "syncing" | "success" | "error"
    menuSyncError?: string
  }) => {
    const existing = await ctx.db
      .query("storeIntegrations")
      .withIndex("by_store_platform", (q: any) =>
        q.eq("storeId", args.storeId).eq("platform", args.platform)
      )
      .unique()

    if (!existing) return null

    const now = Date.now()
    await ctx.db.patch(existing._id, {
      menuSyncStatus: args.menuSyncStatus,
      menuSyncError: args.menuSyncError,
      lastMenuSyncAt: args.menuSyncStatus === "success" ? now : existing.lastMenuSyncAt,
      updatedAt: now,
    })
    return existing._id
  },
}

/**
 * Toggle autoAccept on a store integration
 */
export const toggleAutoAccept = {
  args: {
    storeId: v.id("stores"),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    autoAccept: v.boolean(),
  },
  handler: async (ctx: any, args: {
    storeId: string
    platform: "uberEats" | "deliveroo"
    autoAccept: boolean
  }) => {
    const existing = await ctx.db
      .query("storeIntegrations")
      .withIndex("by_store_platform", (q: any) =>
        q.eq("storeId", args.storeId).eq("platform", args.platform)
      )
      .unique()

    if (!existing) return null

    await ctx.db.patch(existing._id, {
      autoAccept: args.autoAccept,
      updatedAt: Date.now(),
    })
    return existing._id
  },
}

/**
 * Update orderMode on a store integration (per-platform override)
 */
export const updateOrderMode = {
  args: {
    storeId: v.id("stores"),
    platform: v.union(v.literal("uberEats"), v.literal("deliveroo")),
    orderMode: v.union(
      v.literal("auto_accept"),
      v.literal("auto_reject"),
      v.literal("manual")
    ),
  },
  handler: async (ctx: any, args: {
    storeId: string
    platform: "uberEats" | "deliveroo"
    orderMode: "auto_accept" | "auto_reject" | "manual"
  }) => {
    const existing = await ctx.db
      .query("storeIntegrations")
      .withIndex("by_store_platform", (q: any) =>
        q.eq("storeId", args.storeId).eq("platform", args.platform)
      )
      .unique()

    if (!existing) return null

    await ctx.db.patch(existing._id, {
      orderMode: args.orderMode,
      updatedAt: Date.now(),
    })
    return existing._id
  },
}

/**
 * Delete a store integration
 */
export const remove = {
  args: { id: v.id("storeIntegrations") },
  handler: async (ctx: any, args: { id: string }) => {
    await ctx.db.delete(args.id)
  },
}
