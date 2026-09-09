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

/**
 * `SignatureVersion` → the digest SNS used.
 *
 * VERSION 1 IS REFUSED, and it used to be accepted. It is SHA-1, which has
 * been a broken hash for collision resistance since 2017; AWS added
 * SignatureVersion 2 for exactly that reason and lets a topic be pinned to it
 * (`SignatureVersion` topic attribute, or the console's "Signature version"
 * setting). Accepting both means the weaker one is the one that matters, since
 * the sender picks — and here the "sender" of a body we have not yet
 * authenticated is whoever POSTed it.
 *
 * The cost is real and it is one line of setup: a topic still on version 1 has
 * its notifications rejected as `signature_version` until it is moved to 2.
 * That is written up in `tasks/webhook-migration-checklist.md`, and it is the
 * failure to prefer — a rejected notification is a bounce we do not record; an
 * accepted forgery is a customer's address suppressed by a stranger.
 */
export function hashAlgorithmFor(version: string | undefined): "sha256" | null {
  return version === "2" ? "sha256" : null
}

/**
 * Rebuild the exact bytes SNS signed, or `null` if we cannot.
 *
 * `Subject` is omitted when absent rather than sent empty — SNS signs the key
 * only when it has a value, and including it anyway produces a string that
 * never verifies.
 */
export function buildSnsStringToSign(message: SnsEnvelope): string | null {
  // `hasOwnProperty`, not a bare index: `SIGNED_FIELDS` is a plain object, so
  // `Type: "constructor"` returned `Object.prototype.constructor` — truthy, not
  // an array — and the loop below threw `fields is not iterable` out of
  // `canVerify`, before the webhook's own try block. An unauthenticated POST
  // could turn a 403 into a 500 that way.
  const fields =
    message.Type && Object.prototype.hasOwnProperty.call(SIGNED_FIELDS, message.Type)
      ? SIGNED_FIELDS[message.Type]
      : undefined
  if (!fields) return null

  let out = ""
  for (const field of fields) {
    const value = message[field]
    if (value === undefined || value === null) continue
    out += `${field}\n${value}\n`
  }
  return out
}

/**
 * Which SNS topics this deployment accepts messages from.
 *
 * WHY A SIGNATURE IS NOT ENOUGH. The RSA check proves Amazon sent the message.
 * It does not prove that OUR topic did: every SNS topic in every AWS account
 * is signed by the same infrastructure, with a certificate on the same
 * `sns.<region>.amazonaws.com` hosts the URL check allows. So a correctly
 * signed message from a topic an attacker owns passed every check this module
 * made, and the handler behind it marks subscribers bounced and complained
 * from ids in the message body.
 *
 * The step that made it self-service was `SubscriptionConfirmation`: the
 * webhook fetched any `SubscribeURL` on an `sns.*.amazonaws.com` host once the
 * signature verified, so an attacker pointed their own topic at this endpoint
 * and the endpoint confirmed the subscription for them. Nothing else was
 * needed.
 *
 * The list is configuration, not code — one deployment per client, each with
 * its own topic — so it is read from `SES_SNS_TOPIC_ARN` (comma-separated for
 * the rare deployment with more than one).
 */
export const SES_SNS_TOPIC_ARN_ENV = "SES_SNS_TOPIC_ARN"

