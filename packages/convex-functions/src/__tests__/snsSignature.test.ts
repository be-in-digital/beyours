import { describe, expect, it } from "vitest"
import {
  buildSnsStringToSign,
  canVerify,
  hashAlgorithmFor,
  isAllowedTopic,
  isValidSigningCertUrl,
  mayConfirmSubscription,
  parseAllowedTopicArns,
  topicPolicy,
} from "../snsSignature"

const NOTIFICATION = {
  Type: "Notification",
  MessageId: "22b80b92-fdea-4c2c-8f9d-bdfb0c7bf324",
  TopicArn: "arn:aws:sns:eu-west-1:123456789012:ses-events",
  Message: '{"notificationType":"Bounce"}',
  Timestamp: "2026-08-29T22:00:00.000Z",
  // Version 2 (SHA-256). Version 1 is SHA-1 and is refused — see
  // `hashAlgorithmFor`.
  SignatureVersion: "2",
  Signature: "abc",
  SigningCertURL:
    "https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-1234.pem",
}

describe("isValidSigningCertUrl", () => {
  it("accepts an Amazon SNS certificate host", () => {
    expect(isValidSigningCertUrl(NOTIFICATION.SigningCertURL)).toBe(true)
  })

  it("refuses the shapes an attacker would reach for first", () => {
    for (const url of [
      "http://sns.eu-west-1.amazonaws.com/cert.pem", // not https
      "https://sns.eu-west-1.amazonaws.com.evil.test/cert.pem", // suffix trick
      "https://evil.test/sns.eu-west-1.amazonaws.com/cert.pem", // path trick
      "https://sns.eu-west-1.amazonaws.com:8443/cert.pem", // odd port
      "https://sns.eu-west-1.amazonaws.com/cert.txt", // not a cert
      undefined,
      "not a url",
    ]) {
      expect(isValidSigningCertUrl(url)).toBe(false)
    }
  })

  it("is an SSRF guard, not proof of anything", () => {
    // The whole defect this module exists for: the handler treated a passing
    // URL as an authenticated message. The URL comes from the same body.
    const forged = { ...NOTIFICATION, Message: '{"notificationType":"Complaint"}' }
    expect(isValidSigningCertUrl(forged.SigningCertURL)).toBe(true)
  })
})

describe("buildSnsStringToSign", () => {
  it("emits key then value, one per line, in signing order", () => {
    expect(buildSnsStringToSign(NOTIFICATION)).toBe(
      "Message\n" +
        '{"notificationType":"Bounce"}\n' +
        "MessageId\n" +
        "22b80b92-fdea-4c2c-8f9d-bdfb0c7bf324\n" +
        "Timestamp\n" +
        "2026-08-29T22:00:00.000Z\n" +
        "TopicArn\n" +
        "arn:aws:sns:eu-west-1:123456789012:ses-events\n" +
        "Type\n" +
        "Notification\n"
    )
  })

  it("includes Subject only when the message carries one", () => {
    const withSubject = buildSnsStringToSign({ ...NOTIFICATION, Subject: "hi" })
    expect(withSubject).toContain("Subject\nhi\n")
    // Sent empty instead of omitted, the string never verifies.
    expect(buildSnsStringToSign(NOTIFICATION)).not.toContain("Subject")
  })

  it("signs SubscribeURL and Token for a subscription confirmation", () => {
    const built = buildSnsStringToSign({
      ...NOTIFICATION,
      Type: "SubscriptionConfirmation",
      SubscribeURL: "https://sns.eu-west-1.amazonaws.com/?Action=Confirm",
      Token: "tok",
    })
    expect(built).toContain("SubscribeURL\n")
    expect(built).toContain("Token\ntok\n")
  })

  it("refuses a type it does not know how to reproduce", () => {
    // Failing closed is the point: a string we cannot rebuild must reject,
    // never fall through to "well, accept it then".
    expect(buildSnsStringToSign({ ...NOTIFICATION, Type: "Whatever" })).toBeNull()
    expect(buildSnsStringToSign({ ...NOTIFICATION, Type: undefined })).toBeNull()
  })
})

