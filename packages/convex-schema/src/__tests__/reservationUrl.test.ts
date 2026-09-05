import { describe, expect, it } from "vitest"
import {
  assertReservationUrl,
  isSafeReservationUrl,
} from "../reservationUrl"
import { createStoreSchema } from "../validators"

/**
 * `stores.reservationUrl` is owner-supplied text that the storefront renders
 * straight into an `href`. Every one of these cases is the same defect wearing
 * a different scheme: a string that `new URL()` parses happily and that a
 * browser will execute or exfiltrate.
 *
 * Three callers have to agree — the admin form (`createStoreSchema`), the
 * mutation (`assertReservationUrl`) and the storefront (`isSafeReservationUrl`)
 * — so they are asserted together here.
 */

const DANGEROUS = [
  "javascript:alert(document.cookie)",
  "JavaScript:alert(1)",
  "  javascript:alert(1)",
  "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
  "vbscript:msgbox(1)",
  "file:///etc/passwd",
]

const REJECTED_BUT_HARMLESS = [
  "http://www.thefork.fr/restaurant/chez-amir", // cleartext booking details
  "www.thefork.fr/restaurant/chez-amir", // no scheme at all
  "not a url",
  "",
  "   ",
]

const ACCEPTED = [
  "https://www.thefork.fr/restaurant/chez-amir",
  "https://bookings.zenchef.com/results?rid=12345",
  "https://module.lafourchette.com/fr_FR/module/123-abc",
]

describe("isSafeReservationUrl", () => {
  it.each(DANGEROUS)("refuses %s — it would be stored XSS in an href", (url) => {
    expect(isSafeReservationUrl(url)).toBe(false)
  })

  it.each(REJECTED_BUT_HARMLESS)("refuses %s", (url) => {
    expect(isSafeReservationUrl(url)).toBe(false)
  })

  it.each(ACCEPTED)("accepts %s", (url) => {
    expect(isSafeReservationUrl(url)).toBe(true)
  })

  it("never throws, whatever it is handed", () => {
    for (const value of [undefined, null, 42, {}, [], true]) {
      expect(() => isSafeReservationUrl(value)).not.toThrow()
      expect(isSafeReservationUrl(value)).toBe(false)
    }
  })
})

describe("assertReservationUrl", () => {
  it("accepts undefined — clearing the link is a legitimate edit", () => {
    expect(() => assertReservationUrl(undefined)).not.toThrow()
  })

  it.each([...DANGEROUS, ...REJECTED_BUT_HARMLESS])("refuses %s", (url) => {
    expect(() => assertReservationUrl(url)).toThrow(/Lien de réservation invalide/)
  })

  it.each(ACCEPTED)("accepts %s", (url) => {
    expect(() => assertReservationUrl(url)).not.toThrow()
  })

  it("says what a valid link looks like, since an owner reads this", () => {
    expect(() => assertReservationUrl("thefork.fr")).toThrow(/https:\/\//)
  })
})

describe("the admin form and the mutation agree", () => {
  const base = {
    name: "Chez Amir",
    slug: "chez-amir",
    address: {
      street: "12 rue de la Paix",
      city: "Lyon",
      postalCode: "69001",
      country: "FR",
    },
  }

  it.each([...DANGEROUS, ...REJECTED_BUT_HARMLESS.filter((u) => u.trim() !== "")])(
    "the form rejects %s too, so the mutation is never the first line of defence",
    (url) => {
      expect(
        createStoreSchema.safeParse({ ...base, reservationUrl: url }).success,
      ).toBe(false)
    },
  )

  it.each(ACCEPTED)("the form accepts %s", (url) => {
    expect(
      createStoreSchema.safeParse({ ...base, reservationUrl: url }).success,
    ).toBe(true)
  })

  it("treats an absent link as valid — most establishments book by phone", () => {
    expect(createStoreSchema.safeParse(base).success).toBe(true)
  })
})
