/**
 * Blog Auto Guards (Package Layer)
 *
 * Backend guard logic for auto-blog feature gating.
 * Called from app-layer mutations, future crons, and actions.
 * Pure logic — no auth, no side effects.
 */

import {
  bumpImageToProductUsage,
  bumpUsage,
  getCurrentPeriodKey,
} from "./blogAutoUsage"

// ============================================================================
// Types
// ============================================================================

export interface AutoBlogAccessResult {
  allowed: boolean
  reason?: string
  entitlements: any | null
  usage: any | null
  remainingQuota: number
}

export interface ImageGenerationAccessResult {
  allowed: boolean
  reason?: string
  remainingImageQuota: number
}

export interface ImageToProductAccessResult {
  allowed: boolean
  reason?: string
  remainingAnalysisQuota: number
}

// ============================================================================
// Guards
// ============================================================================

/**
 * Check auto-blog access for an owner.
 * Returns allowed status, reason, entitlements, usage, and remaining quota.
 */
export async function checkAutoBlogAccess(
  ctx: any,
  ownerId: string
): Promise<AutoBlogAccessResult> {
  // 1. Get entitlements
  const entitlements = await ctx.db
    .query("ownerEntitlements")
    .withIndex("by_ownerId", (q: any) => q.eq("ownerId", ownerId))
    .first()

  if (!entitlements || !entitlements.autoBlog?.enabled) {
    return {
      allowed: false,
      reason: "Aucun abonnement Auto Blog actif",
      entitlements: null,
      usage: null,
      remainingQuota: 0,
    }
  }

  // Check Stripe subscription status if present (manual entitlements skip this)
  if (
    entitlements.subscriptionStatus &&
    !["active", "trialing"].includes(entitlements.subscriptionStatus)
  ) {
    return {
      allowed: false,
      reason: "Abonnement inactif",
      entitlements,
      usage: null,
      remainingQuota: 0,
    }
  }

  const ab = entitlements.autoBlog

  if (!ab.plan) {
    return {
      allowed: false,
      reason: "Aucun plan Auto Blog actif",
      entitlements,
      usage: null,
      remainingQuota: 0,
    }
  }

  // 2. Get current month usage
  const periodKey = getCurrentPeriodKey()
  const usage = await ctx.db
    .query("blogAutoUsage")
    .withIndex("by_ownerId_periodKey", (q: any) =>
      q.eq("ownerId", ownerId).eq("periodKey", periodKey)
    )
    .first()

  const generatedCount = usage?.generatedCount ?? 0
  const remainingQuota = Math.max(0, ab.monthlyQuota - generatedCount)

  if (remainingQuota <= 0) {
    return {
      allowed: false,
      reason: "Quota mensuel atteint",
      entitlements,
      usage,
      remainingQuota: 0,
    }
  }

  return {
    allowed: true,
    entitlements,
    usage,
    remainingQuota,
  }
}

/**
 * Check image generation access for an owner.
 * Returns allowed status, reason, and remaining image quota.
 */
export async function checkImageGenerationAccess(
  ctx: any,
  ownerId: string
): Promise<ImageGenerationAccessResult> {
  // 1. Get entitlements
  const entitlements = await ctx.db
    .query("ownerEntitlements")
    .withIndex("by_ownerId", (q: any) => q.eq("ownerId", ownerId))
    .first()

  if (!entitlements || !entitlements.autoBlog?.enabled) {
    return {
      allowed: false,
      reason: "Aucun abonnement Auto Blog actif",
      remainingImageQuota: 0,
    }
  }

  // Check Stripe subscription status if present
  if (
    entitlements.subscriptionStatus &&
    !["active", "trialing"].includes(entitlements.subscriptionStatus)
  ) {
    return {
      allowed: false,
      reason: "Abonnement inactif",
      remainingImageQuota: 0,
    }
  }

  const ab = entitlements.autoBlog

  if (!ab.plan) {
    return {
      allowed: false,
      reason: "Aucun plan Auto Blog actif",
      remainingImageQuota: 0,
    }
  }

  const monthlyImageQuota = ab.monthlyImageQuota ?? 0
  if (monthlyImageQuota <= 0) {
    return {
      allowed: false,
      reason: "Génération d'images non disponible avec votre plan",
      remainingImageQuota: 0,
    }
  }

  // 2. Get current month usage
  const periodKey = getCurrentPeriodKey()
  const usage = await ctx.db
    .query("blogAutoUsage")
    .withIndex("by_ownerId_periodKey", (q: any) =>
      q.eq("ownerId", ownerId).eq("periodKey", periodKey)
    )
    .first()

  const imageGeneratedCount = usage?.imageGeneratedCount ?? 0
  const remainingImageQuota = Math.max(0, monthlyImageQuota - imageGeneratedCount)

  if (remainingImageQuota <= 0) {
    return {
      allowed: false,
      reason: "Quota mensuel d'images atteint",
      remainingImageQuota: 0,
    }
  }

  return {
    allowed: true,
    remainingImageQuota,
  }
}

