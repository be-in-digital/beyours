import { describe, it, expect, vi } from "vitest"
import type { SchemaMutationCtx } from "@be-in-digital/convex-schema/dataModel"
import {
  generateRedemptionCode,
  rollOutcome,
  pickPrize,
  remainingStock,
  cooldownMsForGame,
  play,
  claim,
  redeemByCode,
  getSession,
} from "../gamePlay"

// ---------------------------------------------------------------------------
// Mock Convex DB with index-aware queries
// ---------------------------------------------------------------------------

interface MockDoc {
  _id: string
  [key: string]: unknown
}

function createMockCtx(tables: Record<string, MockDoc[]> = {}) {
  const store: Record<string, MockDoc[]> = Object.fromEntries(
    Object.entries(tables).map(([name, docs]) => [name, docs.map((d) => ({ ...d }))])
  )
  let insertCounter = 0

  const findTableOfId = (id: string): MockDoc | null => {
    for (const docs of Object.values(store)) {
      const found = docs.find((d) => d._id === id)
      if (found) return found
    }
    return null
  }

  const db = {
    get: vi.fn(async (id: string) => findTableOfId(id)),
    insert: vi.fn(async (table: string, doc: Record<string, unknown>) => {
      const id = `${table}:${++insertCounter}`
      store[table] = store[table] ?? []
      store[table].push({ _id: id, ...doc })
      return id
    }),
    patch: vi.fn(async (id: string, updates: Record<string, unknown>) => {
      const doc = findTableOfId(id)
      if (doc) Object.assign(doc, updates)
    }),
    delete: vi.fn(async (id: string) => {
      for (const [name, docs] of Object.entries(store)) {
        store[name] = docs.filter((d) => d._id !== id)
      }
    }),
    query: (table: string) => {
      let docs = [...(store[table] ?? [])]
      const chain = {
        withIndex: (_index: string, fn?: (q: unknown) => unknown) => {
          if (fn) {
            const filters: Array<[string, unknown]> = []
            const q = {
              eq: (field: string, value: unknown) => {
                filters.push([field, value])
                return q
              },
            }
            fn(q)
            docs = docs.filter((d) => filters.every(([field, value]) => d[field] === value))
          }
          return chain
        },
        order: (direction: "asc" | "desc") => {
          if (direction === "desc") docs.reverse()
          return chain
        },
        first: async () => docs[0] ?? null,
        take: async (n: number) => docs.slice(0, n),
        collect: async () => docs,
      }
      return chain
    },
  }

  // Test double: handlers only touch ctx.db — the cast documents exactly that.
  return { db, store } as unknown as SchemaMutationCtx & {
    store: Record<string, MockDoc[]>
  }
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe("generateRedemptionCode", () => {
  it("generates 8 chars from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRedemptionCode()
      expect(code).toHaveLength(8)
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/)
      expect(code).not.toMatch(/[O0I1L]/)
    }
  })

  it("is deterministic for a fixed random source", () => {
    expect(generateRedemptionCode(() => 0)).toBe("AAAAAAAA")
  })
})

describe("rollOutcome", () => {
  it("never wins with zero prizes, even at 100%", () => {
    expect(rollOutcome({ winRatio: 100, prizeCount: 0, random: () => 0 })).toBe(false)
  })

  it("always wins at ratio 100 with prizes", () => {
    expect(rollOutcome({ winRatio: 100, prizeCount: 1, random: () => 0.999 })).toBe(true)
  })

  it("never wins at ratio 0", () => {
    expect(rollOutcome({ winRatio: 0, prizeCount: 5, random: () => 0 })).toBe(false)
  })

  it("clamps out-of-range ratios", () => {
    expect(rollOutcome({ winRatio: 250, prizeCount: 1, random: () => 0.99 })).toBe(true)
    expect(rollOutcome({ winRatio: -10, prizeCount: 1, random: () => 0 })).toBe(false)
  })
})

describe("remainingStock / pickPrize", () => {
  it("treats undefined counts as unlimited", () => {
    expect(remainingStock({})).toBeUndefined()
    expect(remainingStock({ totalAvailable: 5 })).toBe(5)
    expect(remainingStock({ remainingCount: 2, totalAvailable: 5 })).toBe(2)
  })

  it("skips out-of-stock prizes", () => {
    const prizes = [
      { _id: "a", remainingCount: 0 },
      { _id: "b", remainingCount: 3 },
    ]
    expect(pickPrize(prizes, () => 0)).toEqual({ _id: "b", remainingCount: 3 })
  })

  it("returns null when everything is out of stock", () => {
    expect(pickPrize([{ remainingCount: 0 }], () => 0)).toBeNull()
  })
})

describe("cooldownMsForGame", () => {
  it("defaults to 24h", () => {
    expect(cooldownMsForGame({})).toBe(24 * 60 * 60 * 1000)
  })

  it("honors the config override", () => {
    expect(cooldownMsForGame({ config: { cooldownHours: 2 } })).toBe(2 * 60 * 60 * 1000)
  })
})

