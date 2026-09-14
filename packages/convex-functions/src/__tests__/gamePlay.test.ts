import { describe, it, expect, vi } from "vitest"
import type { SchemaMutationCtx } from "@be-in-digital/convex-schema/dataModel"
import {
  generateRedemptionCode,
  rollOutcome,
  pickPrize,
  remainingStock,
  cooldownMsForGame,
  resolveCooldownHours,
  MAX_COOLDOWN_HOURS,
  DEFAULT_COOLDOWN_HOURS,
  play,
  recordScan,
  claim,
  redeemByCode,
  getSession,
  selectSequentialProgression,
  isActionRequirementMet,
  sanitiseCompletedActions,
  GAME_CONSENT_NOTICE_VERSIONS,
} from "../gamePlay"


describe("selectSequentialProgression", () => {
  const ids = ["a1", "a2", "a3"]

  it("returns the first action when nothing is done yet", () => {
    const p = selectSequentialProgression(ids, [])
    expect(p.currentActionId).toBe("a1")
    expect(p.completedActionIds).toEqual([])
    expect(p.allDone).toBe(false)
  })

  it("advances to the next uncompleted action across visits", () => {
    const p = selectSequentialProgression(ids, ["a1"])
    expect(p.currentActionId).toBe("a2")
    expect(p.completedActionIds).toEqual(["a1"])
    expect(p.allDone).toBe(false)
  })

  it("marks allDone once every active action is completed", () => {
    const p = selectSequentialProgression(ids, ["a2", "a1", "a3"])
    expect(p.currentActionId).toBeNull()
    expect(p.completedActionIds).toEqual(["a1", "a2", "a3"])
    expect(p.allDone).toBe(true)
  })

  it("ignores stale ids from reconfigured games", () => {
    const p = selectSequentialProgression(ids, ["old", "a1", "gone"])
    expect(p.currentActionId).toBe("a2")
    expect(p.completedActionIds).toEqual(["a1"])
  })

  it("keeps the configured order regardless of completion order", () => {
    const p = selectSequentialProgression(ids, ["a3"])
    expect(p.currentActionId).toBe("a1")
    expect(p.completedActionIds).toEqual(["a3"])
  })
})

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