/**
 * Check Image-to-Product access for an owner.
 * Returns allowed status, reason, and remaining analysis quota.
 */
export async function checkImageToProductAccess(
  ctx: any,
  ownerId: string
): Promise<ImageToProductAccessResult> {
  // 1. Get entitlements
  const entitlements = await ctx.db
    .query("ownerEntitlements")
    .withIndex("by_ownerId", (q: any) => q.eq("ownerId", ownerId))
    .first()

  if (!entitlements) {
    return {
      allowed: false,
      reason: "Aucun abonnement actif",
      remainingAnalysisQuota: 0,
    }
  }

  // Check Stripe subscription status if present
  if (
    entitlements.subscriptionStatus &&
    !["active", "trialing"].includes(entitlements.subscriptionStatus)
  ) {
    return {
      allowed: false,
      reason: "Abonnement inactif",
      remainingAnalysisQuota: 0,
    }
  }

  const itp = entitlements.imageToProduct
  if (!itp || !itp.enabled) {
    return {
      allowed: false,
      reason: "La fonctionnalité Image vers Produit n'est pas incluse dans votre plan",
      remainingAnalysisQuota: 0,
    }
  }

  const monthlyQuota = itp.monthlyAnalysisQuota ?? 0
  if (monthlyQuota <= 0) {
    return {
      allowed: false,
      reason: "Quota d'analyses non disponible avec votre plan",
      remainingAnalysisQuota: 0,
    }
  }

  // 2. Get current month usage
  const periodKey = getCurrentPeriodKey()
  const usage = await ctx.db
    .query("blogAutoUsage")
    .withIndex("by_ownerId_periodKey", (q: any) =>
      q.eq("ownerId", ownerId).eq("periodKey", periodKey)
    )
    .first()

  const analysisCount = usage?.imageToProductAnalysisCount ?? 0
  const remainingAnalysisQuota = Math.max(0, monthlyQuota - analysisCount)

  if (remainingAnalysisQuota <= 0) {
    return {
      allowed: false,
      reason: "Quota mensuel d'analyses Image vers Produit atteint",
      remainingAnalysisQuota: 0,
    }
  }

  return {
    allowed: true,
    remainingAnalysisQuota,
  }
}

/**
 * Normalize schedule days from a config record.
 * Handles backward compat: old single-number fields → new array fields.
 * Used by guards, UI, and future cron/planner.
 */
export function normalizeScheduleDays(config: {
  frequency: "weekly" | "monthly"
  preferredWeekday?: number
  preferredMonthDay?: number
  preferredWeekdays?: number[]
  preferredMonthDays?: number[]
}): { weekdays: number[]; monthDays: number[] } {
  const weekdays =
    config.preferredWeekdays ??
    (config.preferredWeekday !== undefined ? [config.preferredWeekday] : [])

  const monthDays =
    config.preferredMonthDays ??
    (config.preferredMonthDay !== undefined ? [config.preferredMonthDay] : [])

  return { weekdays, monthDays }
}

// ============================================================================
// Quota reservation
// ============================================================================

export interface QuotaReservation {
  ok: boolean
  reason?: string
  remaining: number
}

/**
 * Take one article out of this month's quota — in the transaction that just
 * checked it was there.
 *
 * The generation action used to check the quota, spend two to five minutes at
 * OpenAI, and only then increment. Ten requests arriving together all read the
 * same count and all passed: measured, ten articles generated against a quota
 * of two, and every one of them billed. Nothing about the check was wrong; the
 * gap after it was.
 *
 * Convex mutations are serializable, so a read and the write that depends on it
 * are atomic when they sit in the same mutation. Reserving here and calling the
 * paid API afterwards is what turns the cap into a cap. The caller releases on
 * failure — an article that was never generated must not cost the owner a slot.
 */
