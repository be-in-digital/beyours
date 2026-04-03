/**
 * Email templates functions
 *
 * Export plain { args, handler } objects for Convex query/mutation wrappers
 */

import { v } from "convex/values"
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

export const remove = {
  args: { id: v.id("emailTemplates") },
  handler: async (ctx: any, args: any) => {
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
