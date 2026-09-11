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

// The catalogue fields worth sending to a translator. `slug` is deliberately
// absent: it is a URL segment, and translating it would break every link.
const TRANSLATABLE_FIELDS = ["name", "description"]

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

// ── executeTranslation: query → fetch → mutation ─────────────────────────
//
// A Convex mutation may not call `fetch`, and every one of these paths reaches
// OpenAI. So the work is split three ways, exactly as `cmsAutoTranslate` does
// it: an internal query reads the document and decides what is worth sending,
// a plain async function does the HTTP, and an internal mutation writes the
// result back inside a fresh transaction. The app wrapper registers the query
// and the mutation, and an `internalAction` chains them — the chaining lives
// there because it needs `internal.*`, which a package cannot reference.

/** A single language's worth of work: which fields still need translating. */
export interface TranslationTarget {
  code: string
  fields: string[]
}

/** Everything the fetch step needs, read in one transaction. */
export interface TranslationPlan {
  sourceLang: string
  /** field → source text, as read at plan time. The staleness check re-compares these. */
  sourceTexts: Record<string, string>
  /** field → hash of the source text, stored alongside the translation. */
  sourceHashes: Record<string, string>
  /** Free-text hint for the model, e.g. "restaurant products". */
  context: string
  /** Quota with the daily reset already applied — the mutation persists it. */
  quota: { dailyLimit: number; used: number; resetAt: number }
  /** True when `quota` differs from what is stored, i.e. the reset must be written. */
  quotaWasReset: boolean
  targets: TranslationTarget[]
}

const quotaValidator = v.object({
  dailyLimit: v.number(),
  used: v.number(),
  resetAt: v.number(),
})

/**
 * The store's quota with the daily reset applied in memory.
 *
 * A query cannot write, so the reset is computed here and persisted by
 * whichever mutation runs next. A store whose quota never gets written back
 * simply recomputes the same reset on its next translation.
 */
function effectiveQuota(
  stored: { dailyLimit: number; used: number; resetAt: number } | undefined,
  now: number
): { quota: { dailyLimit: number; used: number; resetAt: number }; wasReset: boolean } {
  const quota = stored ?? {
    dailyLimit: DAILY_QUOTA_LIMIT,
    used: 0,
    resetAt: nextMidnightUTC(),
  }

  if (now > quota.resetAt) {
    return {
      quota: { dailyLimit: quota.dailyLimit, used: 0, resetAt: nextMidnightUTC() },
      wasReset: true,
    }
  }

  return { quota, wasReset: stored === undefined }
}

/**
 * Internal query: decide what to translate for one document.
 *
 * Returns `null` when there is nothing to do — no document, no store, quota
 * spent, no second active language, no translatable text, or every field
 * already translated from the same source. The caller must still run
 * `finishTranslation` in that case, so the document does not sit `pending`
 * for ever.
 */
export const getTranslationPlan = {
  args: {
    documentId: v.string(),
    tableName: v.string(),
    storeId: v.id("stores"),
  },
  handler: async (ctx: any, args: any): Promise<TranslationPlan | null> => {
    const doc = await ctx.db.get(args.documentId as any)
    if (!doc) return null

    const store = await ctx.db.get(args.storeId)
    if (!store) return null

    const { quota, wasReset } = effectiveQuota(store.translationQuota, Date.now())
    if (quota.used >= quota.dailyLimit) {
      console.log(`[autoTranslate] Quota exceeded for store ${args.storeId}`)
      return null
    }

    // Active languages, minus the default — that one is the source.
    const allLanguages = await ctx.db
      .query("languages")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()

    const defaultLang = allLanguages.find((l: any) => l.isDefault)
    const targetLanguages = allLanguages.filter(
      (l: any) => l.isActive && !l.isDefault
    )

    if (!defaultLang || targetLanguages.length === 0) return null

    const sourceTexts: Record<string, string> = {}
    for (const field of TRANSLATABLE_FIELDS) {
      if (doc[field]) sourceTexts[field] = doc[field]
    }
    if (Object.keys(sourceTexts).length === 0) return null

    const sourceHashes: Record<string, string> = {}
    for (const [field, text] of Object.entries(sourceTexts)) {
      sourceHashes[field] = computeSourceHash(text)
    }

    const existingTranslations = (doc.translations ?? {}) as Record<string, any>
    const targets: TranslationTarget[] = []

    for (const lang of targetLanguages) {
      const existing = existingTranslations[lang.code] ?? {}
      const meta = existing._meta ?? {}
      const fields: string[] = []

      for (const field of TRANSLATABLE_FIELDS) {
        if (!sourceTexts[field]) continue
        const prefix = META_KEY_PREFIX[field] ?? field
        // A human edited this translation — never overwrite it.
        if (meta[`${prefix}Auto`] === false) continue
        // The source has not changed since the last translation.
        if (meta[`${prefix}Hash`] === sourceHashes[field]) continue
        fields.push(field)
      }

      if (fields.length > 0) targets.push({ code: lang.code, fields })
    }

    if (targets.length === 0) return null

    return {
      sourceLang: defaultLang.code,
      sourceTexts,
      sourceHashes,
      context: `restaurant ${args.tableName}`,
      quota,
      quotaWasReset: wasReset,
      targets,
    }
  },
}

