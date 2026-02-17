/**
 * Deliveroo webhook signature verification using HMAC-SHA256
 * Uses Web Crypto API (compatible with all runtimes, no Node.js crypto)
 */

/**
 * Verify Deliveroo webhook signature (HMAC-SHA256)
 *
 * Deliveroo signs webhooks with: HMAC-SHA256(secret, requestId + " " + rawBody)
 * The signature is in header: X-Deliveroo-Hmac-SHA256
 * The request ID is in header: X-Deliveroo-Request-Id
 *
 * Dual strategy: try with requestId prefix first, fallback to body-only
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  requestId: string,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) return false

  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )

    // Strategy 1: HMAC(secret, requestId + " " + rawBody)
    const data1 = encoder.encode(requestId + " " + rawBody)
    const sig1 = await crypto.subtle.sign("HMAC", key, data1)
    const hex1 = arrayToHex(new Uint8Array(sig1))
    if (safeCompare(hex1, signature)) return true

    // Strategy 2 (fallback): HMAC(secret, rawBody)
    const data2 = encoder.encode(rawBody)
    const sig2 = await crypto.subtle.sign("HMAC", key, data2)
    const hex2 = arrayToHex(new Uint8Array(sig2))
    return safeCompare(hex2, signature)
  } catch {
    return false
  }
}

function arrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
