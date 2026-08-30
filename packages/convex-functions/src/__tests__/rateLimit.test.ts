/**
 * The limits on the mutations anyone can call.
 *
 * `contactMessages.create` and `emailSubscribers.subscribe` are public by
 * necessity — a storefront visitor has no session — and neither had any bound.
 * `message` was an unbounded `v.string()`.
 */

import { describe, expect, it } from "vitest"
import {
  FIELD_LIMITS,
  FieldTooLongError,
  RATE_LIMITS,
  assertFieldLengths,
  checkRateLimit,
  rateLimitKey,
} from "../rateLimit"

const RULE = { limit: 3, windowMs: 60_000 }
const T = 1_700_000_000_000

describe("checkRateLimit", () => {
  it("opens a window for a subject it has never seen", () => {
    expect(checkRateLimit(null, RULE, T)).toEqual({
      allowed: true,
      next: { windowStart: T, count: 1 },
    })
  })

  it("counts up to the limit", () => {
    let window = { windowStart: T, count: 0 }
    for (let i = 1; i <= RULE.limit; i++) {
      const verdict = checkRateLimit(window, RULE, T + i)
      expect(verdict.allowed, `call ${i}`).toBe(true)
      window = verdict.next!
    }
    expect(window.count).toBe(RULE.limit)
  })

  it("refuses the one past the limit, and says when to come back", () => {
    const verdict = checkRateLimit({ windowStart: T, count: RULE.limit }, RULE, T + 1)
    expect(verdict.allowed).toBe(false)
    expect(verdict.retryAt).toBe(T + RULE.windowMs)
    // Nothing to write: a refused call must not extend its own window, or a
    // caller hammering the endpoint would never be let back in.
    expect(verdict.next).toBeUndefined()
  })

  it("starts a fresh window once the old one has run out", () => {
    const verdict = checkRateLimit(
      { windowStart: T, count: RULE.limit },
      RULE,
      T + RULE.windowMs
    )
    expect(verdict).toEqual({ allowed: true, next: { windowStart: T + RULE.windowMs, count: 1 } })
  })

  it("treats the boundary as expired, not as still running", () => {
    // `>=`, not `>`. A window that never quite ends locks a subject out for
    // good on the last call of the first minute.
    const atBoundary = checkRateLimit({ windowStart: T, count: RULE.limit }, RULE, T + RULE.windowMs)
    const justBefore = checkRateLimit({ windowStart: T, count: RULE.limit }, RULE, T + RULE.windowMs - 1)
    expect(atBoundary.allowed).toBe(true)
    expect(justBefore.allowed).toBe(false)
  })

  it("admits up to twice the limit across a boundary, as a fixed window does", () => {
    // Stated rather than hidden: three at the end of one window and three at
    // the start of the next is six inside a minute. The price of a rule an
    // operator can read off the row.
    const endOfFirst = checkRateLimit({ windowStart: T, count: 2 }, RULE, T + RULE.windowMs - 1)
    expect(endOfFirst.allowed).toBe(true)
    const startOfSecond = checkRateLimit(endOfFirst.next!, RULE, T + RULE.windowMs)
    expect(startOfSecond.allowed).toBe(true)
    expect(startOfSecond.next).toEqual({ windowStart: T + RULE.windowMs, count: 1 })
  })
})

describe("rateLimitKey", () => {
  it("treats an address as one address however it was typed", () => {
    // A limiter that disagrees with the subscriber lookup on case is one
    // Shift key away from being no limiter at all.
    expect(rateLimitKey("contactPerEmail", "Yanis@Resto.Example")).toBe(
      rateLimitKey("contactPerEmail", "yanis@resto.example")
    )
  })

  it("keeps two limits on the same subject apart", () => {
    expect(rateLimitKey("contactPerEmail", "a@b.test")).not.toBe(
      rateLimitKey("subscribePerEmail", "a@b.test")
    )
  })
})

describe("RATE_LIMITS", () => {
  it("lets a restaurant absorb more than any single address", () => {
    // The per-address window is the tight one and is dodged by changing the
    // address; the per-store window is the one that cannot be dodged.
    expect(RATE_LIMITS.contactPerStore.limit).toBeGreaterThan(
      RATE_LIMITS.contactPerEmail.limit
    )
    expect(RATE_LIMITS.subscribePerStore.limit).toBeGreaterThan(
      RATE_LIMITS.subscribePerEmail.limit
    )
  })

  it("gives every limit a positive window", () => {
    for (const [name, rule] of Object.entries(RATE_LIMITS)) {
      expect(rule.limit, name).toBeGreaterThan(0)
      expect(rule.windowMs, name).toBeGreaterThan(0)
    }
  })
})

describe("assertFieldLengths", () => {
  it("accepts what a person writes", () => {
    expect(() =>
      assertFieldLengths({
        name: "Yanis Moreau",
        email: "yanis@resto.example",
        subject: "Réservation",
        message: "Bonjour, avez-vous une table pour six samedi ?",
      })
    ).not.toThrow()
  })

  it("refuses a message no person would type", () => {
    // The defect exactly: `v.string()` has no length, so this was accepted and
    // stored.
    const flood = "x".repeat(FIELD_LIMITS.message + 1)
    expect(() => assertFieldLengths({ message: flood })).toThrow(FieldTooLongError)
  })

  it("names the field that was too long", () => {
    try {
      assertFieldLengths({ subject: "x".repeat(FIELD_LIMITS.subject + 1) })
      throw new Error("expected a refusal")
    } catch (error) {
      expect(error).toBeInstanceOf(FieldTooLongError)
      expect((error as FieldTooLongError).field).toBe("subject")
    }
  })

  it("accepts a field of exactly the limit", () => {
    expect(() =>
      assertFieldLengths({ message: "x".repeat(FIELD_LIMITS.message) })
    ).not.toThrow()
  })

  it("ignores a field that was not supplied", () => {
    expect(() => assertFieldLengths({ phone: undefined })).not.toThrow()
  })
})
