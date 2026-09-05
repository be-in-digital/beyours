import { describe, expect, it } from "vitest"
import {
  DEFAULT_MAX_EMAILS_PER_WEEK,
  assignVariant,
  MAX_EMAILS_PER_WEEK,
  resolveWeeklyCap,
  subjectFor,
  withinWeeklyCap,
  type CampaignVariant,
} from "../campaignDelivery"

const AB: CampaignVariant[] = [
  { id: "a", subject: "Brunch samedi ?", percentage: 50 },
  { id: "b", subject: "Votre table vous attend", percentage: 50 },
]

const CAMPAIGN = "campaigns:1"

describe("assignVariant", () => {
  it("gives the same subscriber the same arm every time", () => {
    // The requirement, not a detail: a send runs in batches that can be
    // interrupted, resumed and retried. Drawing at random would let a retry
    // send arm B to someone who already received arm A, corrupting the
    // measurement the owner set the test up to take.
    const first = assignVariant(AB, CAMPAIGN, "subs:42")
    for (let i = 0; i < 20; i++) {
      expect(assignVariant(AB, CAMPAIGN, "subs:42")?.id).toBe(first?.id)
    }
  })

  it("splits an audience roughly along the percentages", () => {
    const counts = { a: 0, b: 0 }
    for (let i = 0; i < 2_000; i++) {
      const variant = assignVariant(AB, CAMPAIGN, `subs:${i}`)
      counts[variant!.id as "a" | "b"]++
    }
    // A 50/50 split, within a band wide enough that the test is about the
    // distribution rather than about this particular hash.
    expect(counts.a).toBeGreaterThan(800)
    expect(counts.b).toBeGreaterThan(800)
    expect(counts.a + counts.b).toBe(2_000)
  })

  it("honours an uneven split", () => {
    const uneven: CampaignVariant[] = [
      { id: "small", subject: "s", percentage: 10 },
      { id: "large", subject: "l", percentage: 90 },
    ]
    let small = 0
    for (let i = 0; i < 2_000; i++) {
      if (assignVariant(uneven, CAMPAIGN, `subs:${i}`)?.id === "small") small++
    }
    expect(small).toBeGreaterThan(100)
    expect(small).toBeLessThan(320)
  })

  it("separates two campaigns running the same arms", () => {
    // Otherwise every test would sort the audience the same way and a second
    // campaign would measure the first one's buckets.
    const one = Array.from({ length: 200 }, (_, i) =>
      assignVariant(AB, "campaigns:1", `subs:${i}`)?.id
    )
    const two = Array.from({ length: 200 }, (_, i) =>
      assignVariant(AB, "campaigns:2", `subs:${i}`)?.id
    )
    expect(one).not.toEqual(two)
  })

  it("has nothing to assign without variants", () => {
    expect(assignVariant(undefined, CAMPAIGN, "subs:1")).toBeNull()
    expect(assignVariant([], CAMPAIGN, "subs:1")).toBeNull()
  })

  it("refuses to divide by a total of zero", () => {
    // A campaign saved before the wizard enforced 100, or edited around it.
    const broken: CampaignVariant[] = [{ id: "a", subject: "s", percentage: 0 }]
    expect(assignVariant(broken, CAMPAIGN, "subs:1")).toBeNull()
  })

  it("covers the whole audience when the percentages do not reach 100", () => {
    const short: CampaignVariant[] = [
      { id: "a", subject: "a", percentage: 20 },
      { id: "b", subject: "b", percentage: 30 },
    ]
    // Nobody may fall through the gap and receive nothing.
    for (let i = 0; i < 200; i++) {
      expect(assignVariant(short, CAMPAIGN, `subs:${i}`)).not.toBeNull()
    }
  })
})

describe("subjectFor", () => {
  it("uses the campaign's own subject when no test is running", () => {
    expect(
      subjectFor({ subject: "Brunch", abTestEnabled: false, variants: AB }, "subs:1", CAMPAIGN)
    ).toEqual({ subject: "Brunch" })
  })

  it("uses the variant's subject, and names it for the record", () => {
    // `emailEvents.metadata.variantId` exists in the schema for this and was
    // never written, so a finished test had no way to say which arm won.
    const chosen = subjectFor(
      { subject: "Brunch", abTestEnabled: true, variants: AB },
      "subs:42",
      CAMPAIGN
    )
    expect(AB.map((v) => v.subject)).toContain(chosen.subject)
    expect(AB.map((v) => v.id)).toContain(chosen.variantId)
  })

  it("falls back to the campaign subject when the test is empty", () => {
    expect(
      subjectFor({ subject: "Brunch", abTestEnabled: true, variants: [] }, "subs:1", CAMPAIGN)
    ).toEqual({ subject: "Brunch" })
  })
})

describe("resolveWeeklyCap", () => {
  it("uses what the owner configured", () => {
    expect(resolveWeeklyCap(5)).toBe(5)
    expect(resolveWeeklyCap(1)).toBe(1)
  })

  it("applies the documented default when the field says nothing usable", () => {
    // Neither alternative is acceptable: "no limit" throws the guard away
    // silently, and zero stops every campaign the restaurant sends.
    for (const value of [undefined, null, 0, -1, NaN, "3", {}]) {
      expect(resolveWeeklyCap(value)).toBe(DEFAULT_MAX_EMAILS_PER_WEEK)
    }
  })

  it("holds the cap to the maximum the settings screen offers", () => {
    // The screen validates `min(1).max(100)`; `emailConfig.upsert` takes a bare
    // `v.number()`, so a seed or a restore can store more. The cap is now also
    // the bound on how many events the send reads per subscriber, and a cap of
    // a million is not a bound — the batch would cross Convex's read ceiling
    // just as it did before the index. No supported path produces one of these.
    expect(resolveWeeklyCap(100)).toBe(100)
    expect(resolveWeeklyCap(101)).toBe(MAX_EMAILS_PER_WEEK)
    expect(resolveWeeklyCap(1_000_000)).toBe(MAX_EMAILS_PER_WEEK)
    expect(resolveWeeklyCap(Infinity)).toBe(DEFAULT_MAX_EMAILS_PER_WEEK)
  })

  it("resolves to a whole number, because it bounds a read", () => {
    expect(resolveWeeklyCap(3.7)).toBe(3)
    expect(resolveWeeklyCap(0.5)).toBe(DEFAULT_MAX_EMAILS_PER_WEEK)
  })
})

describe("withinWeeklyCap", () => {
  it("lets a subscriber through below the cap", () => {
    expect(withinWeeklyCap(0, 3)).toBe(true)
    expect(withinWeeklyCap(2, 3)).toBe(true)
  })

  it("stops them at it", () => {
    // The cap is a maximum, not a threshold to exceed: three sent means three
    // received, and a fourth would break the promise in the settings screen.
    expect(withinWeeklyCap(3, 3)).toBe(false)
    expect(withinWeeklyCap(9, 3)).toBe(false)
  })
})
