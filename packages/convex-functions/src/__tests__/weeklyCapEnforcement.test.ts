/**
 * The weekly cap has to hold at every value the settings screen offers.
 *
 * `sentCountsSince` stops counting at `countLimit` — correct in itself, because
 * `withinWeeklyCap` only asks whether the count is below the cap, and a count
 * that stopped at the cap answers that identically. The saturation is only
 * harmless while the read reaches the cap, and that is the part that broke: the
 * count was clamped to 50 while the comparison used the configured cap, which
 * the settings screen lets an owner set to 100 (`z.number().min(1).max(100)` in
 * `email-config-page.tsx`).
 *
 * Between 51 and 100 the two numbers disagreed, and the guard inverted. A
 * subscriber with five hundred sends behind them counted 50, `50 < 60` is true,
 * and the campaign sent them another — every batch, forever. The anti-spam
 * promise in the settings screen read as enforced and was not.
 *
 * These hold the invariant that keeps saturation safe: the count must be able
 * to reach the cap it is compared against, at every configurable value.
 */

import { describe, expect, it } from "vitest"
import { sentCountsSince } from "../emailEvents"
import {
  DEFAULT_MAX_EMAILS_PER_WEEK,
  MAX_EMAILS_PER_WEEK,
  resolveWeeklyCap,
  withinWeeklyCap,
} from "../campaignDelivery"

const WEEK_AGO = 1_700_000_000_000 - 7 * 24 * 60 * 60 * 1000

/** A ctx whose subscriber already had `sent` sends inside the window. */
function ctxWithSends(sent: number) {
  const events = Array.from({ length: sent }, (_, i) => ({
    subscriberId: "s1",
    type: "sent",
    occurredAt: WEEK_AGO + i + 1,
  }))
  return {
    db: {
      query: () => ({
        withIndex: (_index: string, fn: (q: unknown) => unknown) => {
          const eq: Record<string, unknown> = {}
          let gte: number | undefined
          const q = {
            eq: (field: string, value: unknown) => {
              eq[field] = value
              return q
            },
            gte: (_field: string, value: number) => {
              gte = value
              return q
            },
          }
          fn(q)
          const matching = events.filter(
            (e) =>
              Object.entries(eq).every(
                ([field, value]) => (e as Record<string, unknown>)[field] === value
              ) && (gte === undefined || e.occurredAt >= gte)
          )
          return { take: async (n: number) => matching.slice(0, n) }
        },
      }),
    },
  }
}

/** What the send path does: resolve the cap, count, then decide. */
async function subscriberMayReceiveAnother(
  configured: unknown,
  alreadySentThisWeek: number
): Promise<boolean> {
  const cap = resolveWeeklyCap(configured)
  const counts = await sentCountsSince.handler(ctxWithSends(alreadySentThisWeek), {
    subscriberIds: ["s1"],
    since: WEEK_AGO,
    countLimit: cap,
  })
  return withinWeeklyCap(counts[0].count, cap)
}

describe("the weekly cap holds at every configurable value", () => {
  // The settings screen validates min(1).max(100). Below 51 this always worked;
  // above it the count could not reach the cap and the guard inverted.
  it.each([1, 2, 3, 25, 49, 50, 51, 60, 75, 99, 100])(
    "a flooded subscriber is held back at a cap of %i",
    async (configured) => {
      expect(await subscriberMayReceiveAnother(configured, 500)).toBe(false)
    }
  )

  it.each([1, 3, 50, 51, 100])(
    "a subscriber one short of a cap of %i still receives",
    async (configured) => {
      const cap = resolveWeeklyCap(configured)
      expect(await subscriberMayReceiveAnother(configured, cap - 1)).toBe(true)
    }
  )

  it("holds exactly at the cap, not one past it", async () => {
    expect(await subscriberMayReceiveAnother(60, 59)).toBe(true)
    expect(await subscriberMayReceiveAnother(60, 60)).toBe(false)
    expect(await subscriberMayReceiveAnother(60, 61)).toBe(false)
  })
})

describe("resolveWeeklyCap", () => {
  it("holds the cap to the maximum the settings screen offers", () => {
    // `emailConfig.upsert` takes a bare `v.number()`, so the screen's max(100)
    // is client-side only and a seed or a restore can store more. The cap also
    // bounds a per-subscriber read, so it needs a ceiling of its own.
    expect(resolveWeeklyCap(100)).toBe(MAX_EMAILS_PER_WEEK)
    expect(resolveWeeklyCap(101)).toBe(MAX_EMAILS_PER_WEEK)
    expect(resolveWeeklyCap(1_000_000)).toBe(MAX_EMAILS_PER_WEEK)
  })

  it("resolves to a whole number, because it bounds a read", () => {
    expect(resolveWeeklyCap(3.7)).toBe(3)
    // Rounded down BEFORE it is tested for usability: 0.5 is a positive number
    // that floors to zero, and a cap of zero holds every subscriber back
    // forever — the silent stop the default exists to avoid.
    expect(resolveWeeklyCap(0.5)).toBe(DEFAULT_MAX_EMAILS_PER_WEEK)
  })

  it("still applies the documented default to junk", () => {
    for (const value of [undefined, null, 0, -1, NaN, Infinity, "3", {}]) {
      expect(resolveWeeklyCap(value)).toBe(DEFAULT_MAX_EMAILS_PER_WEEK)
    }
  })
})

describe("a batch at the largest cap stays under the Convex ceiling", () => {
  it("reads fewer documents than a transaction may scan", () => {
    // The read is `page x cap`. This is the arithmetic that has to keep coming
    // out under 16,384 if either constant is ever raised.
    const BATCH_SIZE = 40 // emailCampaignActions.ts
    expect(BATCH_SIZE * MAX_EMAILS_PER_WEEK).toBeLessThan(16_384)
  })
})
