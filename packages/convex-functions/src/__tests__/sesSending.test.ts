/**
 * The two decisions a send makes before and during its SES calls.
 *
 * The configuration set was hard-coded to `"beindigital-email-tracking"` at
 * three sites across the two apps, while `AWS_SES_CONFIGURATION_SET` was
 * declared, documented, written into `.env` by `setup-aws.sh` — and read
 * nowhere. On a client's own AWS account that set does not exist, so SES
 * refused every call; the send loop swallowed each refusal to `console.error`,
 * `markSent` ran anyway, and the dashboard reported "Campagne envoyée (0/342
 * emails)".
 *
 * Both halves are held here: where the name comes from, and when a run of
 * refusals must stop the batch rather than be counted as a delivery.
 */

import { describe, expect, it } from "vitest"
import {
  CONSECUTIVE_SEND_FAILURE_LIMIT,
  configurationSetFields,
  describeSendAbort,
  describeSendError,
  resolveConfigurationSet,
  shouldAbortSend,
} from "../sesSending"

describe("resolveConfigurationSet", () => {
  it("uses the configured name", () => {
    expect(resolveConfigurationSet("luigi-email-tracking")).toBe(
      "luigi-email-tracking"
    )
  })

  it("trims, so a stray newline in .env is not a set name", () => {
    expect(resolveConfigurationSet("  luigi-email-tracking\n")).toBe(
      "luigi-email-tracking"
    )
  })

  it("reads an unset variable as no configuration set", () => {
    expect(resolveConfigurationSet(undefined)).toBeUndefined()
    expect(resolveConfigurationSet(null)).toBeUndefined()
  })

  it("reads an empty or blank value as no configuration set", () => {
    // `AWS_SES_CONFIGURATION_SET=` is what `.env.example` ships. Passing "" to
    // SES is not "send without tracking" — it is a name that does not exist,
    // and it fails the send exactly like the hard-coded one did.
    expect(resolveConfigurationSet("")).toBeUndefined()
    expect(resolveConfigurationSet("   ")).toBeUndefined()
  })
})

describe("configurationSetFields", () => {
  it("carries the name into the message when one is configured", () => {
    expect(configurationSetFields("luigi-email-tracking")).toEqual({
      configurationSet: "luigi-email-tracking",
    })
  })

  it("omits the key entirely when none is configured", () => {
    // Absent, not present-and-undefined: omission is how a send goes out with
    // no configuration set, which SES accepts — it simply produces no open or
    // click events.
    const fields = configurationSetFields(undefined)
    expect(fields).toEqual({})
    expect("configurationSet" in fields).toBe(false)
    expect(Object.keys(fields)).toEqual([])
  })

  it("spreads into a message without leaving a hole", () => {
    const withSet = { to: "a@x.fr", ...configurationSetFields("set-a") }
    const without = { to: "a@x.fr", ...configurationSetFields("") }

    expect(Object.keys(withSet).sort()).toEqual(["configurationSet", "to"])
    expect(Object.keys(without)).toEqual(["to"])
  })
})

describe("shouldAbortSend", () => {
  it("tolerates the scattered bad addresses every real list has", () => {
    // The counter is reset by every send that works, so these are runs, not
    // totals. A campaign with twelve bad addresses among three thousand good
    // ones has to finish.
    for (let run = 0; run < CONSECUTIVE_SEND_FAILURE_LIMIT; run++) {
      expect(shouldAbortSend(run)).toBe(false)
    }
  })

  it("gives up once the run reaches the limit", () => {
    expect(shouldAbortSend(CONSECUTIVE_SEND_FAILURE_LIMIT)).toBe(true)
    expect(shouldAbortSend(CONSECUTIVE_SEND_FAILURE_LIMIT + 1)).toBe(true)
  })

  it("aborts well inside a page, not after it", () => {
    // A page is 40 subscribers and a campaign is many pages. An account-level
    // fault must cost five wasted SES calls, not 342 — a run of refusals
    // against a paused account is what makes the pause permanent.
    expect(CONSECUTIVE_SEND_FAILURE_LIMIT).toBeLessThan(40)
    expect(CONSECUTIVE_SEND_FAILURE_LIMIT).toBeGreaterThan(1)
  })

  it("honours an explicit limit", () => {
    expect(shouldAbortSend(2, 3)).toBe(false)
    expect(shouldAbortSend(3, 3)).toBe(true)
  })
})

describe("describeSendError", () => {
  it("names the AWS error class, which is the whole diagnosis", () => {
    const error = new Error("Configuration set <x> does not exist.")
    error.name = "ConfigurationSetDoesNotExist"
    expect(describeSendError(error)).toBe(
      "ConfigurationSetDoesNotExist: Configuration set <x> does not exist."
    )
  })

  it("does not prefix a plain Error with the word Error", () => {
    expect(describeSendError(new Error("boom"))).toBe("boom")
  })

  it("survives something that is not an Error at all", () => {
    expect(describeSendError("boom")).toBe("boom")
  })
})

describe("describeSendAbort", () => {
  it("names the configuration set the send was refused under", () => {
    const message = describeSendAbort({
      consecutiveFailures: 5,
      configurationSet: "luigi-email-tracking",
      error: new Error("nope"),
    })

    expect(message).toContain("5 consecutive sends")
    expect(message).toContain('configuration set "luigi-email-tracking"')
    expect(message).toContain("nope")
  })

  it("says so when there was no configuration set", () => {
    const message = describeSendAbort({
      consecutiveFailures: 5,
      configurationSet: undefined,
      error: new Error("nope"),
    })
    expect(message).toContain("no configuration set")
  })
})
