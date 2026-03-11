import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Languages table
 * Dynamic language management (unlimited languages)
 */
export const languagesTable = defineTable({
  storeId: v.id("stores"),
  code: v.string(), // ISO 639-1: "fr", "en", "es"
  name: v.string(), // e.g. "French"
  nativeName: v.string(), // e.g. "Fran\u00e7ais"
  flagEmoji: v.optional(v.string()),
  isDefault: v.boolean(),
  isActive: v.boolean(),
  isRtl: v.boolean(),
  sortOrder: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_code", ["storeId", "code"])

/**
 * Translations table
 * Stores translated content for all entities
 */
export const translationsTable = defineTable({
  storeId: v.id("stores"),
  entityType: v.string(), // "product", "category", "page"
  entityId: v.string(),
  field: v.string(), // "name", "description"
  languageCode: v.string(),
  value: v.string(),
  isAutoTranslated: v.boolean(),
  createdAt: v.optional(v.number()),
  updatedAt: v.number(),
})
  .index("by_storeId_entity", ["storeId", "entityType", "entityId"])
  .index("by_storeId_language", ["storeId", "languageCode"])

/**
 * Translation Jobs table
 * Tracks GPT-3.5 batch translation jobs
 */
export const translationJobsTable = defineTable({
  storeId: v.id("stores"),
  sourceLanguage: v.string(),
  targetLanguage: v.string(),
  entityType: v.string(),
  totalItems: v.number(),
  completedItems: v.number(),
  status: v.union(
    v.literal("pending"),
    v.literal("in_progress"),
    v.literal("completed"),
    v.literal("failed")
  ),
  error: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_status", ["status"])
