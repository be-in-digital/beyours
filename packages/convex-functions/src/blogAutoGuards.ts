/**
 * Blog Auto Guards (Package Layer)
 *
 * Backend guard logic for auto-blog feature gating.
 * Called from app-layer mutations, future crons, and actions.
 * Pure logic — no auth, no side effects.
 */

import { getCurrentPeriodKey } from "./blogAutoUsage"

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
 * Validate plan-specific limits for a config upsert.
 * Throws with a descriptive French error message if validation fails.
 */
export function validateConfigAgainstPlan(
  entitlements: any,
  config: {
    themes?: string[]
    approvalMode?: string
    autoTranslate?: boolean
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
      `Votre plan ${ab.plan} est limite a ${ab.maxTopics} thematique(s). Passez au plan superieur pour en ajouter davantage.`
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
}
