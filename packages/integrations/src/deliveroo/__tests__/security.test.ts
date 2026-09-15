/**
 * Deliveroo webhook signature verification.
 *
 * This module had no tests and no callers, and had drifted away from the
 * contract it claims to implement: it read the GUID from the wrong header,
 * took the body as a string, and fell back to accepting an HMAC over the body
 * alone when the real message did not match. That fallback made it a verifier
 * which accepts unsigned-in-context payloads — the exact malformed signature
 * the Deliveroo e2e suites were sending.
 *
 * Expected digests below were computed outside this codebase, with LibreSSL:
 *
 *     printf '%s %s' "$GUID" "$BODY" | openssl dgst -sha256 -hmac "$SECRET"
 */

import { afterEach, describe, expect, it, vi } from "vitest"
import { verifyWebhookSignature } from "../security"

const SECRET = "whsec_deliveroo_test_secret"
const SEQUENCE_GUID = "4f1c1b7e-6a2b-4f4e-9a3a-2f6f0f9a1b2c"
const BODY = '{"event":"order.new","body":{"order":{"id":"fr:1234","status":"placed"}}}'

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s)
const BODY_BYTES = bytes(BODY)

/** HMAC-SHA256(SECRET, `${SEQUENCE_GUID} ${BODY}`) — the only accepted shape. */
const VALID_SIGNATURE =
  "e02008372a70c2e636d8100488110fd93ddfe8984ad98cd4eebf2698d6487997"

/** HMAC over the body alone. The old fallback accepted this. It must not. */
const BODY_ONLY_SIGNATURE =
  "0fbeb244e6b8ecd5e6adeeee93f9117be1ce1b4d9d2e28daa51f49b3eda1794a"

/** The legacy POS separator `" \n "`, which this function deliberately drops. */
const LEGACY_POS_SIGNATURE =
  "bb8dd054d28399596e1f37695f2ddd89813379085c424f12fcccb2bfe488248b"

describe("verifyWebhookSignature", () => {
  it("accepts a signature over guid + space + raw body", async () => {
    await expect(
      verifyWebhookSignature(BODY_BYTES, VALID_SIGNATURE, SEQUENCE_GUID, SECRET)
    ).resolves.toBe(true)
  })

  it("accepts an ArrayBuffer as well as a Uint8Array", async () => {
    const buffer = BODY_BYTES.buffer.slice(
      BODY_BYTES.byteOffset,
      BODY_BYTES.byteOffset + BODY_BYTES.byteLength
    ) as ArrayBuffer

    await expect(
      verifyWebhookSignature(buffer, VALID_SIGNATURE, SEQUENCE_GUID, SECRET)
    ).resolves.toBe(true)
  })

  it("tolerates an uppercase or padded signature header", async () => {
    await expect(
      verifyWebhookSignature(
        BODY_BYTES,
        `  ${VALID_SIGNATURE.toUpperCase()}  `,
        SEQUENCE_GUID,
        SECRET
      )
    ).resolves.toBe(true)
  })

  // ==========================================================================
  // The removed fallback — the reason this file exists
  // ==========================================================================

  it("rejects an HMAC over the body alone", async () => {
    // The old implementation returned true here. A signature with no GUID in
    // it binds a payload to nothing: the same bytes replay under any delivery.
    await expect(
      verifyWebhookSignature(
        BODY_BYTES,
        BODY_ONLY_SIGNATURE,
        SEQUENCE_GUID,
        SECRET
      )
    ).resolves.toBe(false)
  })

  it("rejects the legacy POS separator", async () => {
    await expect(
      verifyWebhookSignature(
        BODY_BYTES,
        LEGACY_POS_SIGNATURE,
        SEQUENCE_GUID,
        SECRET
      )
    ).resolves.toBe(false)
  })

  // ==========================================================================
  // Binding
  // ==========================================================================

  it("rejects a valid signature replayed under a different GUID", async () => {
    await expect(
      verifyWebhookSignature(
        BODY_BYTES,
        VALID_SIGNATURE,
        "00000000-0000-4000-8000-000000000000",
        SECRET
      )
    ).resolves.toBe(false)
  })

  it("rejects a tampered body", async () => {
    await expect(
      verifyWebhookSignature(
        bytes(BODY.replace("fr:1234", "fr:9999")),
        VALID_SIGNATURE,
        SEQUENCE_GUID,
        SECRET
      )
    ).resolves.toBe(false)
  })

  it("rejects a signature made with a different secret", async () => {
    await expect(
      verifyWebhookSignature(
        BODY_BYTES,
        VALID_SIGNATURE,
        SEQUENCE_GUID,
        "whsec_wrong_secret"
      )
    ).resolves.toBe(false)
  })

  it("rejects a re-serialized body whose bytes differ", async () => {
    // Same JSON value, different bytes. Verifying on a re-serialized body is
    // the mistake the raw-bytes signature exists to prevent.
    await expect(
      verifyWebhookSignature(
        bytes(JSON.stringify(JSON.parse(BODY), null, 2)),
        VALID_SIGNATURE,
        SEQUENCE_GUID,
        SECRET
      )
    ).resolves.toBe(false)
  })

  // ==========================================================================
  // Malformed input
  // ==========================================================================

  it.each([
    ["empty signature", "", SEQUENCE_GUID, SECRET],
    ["empty secret", VALID_SIGNATURE, SEQUENCE_GUID, ""],
    ["empty sequence GUID", VALID_SIGNATURE, "", SECRET],
    ["non-hex signature", "not-a-hex-signature", SEQUENCE_GUID, SECRET],
    ["truncated signature", VALID_SIGNATURE.slice(0, 32), SEQUENCE_GUID, SECRET],
    ["over-long signature", `${VALID_SIGNATURE}00`, SEQUENCE_GUID, SECRET],
    ["odd-length hex", VALID_SIGNATURE.slice(0, 63), SEQUENCE_GUID, SECRET],
    ["sha256= prefix, unsupported", `sha256=${VALID_SIGNATURE}`, SEQUENCE_GUID, SECRET],
  ])("rejects %s", async (_label, signature, guid, secret) => {
    await expect(
      verifyWebhookSignature(BODY_BYTES, signature, guid, secret)
    ).resolves.toBe(false)
  })

  it("rejects an empty body signed as if it were the real one", async () => {
    await expect(
      verifyWebhookSignature(
        new Uint8Array(0),
        VALID_SIGNATURE,
        SEQUENCE_GUID,
        SECRET
      )
    ).resolves.toBe(false)
  })
})

