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
  it("devrait incrémenter un champ de 1 par défaut", () => {
    const result = incrementCampaignStats(emptyStats, "sent")
    expect(result.sent).toBe(1)
    expect(result.delivered).toBe(0) // les autres restent intacts
  })

  it("devrait incrémenter avec un montant personnalisé", () => {
    const result = incrementCampaignStats(emptyStats, "opened", 5)
    expect(result.opened).toBe(5)
  })

  it("ne devrait pas muter l'objet original", () => {
    const original = { ...emptyStats, sent: 10 }
    const result = incrementCampaignStats(original, "sent")
    expect(result.sent).toBe(11)
    expect(original.sent).toBe(10)
  })
})

describe("incrementRevenueStat", () => {
  it("devrait incrémenter revenue et converted", () => {
    const result = incrementRevenueStat(emptyStats, 5000)
    expect(result.revenue).toBe(5000)
    expect(result.converted).toBe(1)
  })

  it("devrait accumuler les revenues", () => {
    const first = incrementRevenueStat(emptyStats, 2000)
    const second = incrementRevenueStat(first, 3000)
    expect(second.revenue).toBe(5000)
    expect(second.converted).toBe(2)
  })
})

describe("computeStatRates", () => {
  it("devrait calculer les taux basés sur delivered", () => {
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
    expect(rates.bounceRate).toBe(11.1) // 10/90 * 100 arrondi
    expect(rates.unsubscribeRate).toBe(2.2) // 2/90 * 100 arrondi
  })

  it("devrait gérer delivered = 0 sans division par zéro", () => {
    const rates = computeStatRates(emptyStats)
    expect(rates.openRate).toBe(0)
    expect(rates.clickRate).toBe(0)
  })

  it("devrait arrondir à 1 décimale", () => {
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

  it("devrait incrémenter le nombre de commandes et le total dépensé", () => {
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

  it("devrait calculer la nouvelle moyenne arrondie", () => {
    const order: OrderForMetadata = {
      amount: 3000,
      type: "pickup",
      productIds: [],
      orderedAt: 1700000100000,
    }
    const result = calculateSubscriberMetadata(baseMeta, order)
    // 7000 / 3 = 2333.33... arrondi à 2333
    expect(result.averageOrderValue).toBe(2333)
  })

  it("devrait ajouter un nouveau type de commande", () => {
    const order: OrderForMetadata = {
      amount: 1000,
      type: "pickup",
      productIds: [],
      orderedAt: 1700000100000,
    }
    const result = calculateSubscriberMetadata(baseMeta, order)
    expect(result.orderTypes).toEqual(["delivery", "pickup"])
  })

  it("ne devrait pas dupliquer les types de commande", () => {
    const order: OrderForMetadata = {
      amount: 1000,
      type: "delivery",
      productIds: [],
      orderedAt: 1700000100000,
    }
    const result = calculateSubscriberMetadata(baseMeta, order)
    expect(result.orderTypes).toEqual(["delivery"])
  })

  it("devrait merger les produits favoris et garder les 10 derniers", () => {
    const order: OrderForMetadata = {
      amount: 1000,
      type: "delivery",
      productIds: ["p3", "p4"],
      orderedAt: 1700000100000,
    }
    const result = calculateSubscriberMetadata(baseMeta, order)
    // Nouveaux produits en premier, puis existants
    expect(result.favoriteProducts).toContain("p3")
    expect(result.favoriteProducts).toContain("p4")
    expect(result.favoriteProducts).toContain("p1")
    expect(result.favoriteProducts.length).toBeLessThanOrEqual(10)
  })

  it("devrait dédupliquer les produits favoris", () => {
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

  it("devrait mettre à jour lastOrderAt", () => {
    const order: OrderForMetadata = {
      amount: 1000,
      type: "delivery",
      productIds: [],
      orderedAt: 1700000100000,
    }
    const result = calculateSubscriberMetadata(baseMeta, order)
    expect(result.lastOrderAt).toBe(1700000100000)
  })

  it("ne devrait pas muter l'objet original", () => {
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
