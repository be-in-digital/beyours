/**
 * Authenticating a Resend webhook.
 *
 * WHY THIS EXISTS: `EMAIL_PROVIDER=resend` is the escape hatch for a client
 * whose AWS SES production-access request was refused, and it shipped with no
 * feedback path at all. `/webhooks/ses` was the only feedback endpoint among
 * the routes in `each app's convex/http.ts`, and SNS never calls it on a Resend
 * deployment — so that client mailed a growing list with zero suppression: a
 * dead mailbox was re-mailed on every campaign, a spam report was never
 * recorded, and the first symptom available to anyone was the sending domain
 * being throttled.
 *
 * Resend signs its webhooks with Svix. The scheme is symmetric HMAC-SHA256
 * rather than SNS's RSA, which is why this module needs no Node runtime: the
 * verification itself is a `crypto.subtle.verify` the Convex V8 runtime already
 * runs (see `deliverooWebhookHandler.ts`). What lives here is everything that
 * can be tested without a key or a network — which headers carry the signature,
 * exactly which bytes are signed, how old a message may be, and which Resend
 * event maps onto which of ours.
 *
 * Reference: "Verifying webhooks", Svix docs; "Webhooks", Resend docs.
 */

/** The environment variable naming the signing secret Resend issued. */
export const RESEND_WEBHOOK_SECRET_ENV = "RESEND_WEBHOOK_SECRET"

/**
 * How far out of date a signed message may be, in milliseconds.
 *
 * Svix's own tolerance, and the reason it exists: the signature covers the
 * timestamp, so an attacker who captures one delivery cannot replay it for
 * ever. Five minutes is long enough for a retry and a clock that is a little
 * out, and short enough that a captured body stops being useful the same
 * afternoon.
 */
export const RESEND_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000

/** The three headers Svix signs with, under either of the two spellings. */
export interface SvixHeaders {
  id: string
  timestamp: string
  signature: string
}

/**
 * Pull the Svix triple out of a request's headers.
 *
 * Svix sends `svix-id` / `svix-timestamp` / `svix-signature`, and white-labelled
 * senders send the same three as `webhook-*`. Resend uses the `svix-` spelling
 * today; both are read because which one arrives is the sender's choice and not
 * ours, and a verifier that silently fails closed on the other spelling would
 * look exactly like a bad secret.
 *
 * Returns `null` when any of the three is missing — a partial triple cannot be
 * verified, and guessing at the missing one is how a check becomes decorative.
 */
export function readSvixHeaders(
  headers: { get(name: string): string | null } | undefined | null
): SvixHeaders | null {
  if (!headers) return null
  const read = (name: string) =>
    headers.get(`svix-${name}`) ?? headers.get(`webhook-${name}`) ?? null
  const id = read("id")
  const timestamp = read("timestamp")
  const signature = read("signature")
  if (!id || !timestamp || !signature) return null
  return { id, timestamp, signature }
}

/**
 * The exact bytes Svix signs: `<id>.<timestamp>.<body>`.
 *
 * The body is the raw text as received, not a re-serialisation of the parsed
 * object. `JSON.parse` then `JSON.stringify` reorders nothing in practice but
 * normalises whitespace and number formatting, and either would change the
 * digest — which is the classic way a signature check comes out permanently
 * false and gets "fixed" by being removed.
 */
export function buildSvixSignedPayload(
  id: string,
  timestamp: string,
  rawBody: string
): string {
  return `${id}.${timestamp}.${rawBody}`
}

/**
 * Is this message recent enough to act on?
 *
 * `timestamp` is seconds since the epoch, as a string, per Svix. A value that
 * is not an integer is refused rather than coerced: `Number("")` is 0, which
 * would read as 1970 and be refused anyway, but `Number("1e9")` is a valid
 * number that no sender would ever write, and accepting it means the parser and
 * the signer disagree about what the signed bytes said.
 *
 * The window is symmetric. A message from the future is as suspicious as a
 * stale one, and a clock skewed the wrong way is a misconfiguration worth
 * seeing rather than tolerating silently.
 */