export async function reserveArticleQuota(
  ctx: any,
  ownerId: string,
): Promise<QuotaReservation> {
  const access = await checkAutoBlogAccess(ctx, ownerId)
  if (!access.allowed) {
    return { ok: false, reason: access.reason ?? "Accès refusé", remaining: 0 }
  }

  await bumpUsage(ctx, ownerId, { generated: 1 })
  return { ok: true, remaining: access.remainingQuota - 1 }
}

/** Give an article slot back after a generation that never produced anything. */
export async function releaseArticleQuota(ctx: any, ownerId: string): Promise<void> {
  await bumpUsage(ctx, ownerId, { generated: -1 })
}

/**
 * The same reservation for generated images.
 *
 * An article generates up to four of them — one cover plus three in the body —
 * and each is a `gpt-image-1` call. They were counted by nothing at all: the
 * image quota existed, `checkImageGenerationAccess` read it, and the article
 * pipeline never asked. A plan with five images a month could produce forty in
 * ten articles.
 */
export async function reserveImageQuota(
  ctx: any,
  ownerId: string,
): Promise<QuotaReservation> {
  const access = await checkImageGenerationAccess(ctx, ownerId)
  if (!access.allowed) {
    return {
      ok: false,
      reason: access.reason ?? "Quota d'images atteint",
      remaining: 0,
    }
  }

  await bumpUsage(ctx, ownerId, { images: 1 })
  return { ok: true, remaining: access.remainingImageQuota - 1 }
}

/** Give an image slot back after a generation that returned nothing. */
export async function releaseImageQuota(ctx: any, ownerId: string): Promise<void> {
  await bumpUsage(ctx, ownerId, { images: -1 })
}

/**
 * The same reservation for Image-to-Product analyses.
 *
 * Not named in the audit card, and the identical defect: `imageToProduct`
 * checked the quota, then made three OpenAI calls — a vision pass, an
 * enrichment pass and up to several `gpt-image` generations — and incremented
 * the counter seventy-five lines later. Concurrent requests all read the same
 * count and all passed, exactly as the blog quota did.
 */
export async function reserveImageToProductQuota(
  ctx: any,
  ownerId: string,
): Promise<QuotaReservation> {
  const access = await checkImageToProductAccess(ctx, ownerId)
  if (!access.allowed) {
    return {
      ok: false,
      reason: access.reason ?? "Quota d'analyses atteint",
      remaining: 0,
    }
  }

  await bumpImageToProductUsage(ctx, ownerId, 1)
  return { ok: true, remaining: access.remainingAnalysisQuota - 1 }
}

/** Give an analysis slot back when nothing was produced. */
export async function releaseImageToProductQuota(
  ctx: any,
  ownerId: string,
): Promise<void> {
  await bumpImageToProductUsage(ctx, ownerId, -1)
}

/**
 * What actually happens to a generated article, once the plan has its say.
 *
 * `approvalMode: "auto_publish"` was stored, validated against the plan at
 * config time, and then read by nobody: every generated article was saved as a
 * draft. A subscription sold as "weekly, auto-publish" produced drafts nobody
 * was told about.
 *
 * The plan is checked again here rather than trusted from the config, because
 * a subscription can be downgraded after the config was written and the row
 * does not change when it is.
 */
export function resolveApprovalMode(
  entitlements: any,
  requested: string | undefined,
): "draft_review" | "auto_publish" {
  if (requested !== "auto_publish") return "draft_review"
  return entitlements?.autoBlog?.allowAutoPublish ? "auto_publish" : "draft_review"
}

/**
 * Validate plan-specific limits for a config upsert.
 * Throws with a descriptive French error message if validation fails.
 */