describe("hashAlgorithmFor", () => {
  it("accepts SignatureVersion 2 and refuses everything else", () => {
    expect(hashAlgorithmFor("2")).toBe("sha256")
    expect(hashAlgorithmFor("3")).toBeNull()
    expect(hashAlgorithmFor(undefined)).toBeNull()
  })

  it("refuses SignatureVersion 1, which is SHA-1", () => {
    // It used to be accepted. The sender picks the version, and the "sender"
    // of a body that has not been authenticated yet is whoever POSTed it — so
    // offering both means the weaker one is the one that counts. AWS added
    // version 2 for exactly this and a topic can be pinned to it.
    expect(hashAlgorithmFor("1")).toBeNull()
  })
})

describe("canVerify", () => {
  it("accepts a message that carries everything a check needs", () => {
    expect(canVerify(NOTIFICATION)).toBe(true)
  })

  it("refuses a message missing any part of the proof", () => {
    expect(canVerify({ ...NOTIFICATION, Signature: undefined })).toBe(false)
    expect(canVerify({ ...NOTIFICATION, Signature: "" })).toBe(false)
    expect(canVerify({ ...NOTIFICATION, SignatureVersion: "9" })).toBe(false)
    expect(canVerify({ ...NOTIFICATION, SignatureVersion: "1" })).toBe(false)
    expect(canVerify({ ...NOTIFICATION, SigningCertURL: "https://evil.test/c.pem" })).toBe(false)
    expect(canVerify({ ...NOTIFICATION, Type: "Nonsense" })).toBe(false)
  })
})

describe("a message type that is not a message type", () => {
  it("refuses an inherited property instead of throwing", () => {
    // `SIGNED_FIELDS` is a plain object, so `SIGNED_FIELDS["constructor"]`
    // used to return `Object.prototype.constructor` — truthy, not an array —
    // and the loop threw out of `canVerify`, before the webhook's try block.
    // An unauthenticated POST could turn its own 403 into a 500.
    for (const type of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(() => buildSnsStringToSign({ ...NOTIFICATION, Type: type })).not.toThrow()
      expect(buildSnsStringToSign({ ...NOTIFICATION, Type: type })).toBeNull()
      expect(canVerify({ ...NOTIFICATION, Type: type })).toBe(false)
    }
  })
})

/**
 * A valid signature says AMAZON sent it, not that OUR topic did.
 *
 * Every SNS topic in every AWS account is signed by the same infrastructure,
 * with a certificate on the same `sns.<region>.amazonaws.com` hosts the URL
 * check allows. So a correctly signed message from a topic an attacker owns
 * passed every check this module made — and the handler behind it marks
 * subscribers bounced and complained from ids in the message body.
 *
 * What made it self-service was the confirmation: the webhook fetched any
 * `SubscribeURL` on an Amazon host once the signature verified, so an attacker
 * pointed their own topic at the endpoint and the endpoint subscribed itself.
 */