export function isFreshTimestamp(
  timestamp: string,
  nowMs: number,
  toleranceMs: number = RESEND_TIMESTAMP_TOLERANCE_MS
): boolean {
  if (!/^\d{1,15}$/.test(timestamp)) return false
  const sentMs = Number(timestamp) * 1000
  if (!Number.isFinite(sentMs)) return false
  return Math.abs(nowMs - sentMs) <= toleranceMs
}

/**
 * The candidate signatures in a `svix-signature` header.
 *
 * The header is a space-delimited list of `<version>,<base64>` pairs, because
 * Svix rotates secrets by signing one delivery with both. Only `v1` is a scheme
 * we know how to check; anything else is dropped rather than treated as opaque,
 * so a future `v2` cannot be smuggled past as an unverified match.
 */
export function parseSignatureHeader(raw: string | undefined | null): string[] {
  if (!raw) return []
  return raw
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .map((part) => part.slice("v1,".length))
    .filter((sig) => sig.length > 0)
}

/**
 * The HMAC key inside a `whsec_`-prefixed secret.
 *
 * Svix writes the secret as `whsec_` plus standard base64 of the raw key
 * bytes. The prefix is not part of the key: signing with the whole string
 * produces a digest that never matches, which is a failure mode that looks
 * identical to an attack and is why this is a named function with a test rather
 * than a `.replace()` at the call site.
 *
 * A secret with no prefix is accepted as already being the base64 — some
 * dashboards copy it that way — and an empty one is refused.
 */
export function parseWebhookSecret(raw: string | undefined | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const material = trimmed.startsWith("whsec_")
    ? trimmed.slice("whsec_".length)
    : trimmed
  return material.length > 0 ? material : null
}

/**
 * Compare two base64 signatures without leaking where they diverge.
 *
 * `a === b` on strings short-circuits at the first differing character, and the
 * timing of that is measurable across enough requests. Length is compared first
 * and is not secret; the bytes are then compared in full, every time.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/** The Resend events this product records, and what it records them as. */
export const RESEND_EVENT_TYPES = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.complained",
  "email.failed",
] as const

export type ResendEventType = (typeof RESEND_EVENT_TYPES)[number]

/** The `emailEvents.type` a Resend event becomes, or `null` to record nothing. */
export type RecordedEmailEvent =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"

/**
 * Map a Resend event onto the event this product stores.
 *
 * `email.delivery_delayed` is deliberately absent: a delay is not a delivery
 * and it is not a bounce, and Resend follows it with one of the two. Recording
 * it would move a counter that the later event moves again.
 *
 * `email.failed` maps to `bounced`, which is what it is — Resend could not hand
 * the message to the receiving server. It carries no `bounce.type`, so it
 * suppresses only on the third strike, which is the cautious reading and the
 * one `markBounced` already implements for a bounce with no classification.
 */
export function recordedEventFor(type: string | undefined): RecordedEmailEvent | null {
  switch (type) {
    case "email.sent":
      return "sent"
    case "email.delivered":
      return "delivered"
    case "email.opened":
      return "opened"
    case "email.clicked":
      return "clicked"
    case "email.bounced":
    case "email.failed":
      return "bounced"
    case "email.complained":
      return "complained"
    default:
      return null
  }
}

/**
 * Does this event suppress the address, whatever the campaign was?
 *
 * The same rule the SES path applies, for the same reason: a hard bounce says
 * the mailbox does not exist and a complaint says this person reported us, and
 * neither fact depends on knowing which campaign carried the message. Both
 * suppress. Deliveries, opens and clicks are campaign statistics and are
 * dropped rather than attributed to a store that did not send the message.
 */
export function suppressesRecipient(type: string | undefined): boolean {
  const recorded = recordedEventFor(type)
  return recorded === "bounced" || recorded === "complained"
}