function playFixtures(
  overrides: {
    winRatio?: number
    plays?: MockDoc[]
    prizes?: MockDoc[]
    requiredActions?: MockDoc[]
    rateLimits?: MockDoc[]
    prizeIssuance?: MockDoc[]
    config?: Record<string, unknown>
    extraGames?: MockDoc[]
    referrals?: MockDoc[]
  } = {}
) {
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
        ...(overrides.config ? { config: overrides.config } : {}),
      },
      ...(overrides.extraGames ?? []),
    ],
    requiredActions: overrides.requiredActions ?? [],
    rateLimits: overrides.rateLimits ?? [],
    prizeIssuance: overrides.prizeIssuance ?? [],
    gameReferrals: overrides.referrals ?? [],
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
    consentNoticeVersion: GAME_CONSENT_NOTICE_VERSIONS[0]!,
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

  // Renamed and re-scoped. This case used to be called "lets another device
  // play despite an existing play" and asserted exactly the defect #323 is
  // about: that inventing a new `fingerprint` buys another turn. It is still
  // true for ONE other device, and must stay true — two diners at a table both
  // get to play — but it is no longer the whole story, and the case below it
  // pins the part that stops a loop.
  it("lets a second device play despite an existing play", async () => {
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
        // A claim attaches a name, an e-mail and a phone number to this row.
        // `claim` refuses to do that to a play whose consent was never
        // recorded, so a fixture without one is a fixture of a refusal.
        consent: {
          acceptedAt: Date.now(),
          noticeVersion: GAME_CONSENT_NOTICE_VERSIONS[0]!,
        },
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

describe("anonymous abuse bounds (#323)", () => {
  const baseArgs = {
    code: "TABLE1",
    gameId: "games:1",
    fingerprint: "device-1",
    completedActions: [],
    consentNoticeVersion: GAME_CONSENT_NOTICE_VERSIONS[0]!,
  }

  it("refuses a loop that rotates the fingerprint, and stops at the per-QR window", async () => {
    const ctx = playFixtures({
      prizes: [
        {
          _id: "prizes:1",
          storeId: "stores:1",
          name: "Pizza offerte",
          type: "free_product",
          validityDays: 7,
          isActive: true,
          remainingCount: 5,
        },
      ],
    })

    let refused = 0
    for (let i = 0; i < 40; i++) {
      try {
        await play.handler(ctx, { ...baseArgs, fingerprint: `drain-${i}` })
      } catch {
        refused++
      }
    }

    // 10 admitted (RATE_LIMITS.gamePlayPerQr), 30 refused. Before #323 all 40
    // were admitted: the cooldown is keyed on a caller-supplied string, so
    // rotating it defeated it entirely.
    expect(refused).toBe(30)
    expect(ctx.store.gamePlays).toHaveLength(10)
  })

  it("bounds the loop on a key no argument can rotate", async () => {
    const ctx = playFixtures()
    for (let i = 0; i < 10; i++) {
      await play.handler(ctx, { ...baseArgs, fingerprint: `f-${i}` })
    }
    // Every argument the caller controls is different here, and it changes
    // nothing: the key is the QR document the server resolved.
    await expect(play.handler(ctx, { ...baseArgs, fingerprint: "brand-new" })).rejects.toThrow(
      /Trop de requetes|Trop de requêtes/
    )
  })

  it("does NOT restore the cooldown, and pins that deliberately", async () => {
    const ctx = playFixtures()
    await play.handler(ctx, { ...baseArgs, fingerprint: "device-1" })
    await expect(play.handler(ctx, { ...baseArgs, fingerprint: "device-1" })).rejects.toThrow(
      /COOLDOWN_ACTIVE/
    )
    // A new string, still inside the 24h cooldown: admitted. This is the
    // residual exposure #323 leaves open. A fingerprint is not an identity and
    // no limit makes it one. If this case ever starts failing, something has
    // bound a play to a person — the fix the limiter could not be.
    const r = await play.handler(ctx, { ...baseArgs, fingerprint: "another-string" })
    expect(r.didWin).toBe(true)
  })

  it("keeps only real action ids, and caps how many it will store", async () => {
    const ctx = playFixtures()
    ctx.store.requiredActions = [
      {
        _id: "requiredActions:1",
        storeId: "stores:1",
        type: "google_review",
        name: "Avis Google",
        isRequired: true,
        sortOrder: 0,
        isActive: true,
      },
    ]

    const result = await play.handler(ctx, {
      ...baseArgs,
      completedActions: [
        "requiredActions:1",
        "requiredActions:1",
        "requiredActions:999",
        "x".repeat(500),
      ],
    })

    expect(result.didWin).toBe(true)
    // Persisted verbatim before #323: an unbounded array of unbounded strings.
    expect(ctx.store.gamePlays[0]?.completedActions).toEqual(["requiredActions:1"])
  })

  it("drops every claimed action when the store has none configured", async () => {
    const ctx = playFixtures()
    await play.handler(ctx, {
      ...baseArgs,
      completedActions: ["requiredActions:1", "requiredActions:2"],
    })
    expect(ctx.store.gamePlays[0]?.completedActions).toEqual([])
  })

  it("bounds recordScan, which had no guard of any kind", async () => {
    const ctx = playFixtures()
    let refused = 0
    for (let i = 0; i < 70; i++) {
      try {
        await recordScan.handler(ctx, { code: "TABLE1" })
      } catch {
        refused++
      }
    }
    // 60 admitted (RATE_LIMITS.gameScanPerQr). Before, one caller could drive a
    // store's scan counter to any number it liked.
    expect(refused).toBe(10)
    expect(ctx.store.gameQRCodes[0]?.scannedCount).toBe(60)
  })

  it("bounds claim, which mails a prize code to an address the caller chose", async () => {
    const ctx = playFixtures()
    const plays = []
    for (let i = 0; i < 5; i++) {
      plays.push(await play.handler(ctx, { ...baseArgs, fingerprint: `winner-${i}` }))
    }

    let refused = 0
    for (const p of plays) {
      try {
        await claim.handler(ctx, {
          playId: p.playId,
          firstName: "Marie",
          lastName: "Dupont",
          email: "marie@example.fr",
        })
      } catch {
        refused++
      }
    }
    // 3 admitted (RATE_LIMITS.gameClaimPerEmail), matching the contact form.
    expect(refused).toBe(2)
  })

  it("refuses an oversized name on a claim rather than storing it", async () => {
    const ctx = playFixtures()
    const p = await play.handler(ctx, baseArgs)
    await expect(
      claim.handler(ctx, {
        playId: p.playId,
        firstName: "x".repeat(200),
        lastName: "y".repeat(200),
        email: "marie@example.fr",
      })
    ).rejects.toThrow()
  })
})

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

  it("refuses a play that recorded no consent", async () => {
    // Every row written before `gamePlays.consent` existed has none, and a
    // claim is the one endpoint that turns such a row into a named person.
    // Attaching an e-mail and a phone number to it would be collecting
    // identified personal data with no legal basis at all (art. 6.1).
    const ctx = claimFixtures({ consent: undefined })
    await expect(claim.handler(ctx, args)).rejects.toThrow("CONSENT_REQUIRED")
    expect(ctx.store.prizeRedemptions).toHaveLength(0)
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

/* ------------------------------------------------------------------ */
/* The two guards NEW-N's residual left open                           */
/* ------------------------------------------------------------------ */

const ACTIONS = [
  { id: "requiredActions:1", isRequired: true },
  { id: "requiredActions:2", isRequired: true },
  { id: "requiredActions:3", isRequired: false },
]

describe("isActionRequirementMet", () => {
  it("admits any play when the store configured no actions", () => {
    expect(
      isActionRequirementMet({
        mode: "sequential",
        activeActions: [],
        previouslyCompleted: [],
        claimedNow: [],
      })
    ).toBe(true)
  })

  describe("sequential — one action per visit, as the player UI shows it", () => {
    it("refuses a first play that claims nothing", () => {
      expect(
        isActionRequirementMet({
          mode: "sequential",
          activeActions: ACTIONS,
          previouslyCompleted: [],
          claimedNow: [],
        })
      ).toBe(false)
    })

    it("admits the first play when the due action is the one claimed", () => {
      expect(
        isActionRequirementMet({
          mode: "sequential",
          activeActions: ACTIONS,
          previouslyCompleted: [],
          claimedNow: ["requiredActions:1"],
        })
      ).toBe(true)
    })

    it("refuses a claim that skips ahead to a later action", () => {
      // The UI hands out one action at a time in `sortOrder`. Claiming the
      // third while the first is undone is not a flow the client can produce.
      expect(
        isActionRequirementMet({
          mode: "sequential",
          activeActions: ACTIONS,
          previouslyCompleted: [],
          claimedNow: ["requiredActions:3"],
        })
      ).toBe(false)
    })

    it("admits a return visit that does the next one", () => {
      expect(
        isActionRequirementMet({
          mode: "sequential",
          activeActions: ACTIONS,
          previouslyCompleted: ["requiredActions:1"],
          claimedNow: ["requiredActions:2"],
        })
      ).toBe(true)
    })

    it("admits an empty claim once every action has been done", () => {
      // This is the referral stage and the loyal repeat visitor. Both reach the
      // game with nothing new to do, and refusing them would be the gate
      // breaking real players — the thing the residual warned about.
      expect(
        isActionRequirementMet({
          mode: "sequential",
          activeActions: ACTIONS,
          previouslyCompleted: ACTIONS.map((a) => a.id),
          claimedNow: [],
        })
      ).toBe(true)
    })
  })

  describe("all — the legacy mode", () => {
    it("refuses until every required action is covered", () => {
      expect(
        isActionRequirementMet({
          mode: "all",
          activeActions: ACTIONS,
          previouslyCompleted: [],
          claimedNow: ["requiredActions:1"],
        })
      ).toBe(false)
    })

    it("ignores actions the owner marked optional", () => {
      expect(
        isActionRequirementMet({
          mode: "all",
          activeActions: ACTIONS,
          previouslyCompleted: [],
          claimedNow: ["requiredActions:1", "requiredActions:2"],
        })
      ).toBe(true)
    })

    it("counts what the device did on an earlier visit", () => {
      // The client resets its local state on every load, so a rule that ignored
      // history would make an honest player redo work to be believed.
      expect(
        isActionRequirementMet({
          mode: "all",
          activeActions: ACTIONS,
          previouslyCompleted: ["requiredActions:1"],
          claimedNow: ["requiredActions:2"],
        })
      ).toBe(true)
    })
  })
})

describe("sanitiseCompletedActions", () => {
  const active = [
    { _id: "requiredActions:1", isRequired: true },
    { _id: "requiredActions:2", isRequired: true },
  ] as unknown as Parameters<typeof sanitiseCompletedActions>[0]

  it("keeps only ids that name a real active action, once each", () => {
    expect(
      sanitiseCompletedActions(active, [
        "requiredActions:1",
        "requiredActions:1",
        "requiredActions:99",
        "x".repeat(500),
      ])
    ).toEqual(["requiredActions:1"])
  })

  it("filters before it caps, so junk cannot push a real id off the end", () => {
    const junk = Array.from({ length: 40 }, (_, i) => `invented-${i}`)
    expect(sanitiseCompletedActions(active, [...junk, "requiredActions:2"])).toEqual([
      "requiredActions:2",
    ])
  })
})

describe("play — the required-actions rule, enforced server-side", () => {
  const baseArgs = {
    code: "TABLE1",
    gameId: "games:1",
    fingerprint: "device-1",
    completedActions: [] as string[],
    consentNoticeVersion: GAME_CONSENT_NOTICE_VERSIONS[0]!,
  }
  const oneAction = [
    {
      _id: "requiredActions:1",
      storeId: "stores:1",
      type: "google_review",
      name: "Avis Google",
      isRequired: true,
      sortOrder: 0,
      isActive: true,
    },
  ]

  it("refuses a play that claims nothing while an action is required", async () => {
    // Measured before this guard: the same call won a prize. `completedActions`
    // was written to the row and never read to permit anything, so the social
    // action the whole pitch rests on was enforced by the client alone.
    const ctx = playFixtures({ requiredActions: oneAction })
    await expect(play.handler(ctx, baseArgs)).rejects.toThrow("ACTIONS_INCOMPLETE")
    expect(ctx.store.gamePlays ?? []).toHaveLength(0)
  })

  it("admits the player who claims the action that is due", async () => {
    const ctx = playFixtures({ requiredActions: oneAction })
    const result = await play.handler(ctx, {
      ...baseArgs,
      completedActions: ["requiredActions:1"],
    })
    expect(result.didWin).toBe(true)
    expect(ctx.store.gamePlays[0]?.completedActions).toEqual(["requiredActions:1"])
  })

  it("refuses an invented id, which sanitising has already discarded", async () => {
    const ctx = playFixtures({ requiredActions: oneAction })
    await expect(
      play.handler(ctx, { ...baseArgs, completedActions: ["requiredActions:made-up"] })
    ).rejects.toThrow("ACTIONS_INCOMPLETE")
  })

  it("still admits a referrer spending a bonus, who never sees the actions screen", async () => {
    // The player UI routes a bonus holder straight to the game whether or not a
    // cooldown is running. The gate has to agree, or it breaks a real player.
    const ctx = playFixtures({
      requiredActions: oneAction,
      referrals: [
        {
          _id: "gameReferrals:1",
          storeId: "stores:1",
          code: "SHARE123",
          referrerFingerprint: "device-1",
          conversions: 0,
          pendingBonuses: 1,
        },
      ],
    })
    const result = await play.handler(ctx, baseArgs)
    expect(result.didWin).toBe(true)
  })

  it("still admits a friend arriving on a real referral code", async () => {
    const ctx = playFixtures({
      requiredActions: oneAction,
      referrals: [
        {
          _id: "gameReferrals:1",
          storeId: "stores:1",
          code: "SHARE123",
          referrerFingerprint: "device-OTHER",
          conversions: 0,
          pendingBonuses: 0,
        },
      ],
    })
    const result = await play.handler(ctx, { ...baseArgs, ref: "SHARE123" })
    expect(result.didWin).toBe(true)
  })

  it("caps the bonuses a referrer can bank, however many friends are invented", async () => {
    const ctx = playFixtures({
      referrals: [
        {
          _id: "gameReferrals:1",
          storeId: "stores:1",
          code: "SHARE123",
          referrerFingerprint: "device-OTHER",
          conversions: 0,
          pendingBonuses: 5,
        },
      ],
    })
    await play.handler(ctx, { ...baseArgs, ref: "SHARE123" })
    expect(ctx.store.gameReferrals[0]?.pendingBonuses).toBe(5)
  })
})

describe("play — the establishment's prize budget", () => {
  const baseArgs = {
    code: "TABLE1",
    gameId: "games:1",
    fingerprint: "device-1",
    completedActions: [] as string[],
    consentNoticeVersion: GAME_CONSENT_NOTICE_VERSIONS[0]!,
  }

  it("records the prize in the establishment's ledger", async () => {
    const ctx = playFixtures()
    const result = await play.handler(ctx, baseArgs)
    expect(result.didWin).toBe(true)
    expect(ctx.store.prizeIssuance[0]?.issuedAt).toHaveLength(1)
  })

  it("records nothing when the play loses", async () => {
    // A ledger that recorded attempts would let a run of losing spins exhaust a
    // budget nothing came out of.
    const ctx = playFixtures({ winRatio: 0 })
    const result = await play.handler(ctx, baseArgs)
    expect(result.didWin).toBe(false)
    expect(ctx.store.prizeIssuance ?? []).toHaveLength(0)
  })

  it("stops winning once the window is full, and still lets the player play", async () => {
    const ctx = playFixtures({
      config: { prizeBudget: { maxPrizes: 2, windowHours: 24 } },
      prizeIssuance: [
        {
          _id: "prizeIssuance:1",
          storeId: "stores:1",
          issuedAt: [Date.now() - 1000, Date.now() - 500],
        },
      ],
    })
    const result = await play.handler(ctx, baseArgs)
    // Not an error: refusing would tell a prober where the budget sits and
    // would punish whoever happened to scan next.
    expect(result.didWin).toBe(false)
    expect(result.prize).toBeNull()
    expect(ctx.store.gamePlays).toHaveLength(1)
    expect(ctx.store.prizes[0]?.remainingCount).toBeUndefined()
  })

  it("wins again once the oldest prize has rolled out of the window", async () => {
    const ctx = playFixtures({
      config: { prizeBudget: { maxPrizes: 2, windowHours: 1 } },
      prizeIssuance: [
        {
          _id: "prizeIssuance:1",
          storeId: "stores:1",
          issuedAt: [Date.now() - 3 * 60 * 60_000, Date.now() - 2 * 60 * 60_000],
        },
      ],
    })
    const result = await play.handler(ctx, baseArgs)
    expect(result.didWin).toBe(true)
  })

  it("lets any of the establishment's games refuse, not just the one played", async () => {
    // `args.gameId` is the caller's. Reading the rule off it let a caller pick
    // whichever of the owner's games was most generous.
    const ctx = playFixtures({
      config: { prizeBudget: { maxPrizes: 50, windowHours: 24 } },
      extraGames: [
        {
          _id: "games:2",
          storeId: "stores:1",
          type: "scratch_card",
          winRatio: 100,
          isActive: true,
          config: { prizeBudget: { maxPrizes: 1, windowHours: 24 } },
        },
      ],
      prizeIssuance: [
        { _id: "prizeIssuance:1", storeId: "stores:1", issuedAt: [Date.now() - 1000] },
      ],
    })
    const result = await play.handler(ctx, baseArgs)
    expect(result.didWin).toBe(false)
  })

  it("refuses a burst a short-window game forbids, whatever a long-window one allows", async () => {
    // Picking ONE budget by issuance rate made "100 per week" look tighter than
    // "1 per hour" and then licensed 100 prizes inside that hour.
    const ctx = playFixtures({
      config: { prizeBudget: { maxPrizes: 1, windowHours: 1 } },
      extraGames: [
        {
          _id: "games:2",
          storeId: "stores:1",
          type: "scratch_card",
          winRatio: 100,
          isActive: true,
          config: { prizeBudget: { maxPrizes: 100, windowHours: 168 } },
        },
      ],
      prizeIssuance: [
        { _id: "prizeIssuance:1", storeId: "stores:1", issuedAt: [Date.now() - 60_000] },
      ],
    })
    expect((await play.handler(ctx, baseArgs)).didWin).toBe(false)
  })

  it("refuses a fingerprint or user agent long enough to be storage", async () => {
    // Both were stored verbatim, and `fingerprint` also becomes a
    // `rateLimits.key` on an index: 200 000 characters went in.
    const ctx = playFixtures()
    await expect(
      play.handler(ctx, { ...baseArgs, fingerprint: "x".repeat(5_000) })
    ).rejects.toThrow(/fingerprint/)
    await expect(
      play.handler(ctx, { ...baseArgs, userAgent: "x".repeat(5_000) })
    ).rejects.toThrow(/userAgent/)
    expect(ctx.store.gamePlays ?? []).toHaveLength(0)
    expect(ctx.store.rateLimits ?? []).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------ */
/* What an adversarial pass found wrong with the first version         */
/* ------------------------------------------------------------------ */

describe("play — the exemptions, after an adversarial pass got through them", () => {
  const baseArgs = {
    code: "TABLE1",
    gameId: "games:1",
    fingerprint: "device-1",
    completedActions: [] as string[],
    consentNoticeVersion: GAME_CONSENT_NOTICE_VERSIONS[0]!,
  }
  const oneAction = [
    {
      _id: "requiredActions:1",
      storeId: "stores:1",
      type: "google_review",
      name: "Avis Google",
      isRequired: true,
      sortOrder: 0,
      isActive: true,
    },
  ]
  const referral = (over: Partial<MockDoc> = {}) => ({
    _id: "gameReferrals:1",
    storeId: "stores:1",
    code: "SHARE123",
    referrerFingerprint: "device-OTHER",
    conversions: 0,
    pendingBonuses: 0,
    ...over,
  })

  it("meters the friend welcome on the referral row, so one code cannot exempt forever", async () => {
    // Measured before this: `isFriendWelcome` turns on `isFirstPlay`, which is
    // per fingerprint, so every rotated fingerprint was a first-timer.
    // Appending one `?ref` to the loop took 120 plays with `completedActions:
    // []` past a store demanding three Google reviews, with zero refusals.
    const ctx = playFixtures({ requiredActions: oneAction, referrals: [referral()] })
    let exempted = 0
    let refused = 0
    for (let i = 0; i < 6; i++) {
      try {
        await play.handler(ctx, { ...baseArgs, fingerprint: `friend-${i}`, ref: "SHARE123" })
        exempted++
      } catch {
        refused++
      }
    }
    expect(exempted).toBe(3)
    expect(refused).toBe(3)
  })

  it("does not spend the friend welcome on a friend who did the action", async () => {
    const ctx = playFixtures({ requiredActions: oneAction, referrals: [referral()] })
    for (let i = 0; i < 5; i++) {
      await play.handler(ctx, {
        ...baseArgs,
        fingerprint: `friend-${i}`,
        ref: "SHARE123",
        completedActions: ["requiredActions:1"],
      })
    }
    // The play's own windows were spent; the welcome window was not, because
    // nothing needed exempting.
    const welcomes = ctx.store.rateLimits.filter((r) =>
      String(r.key).startsWith("gameFriendWelcomePerReferral:")
    )
    expect(welcomes).toHaveLength(0)
  })

  it("spends a bonus when the bonus is what buys the gate-free play", async () => {
    // `hasBonus` rather than `consumedBonus` let a banked bonus buy an unlimited
    // number of gate-free plays, because nothing ever spent it: five banked
    // bought six plays.
    const ctx = playFixtures({
      requiredActions: oneAction,
      referrals: [referral({ referrerFingerprint: "device-1", pendingBonuses: 1 })],
    })
    await play.handler(ctx, baseArgs)
    expect(ctx.store.gameReferrals[0]?.pendingBonuses).toBe(0)
    await expect(play.handler(ctx, { ...baseArgs, fingerprint: "device-2" })).rejects.toThrow(
      "ACTIONS_INCOMPLETE"
    )
  })

  it("does not spend a bonus on a player who did the action anyway", async () => {
    const ctx = playFixtures({
      requiredActions: oneAction,
      referrals: [referral({ referrerFingerprint: "device-1", pendingBonuses: 2 })],
    })
    await play.handler(ctx, { ...baseArgs, completedActions: ["requiredActions:1"] })
    expect(ctx.store.gameReferrals[0]?.pendingBonuses).toBe(2)
  })

  it("never confiscates bonuses a referrer already banked", async () => {
    // `Math.min(MAX, stored + 1)` clamped the stored VALUE, not the increment:
    // a row sitting at 8 from before the cap existed dropped to 5 on its next
    // conversion, destroying three plays that had been earned.
    const ctx = playFixtures({ referrals: [referral({ pendingBonuses: 8 })] })
    await play.handler(ctx, { ...baseArgs, ref: "SHARE123" })
    expect(ctx.store.gameReferrals[0]?.pendingBonuses).toBe(8)
  })

  it("keeps a store playable past the storage cap on claimed actions", async () => {
    // `MAX_COMPLETED_ACTIONS` capped the sanitised list, and the "all" branch
    // demanded every required action: a store with 33 of them was permanently
    // unplayable, with no error an owner could diagnose. The cap is a storage
    // bound; the gate now sees the whole claim.
    const many = Array.from({ length: 33 }, (_, i) => ({
      _id: `requiredActions:${i}`,
      storeId: "stores:1",
      type: "google_review",
      name: `Action ${i}`,
      isRequired: true,
      sortOrder: i,
      isActive: true,
    }))
    const ctx = playFixtures({ requiredActions: many, config: { actionMode: "all" } })
    const result = await play.handler(ctx, {
      ...baseArgs,
      completedActions: many.map((a) => a._id),
    })
    expect(result.didWin).toBe(true)
    // Still bounded on the way into the row.
    expect(ctx.store.gamePlays[0]?.completedActions).toHaveLength(32)
  })
})

describe("getSession — telling the player only what play will honour", () => {
  it("stops advertising a friend welcome once the referral's window is spent", async () => {
    // The session computed `isFriendWelcome` with no reference to the window
    // `play` meters it against, so the fourth friend on a share link was sent
    // straight to the wheel and lost a spin to an error the screen had been
    // told could not happen.
    const spent = {
      _id: "rateLimits:1",
      key: "gameFriendWelcomePerReferral:gameReferrals:1",
      windowStart: Date.now(),
      count: 3,
    }
    const tables = (rateLimits: MockDoc[]) => ({
      gameQRCodes: [
        { _id: "qr:1", storeId: "stores:1", code: "TABLE1", isActive: true, scannedCount: 0 },
      ],
      stores: [{ _id: "stores:1", name: "Chez Momo" }],
      games: [
        { _id: "games:1", storeId: "stores:1", type: "wheel", winRatio: 30, isActive: true },
      ],
      requiredActions: [],
      prizes: [],
      gamePlays: [],
      rateLimits,
      gameReferrals: [
        {
          _id: "gameReferrals:1",
          storeId: "stores:1",
          code: "SHARE123",
          referrerFingerprint: "device-OTHER",
          conversions: 0,
          pendingBonuses: 0,
        },
      ],
    })
    const args = { code: "TABLE1", fingerprint: "friend-1", ref: "SHARE123" }

    const open = await getSession.handler(createMockCtx(tables([])), args)
    expect(open.status === "ready" && open.referral.isFriendWelcome).toBe(true)

    const closed = await getSession.handler(createMockCtx(tables([spent])), args)
    expect(closed.status === "ready" && closed.referral.isFriendWelcome).toBe(false)
  })


  it("does not publish the establishment's prize budget", async () => {
    // The decision to LOSE rather than refuse past the budget rests on a prober
    // not knowing where the budget sits. `config` was returned verbatim, so
    // anyone holding a table code could read it off.
    const ctx = createMockCtx({
      gameQRCodes: [
        { _id: "qr:1", storeId: "stores:1", code: "TABLE1", isActive: true, scannedCount: 0 },
      ],
      stores: [{ _id: "stores:1", name: "Chez Momo" }],
      games: [
        {
          _id: "games:1",
          storeId: "stores:1",
          type: "wheel",
          winRatio: 30,
          isActive: true,
          config: {
            actionMode: "sequential",
            primaryColor: "#f97316",
            prizeBudget: { maxPrizes: 7, windowHours: 3 },
          },
        },
      ],
      requiredActions: [],
      prizes: [],
      gamePlays: [],
    })
    const session = await getSession.handler(ctx, { code: "TABLE1" })
    expect(session.status).toBe("ready")
    if (session.status !== "ready") return
    expect(session.game.config).not.toHaveProperty("prizeBudget")
    expect(session.game.config?.primaryColor).toBe("#f97316")
  })
})

/**
 * How long one device waits between two plays (#107).
 *
 * `games.config.cooldownHours` was in the schema and read by `cooldownMsForGame`,
 * and no screen wrote it — the admin declared it in a TypeScript interface and
 * rendered nothing. Every game on every deployment was stuck on the 24-hour
 * default, so the audit's "configurable cooldown" was a field with a reader and
 * no writer.
 *
 * It reaches `games.update` through `config: v.any()`, which validates nothing —
 * hence the clamp, and hence these tests.
 */
describe("resolveCooldownHours", () => {
  it("falls back to the default when nothing is set", () => {
    expect(resolveCooldownHours({})).toBe(DEFAULT_COOLDOWN_HOURS)
    expect(resolveCooldownHours({ config: {} })).toBe(DEFAULT_COOLDOWN_HOURS)
  })

  it("honours what the owner set", () => {
    expect(resolveCooldownHours({ config: { cooldownHours: 6 } })).toBe(6)
  })

  it("allows zero, which means no wait", () => {
    /* A real choice — a one-evening event where every scan should play. It is
       survivable because the cooldown is not the abuse bound: `consumeRateLimit`
       bounds the rate and `prizeBudget` bounds the cost. */
    expect(resolveCooldownHours({ config: { cooldownHours: 0 } })).toBe(0)
    expect(cooldownMsForGame({ config: { cooldownHours: 0 } })).toBe(0)
  })

  it("refuses a negative wait", () => {
    // `playedAt + cooldown` would lie in the past and every play would be
    // allowed — a cooldown that reads as configured and is not.
    expect(resolveCooldownHours({ config: { cooldownHours: -5 } })).toBe(0)
  })

  it("caps an absurd wait at a week", () => {
    // Past a week the game is not on a cooldown, it is switched off — and
    // `isActive` is the control for that, on the same screen.
    expect(resolveCooldownHours({ config: { cooldownHours: 100_000 } })).toBe(
      MAX_COOLDOWN_HOURS
    )
  })

  it("refuses a value that is not a number", () => {
    // `config` is `v.any()`, so this is reachable from the API.
    expect(
      resolveCooldownHours({ config: { cooldownHours: "12" as unknown as number } })
    ).toBe(DEFAULT_COOLDOWN_HOURS)
    expect(resolveCooldownHours({ config: { cooldownHours: NaN } })).toBe(
      DEFAULT_COOLDOWN_HOURS
    )
    expect(resolveCooldownHours({ config: { cooldownHours: Infinity } })).toBe(
      DEFAULT_COOLDOWN_HOURS
    )
  })

  it("floors a fractional wait rather than carrying minutes nobody typed", () => {
    expect(resolveCooldownHours({ config: { cooldownHours: 6.75 } })).toBe(6)
  })

  it("is what cooldownMsForGame converts, so the screen and the game agree", () => {
    // The admin renders `resolveCooldownHours`; the player path calls
    // `cooldownMsForGame`. If they diverged, the owner would be shown a number
    // the game does not honour.
    expect(cooldownMsForGame({ config: { cooldownHours: 100_000 } })).toBe(
      MAX_COOLDOWN_HOURS * 60 * 60 * 1000
    )
  })
})
