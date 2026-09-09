/**
 * A referral code must not be guessable, and must not be predictable.
 *
 * `validateCode` is a public, unauthenticated query and has to stay one — an
 * affiliate code is handed to strangers to type before anyone signs in. That
 * makes it an oracle: it answers "is this a real code?" for anybody, as often
 * as they ask. Codes were minted from `Math.random()` with five characters, so
 * the oracle was answering a question an attacker could afford to ask.
 *
 * Both halves matter and they fail differently:
 *
 *   - LENGTH is what a blind sweep costs. 32^5 ≈ 33.5M against a few hundred
 *     live codes is an afternoon's work.
 *   - THE GENERATOR is what a sweep costs when you have samples. V8's
 *     `Math.random` is xorshift128+, whose state is recoverable from a short
 *     run of outputs — and these codes are published by the affiliates who
 *     hold them, so samples are the one thing an attacker is guaranteed.
 *
 * This test reads the source for the generator, because that is the only place
 * the choice is visible: a statistical test cannot distinguish xorshift128+
 * output from a CSPRNG's, which is exactly why the defect survived review.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const RAW = readFileSync(join(__dirname, "../convex/referralCodes.ts"), "utf8")

/**
 * The file with its comments removed.
 *
 * Asserting against the raw text would be the same mistake this whole change
 * is about: the first version of the test below failed on the sentence
 * "`Math.random()` is not a random number generator …" in the docblock
 * EXPLAINING the fix. A check that reads prose as code cannot tell a warning
 * from a violation — which is exactly how the Convex guard rule came to pass a
 * file whose only guard was a mention in a comment.
 */
const SOURCE = RAW.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")

/** The generator, lifted from the source so the assertions run the real thing. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const LENGTH = 8

function generateCode(): string {
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length
  let code = "BID-"
  while (code.length < 4 + LENGTH) {
    const bytes = new Uint8Array(LENGTH)
    crypto.getRandomValues(bytes)
    for (const byte of bytes) {
      if (byte >= limit) continue
      code += ALPHABET[byte % ALPHABET.length]
      if (code.length === 4 + LENGTH) break
    }
  }
  return code
}

describe("the generator", () => {
  it("does not use Math.random", () => {
    // The whole defect, in one assertion. If this ever passes again, the codes
    // are predictable to anyone holding a few of them.
    expect(SOURCE).not.toMatch(/Math\.random/)
  })

  it("draws from the platform CSPRNG", () => {
    expect(SOURCE).toMatch(/crypto\.getRandomValues/)
  })

  it("mints at least 8 random characters", () => {
    // 32^8 ≈ 1.1e12. Below 8 the sweep becomes affordable again.
    const declared = /const CODE_LENGTH = (\d+)/.exec(SOURCE)
    expect(declared).not.toBeNull()
    expect(Number(declared![1])).toBeGreaterThanOrEqual(8)
  })
})

describe("the codes it mints", () => {
  it("satisfy isValidCode, so the lookup can find them", () => {
    // `isValidCode` accepts 3-20 of [A-Za-z0-9_-]; `BID-` + 8 is 12.
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).toMatch(/^[A-Za-z0-9_-]{3,20}$/)
    }
  })

  it("avoid the characters a person misreads aloud", () => {
    // No I, O, 0 or 1 — these are dictated over a counter.
    const body = generateCode().slice(4)
    expect(body).not.toMatch(/[IO01]/)
  })

  it("do not collide across a realistic mint volume", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 20_000; i++) seen.add(generateCode())
    expect(seen.size).toBe(20_000)
  })

  it("use the whole alphabet, so rejection sampling did not skew it", () => {
    // A `byte % 32` fold is uniform only because 256 happens to divide by 32.
    // Adding one character to the alphabet would silently bias the early
    // letters; the generator rejects the tail instead. This notices if that is
    // ever replaced by a fold that drops characters entirely.
    const seen = new Set<string>()
    for (let i = 0; i < 5_000; i++) for (const ch of generateCode().slice(4)) seen.add(ch)
    expect(seen.size).toBe(ALPHABET.length)
  })
})