/** Read the configured topics, or an empty list when none are configured. */
export function parseAllowedTopicArns(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

/**
 * Is this message from a topic this deployment accepts?
 *
 * NO LIST MEANS NO. This used to answer `true` on an empty list, and the
 * argument for it was that SNS delivers only to a confirmed subscription and
 * `mayConfirmSubscription` refuses to create one — so the fail-open could not
 * be reached. That reasoning has a hole in it, and the hole is the whole
 * attack: **nothing here requires a subscription at all.** The endpoint is an
 * HTTPS URL that accepts a POST from anyone. An attacker publishes a message
 * on their OWN topic, to a subscription pointing at their own server, keeps
 * the signed JSON Amazon hands them, and `curl`s it here. The signature is
 * genuine — Amazon really did sign it — the certificate is on an
 * `sns.<region>.amazonaws.com` host, and with no list configured the topic
 * check waved it through. The body is theirs to write, so
 * `emailHttpHandlers.ts` marked whichever subscribers they named bounced and
 * complained, suppressing mail to real customers and corrupting campaign
 * counters. Blocking self-subscription never closed that, because the attack
 * never needed a subscription.
 *
 * SO IT REFUSES, and the refusal is loud rather than silent: the caller logs
 * `topic_not_configured` and the ARN it saw, which is the value to paste into
 * `SES_SNS_TOPIC_ARN`. The cost of refusing is that a deployment which has not
 * been configured stops recording bounces and complaints — bookkeeping, and
 * `tasks/webhook-migration-checklist.md` already requires the variable to be
 * set *before* the subscription is confirmed, so no deployment is meant to be
 * in that state. The cost of accepting is that anyone on the internet decides
 * which of a client's customers can be emailed. Those are not comparable, and
 * an authentication check that answers "yes" when it has not been configured
 * is not an authentication check.
 *
 * `SES_SNS_ALLOW_ANY_TOPIC` is the escape hatch for an operator who needs the
 * old behaviour while they configure the real thing — see
 * `topicPolicy`. It is deliberately a separate variable: restoring a
 * fail-open should be an act someone performs and can be seen to have
 * performed, not the default nobody chose.
 *
 * A `TopicArn` compared with `===`: an ARN is an exact identifier, and prefix
 * or `includes` matching on one is how `arn:aws:sns:eu-west-1:111:beyours` is
 * satisfied by `arn:aws:sns:eu-west-1:999:beyours-evil`.
 */
export function isAllowedTopic(
  topicArn: string | undefined,
  allowed: readonly string[],
  /** Set only by an operator who has deliberately re-opened the endpoint. */
  allowAnyTopic = false
): boolean {
  if (allowed.length === 0) return allowAnyTopic
  return typeof topicArn === "string" && allowed.includes(topicArn)
}

/** The variable that re-opens the endpoint to any correctly-signed topic. */
export const SES_SNS_ALLOW_ANY_TOPIC_ENV = "SES_SNS_ALLOW_ANY_TOPIC"

/**
 * What a deployment's two SNS variables add up to.
 *
 * One place, so the webhook and its tests read the same rule and an operator
 * reading a log gets the reason rather than a boolean. `reason` is what the
 * caller reports when a message is refused:
 *
 *   `topic_not_configured` — `SES_SNS_TOPIC_ARN` is unset. Set it.
 *   `topic_not_allowed`    — it is set and this is not one of its topics.
 *
 * Only the exact string `"true"` opens the hatch: `"false"`, `"0"` and an
 * empty string are all somebody trying to turn it off, and a truthiness test
 * on `process.env` reads every one of them as on.
 */
export function topicPolicy(env: Record<string, string | undefined>): {
  allowed: string[]
  allowAnyTopic: boolean
  reason: "topic_not_configured" | "topic_not_allowed"
} {
  const allowed = parseAllowedTopicArns(env[SES_SNS_TOPIC_ARN_ENV])
  return {
    allowed,
    allowAnyTopic: env[SES_SNS_ALLOW_ANY_TOPIC_ENV]?.trim().toLowerCase() === "true",
    reason: allowed.length === 0 ? "topic_not_configured" : "topic_not_allowed",
  }
}

/**
 * May this deployment confirm a subscription by fetching its `SubscribeURL`?
 *
 * ONLY for a topic that is named in the configuration. Confirming a
 * subscription is what turns "a stranger pointed their topic at us" into "a
 * stranger can publish to us", and it is a once-per-deployment operation that
 * an operator can also do from the AWS console. A deployment with no
 * configured topic confirms nothing and says so in its log, which is a setup
 * step; the alternative default cost the endpoint its authenticity.
 *
 * `SES_SNS_ALLOW_ANY_TOPIC` does NOT reach here, and that is the point of it
 * being a separate decision. The hatch exists so a deployment mid-configuration
 * keeps RECORDING bounces on a subscription an operator already confirmed. It
 * is not a licence to create new ones: an endpoint that subscribes itself to a
 * stranger's topic is the original defect, and no environment variable should
 * be able to put it back.
 */
export function mayConfirmSubscription(
  topicArn: string | undefined,
  allowed: readonly string[]
): boolean {
  if (allowed.length === 0) return false
  return typeof topicArn === "string" && allowed.includes(topicArn)
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
