import { describe, it, expect } from "vitest"
import {
  incrementCampaignStats,
  incrementRevenueStat,
  computeStatRates,
  calculateSubscriberMetadata,
  type CampaignStats,
  type SubscriberMetadata,
  type OrderForMetadata,
} from "../stats"

const emptyStats: CampaignStats = {
  sent: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  bounced: 0,
  unsubscribed: 0,
  converted: 0,
  revenue: 0,
}

describe("incrementCampaignStats", () => {
  it("increments a field by 1 by default", () => {
    const result = incrementCampaignStats(emptyStats, "sent")
    expect(result.sent).toBe(1)
    expect(result.delivered).toBe(0) // the others stay untouched
  })

  it("increments by a custom amount", () => {
    const result = incrementCampaignStats(emptyStats, "opened", 5)
    expect(result.opened).toBe(5)
  })

  it("does not mutate the original object", () => {
    const original = { ...emptyStats, sent: 10 }
    const result = incrementCampaignStats(original, "sent")
    expect(result.sent).toBe(11)
    expect(original.sent).toBe(10)
  })
})

describe("incrementRevenueStat", () => {
  it("increments revenue and converted", () => {
    const result = incrementRevenueStat(emptyStats, 5000)
    expect(result.revenue).toBe(5000)
    expect(result.converted).toBe(1)
  })

  it("accumulates revenue", () => {
    const first = incrementRevenueStat(emptyStats, 2000)
    const second = incrementRevenueStat(first, 3000)
    expect(second.revenue).toBe(5000)
    expect(second.converted).toBe(2)
  })
})

describe("computeStatRates", () => {
  it("computes the rates based on delivered", () => {
    const stats: CampaignStats = {
      sent: 100,
      delivered: 90,
      opened: 45,
      clicked: 9,
      bounced: 10,
      unsubscribed: 2,
      converted: 0,
      revenue: 0,
    }
    const rates = computeStatRates(stats)
    expect(rates.openRate).toBe(50) // 45/90 * 100
    expect(rates.clickRate).toBe(10) // 9/90 * 100
    expect(rates.bounceRate).toBe(11.1) // 10/90 * 100 rounded
    expect(rates.unsubscribeRate).toBe(2.2) // 2/90 * 100 rounded
  })

  it("handles delivered = 0 without dividing by zero", () => {
    const rates = computeStatRates(emptyStats)
    expect(rates.openRate).toBe(0)
    expect(rates.clickRate).toBe(0)
  })

  it("rounds to 1 decimal place", () => {
    const stats: CampaignStats = {
      ...emptyStats,
      delivered: 3,
      opened: 1,
    }
    const rates = computeStatRates(stats)
    expect(rates.openRate).toBe(33.3) // 1/3 * 100 = 33.333... → 33.3
  })
})

describe("calculateSubscriberMetadata", () => {
  const baseMeta: SubscriberMetadata = {
    totalOrders: 2,
    totalSpent: 4000, // 40.00 EUR
    lastOrderAt: 1700000000000,
    averageOrderValue: 2000,
    favoriteProducts: ["p1", "p2"],
    orderTypes: ["delivery"],
  }

  it("increments the order count and the total spent", () => {
    const order: OrderForMetadata = {
      amount: 3000,
      type: "delivery",
      productIds: ["p3"],
      orderedAt: 1700000100000,
    }
    const result = calculateSubscriberMetadata(baseMeta, order)
    expect(result.totalOrders).toBe(3)
    expect(result.totalSpent).toBe(7000)
  })

  it("computes the new rounded average", () => {
    const order: OrderForMetadata = {
      amount: 3000,
      type: "pickup",
      productIds: [],
      orderedAt: 1700000100000,
    }
    const result = calculateSubscriberMetadata(baseMeta, order)
    // 7000 / 3 = 2333.33... rounded to 2333
    expect(result.averageOrderValue).toBe(2333)
  })

  it("adds a new order type", () => {
    const order: OrderForMetadata = {
      amount: 1000,
      type: "pickup",
      productIds: [],
      orderedAt: 1700000100000,
    }
    const result = calculateSubscriberMetadata(baseMeta, order)
    expect(result.orderTypes).toEqual(["delivery", "pickup"])
  })

  it("does not duplicate order types", () => {
    const order: OrderForMetadata = {
      amount: 1000,
      type: "delivery",
      productIds: [],
      orderedAt: 1700000100000,
    }
    const result = calculateSubscriberMetadata(baseMeta, order)
    expect(result.orderTypes).toEqual(["delivery"])
  })

  it("merges the favorite products and keeps the 10 most recent", () => {
    const order: OrderForMetadata = {
      amount: 1000,
      type: "delivery",
      productIds: ["p3", "p4"],
      orderedAt: 1700000100000,
    }
    const result = calculateSubscriberMetadata(baseMeta, order)
    // New products first, then the existing ones
    expect(result.favoriteProducts).toContain("p3")
    expect(result.favoriteProducts).toContain("p4")
    expect(result.favoriteProducts).toContain("p1")
    expect(result.favoriteProducts.length).toBeLessThanOrEqual(10)
  })

  it("deduplicates the favorite products", () => {
    const order: OrderForMetadata = {
      amount: 1000,
      type: "delivery",
      productIds: ["p1", "p3"],
      orderedAt: 1700000100000,
    }
    const result = calculateSubscriberMetadata(baseMeta, order)
    const p1Count = result.favoriteProducts.filter((p) => p === "p1").length
    expect(p1Count).toBe(1)
  })

  it("updates lastOrderAt", () => {
    const order: OrderForMetadata = {
      amount: 1000,
      type: "delivery",
      productIds: [],
      orderedAt: 1700000100000,
    }
    const result = calculateSubscriberMetadata(baseMeta, order)
    expect(result.lastOrderAt).toBe(1700000100000)
  })

  it("does not mutate the original object", () => {
    const original = { ...baseMeta, favoriteProducts: [...baseMeta.favoriteProducts] }
    calculateSubscriberMetadata(original, {
      amount: 1000,
      type: "delivery",
      productIds: ["p5"],
      orderedAt: 1700000100000,
    })
    expect(original.totalOrders).toBe(2)
    expect(original.favoriteProducts).toHaveLength(2)
  })
})
