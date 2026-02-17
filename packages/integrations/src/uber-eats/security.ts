/**
 * Uber Eats webhook signature verification
 * Uses Web Crypto API (compatible with Convex runtime, no Node.js crypto)
 */

/**
 * Verify the x-uber-signature header on incoming webhooks
 *
 * Uber Eats signs the raw request body with HMAC-SHA256 using the client secret.
 * The signature is sent in the x-uber-signature header.
 */
export async function verifyUberEatsSignature(
  rawBody: string,
  signature: string,
  clientSecret: string
): Promise<boolean> {
  if (!signature || !clientSecret) {
    return false
  }

  // Normalize incoming signature: lowercase, trim, and validate hex format
  const normalizedSignature = signature.toLowerCase().trim()
  if (!/^[0-9a-f]+$/.test(normalizedSignature)) {
    return false
  }

  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(clientSecret)
    const bodyData = encoder.encode(rawBody)

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, bodyData)

    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(signatureBuffer))
    const computedSignature = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    // Constant-time comparison
    if (computedSignature.length !== normalizedSignature.length) {
      return false
    }

    let result = 0
    for (let i = 0; i < computedSignature.length; i++) {
      result |= computedSignature.charCodeAt(i) ^ normalizedSignature.charCodeAt(i)
    }
    return result === 0
  } catch {
    return false
  }
}
