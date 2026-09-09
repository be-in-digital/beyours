import { describe, it, expect } from "vitest"
import { normalisePlatformStorefrontUrl } from "../storeIntegrations"

/**
 * The storefront's delivery tiles link to THIS restaurant, or they do not
 * render.
 *
 * They used to be hard-coded to `https://www.ubereats.com` and
 * `https://www.deliveroo.com` — the marketplaces' own home pages — shown under
 * « Commandez aussi sur vos apps » with a COMMANDER button on every menu page,
 * whether or not the establishment was listed on either platform. A
 * restaurant's own site was routing its own customers into a marketplace to be
 * shown the competition.
 *
 * The link is now a field the owner fills in, so the field is where the rules
 * live.
 */
describe("normalisePlatformStorefrontUrl", () => {
  it("accepts a real restaurant page", () => {
    expect(
      normalisePlatformStorefrontUrl(
        "uberEats",
        "https://www.ubereats.com/fr/store/chez-marie/AbC123"
      )
    ).toBe("https://www.ubereats.com/fr/store/chez-marie/AbC123")

    expect(
      normalisePlatformStorefrontUrl(
        "deliveroo",
        "https://deliveroo.fr/fr/menu/paris/bastille/chez-marie"
      )
    ).toBe("https://deliveroo.fr/fr/menu/paris/bastille/chez-marie")
  })

  it("treats an empty value as 'not on this platform', not as an error", () => {
    expect(normalisePlatformStorefrontUrl("uberEats", "")).toBeUndefined()
    expect(normalisePlatformStorefrontUrl("uberEats", "   ")).toBeUndefined()
    expect(normalisePlatformStorefrontUrl("uberEats", undefined)).toBeUndefined()
    expect(normalisePlatformStorefrontUrl("uberEats", null)).toBeUndefined()
  })

  it("refuses the marketplace home page, which is the defect itself", () => {
    expect(() =>
      normalisePlatformStorefrontUrl("uberEats", "https://www.ubereats.com")
    ).toThrow(/VOTRE établissement/)
    expect(() =>
      normalisePlatformStorefrontUrl("deliveroo", "https://www.deliveroo.com/")
    ).toThrow(/VOTRE établissement/)
  })

  it("refuses a host that is not the platform's", () => {
    expect(() =>
      normalisePlatformStorefrontUrl("uberEats", "https://example.com/store/x")
    ).toThrow(/Uber Eats/)
    // Cross-platform: a Deliveroo link in the Uber Eats field is not a tile
    // this restaurant meant to show.
    expect(() =>
      normalisePlatformStorefrontUrl("uberEats", "https://deliveroo.fr/menu/x")
    ).toThrow(/Uber Eats/)
  })

  it("is not fooled by a host that merely contains the brand", () => {
    // The reason the check walks LABELS rather than matching a pattern over
    // the string: every one of these is a domain somebody else registers, and
    // the field ends up as an anchor on the restaurant's own site.
    for (const host of [
      "deliveroo.com.attacker.example",
      "deliveroo.evil.io",
      "evil-deliveroo.com",
      "notdeliveroo.fr",
    ]) {
      expect(() =>
        normalisePlatformStorefrontUrl("deliveroo", `https://${host}/menu/x`)
      ).toThrow(/Deliveroo/)
    }
  })

  it("allows the platforms' per-market domains and their subdomains", () => {
    for (const host of ["deliveroo.fr", "deliveroo.co.uk", "www.deliveroo.be"]) {
      expect(
        normalisePlatformStorefrontUrl("deliveroo", `https://${host}/menu/x`)
      ).toBe(`https://${host}/menu/x`)
    }
  })

  it("refuses anything that is not https, including javascript:", () => {
    expect(() =>
      normalisePlatformStorefrontUrl("uberEats", "http://www.ubereats.com/store/x")
    ).toThrow(/https/)
    expect(() =>
      normalisePlatformStorefrontUrl("uberEats", "javascript:alert(1)")
    ).toThrow()
    expect(() => normalisePlatformStorefrontUrl("uberEats", "pas une url")).toThrow(
      /adresse complète/
    )
  })

  it("refuses embedded credentials", () => {
    expect(() =>
      normalisePlatformStorefrontUrl(
        "uberEats",
        "https://user:pass@www.ubereats.com/store/x"
      )
    ).toThrow(/identifiants/)
  })
})
