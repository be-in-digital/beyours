import { describe, expect, it } from "vitest"

import {
  RESEND_TIMESTAMP_TOLERANCE_MS,
  RESEND_WEBHOOK_SECRET_ENV,
  buildSvixSignedPayload,
  isFreshTimestamp,
  parseSignatureHeader,
  parseWebhookSecret,
  readSvixHeaders,
  recordedEventFor,
  suppressesRecipient,
  timingSafeEqual,
} from "../resendSignature"

/**
 * Authenticating a Resend webhook, in the parts that can be tested without a
 * key or a network.
 *
 * WHAT WAS BROKEN (#444). `EMAIL_PROVIDER=resend` shipped with no feedback
 * path at all — `/webhooks/ses` was the only feedback endpoint in the app and
 * SNS never calls it on a Resend deployment. That client mailed a growing list
 * with zero suppression, and the first symptom available to anybody was the
 * sending domain being throttled.
 *
 * Every function below decides whether a POST is acted on. The handler that
 * uses them marks subscribers bounced and complained from ids and addresses in
 * the body, so each one of these is a door.
 */

function headersOf(entries: Record<string, string>) {
  return new Headers(entries)
}

describe("readSvixHeaders", () => {
  it("reads the `svix-` spelling Resend sends", () => {
    expect(
      readSvixHeaders(
        headersOf({
          "svix-id": "msg_1",
          "svix-timestamp": "1700000000",
          "svix-signature": "v1,abc",
        })
      )
    ).toEqual({ id: "msg_1", timestamp: "1700000000", signature: "v1,abc" })
  })

  it("also reads the `webhook-` spelling a white-labelled sender uses", () => {
    // Not hypothetical: Svix documents both, and which one arrives is the
    // sender's choice. A verifier blind to one looks exactly like a bad secret.
    expect(
      readSvixHeaders(
        headersOf({
          "webhook-id": "msg_2",
          "webhook-timestamp": "1700000001",
          "webhook-signature": "v1,def",
        })
      )
    ).toEqual({ id: "msg_2", timestamp: "1700000001", signature: "v1,def" })
  })

  it("refuses a partial triple rather than guessing at the missing one", () => {
    expect(
      readSvixHeaders(
        headersOf({ "svix-id": "msg_3", "svix-timestamp": "1700000000" })
      )
    ).toBeNull()
    expect(readSvixHeaders(headersOf({}))).toBeNull()
    expect(readSvixHeaders(null)).toBeNull()
  })
})

describe("buildSvixSignedPayload", () => {
  it("signs `<id>.<timestamp>.<body>`, with the body byte for byte", () => {
    // The raw text, never a re-serialisation: `JSON.parse` then `stringify`
    // normalises whitespace, which changes the digest and turns the check
    // permanently false.
    const body = '{ "type":  "email.bounced" }'
    expect(buildSvixSignedPayload("msg_1", "1700000000", body)).toBe(
      `msg_1.1700000000.${body}`
    )
  })
})

describe("isFreshTimestamp", () => {
  const now = 1_700_000_000_000

  it("accepts a message inside the replay window", () => {
    expect(isFreshTimestamp("1700000000", now)).toBe(true)
    expect(
      isFreshTimestamp(String((now - RESEND_TIMESTAMP_TOLERANCE_MS) / 1000), now)
    ).toBe(true)
  })

  it("refuses one older than the window — a captured delivery must expire", () => {
    expect(isFreshTimestamp(String((now - 6 * 60 * 1000) / 1000), now)).toBe(false)
  })

  it("refuses one from the future, which is a skewed clock worth seeing", () => {
    expect(isFreshTimestamp(String((now + 6 * 60 * 1000) / 1000), now)).toBe(false)
  })

  it("refuses anything that is not a plain integer of seconds", () => {
    // `Number("1e9")` is a valid number no signer would write, and accepting it
    // means the parser and the signer disagree about the signed bytes.
    expect(isFreshTimestamp("1e9", now)).toBe(false)
    expect(isFreshTimestamp("", now)).toBe(false)
    expect(isFreshTimestamp("-1700000000", now)).toBe(false)
    expect(isFreshTimestamp("1700000000.5", now)).toBe(false)
  })
})

