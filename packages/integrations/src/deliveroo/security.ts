/**
 * Deliveroo webhook signature verification using HMAC-SHA256
 * Uses Web Crypto API (compatible with all runtimes, no Node.js crypto)
 */

/**
 * The byte joining the sequence GUID to the body in the signed message.
 *
 * A single space for every modern webhook: order events, rider events, menu,
 * picking, catalogue, Express and Signature. The legacy POS webhook
 * (`new_order` / `cancel_order`) signs with `" \n "` instead and is NOT
 * supported here — nothing in this platform subscribes to it, and offering
 * both separators from one function is how a verifier ends up accepting a
 * message it should have refused.
 */
const SIGNATURE_SEPARATOR = " "

/**
 * Verify a Deliveroo webhook signature (HMAC-SHA256).
 *
 * The signed message is `sequence_guid + " " + raw body bytes`, hex-encoded,
 * keyed on the webhook secret. Two headers carry it:
 * - `X-Deliveroo-Hmac-Sha256` — the hex signature
 * - `X-Deliveroo-Sequence-Guid` — the GUID that goes into the message
 *
 * The body must be passed as **raw bytes**, exactly as received. Decoding it
 * to a string and re-encoding is usually lossless and occasionally is not;
 * re-serializing parsed JSON never is. Either changes the bytes and the
 * signature stops matching, which surfaces as an unexplained 401 in
 * production and nowhere else.
 *
 * This function previously took the body as a string, read the GUID from the
 * wrong header (`X-Deliveroo-Request-Id`), and — on a mismatch — fell back to
 * verifying the body alone. That fallback accepted a signature computed with
 * no GUID at all, which is both a real forgery class (nothing binds the
 * payload to its delivery) and precisely the malformed signature the e2e
 * suites were producing. There is no fallback now: one message shape, or 401.
 *
 * @param rawBody      the request body as received, undecoded
 * @param signature    the `X-Deliveroo-Hmac-Sha256` header value
 * @param sequenceGuid the `X-Deliveroo-Sequence-Guid` header value
 * @param secret       the webhook secret from the Developer Portal
 */
export async function verifyWebhookSignature(
  rawBody: ArrayBuffer | Uint8Array,
  signature: string,
  sequenceGuid: string,
  secret: string
): Promise<boolean> {
  if (!signature || !secret || !sequenceGuid) return false

  // Normalize incoming signature: lowercase, trim, and validate hex format
  const normalizedSignature = signature.toLowerCase().trim()
  if (!/^[0-9a-f]+$/.test(normalizedSignature)) {
    return false
  }
  // SHA-256 is 32 bytes, so a valid hex signature is exactly 64 characters.
  // Checked before decoding so a truncated header cannot reach the comparison.
  if (normalizedSignature.length !== 64) {
    return false
  }

  try {
    const encoder = new TextEncoder()

    const bodyBytes =
      rawBody instanceof Uint8Array ? rawBody : new Uint8Array(rawBody)
    const guidBytes = encoder.encode(sequenceGuid)
    const separatorBytes = encoder.encode(SIGNATURE_SEPARATOR)

    // Message = guid bytes + separator byte + body bytes
    const message = new Uint8Array(
      guidBytes.length + separatorBytes.length + bodyBytes.length
    )
    message.set(guidBytes, 0)
    message.set(separatorBytes, guidBytes.length)
    message.set(bodyBytes, guidBytes.length + separatorBytes.length)

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    )

    // `crypto.subtle.verify` compares in constant time, so no hex string ever
    // gets compared character by character.
    return await crypto.subtle.verify(
      "HMAC",
      key,
      hexToArrayBuffer(normalizedSignature),
      message
    )
  } catch {
    return false
  }
}

/**
 * Decode a validated even-length lowercase hex string to an ArrayBuffer.
 *
 * Returns the buffer rather than the view: since TypeScript 5.7 a bare
 * `Uint8Array` is `Uint8Array<ArrayBufferLike>`, which `BufferSource` does not
 * accept, and `ArrayBuffer` sidesteps the generic entirely.
 */
function hexToArrayBuffer(hex: string): ArrayBuffer {
  const buffer = new ArrayBuffer(hex.length / 2)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return buffer
}