// ==========================================================================
// What the shape checks actually buy (#476, held here since #532)
// ==========================================================================

/**
 * A malformed signature never reaches the comparison.
 *
 * WHY THE CASES ABOVE DO NOT SAY THIS. Every "rejects …" case asserts
 * `resolves.toBe(false)`, and #532 measured what that is worth: drop the hex
 * check, the length check and the `sha256=` refusal, rebuild, and all of them
 * stay green. They have to — none of those inputs is a valid HMAC for the body,
 * so the comparison refuses them whichever gate they arrive at. The assertions
 * are true and they hold nothing.
 *
 * WHAT IS ACTUALLY DIFFERENT is stated in the function's own comment: *"Checked
 * before decoding so a truncated header cannot reach the comparison."* With the
 * checks, a malformed header returns `false` having called `crypto.subtle`
 * **not at all**; without them it imports a key and runs a verify over
 * attacker-controlled bytes.
 *
 * That difference is observable, and this is what observes it. The alternative
 * #532 offers — dropping the claim that the checks harden anything — is the
 * wrong one here: the claim is true, it was simply untested.
 */
describe("the shape checks, and what they are for", () => {
  const subtle = crypto.subtle

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** Every `crypto.subtle` entry point the verifier could reach. */
  function watchSubtle() {
    return {
      importKey: vi.spyOn(subtle, "importKey"),
      verify: vi.spyOn(subtle, "verify"),
      digest: vi.spyOn(subtle, "digest"),
    }
  }

  it.each([
    ["non-hex", "not-a-hex-signature-that-is-long-enough-to-be-sixty-four-ch"],
    ["upper-case non-hex", "ZZ".repeat(32)],
    ["truncated", VALID_SIGNATURE.slice(0, 32)],
    ["over-long", `${VALID_SIGNATURE}00`],
    ["odd-length", VALID_SIGNATURE.slice(0, 63)],
    ["prefixed with sha256=", `sha256=${VALID_SIGNATURE}`],
  ])("refuses a %s signature without touching crypto.subtle", async (_label, signature) => {
    const spies = watchSubtle()

    await expect(
      verifyWebhookSignature(BODY_BYTES, signature, SEQUENCE_GUID, SECRET)
    ).resolves.toBe(false)

    expect(spies.importKey).not.toHaveBeenCalled()
    expect(spies.verify).not.toHaveBeenCalled()
    expect(spies.digest).not.toHaveBeenCalled()
  })

  it.each([
    ["no signature", "", SEQUENCE_GUID, SECRET],
    ["no secret", VALID_SIGNATURE, SEQUENCE_GUID, ""],
    ["no sequence GUID", VALID_SIGNATURE, "", SECRET],
  ])("refuses %s without touching crypto.subtle either", async (_l, signature, guid, secret) => {
    const spies = watchSubtle()

    await expect(
      verifyWebhookSignature(BODY_BYTES, signature, guid, secret)
    ).resolves.toBe(false)

    expect(spies.importKey).not.toHaveBeenCalled()
    expect(spies.verify).not.toHaveBeenCalled()
  })

  it("DOES reach the comparison for a well-formed signature", async () => {
    /*
     * The anti-vacuity, and the whole test rests on it: a verifier that refused
     * everything before the crypto would satisfy every case above and accept
     * nothing at all. Well-formed and WRONG — the comparison has to run and
     * answer false.
     */
    const spies = watchSubtle()
    const wellFormedButWrong = "a".repeat(64)

    await expect(
      verifyWebhookSignature(BODY_BYTES, wellFormedButWrong, SEQUENCE_GUID, SECRET)
    ).resolves.toBe(false)

    expect(spies.importKey).toHaveBeenCalledOnce()
    expect(spies.verify).toHaveBeenCalledOnce()
  })

  it("and for the real one, which it accepts", async () => {
    // The other end of the same anti-vacuity: the spies must not be what makes
    // a valid signature fail.
    const spies = watchSubtle()

    await expect(
      verifyWebhookSignature(BODY_BYTES, VALID_SIGNATURE, SEQUENCE_GUID, SECRET)
    ).resolves.toBe(true)

    expect(spies.verify).toHaveBeenCalledOnce()
  })
})
