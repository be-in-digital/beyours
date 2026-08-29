/**
 * Authenticating an Amazon SNS message.
 *
 * WHY THIS EXISTS: `/webhooks/ses` accepted any POST whose body happened to
 * carry a `SigningCertURL` that LOOKED like Amazon's. That is not a check —
 * the attacker writes the field being validated. The handler then read
 * `X-Subscriber-Id`, `X-Store-Id` and `X-Campaign-Id` out of the same unsigned
 * body and used them to mark subscribers bounced, mark them as having
 * complained, and increment campaign counters. An unauthenticated request could
 * therefore suppress any address the restaurant mails and rewrite its
 * statistics.
 *
 * The URL check was not useless, it was misplaced: it belongs where it now
 * lives, as the guard that stops us FETCHING an attacker-chosen host (SSRF),
 * and it was standing in for an authenticity check it cannot perform.
 *
 * Real authentication is the RSA signature SNS puts on every message. This
 * module holds the part that can be tested without a network or a Node
 * runtime — which host is acceptable, and exactly which bytes are signed. The
 * verification itself needs `node:crypto` and lives in an app's
 * `sesWebhookVerify.ts`, following `stripeWebhookVerify.ts`.
 *
 * Reference: "Verifying the signatures of Amazon SNS messages", AWS docs.
 */

/** The SNS envelope, as far as authenticating it is concerned. */
export interface SnsEnvelope {
  Type?: string
  MessageId?: string
  TopicArn?: string
  Subject?: string
  Message?: string
  Timestamp?: string
  SubscribeURL?: string
  Token?: string
  SignatureVersion?: string
  Signature?: string
  SigningCertURL?: string
}

/**
 * May we fetch this signing certificate?
 *
 * Answers a question about SSRF, not about authenticity: it decides whether the
 * host in an untrusted body is one we are willing to make a request to. A
 * message can pass this and still be a forgery — that is what the signature is
 * for.
 */
export function isValidSigningCertUrl(certUrl: string | undefined): boolean {
  if (!certUrl) return false
  try {
    const url = new URL(certUrl)
    return (
      url.protocol === "https:" &&
      /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(url.hostname) &&
      url.pathname.endsWith(".pem") &&
      !url.port
    )
  } catch {
    return false
  }
}

/**
 * The fields SNS signs, in the order it signs them.
 *
 * Alphabetical, and different per message type — a `SubscriptionConfirmation`
 * signs `SubscribeURL` and `Token` where a `Notification` signs `Subject`. Get
 * the list or the order wrong and every message fails, which is the failure
 * mode to prefer: a signature that cannot be reproduced rejects, it does not
 * admit.
 */
const SIGNED_FIELDS: Record<string, readonly (keyof SnsEnvelope)[]> = {
  Notification: ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"],
  SubscriptionConfirmation: [
    "Message",
    "MessageId",
    "SubscribeURL",
    "Timestamp",
    "Token",
    "TopicArn",
    "Type",
  ],
  UnsubscribeConfirmation: [
    "Message",
    "MessageId",
    "SubscribeURL",
    "Timestamp",
    "Token",
    "TopicArn",
    "Type",
  ],
}

/** `SignatureVersion` → the digest SNS used. */
export function hashAlgorithmFor(version: string | undefined): "sha1" | "sha256" | null {
  if (version === "1") return "sha1"
  if (version === "2") return "sha256"
  return null
}

/**
 * Rebuild the exact bytes SNS signed, or `null` if we cannot.
 *
 * `Subject` is omitted when absent rather than sent empty — SNS signs the key
 * only when it has a value, and including it anyway produces a string that
 * never verifies.
 */
export function buildSnsStringToSign(message: SnsEnvelope): string | null {
  const fields = message.Type ? SIGNED_FIELDS[message.Type] : undefined
  if (!fields) return null

  let out = ""
  for (const field of fields) {
    const value = message[field]
    if (value === undefined || value === null) continue
    out += `${field}\n${value}\n`
  }
  return out
}

/** Everything that must be present before a signature check is even possible. */
export function canVerify(message: SnsEnvelope): boolean {
  return (
    typeof message.Signature === "string" &&
    message.Signature.length > 0 &&
    hashAlgorithmFor(message.SignatureVersion) !== null &&
    isValidSigningCertUrl(message.SigningCertURL) &&
    buildSnsStringToSign(message) !== null
  )
}