describe("which topic a message is from", () => {
  const OURS = "arn:aws:sns:eu-west-1:123456789012:ses-events"
  const THEIRS = "arn:aws:sns:eu-west-1:999999999999:ses-events"

  describe("parseAllowedTopicArns", () => {
    it("reads one, several, or none", () => {
      expect(parseAllowedTopicArns(OURS)).toEqual([OURS])
      expect(parseAllowedTopicArns(` ${OURS} , ${THEIRS} `)).toEqual([OURS, THEIRS])
      expect(parseAllowedTopicArns("")).toEqual([])
      expect(parseAllowedTopicArns(undefined)).toEqual([])
      expect(parseAllowedTopicArns(" , ")).toEqual([])
    })
  })

  describe("isAllowedTopic", () => {
    it("accepts the configured topic and refuses another account's", () => {
      expect(isAllowedTopic(OURS, [OURS])).toBe(true)
      expect(isAllowedTopic(THEIRS, [OURS])).toBe(false)
      expect(isAllowedTopic(undefined, [OURS])).toBe(false)
    })

    it("matches the whole ARN, not a prefix of it", () => {
      // `arn:…:111:beyours` must not be satisfied by
      // `arn:…:999:beyours-evil`, which is what a `startsWith` or an
      // `includes` would do.
      expect(isAllowedTopic(`${OURS}-evil`, [OURS])).toBe(false)
      expect(isAllowedTopic(OURS.slice(0, -1), [OURS])).toBe(false)
    })

    it("refuses everything when nothing is configured", () => {
      // This answered `true`, and the argument for it was that SNS delivers
      // only on a CONFIRMED subscription while `mayConfirmSubscription`
      // refuses to create one. The argument has a hole in it and the hole is
      // the attack: nothing requires a subscription at all. `/webhooks/ses` is
      // an HTTPS URL that takes a POST from anyone, so an attacker publishes
      // on their own topic, keeps the JSON Amazon signed for them, and replays
      // it here. Signature genuine, certificate on an allowed host, topic
      // check waved through — and the handler behind it marks whichever
      // subscribers the body names bounced and complained.
      expect(isAllowedTopic(THEIRS, [])).toBe(false)
      expect(isAllowedTopic(undefined, [])).toBe(false)
    })

    it("re-opens only for an operator who says so, in as many words", () => {
      // The hatch keeps an already-confirmed subscription recording bounces
      // while a deployment is being configured. It is a separate variable so
      // that restoring a fail-open is an act somebody performed.
      expect(isAllowedTopic(THEIRS, [], true)).toBe(true)
      // And it re-opens nothing once a list exists: a configured deployment
      // that also sets the hatch still refuses a topic it does not name.
      expect(isAllowedTopic(THEIRS, [OURS], true)).toBe(false)
    })
  })

  describe("topicPolicy", () => {
    it("reads the list, and names the refusal an unconfigured deployment earns", () => {
      expect(topicPolicy({})).toEqual({
        allowed: [],
        allowAnyTopic: false,
        reason: "topic_not_configured",
      })
      expect(topicPolicy({ SES_SNS_TOPIC_ARN: `${OURS}, ${THEIRS}` })).toEqual({
        allowed: [OURS, THEIRS],
        allowAnyTopic: false,
        reason: "topic_not_allowed",
      })
    })

    it("opens the hatch for `true` and for nothing else", () => {
      // A truthiness test on `process.env` reads "false" and "0" as on, which
      // is how an operator turning something off turns it on.
      expect(topicPolicy({ SES_SNS_ALLOW_ANY_TOPIC: "true" }).allowAnyTopic).toBe(true)
      expect(topicPolicy({ SES_SNS_ALLOW_ANY_TOPIC: " TRUE " }).allowAnyTopic).toBe(true)
      for (const value of ["false", "0", "", "yes", "1"]) {
        expect(topicPolicy({ SES_SNS_ALLOW_ANY_TOPIC: value }).allowAnyTopic).toBe(false)
      }
    })
  })

  describe("mayConfirmSubscription", () => {
    it("confirms only a topic this deployment was told about", () => {
      expect(mayConfirmSubscription(OURS, [OURS])).toBe(true)
      expect(mayConfirmSubscription(THEIRS, [OURS])).toBe(false)
    })

    it("confirms nothing at all when nothing is configured", () => {
      // The opposite default from `isAllowedTopic`, and the difference is the
      // whole fix: confirming a subscription is what turns "a stranger pointed
      // their topic at us" into "a stranger can publish to us". An operator
      // can still confirm one from the AWS console.
      expect(mayConfirmSubscription(OURS, [])).toBe(false)
      expect(mayConfirmSubscription(undefined, [])).toBe(false)
    })
  })
})