// ---------------------------------------------------------------------------
// play
// ---------------------------------------------------------------------------

function playFixtures(overrides: { winRatio?: number; plays?: MockDoc[]; prizes?: MockDoc[] } = {}) {
  return createMockCtx({
    gameQRCodes: [
      { _id: "qr:1", storeId: "stores:1", code: "TABLE1", isActive: true, scannedCount: 0 },
    ],
    games: [
      {
        _id: "games:1",
        storeId: "stores:1",
        type: "wheel",
        winRatio: overrides.winRatio ?? 100,
        isActive: true,
      },
    ],
    prizes:
      overrides.prizes ??
      ([
        {
          _id: "prizes:1",
          storeId: "stores:1",
          name: "Dessert offert",
          type: "free_product",
          validityDays: 7,
          isActive: true,
        },
      ] as MockDoc[]),
    gamePlays: overrides.plays ?? [],
  })
}

describe("play", () => {
  const baseArgs = {
    code: "TABLE1",
    gameId: "games:1",
    fingerprint: "device-1",
    completedActions: [],
  }

  it("resolves a win and records the play", async () => {
    const ctx = playFixtures()
    const result = await play.handler(ctx, baseArgs)
    expect(result.didWin).toBe(true)
    expect(result.prize?.name).toBe("Dessert offert")
    expect(ctx.store.gamePlays).toHaveLength(1)
    expect(ctx.store.gamePlays[0]?.didWin).toBe(true)
  })

  it("throws GAME_UNAVAILABLE for an unknown QR code", async () => {
    const ctx = playFixtures()
    await expect(play.handler(ctx, { ...baseArgs, code: "NOPE" })).rejects.toThrow(
      "GAME_UNAVAILABLE"
    )
  })

  it("enforces the cooldown per fingerprint", async () => {
    const ctx = playFixtures({
      plays: [
        {
          _id: "gamePlays:0",
          storeId: "stores:1",
          gameId: "games:1",
          fingerprint: "device-1",
          didWin: false,
          completedActions: [],
          playedAt: Date.now() - 60 * 60 * 1000, // played 1h ago
        },
      ],
    })
    await expect(play.handler(ctx, baseArgs)).rejects.toThrow(/COOLDOWN_ACTIVE:\d+/)
  })

  it("lets another device play despite an existing play", async () => {
    const ctx = playFixtures({
      plays: [
        {
          _id: "gamePlays:0",
          storeId: "stores:1",
          gameId: "games:1",
          fingerprint: "device-OTHER",
          didWin: false,
          completedActions: [],
          playedAt: Date.now() - 60 * 60 * 1000,
        },
      ],
    })
    const result = await play.handler(ctx, baseArgs)
    expect(result.didWin).toBe(true)
  })

  it("allows replay after the cooldown expired", async () => {
    const ctx = playFixtures({
      plays: [
        {
          _id: "gamePlays:0",
          storeId: "stores:1",
          gameId: "games:1",
          fingerprint: "device-1",
          didWin: false,
          completedActions: [],
          playedAt: Date.now() - 25 * 60 * 60 * 1000, // 25h ago
        },
      ],
    })
    const result = await play.handler(ctx, baseArgs)
    expect(result.didWin).toBe(true)
  })

  it("forces a lose when no prize is in stock", async () => {
    const ctx = playFixtures({
      winRatio: 100,
      prizes: [
        {
          _id: "prizes:1",
          storeId: "stores:1",
          name: "Épuisé",
          type: "custom",
          validityDays: 7,
          isActive: true,
          totalAvailable: 3,
          remainingCount: 0,
        },
      ],
    })
    const result = await play.handler(ctx, baseArgs)
    expect(result.didWin).toBe(false)
    expect(result.prize).toBeNull()
  })

  it("decrements the prize stock on a win", async () => {
    const ctx = playFixtures({
      prizes: [
        {
          _id: "prizes:1",
          storeId: "stores:1",
          name: "Café offert",
          type: "free_product",
          validityDays: 7,
          isActive: true,
          totalAvailable: 5,
          remainingCount: 5,
        },
      ],
    })
    await play.handler(ctx, baseArgs)
    expect(ctx.store.prizes[0]?.remainingCount).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// claim
// ---------------------------------------------------------------------------

function claimFixtures(playOverrides: Partial<MockDoc> = {}) {
  return createMockCtx({
    gamePlays: [
      {
        _id: "gamePlays:1",
        storeId: "stores:1",
        gameId: "games:1",
        didWin: true,
        prizeId: "prizes:1",
        completedActions: [],
        playedAt: Date.now(),
        ...playOverrides,
      },
    ],
    prizes: [
      {
        _id: "prizes:1",
        storeId: "stores:1",
        name: "Dessert offert",
        type: "free_product",
        validityDays: 7,
        isActive: true,
      },
    ],
    prizeRedemptions: [],
  })
}

describe("claim", () => {
  const args = {
    playId: "gamePlays:1",
    firstName: "Nadia",
    lastName: "Benali",
    email: "nadia@example.com",
  }

  it("creates a redemption with an 8-char code and validity window", async () => {
    const ctx = claimFixtures()
    const before = Date.now()
    const result = await claim.handler(ctx, args)
    expect(result.alreadyClaimed).toBe(false)
    expect(result.code).toMatch(/^[A-Z2-9]{8}$/)
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000 - 1000)
    expect(ctx.store.prizeRedemptions).toHaveLength(1)
    expect(ctx.store.prizeRedemptions[0]?.status).toBe("pending")
    // Player info persisted on the play
    expect(ctx.store.gamePlays[0]?.playerEmail).toBe("nadia@example.com")
    expect(ctx.store.gamePlays[0]?.playerName).toBe("Nadia Benali")
  })

  it("is idempotent: a second claim returns the same code", async () => {
    const ctx = claimFixtures()
    const first = await claim.handler(ctx, args)
    const second = await claim.handler(ctx, args)
    expect(second.alreadyClaimed).toBe(true)
    expect(second.code).toBe(first.code)
    expect(ctx.store.prizeRedemptions).toHaveLength(1)
  })

  it("rejects claims on losing plays", async () => {
    const ctx = claimFixtures({ didWin: false, prizeId: undefined })
    await expect(claim.handler(ctx, args)).rejects.toThrow("CLAIM_INVALID")
  })
})

// ---------------------------------------------------------------------------
// redeemByCode
// ---------------------------------------------------------------------------

function redemptionFixtures(overrides: Partial<MockDoc> = {}) {
  return createMockCtx({
    prizeRedemptions: [
      {
        _id: "prizeRedemptions:1",
        storeId: "stores:1",
        gamePlayId: "gamePlays:1",
        prizeId: "prizes:1",
        redemptionCode: "ABCD2345",
        status: "pending",
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        ...overrides,
      },
    ],
  })
}

describe("redeemByCode", () => {
  it("marks a pending redemption as redeemed", async () => {
    const ctx = redemptionFixtures()
    await redeemByCode.handler(ctx, { code: "ABCD2345", redeemedBy: "staff@resto.fr" })
    expect(ctx.store.prizeRedemptions[0]?.status).toBe("redeemed")
    expect(ctx.store.prizeRedemptions[0]?.redeemedBy).toBe("staff@resto.fr")
  })

  it("rejects double redemption", async () => {
    const ctx = redemptionFixtures({ status: "redeemed" })
    await expect(redeemByCode.handler(ctx, { code: "ABCD2345" })).rejects.toThrow(
      "ALREADY_REDEEMED"
    )
  })

  it("rejects expired redemptions", async () => {
    const ctx = redemptionFixtures({ expiresAt: Date.now() - 1000 })
    await expect(redeemByCode.handler(ctx, { code: "ABCD2345" })).rejects.toThrow(
      "REDEMPTION_EXPIRED"
    )
  })

  it("rejects unknown codes", async () => {
    const ctx = redemptionFixtures()
    await expect(redeemByCode.handler(ctx, { code: "ZZZZZZZZ" })).rejects.toThrow(
      "REDEMPTION_NOT_FOUND"
    )
  })
})

// ---------------------------------------------------------------------------
// getSession
// ---------------------------------------------------------------------------

describe("getSession", () => {
  it("returns not_found for inactive QR codes", async () => {
    const ctx = createMockCtx({
      gameQRCodes: [{ _id: "qr:1", storeId: "stores:1", code: "OFF", isActive: false }],
    })
    const result = await getSession.handler(ctx, { code: "OFF" })
    expect(result.status).toBe("not_found")
  })

  it("reports an active cooldown for the fingerprint", async () => {
    const ctx = createMockCtx({
      gameQRCodes: [
        { _id: "qr:1", storeId: "stores:1", code: "TABLE1", isActive: true, scannedCount: 0 },
      ],
      stores: [{ _id: "stores:1", name: "Chez Momo" }],
      games: [
        { _id: "games:1", storeId: "stores:1", type: "wheel", winRatio: 30, isActive: true },
      ],
      requiredActions: [],
      prizes: [],
      gamePlays: [
        {
          _id: "gamePlays:1",
          storeId: "stores:1",
          gameId: "games:1",
          fingerprint: "device-1",
          didWin: false,
          completedActions: [],
          playedAt: Date.now() - 60 * 60 * 1000,
        },
      ],
    })
    const result = await getSession.handler(ctx, { code: "TABLE1", fingerprint: "device-1" })
    expect(result.status).toBe("ready")
    expect(result.cooldown.active).toBe(true)
    expect(result.cooldown.nextPlayAt).toBeGreaterThan(Date.now())
    expect(result.store.name).toBe("Chez Momo")
  })
})
