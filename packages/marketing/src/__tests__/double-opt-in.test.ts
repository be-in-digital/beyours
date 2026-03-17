import { describe, it, expect, vi, afterEach } from "vitest"
import {
  generateDoubleOptInToken,
  isDoubleOptInValid,
  processDoubleOptIn,
  type SubscriberForOptIn,
} from "../double-opt-in"

describe("generateDoubleOptInToken", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("devrait générer un token UUID", () => {
    const result = generateDoubleOptInToken()
    expect(result.token).toBeDefined()
    expect(result.token.length).toBeGreaterThan(0)
    // UUID v4 format
    expect(result.token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })

  it("devrait définir une expiration 48h dans le futur", () => {
    const before = Date.now()
    const result = generateDoubleOptInToken()
    const after = Date.now()
    const ttl48h = 48 * 60 * 60 * 1000

    expect(result.expiresAt).toBeGreaterThanOrEqual(before + ttl48h)
    expect(result.expiresAt).toBeLessThanOrEqual(after + ttl48h)
  })

  it("devrait générer des tokens uniques", () => {
    const t1 = generateDoubleOptInToken()
    const t2 = generateDoubleOptInToken()
    expect(t1.token).not.toBe(t2.token)
  })
})

describe("isDoubleOptInValid", () => {
  const future = Date.now() + 60_000
  const past = Date.now() - 60_000

  it("devrait retourner true pour un abonné pending avec token valide", () => {
    const subscriber: SubscriberForOptIn = {
      status: "pending",
      doubleOptInToken: "abc-123",
      doubleOptInExpiresAt: future,
    }
    expect(isDoubleOptInValid(subscriber)).toBe(true)
  })

  it("devrait retourner false si status n'est pas pending", () => {
    const subscriber: SubscriberForOptIn = {
      status: "active",
      doubleOptInToken: "abc-123",
      doubleOptInExpiresAt: future,
    }
    expect(isDoubleOptInValid(subscriber)).toBe(false)
  })

  it("devrait retourner false si token est manquant", () => {
    const subscriber: SubscriberForOptIn = {
      status: "pending",
      doubleOptInExpiresAt: future,
    }
    expect(isDoubleOptInValid(subscriber)).toBe(false)
  })

  it("devrait retourner false si expiresAt est manquant", () => {
    const subscriber: SubscriberForOptIn = {
      status: "pending",
      doubleOptInToken: "abc-123",
    }
    expect(isDoubleOptInValid(subscriber)).toBe(false)
  })

  it("devrait retourner false si le token est expiré", () => {
    const subscriber: SubscriberForOptIn = {
      status: "pending",
      doubleOptInToken: "abc-123",
      doubleOptInExpiresAt: past,
    }
    expect(isDoubleOptInValid(subscriber)).toBe(false)
  })
})

describe("processDoubleOptIn", () => {
  it("devrait retourner les données de confirmation", () => {
    const now = 1700000000000
    const result = processDoubleOptIn(now)
    expect(result).toEqual({
      status: "active",
      doubleOptInAt: now,
      doubleOptInToken: undefined,
      doubleOptInExpiresAt: undefined,
    })
  })

  it("devrait utiliser Date.now() par défaut", () => {
    const before = Date.now()
    const result = processDoubleOptIn()
    const after = Date.now()
    expect(result.status).toBe("active")
    expect(result.doubleOptInAt as number).toBeGreaterThanOrEqual(before)
    expect(result.doubleOptInAt as number).toBeLessThanOrEqual(after)
  })

  it("devrait effacer le token et l'expiration", () => {
    const result = processDoubleOptIn()
    expect(result.doubleOptInToken).toBeUndefined()
    expect(result.doubleOptInExpiresAt).toBeUndefined()
  })
})
