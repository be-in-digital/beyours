/**
 * CMS App Wrappers (Pages & Blocks)
 *
 * Auth-protected wrappers around package-level CMS functions.
 * No media mutations here — those are in cmsMedia.ts.
 */

// Initialize CMS registry with app-specific pages (must run before any handler)
import { setCmsRegistry } from "@beindigital-engine/cms"
import { appCmsConfig } from "../cms"
setCmsRegistry(appCmsConfig)

import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import * as cmsDefs from "@beindigital-engine/convex-functions/cms"
import * as cmsPublishDefs from "@beindigital-engine/convex-functions/cmsPublish"
import { publishPageCore } from "@beindigital-engine/convex-functions/cmsPublish"
import { saveDraftBlockCore } from "@beindigital-engine/convex-functions/cms"
import { scheduleCmsTranslation, schedulePageTranslation } from "./cmsAutoTranslate"

// ============================================================================
// Queries
// ============================================================================

/** List all CMS pages for a store (public) */
export const listPages = query(cmsDefs.listPages)

/** Get page status (public) */
export const getPage = query(cmsDefs.getPage)

/** Get published blocks for storefront (public, no auth) */
export const getPageBlocks = query(cmsDefs.getPageBlocks)

/** Get draft + published blocks for admin editor (auth-protected) */
export const getAdminPageBlocks = query({
  args: cmsDefs.getAdminPageBlocks.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return cmsDefs.getAdminPageBlocks.handler(ctx, args)
  },
})

/** Get preview blocks: draft > published (auth-protected) */
export const getPreviewPageBlocks = query({
  args: cmsDefs.getPreviewPageBlocks.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return cmsDefs.getPreviewPageBlocks.handler(ctx, args)
  },
})

/** Get a single block draft (auth-protected) */
export const getBlockDraft = query({
  args: cmsDefs.getBlockDraft.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return cmsDefs.getBlockDraft.handler(ctx, args)
  },
})

// ============================================================================
// Mutations
// ============================================================================

/** Save draft block — built via saveDraftBlockCore helper */
export const saveDraftBlock = mutation({
  args: {
    storeId: v.id("stores"),
    pageSlug: v.string(),
    blockKey: v.string(),
    values: v.any(),
    updatedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    return saveDraftBlockCore(ctx, args, {
      onAfterSave: scheduleCmsTranslation,
    })
  },
})

/** Reset a single field to fallback */
export const resetField = mutation({
  args: cmsDefs.resetField.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return cmsDefs.resetField.handler(ctx, args)
  },
})

/** Reset an entire block */
export const resetBlock = mutation({
  args: cmsDefs.resetBlock.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return cmsDefs.resetBlock.handler(ctx, args)
  },
})

/** Reset all blocks for a page */
export const resetPage = mutation({
  args: cmsDefs.resetPage.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return cmsDefs.resetPage.handler(ctx, args)
  },
})

/** Translate all text fields of a page at once */
export const translateAllPageFields = mutation({
  args: {
    storeId: v.id("stores"),
    pageSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    // Check target languages exist
    const allLanguages = await ctx.db
      .query("languages")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasTargetLangs = allLanguages.some((l: any) => l.isActive && !l.isDefault)
    if (!hasTargetLangs) {
      throw new Error("Aucune langue cible active. Ajoutez des langues dans Paramètres > Langues.")
    }

    await schedulePageTranslation(ctx, args.storeId, args.pageSlug)
  },
})

/** Publish all draft blocks for a page */
export const publishPage = mutation({
  args: cmsPublishDefs.publishPage.args,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")
    return publishPageCore(ctx, args, {
      onAfterPublish: scheduleCmsTranslation,
    })
  },
})
