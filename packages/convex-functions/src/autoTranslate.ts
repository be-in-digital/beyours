/**
 * Auto-translation functions (incremental + batch)
 *
 * Export plain { args, handler } objects for Convex internalMutation/internalAction wrappers.
 * Scheduling (ctx.scheduler) is handled in the app wrapper since it needs `internal.*` refs.
 *
 * NOTE: This file must NOT import @be-in-digital/core to avoid pulling
 * Node.js-only modules (crypto) into the Convex default runtime bundle.
 * Hash and translation utilities are inlined below.
 */

import { v } from "convex/values"

// ── Constants (exported for app wrapper) ─────────────────────────────────

export const DEBOUNCE_MS = 5000
export const DAILY_QUOTA_LIMIT = 500
export const BATCH_CHUNK_SIZE = 40
export const MAX_TRANSLATION_TEXT_LENGTH = 5000

// Field name → schema meta key prefix (schema uses abbreviated names)
const META_KEY_PREFIX: Record<string, string> = {
  name: "name",
  description: "desc",
}

// Allowed entity types for batch translation (prevents table injection)
const TRANSLATABLE_TABLES = ["products", "categories", "menus"]

// ── Inlined utilities ────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text.trim().replace(/\r\n/g, "\n").replace(/\s+/g, " ")
}

function computeSourceHash(text: string): string {
  const normalized = normalizeText(text)
  let hash = 5381
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16)
}

async function translateViaGPT(
  text: string,
  sourceLang: string,
  targetLang: string,
  context: string,
  apiKey: string | undefined
): Promise<string> {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set")
  }

  if (text.length > MAX_TRANSLATION_TEXT_LENGTH) {
    throw new Error(`Text too long for translation: ${text.length} characters (max ${MAX_TRANSLATION_TEXT_LENGTH})`)
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      temperature: 0.3,
      max_tokens: 2048,
      messages: [
        {
          role: "system",
          content: `You are a professional translator for a ${context}. Translate from ${sourceLang} to ${targetLang}. Preserve formatting and field labels like [name]: and [description]:. Only return the translation, nothing else.`,
        },
        { role: "user", content: text },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>
  }
  return data.choices[0]?.message?.content?.trim() ?? ""
}

// ── Bulk JSON translation via GPT ────────────────────────────────────────

const UI_CHUNK_SIZE = 50