export function validateConfigAgainstPlan(
  entitlements: any,
  config: {
    themes?: string[]
    approvalMode?: string
    autoTranslate?: boolean
    frequency?: "weekly" | "monthly"
    preferredWeekdays?: number[]
    preferredMonthDays?: number[]
    preferredHour?: number
    timezone?: string
  }
): void {
  const ab = entitlements?.autoBlog
  if (!ab || !ab.enabled) {
    throw new Error("Aucun abonnement Auto Blog actif")
  }

  // Check max topics (undefined = unlimited)
  if (
    ab.maxTopics !== undefined &&
    config.themes &&
    config.themes.length > ab.maxTopics
  ) {
    throw new Error(
      `Votre plan ${ab.plan} est limite a ${ab.maxTopics} thematique(s). Passez au plan supérieur pour en ajouter davantage.`
    )
  }

  // Check auto-publish
  if (config.approvalMode === "auto_publish" && !ab.allowAutoPublish) {
    throw new Error(
      `La publication automatique n'est pas disponible avec le plan ${ab.plan}. Passez au plan Pro ou Enterprise.`
    )
  }

  // Check multi-language
  if (config.autoTranslate && !ab.allowMultiLanguage) {
    throw new Error(
      `La traduction automatique n'est pas disponible avec le plan ${ab.plan}. Passez au plan Enterprise.`
    )
  }

  // The hour the owner picked, bounded where it is saved.
  //
  // `upsert` declares `preferredHour: v.number()`; the 0-23 constraint lived
  // only in the client form, so hour 25 stored cleanly and was simply never due
  // — a subscription that produced nothing, with nothing to show why.
  if (config.preferredHour !== undefined) {
    if (
      !Number.isInteger(config.preferredHour) ||
      config.preferredHour < 0 ||
      config.preferredHour > 23
    ) {
      throw new Error("L'heure de publication doit être comprise entre 0 et 23.")
    }
  }

  // A timezone the runtime cannot resolve silently plans on UTC, which is the
  // right hour in the wrong place.
  if (config.timezone !== undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: config.timezone })
    } catch {
      throw new Error(`Fuseau horaire inconnu : ${config.timezone}.`)
    }
  }

  // Check schedule days
  if (config.frequency) {
    const quota: number = ab.monthlyQuota ?? 0

    if (config.frequency === "weekly" && config.preferredWeekdays) {
      // Exclusivity: monthly days must not be provided
      if (config.preferredMonthDays && config.preferredMonthDays.length > 0) {
        throw new Error(
          "En mode hebdomadaire, les jours du mois ne doivent pas être renseignés."
        )
      }

      // Non-empty
      if (config.preferredWeekdays.length === 0) {
        throw new Error("Veuillez sélectionner au moins un jour de la semaine.")
      }

      // Bounds: each day ∈ [0..6]
      if (config.preferredWeekdays.some((d) => d < 0 || d > 6 || !Number.isInteger(d))) {
        throw new Error("Jours de la semaine invalides (attendu : 0-6).")
      }

      // Unique
      if (new Set(config.preferredWeekdays).size !== config.preferredWeekdays.length) {
        throw new Error("Les jours de la semaine doivent être uniques.")
      }

      // Max count
      const maxAllowed = Math.min(quota, 7)
      if (config.preferredWeekdays.length > maxAllowed) {
        throw new Error(
          `Votre plan ${ab.plan} permet de choisir au maximum ${maxAllowed} jour(s) par semaine.`
        )
      }
    }

    if (config.frequency === "monthly" && config.preferredMonthDays) {
      // Exclusivity: weekly days must not be provided
      if (config.preferredWeekdays && config.preferredWeekdays.length > 0) {
        throw new Error(
          "En mode mensuel, les jours de la semaine ne doivent pas être renseignés."
        )
      }

      // Non-empty
      if (config.preferredMonthDays.length === 0) {
        throw new Error("Veuillez sélectionner au moins un jour du mois.")
      }

      // Bounds: each day ∈ [1..28]
      if (config.preferredMonthDays.some((d) => d < 1 || d > 28 || !Number.isInteger(d))) {
        throw new Error("Jours du mois invalides (attendu : 1-28).")
      }

      // Unique
      if (new Set(config.preferredMonthDays).size !== config.preferredMonthDays.length) {
        throw new Error("Les jours du mois doivent être uniques.")
      }

      // Max count
      const maxAllowed = Math.min(quota, 28)
      if (config.preferredMonthDays.length > maxAllowed) {
        throw new Error(
          `Votre plan ${ab.plan} permet de choisir au maximum ${maxAllowed} jour(s) par mois.`
        )
      }
    }
  }
}
