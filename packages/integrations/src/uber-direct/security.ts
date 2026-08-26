/**
 * Uber Direct — webhook signature
 *
 * Uber signs Direct webhooks the same way it signs Uber Eats ones: HMAC-SHA256
 * over the raw body, hex-encoded, in `x-uber-signature`. The verification is
 * therefore delegated rather than reimplemented — one signing routine, one
 * place to fix if Uber ever changes it.
 */

import { verifyUberEatsSignature } from "../uber-eats/security"

/** Header carrying the signature on an Uber Direct webhook. */
export const UBER_DIRECT_SIGNATURE_HEADER = "x-uber-signature"

/**
 * Verify an Uber Direct webhook signature.
 *
 * Returns `false` on anything suspicious — missing header, non-hex signature,
 * length mismatch — rather than throwing, so the caller can answer 401 without
 * a try/catch.
 */
export async function verifyUberDirectSignature(
  rawBody: string,
  signature: string,
  signingSecret: string
): Promise<boolean> {
  return verifyUberEatsSignature(rawBody, signature, signingSecret)
}