async function translateJsonChunkViaGPT(
  chunk: Record<string, string>,
  sourceLang: string,
  targetLang: string,
  apiKey: string
): Promise<Record<string, string>> {
  const prompt = `Translate the following JSON object values from ${sourceLang} to ${targetLang}. Keep the keys exactly as they are. Keep placeholders like {count}, {amount}, {max}, {time} unchanged. Return ONLY a valid JSON object with the same keys and translated values, no explanation.\n\n${JSON.stringify(chunk, null, 2)}`

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      temperature: 0.3,
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate UI strings from ${sourceLang} to ${targetLang}. Preserve JSON keys, placeholders ({count}, {amount}, etc.), and formatting. Return only valid JSON.`,
        },
        { role: "user", content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>
  }
  const content = data.choices[0]?.message?.content?.trim() ?? ""

  try {
    const jsonStr = content.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "")
    return JSON.parse(jsonStr)
  } catch {
    console.error("[translateUIBulk] Failed to parse GPT response:", content.slice(0, 200))
    return {}
  }
}

/**
 * Action: Translate UI strings via GPT (fetch only, no DB writes).
 * Returns the translated key-value pairs.
 * Must be wrapped as internalAction in the app.
 */
export const translateUIBulkAction = {
  args: {
    targetLang: v.string(),
    sourceLang: v.string(),
    entries: v.record(v.string(), v.string()),
  },
  handler: async (_ctx: any, args: any): Promise<Record<string, string>> => {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set")
    }

    const entries = args.entries as Record<string, string>
    const keys = Object.keys(entries)
    const translated: Record<string, string> = {}

    for (let i = 0; i < keys.length; i += UI_CHUNK_SIZE) {
      const chunkKeys = keys.slice(i, i + UI_CHUNK_SIZE)
      const chunk: Record<string, string> = {}
      for (const k of chunkKeys) {
        if (entries[k] !== undefined) chunk[k] = entries[k]!
      }

      const result = await translateJsonChunkViaGPT(
        chunk,
        args.sourceLang,
        args.targetLang,
        apiKey
      )
      Object.assign(translated, result)
    }

    return translated
  },
}

/**
 * Mutation: Write translated UI strings to the translations table.
 * Must be wrapped as internalMutation in the app.
 */
export const saveUITranslations = {
  args: {
    storeId: v.id("stores"),
    targetLang: v.string(),
    translated: v.record(v.string(), v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const translated = args.translated as Record<string, string>
    const now = Date.now()
    let count = 0

    // Single query: fetch ALL existing UI translations for this store+language
    const existingDocs = await ctx.db
      .query("translations")
      .withIndex("by_storeId_entity", (q: any) =>
        q.eq("storeId", args.storeId)
          .eq("entityType", "ui")
          .eq("entityId", "static")
      )
      .filter((q: any) =>
        q.eq(q.field("languageCode"), args.targetLang)
      )
      .collect()

    // Build lookup map: field → document
    const existingByField = new Map<string, any>()
    for (const doc of existingDocs) {
      existingByField.set(doc.field, doc)
    }

    for (const [key, value] of Object.entries(translated)) {
      if (!value) continue

      const existing = existingByField.get(key)
      if (existing) {
        await ctx.db.patch(existing._id, {
          value,
          isAutoTranslated: true,
          updatedAt: now,
        })
      } else {
        await ctx.db.insert("translations", {
          storeId: args.storeId,
          entityType: "ui",
          entityId: "static",
          field: key,
          languageCode: args.targetLang,
          value,
          isAutoTranslated: true,
          createdAt: now,
          updatedAt: now,
        })
      }
      count++
    }

    return { saved: count }
  },
}

// ── Helper: next midnight UTC ────────────────────────────────────────────

export function nextMidnightUTC(): number {
  const now = new Date()
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ))
  return tomorrow.getTime()
}

// ── executeTranslation ───────────────────────────────────────────────────

/**
 * Execute translation for a single document.
 * Called by the scheduler after the 5s debounce.
 */
export const executeTranslation = {
  args: {
    documentId: v.string(),
    tableName: v.string(),
    storeId: v.id("stores"),
  },
  handler: async (ctx: any, args: any) => {
    const doc = await ctx.db.get(args.documentId as any)

    // Cleanup helper — always runs in all exit paths
    const cleanup = async () => {
      try {
        const current = await ctx.db.get(args.documentId as any)
        if (current) {
          await ctx.db.patch(args.documentId as any, {
            pendingTranslation: false,
            scheduledTranslationJobId: undefined,
          })
        }
      } catch {
        // Document may have been deleted
      }
    }

    try {
      if (!doc) {
        await cleanup()
        return
      }

      // Get store + check/reset quota
      const store = await ctx.db.get(args.storeId)
      if (!store) {
        await cleanup()
        return
      }

      let quota = store.translationQuota ?? {
        dailyLimit: DAILY_QUOTA_LIMIT,
        used: 0,
        resetAt: nextMidnightUTC(),
      }

      // Reset quota on-the-fly if past reset time
      const now = Date.now()
      if (now > quota.resetAt) {
        quota = {
          dailyLimit: quota.dailyLimit,
          used: 0,
          resetAt: nextMidnightUTC(),
        }
        await ctx.db.patch(args.storeId, { translationQuota: quota })
      }

      if (quota.used >= quota.dailyLimit) {
        console.log(`[autoTranslate] Quota exceeded for store ${args.storeId}`)
        await cleanup()
        return
      }

      // Get active languages (skip default — it's the source)
      const allLanguages = await ctx.db
        .query("languages")
        .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
        .collect()

      const defaultLang = allLanguages.find((l: any) => l.isDefault)
      const targetLanguages = allLanguages.filter(
        (l: any) => l.isActive && !l.isDefault
      )

      if (!defaultLang || targetLanguages.length === 0) {
        await cleanup()
        return
      }

      const translatableFields = ["name", "description"]

      // Build source texts
      const sourceTexts: Record<string, string> = {}
      for (const field of translatableFields) {
        if (doc[field]) {
          sourceTexts[field] = doc[field]
        }
      }

      if (Object.keys(sourceTexts).length === 0) {
        await cleanup()
        return
      }

      // Compute source hashes
      const sourceHashes: Record<string, string> = {}
      for (const [field, text] of Object.entries(sourceTexts)) {
        sourceHashes[field] = computeSourceHash(text)
      }

      const translations = { ...(doc.translations ?? {}) }
      let gptCallsMade = 0

      for (const lang of targetLanguages) {
        if (quota.used + gptCallsMade >= quota.dailyLimit) {
          console.log(`[autoTranslate] Quota would be exceeded, stopping`)
          break
        }

        const existing = translations[lang.code] ?? {}
        const meta = existing._meta ?? {}

        // Collect fields that need translation
        const fieldsToTranslate: string[] = []
        const textsToTranslate: string[] = []

        for (const field of translatableFields) {
          if (!sourceTexts[field]) continue
          const prefix = META_KEY_PREFIX[field] ?? field
          // Skip if manually translated
          if (meta[`${prefix}Auto`] === false) continue
          // Skip if hash unchanged
          if (meta[`${prefix}Hash`] === sourceHashes[field]) continue

          fieldsToTranslate.push(field)
          textsToTranslate.push(sourceTexts[field]!)
        }

        if (fieldsToTranslate.length === 0) continue

        // 1 GPT call per language per document
        try {
          const combinedText = fieldsToTranslate
            .map((f, i) => `[${f}]: ${textsToTranslate[i]}`)
            .join("\n")

          const translated = await translateViaGPT(
            combinedText,
            defaultLang.code,
            lang.code,
            `restaurant ${args.tableName}`,
            process.env.OPENAI_API_KEY
          )

          gptCallsMade++

          // Parse response back into fields
          const translatedFields: Record<string, string> = {}
          for (const field of fieldsToTranslate) {
            const regex = new RegExp(`\\[${field}\\]:\\s*(.+?)(?=\\n\\[|$)`, "s")
            const match = translated.match(regex)
            if (match?.[1]) {
              translatedFields[field] = match[1].trim()
            }
          }

          // Concurrence check: re-read to verify source hasn't changed
          const freshDoc = await ctx.db.get(args.documentId as any)
          if (!freshDoc) continue

          let sourceChanged = false
          for (const field of fieldsToTranslate) {
            if (freshDoc[field] !== sourceTexts[field]) {
              sourceChanged = true
              break
            }
          }
          if (sourceChanged) continue

          // Write translated fields
          const updatedLangEntry = { ...existing }
          const updatedMeta = { ...(existing._meta ?? {}) }

          for (const field of fieldsToTranslate) {
            if (translatedFields[field]) {
              const prefix = META_KEY_PREFIX[field] ?? field
              updatedLangEntry[field] = translatedFields[field]
              updatedMeta[`${prefix}Hash`] = sourceHashes[field]
              updatedMeta[`${prefix}Auto`] = true
            }
          }

          updatedLangEntry._meta = updatedMeta
          translations[lang.code] = updatedLangEntry
        } catch (error) {
          console.error(`[autoTranslate] GPT error for ${lang.code}:`, error)
        }
      }

      // Persist translations + update quota
      if (gptCallsMade > 0) {
        await ctx.db.patch(args.documentId as any, { translations })
        await ctx.db.patch(args.storeId, {
          translationQuota: {
            ...quota,
            used: quota.used + gptCallsMade,
          },
        })
      }
    } finally {
      await cleanup()
    }
  },
}

// ── batchChunkCore ───────────────────────────────────────────────────────

/**
 * Core batch translation logic for a chunk of documents.
 * Returns the next cursor index (or null if done) so the app wrapper
 * can schedule the next chunk via internal ref.
 */
export const batchChunkCore = {
  args: {
    storeId: v.id("stores"),
    targetLang: v.string(),
    entityType: v.union(
      v.literal("products"),
      v.literal("categories"),
      v.literal("menus")
    ),
    cursor: v.optional(v.string()),
    jobId: v.optional(v.id("translationJobs")),
  },
  handler: async (ctx: any, args: any): Promise<string | null> => {
    if (!TRANSLATABLE_TABLES.includes(args.entityType)) {
      throw new Error(`Invalid entity type: ${args.entityType}`)
    }

    const allDocs = await ctx.db
      .query(args.entityType)
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()

    const startIdx = args.cursor ? parseInt(args.cursor, 10) : 0
    const chunk = allDocs.slice(startIdx, startIdx + BATCH_CHUNK_SIZE)

    if (chunk.length === 0) {
      if (args.jobId) {
        await ctx.db.patch(args.jobId, {
          status: "completed",
          updatedAt: Date.now(),
        })
      }
      return null
    }

    // Get default language
    const allLanguages = await ctx.db
      .query("languages")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()

    const defaultLang = allLanguages.find((l: any) => l.isDefault)
    if (!defaultLang) return null

    let completedInChunk = 0

    for (const doc of chunk) {
      const sourceTexts: Record<string, string> = {}
      for (const field of ["name", "description"]) {
        if (doc[field]) sourceTexts[field] = doc[field]
      }

      if (Object.keys(sourceTexts).length === 0) {
        completedInChunk++
        continue
      }

      try {
        const combinedText = Object.entries(sourceTexts)
          .map(([f, t]) => `[${f}]: ${t}`)
          .join("\n")

        const translated = await translateViaGPT(
          combinedText,
          defaultLang.code,
          args.targetLang,
          `restaurant ${args.entityType}`,
          process.env.OPENAI_API_KEY
        )

        const translations = { ...(doc.translations ?? {}) }
        const langEntry: Record<string, any> = {}
        const meta: Record<string, any> = {}

        for (const [field, text] of Object.entries(sourceTexts)) {
          const regex = new RegExp(`\\[${field}\\]:\\s*(.+?)(?=\\n\\[|$)`, "s")
          const match = translated.match(regex)
          if (match?.[1]) {
            const prefix = META_KEY_PREFIX[field] ?? field
            langEntry[field] = match[1].trim()
            meta[`${prefix}Hash`] = computeSourceHash(text)
            meta[`${prefix}Auto`] = true
          }
        }

        langEntry._meta = meta
        translations[args.targetLang] = langEntry
        await ctx.db.patch(doc._id, { translations })
        completedInChunk++
      } catch (error) {
        console.error(`[batchChunk] Error translating ${doc._id}:`, error)
        completedInChunk++
      }
    }

    // Update job progress
    if (args.jobId) {
      const job = await ctx.db.get(args.jobId)
      if (job) {
        await ctx.db.patch(args.jobId, {
          completedItems: (job.completedItems ?? 0) + completedInChunk,
          status: "in_progress",
          updatedAt: Date.now(),
        })
      }
    }

    // Return next cursor or null if done
    const nextIdx = startIdx + BATCH_CHUNK_SIZE
    if (nextIdx < allDocs.length) {
      return String(nextIdx)
    }

    // All done
    if (args.jobId) {
      await ctx.db.patch(args.jobId, {
        status: "completed",
        updatedAt: Date.now(),
      })
    }
    return null
  },
}

// ── resetDailyQuota ──────────────────────────────────────────────────────

export const resetDailyQuota = {
  args: { storeId: v.id("stores") },
  handler: async (ctx: any, args: any) => {
    const store = await ctx.db.get(args.storeId)
    if (!store) return

    await ctx.db.patch(args.storeId, {
      translationQuota: {
        dailyLimit: store.translationQuota?.dailyLimit ?? DAILY_QUOTA_LIMIT,
        used: 0,
        resetAt: nextMidnightUTC(),
      },
    })
  },
}
