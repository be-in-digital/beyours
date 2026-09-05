/**
 * The two campaign settings the send path collected and never read.
 *
 * WHY THIS EXISTS:
 *
 * **A/B testing.** The wizard offers variants, checks their percentages sum to
 * 100, and stores them on the campaign. The send used `campaign.subject` for
 * everyone, `campaign.variants` was read by nothing, and
 * `emailEvents.metadata.variantId` — a field that exists in the schema for
 * exactly this — was never written. So an owner could run a test whose two
 * arms were the same email, and read a result that measured nothing.
 *
 * **`maxEmailsPerWeek`.** Presented in the settings screen as an anti-spam
 * guard, with a default of three and a range of one to a hundred. Nothing
 * anywhere consulted it. A restaurant sending four campaigns in a week sent all
 * four to everyone, having promised itself otherwise.
 */

/** A subject-line variant, as the send path cares about it. */
export interface CampaignVariant {
  id: string
  subject: string
  /** Share of the audience, in percent. The wizard enforces a total of 100. */
  percentage: number
}

/**
 * Mirrors the admin's own default (`email-config-page.tsx`).
 *
 * Used when the stored value is missing or not a positive number. Neither
 * alternative is acceptable: reading it as "no limit" throws the guard away
 * silently, and reading it as zero stops every campaign a restaurant sends.
 * Applying the documented default is the only reading that matches what an
 * unset field means.
 */
export const DEFAULT_MAX_EMAILS_PER_WEEK = 3

/**
 * The highest cap the product offers, mirroring the settings screen's own
 * `z.number().min(1).max(100)` (`email-config-page.tsx`).
 *
 * Repeated here because that bound is client-side only: `emailConfig.upsert`
 * takes a bare `v.number()`, so a seed, a restore or a direct call can store
 * anything. It matters because the cap is not only compared against — it also
 * bounds how many events `sentCountsSince` reads per subscriber, and a cap of
 * a million is not a bound at all.
 *
 * It is also the number `emailEvents` sizes its read ceiling from, so that the
 * count can always reach the cap it is measured against. When those two
 * diverged, the guard inverted above 50 rather than failing loudly.
 */
export const MAX_EMAILS_PER_WEEK = 100

export const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * The cap to enforce for a store, whatever its config happens to hold.
 *
 * Rounded down before it is tested for usability, not after: a stored 0.5 is a
 * positive number that floors to zero, and a cap of zero holds every subscriber
 * back forever — the same silent stop as reading the field as zero, which is
 * what the default exists to avoid.
 */
export function resolveWeeklyCap(configured: unknown): number {
  if (typeof configured !== "number" || !Number.isFinite(configured)) {
    return DEFAULT_MAX_EMAILS_PER_WEEK
  }
  const whole = Math.floor(configured)
  if (whole <= 0) return DEFAULT_MAX_EMAILS_PER_WEEK
  return Math.min(whole, MAX_EMAILS_PER_WEEK)
}

/**
 * A small, stable hash of a string.
 *
 * FNV-1a, chosen for being short enough to read and deterministic across
 * runtimes. It is not a security primitive and nothing here needs one — see
 * `assignVariant` for why determinism is the whole requirement.
 */
function hash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * Which variant this subscriber receives.
 *
 * Deterministic, from the campaign and subscriber ids, and that is the point
 * rather than a detail: a send now runs in batches that can be interrupted,
 * resumed and retried. Drawing at random would mean a retried batch could send
 * arm B to someone who already received arm A — corrupting the very measurement
 * the owner set the test up to take, in a way nothing would report.
 *
 * Returns `null` when there is no test to run, and the caller falls back to the
 * campaign's own subject.
 */
export function assignVariant(
  variants: CampaignVariant[] | undefined,
  campaignId: string,
  subscriberId: string
): CampaignVariant | null {
  if (!variants || variants.length === 0) return null

  const total = variants.reduce((sum, variant) => sum + variant.percentage, 0)
  // The wizard enforces 100, but a campaign saved before that check — or edited
  // around it — must not silently drop the tail of the audience.
  if (total <= 0) return null

  const bucket = hash(`${campaignId}:${subscriberId}`) % total

  let ceiling = 0
  for (const variant of variants) {
    ceiling += variant.percentage
    if (bucket < ceiling) return variant
  }

  // Unreachable while the percentages are positive; the last arm is the honest
  // answer if rounding ever leaves a gap.
  return variants[variants.length - 1] ?? null
}

/** The subject this subscriber should see. */
export function subjectFor(
  campaign: { subject: string; abTestEnabled?: boolean; variants?: CampaignVariant[] },
  subscriberId: string,
  campaignId: string
): { subject: string; variantId?: string } {
  if (!campaign.abTestEnabled) return { subject: campaign.subject }

  const variant = assignVariant(campaign.variants, campaignId, subscriberId)
  if (!variant) return { subject: campaign.subject }

  return { subject: variant.subject, variantId: variant.id }
}

/**
 * May this subscriber receive another campaign email this week?
 *
 * The cap counts what was actually sent, from the events table, rather than a
 * counter that could drift — the same source `alreadySentTo` reads for
 * idempotency, so the two answers cannot disagree.
 */
export function withinWeeklyCap(sentInLastWeek: number, cap: number): boolean {
  return sentInLastWeek < cap
}
