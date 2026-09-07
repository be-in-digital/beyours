/**
 * Email templates functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { ConvexError, v } from "convex/values"
import {
  automationsReferencing,
  liveCampaignsReferencing,
  quoteNames,
} from "./emailAssetReferences"
import { emailBlockValidator } from "@be-in-digital/convex-schema"

const categoryValidator = v.union(
  v.literal("marketing"),
  v.literal("transactional"),
  v.literal("automation")
)

// === QUERIES ===

export const list = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailTemplates")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()
  },
}

export const getById = {
  args: { id: v.id("emailTemplates") },
  handler: async (ctx: any, args: any) => {
    return await ctx.db.get(args.id)
  },
}

export const listByCategory = {
  args: {
    storeId: v.id("stores"),
    category: categoryValidator,
  },
  handler: async (ctx: any, args: any) => {
    return await ctx.db
      .query("emailTemplates")
      .withIndex("by_storeId_category", (q: any) =>
        q.eq("storeId", args.storeId).eq("category", args.category)
      )
      .collect()
  },
}

// === MUTATIONS ===

export const create = {
  args: {
    storeId: v.id("stores"),
    name: v.string(),
    subject: v.string(),
    previewText: v.optional(v.string()),
    blocks: v.array(emailBlockValidator),
    category: categoryValidator,
    thumbnailUrl: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const now = Date.now()
    return await ctx.db.insert("emailTemplates", {
      ...args,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    })
  },
}

export const update = {
  args: {
    id: v.id("emailTemplates"),
    name: v.optional(v.string()),
    subject: v.optional(v.string()),
    previewText: v.optional(v.string()),
    blocks: v.optional(v.array(emailBlockValidator)),
    category: v.optional(categoryValidator),
    thumbnailUrl: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const { id, ...fields } = args
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() })
  },
}

/**
 * Delete an email template.
 *
 * This was a bare `ctx.db.delete(args.id)`. `emailCampaigns.templateId` is
 * REQUIRED, so deleting a template a scheduled campaign named halted that
 * campaign's send in silence — `sendBatch` read the template, found nothing,
 * logged one line and returned, leaving the campaign at `sending` for ever with
 * the owner's screen still showing "En cours". `emailAutomations.steps[]` holds
 * the same required column and was reachable from no delete path at all.
 *
 * Which references block, and why only some of them, is in
 * `emailAssetReferences.ts`. The short version: a campaign that can still send
 * blocks; a campaign that has finished does not.
 *
 * This is one of two defences and neither replaces the other. This one stops the
 * template going while a send depends on it; `sendBatch` now marks the campaign
 * `failed` with a reason instead of holding, which covers the deletes that
 * happened before this existed and every other way a template can go missing.
 */
export const remove = {
  args: { id: v.id("emailTemplates") },
  handler: async (ctx: any, args: any) => {
    const template = await ctx.db.get(args.id)
    if (!template) throw new Error("Modèle introuvable")

    const campaigns = await liveCampaignsReferencing(
      ctx,
      template.storeId,
      "templateId",
      args.id
    )
    if (campaigns.length > 0) {
      const plural = campaigns.length > 1
      throw new ConvexError({
        code: "template_in_campaign",
        message:
          `Ce modèle est utilisé par ${campaigns.length} campagne${plural ? "s" : ""} ` +
          `en cours ou à venir : ${quoteNames(campaigns)}. ` +
          `Changez ${plural ? "leur" : "son"} modèle ou annulez-${plural ? "les" : "la"} ` +
          "avant de le supprimer.",
      })
    }

    const automations = await automationsReferencing(
      ctx,
      template.storeId,
      "templateId",
      args.id
    )
    if (automations.length > 0) {
      const plural = automations.length > 1
      throw new ConvexError({
        code: "template_in_automation",
        message:
          `Ce modèle est utilisé par ${automations.length} automatisation${plural ? "s" : ""} : ` +
          `${quoteNames(automations)}. Modifiez ${plural ? "ces automatisations" : "cette automatisation"} ` +
          "avant de supprimer le modèle.",
      })
    }

    await ctx.db.delete(args.id)
  },
}

export const duplicate = {
  args: { id: v.id("emailTemplates") },
  handler: async (ctx: any, args: any) => {
    const original = await ctx.db.get(args.id)
    if (!original) throw new Error("Modèle introuvable")
    const now = Date.now()
    return await ctx.db.insert("emailTemplates", {
      storeId: original.storeId,
      name: `${original.name} (copie)`,
      subject: original.subject,
      previewText: original.previewText,
      blocks: original.blocks,
      category: original.category,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    })
  },
}
