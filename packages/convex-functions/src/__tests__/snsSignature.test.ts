import { describe, expect, it } from "vitest"
import {
  buildSnsStringToSign,
  canVerify,
  hashAlgorithmFor,
  isValidSigningCertUrl,
} from "../snsSignature"

const NOTIFICATION = {
  Type: "Notification",
  MessageId: "22b80b92-fdea-4c2c-8f9d-bdfb0c7bf324",
  TopicArn: "arn:aws:sns:eu-west-1:123456789012:ses-events",
  Message: '{"notificationType":"Bounce"}',
  Timestamp: "2026-08-29T22:00:00.000Z",
  SignatureVersion: "1",
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
  it("maps the two versions SNS uses and refuses the rest", () => {
    expect(hashAlgorithmFor("1")).toBe("sha1")
    expect(hashAlgorithmFor("2")).toBe("sha256")
    expect(hashAlgorithmFor("3")).toBeNull()
    expect(hashAlgorithmFor(undefined)).toBeNull()
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
    expect(canVerify({ ...NOTIFICATION, SigningCertURL: "https://evil.test/c.pem" })).toBe(false)
    expect(canVerify({ ...NOTIFICATION, Type: "Nonsense" })).toBe(false)
  })
})