/** One language's translated fields, as produced by the fetch step. */
export interface TranslationResult {
  languageCode: string
  fields: Record<string, string>
}

/** Fields that must never span lines. A product name that does is not a name. */
const SINGLE_LINE_FIELDS = new Set(["name"])

/** Escape a field name for use inside a RegExp. */
function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Split a GPT reply back into the fields it was asked to translate.
 *
 * The prompt labels each field `[name]: …`, and the reply is cut on those
 * labels — every label is located in one pass and each value runs to the next
 * one. A per-field regex cannot do this: `\s*` after the label crosses a
 * newline, so a field the model answered empty swallowed the label after it
 * and the product ended up named `[description]:`, on the customer's menu.
 *
 * A field the model dropped is simply absent from the result and stays in the
 * source language — better than writing the whole reply into one field.
 */
export function parseLabelledFields(
  translated: string,
  fields: string[]
): Record<string, string> {
  const parsed: Record<string, string> = {}
  if (fields.length === 0) return parsed

  // Models wrap answers in fences often enough to be worth stripping; the
  // JSON translator already does it, and this one did not.
  const body = translated
    .replace(/^\s*```[a-z]*\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")

  const labelPattern = fields.map(escapeForRegExp).join("|")
  const labels = new RegExp(`\\[(${labelPattern})\\]\\s*:[ \\t]*`, "g")

  const hits: Array<{ field: string; valueStart: number; labelStart: number }> = []
  let match: RegExpExecArray | null
  while ((match = labels.exec(body)) !== null) {
    hits.push({
      field: match[1]!,
      labelStart: match.index,
      valueStart: labels.lastIndex,
    })
  }

  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]!
    const stop = i + 1 < hits.length ? hits[i + 1]!.labelStart : body.length
    let value = body.slice(hit.valueStart, stop).trim()

    // A name runs to the end of its line and no further, which is also what
    // keeps trailing model chatter out of the last field on the reply.
    if (SINGLE_LINE_FIELDS.has(hit.field)) {
      value = (value.split("\n")[0] ?? "").trim()
    }

    if (value) parsed[hit.field] = value
  }

  return parsed
}

/**
 * The fetch step: one GPT call per language, inside an action.
 *
 * Stops as soon as the plan's quota would be exceeded, and swallows a
 * per-language failure so one bad language does not lose the others.
 */
export async function runTranslationPlan(
  plan: TranslationPlan,
  apiKey: string | undefined
): Promise<{ results: TranslationResult[]; gptCalls: number }> {
  const results: TranslationResult[] = []
  let gptCalls = 0

  for (const target of plan.targets) {
    if (plan.quota.used + gptCalls >= plan.quota.dailyLimit) {
      console.log(`[autoTranslate] Quota would be exceeded, stopping`)
      break
    }

    try {
      const combinedText = target.fields
        .map((f) => `[${f}]: ${plan.sourceTexts[f]}`)
        .join("\n")

      const translated = await translateViaGPT(
        combinedText,
        plan.sourceLang,
        target.code,
        plan.context,
        apiKey
      )

      gptCalls++

      const fields = parseLabelledFields(translated, target.fields)
      if (Object.keys(fields).length > 0) {
        results.push({ languageCode: target.code, fields })
      }
    } catch (error) {
      console.error(`[autoTranslate] GPT error for ${target.code}:`, error)
    }
  }

  return { results, gptCalls }
}

/**
 * Internal mutation: clear the pending flags and nothing else.
 *
 * Every exit path of the action ends here, including the ones that translated
 * nothing — a document left `pendingTranslation: true` would show a spinner
 * that never stops and would block the next debounce from cancelling cleanly.
 */
export const finishTranslation = {
  args: { documentId: v.string() },
  handler: async (ctx: any, args: any) => {
    const current = await ctx.db.get(args.documentId as any)
    if (!current) return
    await ctx.db.patch(args.documentId as any, {
      pendingTranslation: false,
      scheduledTranslationJobId: undefined,
    })
  },
}

/**
 * Internal mutation: write the translations back.
 *
 * Re-reads the document first: the source may have been edited while GPT was
 * answering, and a translation of text nobody is showing any more is worse
 * than none. The staleness check is per field, so an edit to the description
 * does not discard a freshly translated name.
 */
export const saveDocumentTranslations = {
  args: {
    documentId: v.string(),
    storeId: v.id("stores"),
    sourceTexts: v.record(v.string(), v.string()),
    sourceHashes: v.record(v.string(), v.string()),
    results: v.array(
      v.object({
        languageCode: v.string(),
        fields: v.record(v.string(), v.string()),
      })
    ),
    gptCalls: v.number(),
    quota: quotaValidator,
    quotaWasReset: v.boolean(),
  },
  handler: async (ctx: any, args: any) => {
    const doc = await ctx.db.get(args.documentId as any)

    if (doc) {
      const sourceTexts = args.sourceTexts as Record<string, string>
      const sourceHashes = args.sourceHashes as Record<string, string>
      const translations = { ...((doc.translations ?? {}) as Record<string, any>) }
      let wrote = false

      for (const result of args.results as TranslationResult[]) {
        const existing = translations[result.languageCode] ?? {}
        const updatedEntry: Record<string, any> = { ...existing }
        const updatedMeta: Record<string, any> = { ...(existing._meta ?? {}) }
        let wroteLang = false

        for (const [field, value] of Object.entries(result.fields)) {
          // Concurrency check: the source changed under us, drop this field.
          if (doc[field] !== sourceTexts[field]) continue
          const prefix = META_KEY_PREFIX[field] ?? field
          updatedEntry[field] = value
          updatedMeta[`${prefix}Hash`] = sourceHashes[field]
          updatedMeta[`${prefix}Auto`] = true
          wroteLang = true
        }

        if (wroteLang) {
          updatedEntry._meta = updatedMeta
          translations[result.languageCode] = updatedEntry
          wrote = true
        }
      }

      await ctx.db.patch(args.documentId as any, {
        ...(wrote ? { translations } : {}),
        pendingTranslation: false,
        scheduledTranslationJobId: undefined,
      })
    }

    // The quota is billed on calls made, not on translations kept: a reply the
    // staleness check discarded was still paid for. Billed even when the
    // document vanished mid-flight, for the same reason.
    await billQuota(ctx, args.storeId, args.gptCalls, args.quota.resetAt)
  },
}

/**
 * Bill GPT calls against the store's quota, from the value stored *now*.
 *
 * The plan's snapshot cannot be trusted for this. It was read in a separate
 * query transaction, so ten translations in flight all read `used: 0` and all
 * wrote `0 + 1` — measured: ten documents translated, `used` recorded as 1.
 * That is precisely the burst the quota exists to bound. Re-reading inside the
 * mutation makes the increment atomic, because a mutation is.
 */
async function billQuota(
  ctx: any,
  storeId: any,
  calls: number,
  fallbackResetAt: number
): Promise<void> {
  if (calls <= 0) return

  const store = await ctx.db.get(storeId)
  if (!store) return

  const stored = store.translationQuota
  const now = Date.now()

  // A stored quota whose window has closed starts again at zero.
  const base =
    stored && now <= stored.resetAt
      ? stored
      : {
          dailyLimit: stored?.dailyLimit ?? DAILY_QUOTA_LIMIT,
          used: 0,
          resetAt: stored && now > stored.resetAt ? nextMidnightUTC() : fallbackResetAt,
        }

  await ctx.db.patch(storeId, {
    translationQuota: {
      dailyLimit: base.dailyLimit,
      used: base.used + calls,
      resetAt: base.resetAt,
    },
  })
}

// ── batchChunk: query → fetch → mutation ─────────────────────────────────

/** One document's translatable text, as read by the batch planner. */
export interface BatchDocument {
  documentId: string
  texts: Record<string, string>
}

export interface BatchChunkPlan {
  sourceLang: string
  documents: BatchDocument[]
  /** Documents this chunk need not translate — empty, or already current. */
  skippedCount: number
  /** Creation time of the last document in this chunk, or null when done. */
  nextCursor: string | null
  /** The window the batch may bill against; the mutation re-reads it to bill. */
  quotaResetAt: number
  /** True when the store's daily budget is spent — stop the batch, do not chunk on. */
  quotaExhausted: boolean
}

/**
 * Internal query: read one chunk of a batch translation.
 *
 * Returns `null` only when the batch cannot proceed at all (unknown entity
 * type is rejected outright; no default language means there is no source to
 * translate from). An empty chunk is a normal end-of-batch and comes back with
 * `documents: []` and `nextCursor: null`, so the caller can close the job.
 */
export const getBatchChunkPlan = {
  args: {
    storeId: v.id("stores"),
    targetLang: v.string(),
    entityType: v.union(
      v.literal("products"),
      v.literal("categories"),
      v.literal("menus")
    ),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any): Promise<BatchChunkPlan | null> => {
    if (!TRANSLATABLE_TABLES.includes(args.entityType)) {
      throw new Error(`Invalid entity type: ${args.entityType}`)
    }

    const store = await ctx.db.get(args.storeId)
    if (!store) return null

    const { quota } = effectiveQuota(store.translationQuota, Date.now())
    const remaining = quota.dailyLimit - quota.used

    const allLanguages = await ctx.db
      .query("languages")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()

    const defaultLang = allLanguages.find((l: any) => l.isDefault)
    if (!defaultLang) return null

    if (remaining <= 0) {
      console.log(`[batchChunk] Quota exceeded for store ${args.storeId}`)
      return {
        sourceLang: defaultLang.code,
        documents: [],
        skippedCount: 0,
        nextCursor: null,
        quotaResetAt: quota.resetAt,
        quotaExhausted: true,
      }
    }

    const allDocs = await ctx.db
      .query(args.entityType)
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()

    // The cursor is a creation time, not an index into this list. An index is
    // only stable while nothing is inserted or deleted mid-batch, and a delete
    // during chunk 0 made the chunk-boundary document step past itself — it
    // was never translated, and the job still reported 45/45 completed.
    const after = args.cursor ? Number(args.cursor) : null
    const pending =
      after === null || Number.isNaN(after)
        ? allDocs
        : allDocs.filter((doc: any) => doc._creationTime > after)

    const chunk = pending.slice(0, BATCH_CHUNK_SIZE)
    const last = chunk[chunk.length - 1]
    const nextCursor =
      last && pending.length > chunk.length ? String(last._creationTime) : null

    const documents: BatchDocument[] = []
    let skippedCount = 0

    let budgetStopped = false

    for (const doc of chunk) {
      // The budget is per chunk as well as per day: one GPT call per document.
      if (documents.length >= remaining) {
        budgetStopped = true
        break
      }

      const texts: Record<string, string> = {}
      const existing = ((doc.translations ?? {}) as Record<string, any>)[
        args.targetLang
      ] ?? {}
      const meta = existing._meta ?? {}

      for (const field of TRANSLATABLE_FIELDS) {
        if (!doc[field]) continue
        const prefix = META_KEY_PREFIX[field] ?? field
        // Same two rules the incremental path applies: never overwrite a
        // human, never pay twice for text that has not changed. Without them
        // a second "add language" click re-translated the whole catalogue.
        if (meta[`${prefix}Auto`] === false) continue
        if (meta[`${prefix}Hash`] === computeSourceHash(doc[field])) continue
        texts[field] = doc[field]
      }

      if (Object.keys(texts).length === 0) {
        skippedCount++
        continue
      }

      documents.push({ documentId: doc._id, texts })
    }

    // A run cut short by the budget stops here — and says so. Reporting it as
    // finished would tell the owner their catalogue is translated when part of
    // it never reached GPT.
    const outOfBudget = budgetStopped || (documents.length >= remaining && nextCursor !== null)

    return {
      sourceLang: defaultLang.code,
      documents,
      skippedCount,
      nextCursor: outOfBudget ? null : nextCursor,
      quotaResetAt: quota.resetAt,
      quotaExhausted: outOfBudget,
    }
  },
}

/** One document's batch translation, ready to be written. */
export interface BatchResult {
  documentId: string
  fields: Record<string, string>
  hashes: Record<string, string>
}

/**
 * The fetch step for a batch chunk: one GPT call per document.
 *
 * A document whose call fails still counts as attempted, so a failing chunk
 * cannot stall the job's progress bar for ever.
 */
export async function runBatchChunkPlan(
  plan: BatchChunkPlan,
  targetLang: string,
  context: string,
  apiKey: string | undefined
): Promise<{ results: BatchResult[]; attempted: number; gptCalls: number }> {
  const results: BatchResult[] = []
  let attempted = 0
  let gptCalls = 0

  for (const doc of plan.documents) {
    attempted++
    try {
      const fieldNames = Object.keys(doc.texts)
      const combinedText = fieldNames
        .map((f) => `[${f}]: ${doc.texts[f]}`)
        .join("\n")

      const translated = await translateViaGPT(
        combinedText,
        plan.sourceLang,
        targetLang,
        context,
        apiKey
      )

      // Billed on the call, not on the answer: a reply that parsed to nothing
      // still reached OpenAI and still cost money.
      gptCalls++

      const fields = parseLabelledFields(translated, fieldNames)
      const hashes: Record<string, string> = {}
      for (const field of Object.keys(fields)) {
        hashes[field] = computeSourceHash(doc.texts[field]!)
      }

      if (Object.keys(fields).length > 0) {
        results.push({ documentId: doc.documentId, fields, hashes })
      }
    } catch (error) {
      console.error(`[batchChunk] Error translating ${doc.documentId}:`, error)
    }
  }

  return { results, attempted, gptCalls }
}

/**
 * Internal mutation: write one batch chunk and advance the job.
 *
 * `completed` counts documents dealt with — translated, empty or failed — so
 * `completedItems` reaches `totalItems` even on a partially failing run.
 */
export const saveBatchChunk = {
  args: {
    storeId: v.id("stores"),
    targetLang: v.string(),
    results: v.array(
      v.object({
        documentId: v.string(),
        fields: v.record(v.string(), v.string()),
        hashes: v.record(v.string(), v.string()),
      })
    ),
    completed: v.number(),
    gptCalls: v.number(),
    quotaResetAt: v.number(),
    isLastChunk: v.boolean(),
    quotaExhausted: v.boolean(),
    jobId: v.optional(v.id("translationJobs")),
  },
  handler: async (ctx: any, args: any) => {
    for (const result of args.results as BatchResult[]) {
      const doc = await ctx.db.get(result.documentId as any)
      if (!doc) continue

      const translations = { ...((doc.translations ?? {}) as Record<string, any>) }
      const existing = translations[args.targetLang] ?? {}
      const entry: Record<string, any> = { ...existing }
      const meta: Record<string, any> = { ...(existing._meta ?? {}) }
      let wrote = false

      for (const [field, value] of Object.entries(result.fields)) {
        const prefix = META_KEY_PREFIX[field] ?? field
        // A manual translation outranks the batch, same rule as the
        // incremental path.
        if (meta[`${prefix}Auto`] === false) continue

        // Staleness: the batch had no such check, so renaming a dish while a
        // batch ran wrote a translation of the old text stamped with the old
        // hash — and because the batch never re-reads hashes, the wrong name
        // stayed on the storefront until someone edited that product again.
        const current = doc[field]
        if (typeof current !== "string" || computeSourceHash(current) !== result.hashes[field]) {
          continue
        }

        entry[field] = value
        meta[`${prefix}Hash`] = result.hashes[field]
        meta[`${prefix}Auto`] = true
        wrote = true
      }

      if (!wrote) continue

      entry._meta = meta
      translations[args.targetLang] = entry
      await ctx.db.patch(result.documentId as any, { translations })
    }

    // The batch bills the same quota as the incremental path. It did not
    // before: `translateCatalogue` is fired three times by the admin on every
    // language added, so a three-hundred-product catalogue spent ~900
    // unmetered OpenAI calls in one click.
    await billQuota(ctx, args.storeId, args.gptCalls, args.quotaResetAt)

    if (args.jobId) {
      const job = await ctx.db.get(args.jobId)
      if (job) {
        await ctx.db.patch(args.jobId, {
          completedItems: (job.completedItems ?? 0) + args.completed,
          // A batch stopped by the budget is not "completed" — saying so would
          // tell the owner their catalogue is translated when it is not.
          status: args.quotaExhausted
            ? "failed"
            : args.isLastChunk
              ? "completed"
              : "in_progress",
          ...(args.quotaExhausted
            ? { error: "Daily translation quota reached — resumes after the next reset" }
            : {}),
          updatedAt: Date.now(),
        })
      }
    }
  },
}

/**
 * Internal mutation: open a batch translation job.
 *
 * Returns the job id and how many documents it covers, so the action that
 * starts the batch can report progress from the first chunk.
 */
export const createBatchJob = {
  args: {
    storeId: v.id("stores"),
    targetLang: v.string(),
    entityType: v.union(
      v.literal("products"),
      v.literal("categories"),
      v.literal("menus")
    ),
  },
  handler: async (ctx: any, args: any): Promise<{ jobId: string; totalItems: number }> => {
    if (!TRANSLATABLE_TABLES.includes(args.entityType)) {
      throw new Error(`Invalid entity type: ${args.entityType}`)
    }

    const allLanguages = await ctx.db
      .query("languages")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()

    const defaultLang = allLanguages.find((l: any) => l.isDefault)
    if (!defaultLang) throw new Error("No default language configured for this store")
    if (defaultLang.code === args.targetLang) {
      throw new Error("Cannot translate a store into its own default language")
    }

    const target = allLanguages.find(
      (l: any) => l.code === args.targetLang && l.isActive
    )
    if (!target) throw new Error(`Language not active for this store: ${args.targetLang}`)

    const docs = await ctx.db
      .query(args.entityType)
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      .collect()

    const now = Date.now()
    const jobId = await ctx.db.insert("translationJobs", {
      storeId: args.storeId,
      sourceLanguage: defaultLang.code,
      targetLanguage: args.targetLang,
      entityType: args.entityType,
      totalItems: docs.length,
      completedItems: 0,
      status: "pending" as const,
      createdAt: now,
      updatedAt: now,
    })

    return { jobId, totalItems: docs.length }
  },
}

/**
 * How many translation runs the owner's screen shows.
 *
 * One per entity type per language, and the admin fires three at a time —
 * products, categories, menus — so twelve covers the last four languages
 * added. Bounded for the reason every read in this repository is: an
 * establishment that has been adding languages for two years must not turn
 * opening a screen into a table walk.
 */
export const TRANSLATION_JOB_PAGE = 12

/**
 * The recent catalogue translation runs, most recent first.
 *
 * WHY THIS EXISTS (#95). `translateCatalogue` writes a `translationJobs` row
 * and `runBatchChunkPlan` keeps it up to date — `completedItems`, `status`, and
 * the `error` when the daily quota stops a run. Nothing read any of it:
 *
 *     $ grep -rn 'query("translationJobs")' packages apps
 *     (no output)
 *
 * So a back-fill that stopped on the quota looked exactly like one that
 * finished. The owner adds German, the toast says « Traduction du catalogue
 * lancée : 300 éléments », the run stops at 80, and the first evidence anybody
 * gets is a German storefront with French dish names on it.
 *
 * `languages-page.tsx` said so in its own comment — *"The row is not the
 * missing half: a query over `by_storeId` and somewhere on this page to render
 * it is"* — and this is that query.
 *
 * `by_storeId` then sorted in memory: the index is not on time, and twelve rows
 * are cheaper to sort than an index is to maintain on every write.
 */
export const listJobs = {
  args: {
    storeId: v.id("stores"),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx: any,
    args: { storeId: string; limit?: number }
  ): Promise<
    Array<{
      _id: string
      targetLanguage: string
      entityType: string
      status: string
      totalItems: number
      completedItems: number
      error?: string
      updatedAt: number
    }>
  > => {
    const limit = Math.min(Math.max(args.limit ?? TRANSLATION_JOB_PAGE, 1), 50)
    const rows = await ctx.db
      .query("translationJobs")
      .withIndex("by_storeId", (q: any) => q.eq("storeId", args.storeId))
      // One more than the window, so the scan stays bounded while an
      // establishment accumulates runs.
      .take(limit * 4)

    return rows
      .sort((a: any, b: any) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, limit)
      .map((job: any) => ({
        _id: job._id,
        targetLanguage: job.targetLanguage,
        entityType: job.entityType,
        status: job.status,
        totalItems: job.totalItems ?? 0,
        completedItems: job.completedItems ?? 0,
        ...(job.error ? { error: job.error } : {}),
        updatedAt: job.updatedAt ?? job.createdAt ?? 0,
      }))
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

// ── Helper: did this write touch anything worth translating? ─────────────

/**
 * True when an update carries a field the translator cares about.
 *
 * A price change or a stock toggle must not book a GPT round trip, and must
 * not flag the document `pendingTranslation` — the plan would find nothing to
 * do and the admin would have watched a spinner for no reason.
 */
export function touchesTranslatableText(
  args: Record<string, unknown>
): boolean {
  return TRANSLATABLE_FIELDS.some((field) => args[field] !== undefined)
}