describe("parseSignatureHeader", () => {
  it("returns every v1 candidate — Svix signs with both during a rotation", () => {
    expect(parseSignatureHeader("v1,aaa v1,bbb")).toEqual(["aaa", "bbb"])
  })

  it("drops a version this code cannot check, rather than treating it as opaque", () => {
    // A future `v2` must not be smuggled through as an unverified match.
    expect(parseSignatureHeader("v2,aaa")).toEqual([])
    expect(parseSignatureHeader("v2,aaa v1,bbb")).toEqual(["bbb"])
  })

  it("returns nothing for an absent or empty header", () => {
    expect(parseSignatureHeader(undefined)).toEqual([])
    expect(parseSignatureHeader("")).toEqual([])
    expect(parseSignatureHeader("v1,")).toEqual([])
  })
})

describe("parseWebhookSecret", () => {
  it("strips the `whsec_` prefix, which is not part of the key", () => {
    // Signing with the prefix included produces a digest that never matches —
    // a failure indistinguishable from an attack.
    expect(parseWebhookSecret("whsec_c2VjcmV0")).toBe("c2VjcmV0")
  })

  it("accepts a bare base64 secret, which some dashboards copy", () => {
    expect(parseWebhookSecret("c2VjcmV0")).toBe("c2VjcmV0")
  })

  it("refuses an absent or empty secret so the handler cannot fail open", () => {
    expect(parseWebhookSecret(undefined)).toBeNull()
    expect(parseWebhookSecret("")).toBeNull()
    expect(parseWebhookSecret("   ")).toBeNull()
    expect(parseWebhookSecret("whsec_")).toBeNull()
  })

  it("names the variable the deployment reads", () => {
    expect(RESEND_WEBHOOK_SECRET_ENV).toBe("RESEND_WEBHOOK_SECRET")
  })
})

describe("timingSafeEqual", () => {
  it("is true only for identical strings", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true)
    expect(timingSafeEqual("abc", "abd")).toBe(false)
    expect(timingSafeEqual("abc", "ab")).toBe(false)
    expect(timingSafeEqual("", "")).toBe(true)
  })

  it("compares every character, with no early exit on the first difference", () => {
    // The property, not the timing: a difference in the FIRST position and one
    // in the LAST must both be reported, and the loop must not stop early.
    expect(timingSafeEqual("Xbcdef", "abcdef")).toBe(false)
    expect(timingSafeEqual("abcdeX", "abcdef")).toBe(false)
  })
})

describe("recordedEventFor", () => {
  it("maps each Resend event to the event this product stores", () => {
    expect(recordedEventFor("email.sent")).toBe("sent")
    expect(recordedEventFor("email.delivered")).toBe("delivered")
    expect(recordedEventFor("email.opened")).toBe("opened")
    expect(recordedEventFor("email.clicked")).toBe("clicked")
    expect(recordedEventFor("email.bounced")).toBe("bounced")
    expect(recordedEventFor("email.complained")).toBe("complained")
  })

  it("reads a failed handoff as a bounce, because that is what it is", () => {
    expect(recordedEventFor("email.failed")).toBe("bounced")
  })

  it("records nothing for a delay, which Resend follows with the real outcome", () => {
    // Recording it would move a counter the later event moves again.
    expect(recordedEventFor("email.delivery_delayed")).toBeNull()
  })

  it("records nothing for an event it has never heard of", () => {
    expect(recordedEventFor("email.teleported")).toBeNull()
    expect(recordedEventFor(undefined)).toBeNull()
  })
})

describe("suppressesRecipient", () => {
  it("is true for the two events that are about the address, not the campaign", () => {
    // Both must suppress without knowing which campaign carried the message,
    // or the sending account's own reputation pays for it.
    expect(suppressesRecipient("email.bounced")).toBe(true)
    expect(suppressesRecipient("email.failed")).toBe(true)
    expect(suppressesRecipient("email.complained")).toBe(true)
  })

  it("is false for statistics, which must not be attributed by address", () => {
    // Attributing a delivery to a store that did not send the message would
    // corrupt the figure rather than complete it.
    expect(suppressesRecipient("email.delivered")).toBe(false)
    expect(suppressesRecipient("email.opened")).toBe(false)
    expect(suppressesRecipient("email.clicked")).toBe(false)
    expect(suppressesRecipient("email.sent")).toBe(false)
    expect(suppressesRecipient("email.delivery_delayed")).toBe(false)
  })
})
