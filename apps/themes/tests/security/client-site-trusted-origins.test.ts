/**
 * A delivered client site must not trust a development origin.
 *
 * `convex/auth.ts` carried a four-line comment saying exactly this — "Un site
 * client n'a aucune raison d'accepter une origine de développement" — directly
 * above code that appended `http://localhost:3000` in BOTH branches, on every
 * deployment. `lib/convex.ts` added `http://localhost:3001` the same way. The
 * comment was the whole of the enforcement, and it was ignored for as long as
 * it existed.
 *
 * A trusted origin is permission for a page on that origin to make requests
 * carrying the visitor's session. The prose could not fail; this can.
 */

import { describe, expect, it } from "vitest"

import { buildTrustedOrigins } from "@/convex/auth"
import { nextTrustedOrigins } from "@/lib/convex"

describe("a delivered client site", () => {
  const DELIVERED = "https://pizzeria-du-port.fr"

  it("trusts its own domain and nothing else", () => {
    expect(buildTrustedOrigins(DELIVERED)).toEqual([DELIVERED])
  })

  it("trusts no localhost origin, on either half of the seam", () => {
    for (const origins of [buildTrustedOrigins(DELIVERED), nextTrustedOrigins(DELIVERED)]) {
      expect(origins.some((origin) => origin.includes("localhost"))).toBe(false)
    }
  })

  it("is not fooled by a domain that merely contains the word", () => {
    // `localhost.attacker.tld` is a domain an attacker can register and point
    // anywhere. A substring test would have trusted it.
    const origins = buildTrustedOrigins("https://localhost.attacker.tld")
    expect(origins).toEqual(["https://localhost.attacker.tld"])
    expect(origins).not.toContain("http://localhost:3000")
  })

  it("does not trust a http://localhost prefix on a different host", () => {
    const origins = buildTrustedOrigins("http://localhost.evil.example")
    expect(origins).not.toContain("http://localhost:3000")
  })
})

describe("a developer's machine", () => {
  it("still trusts localhost, so local sign-in keeps working", () => {
    expect(buildTrustedOrigins("http://localhost:3000")).toContain("http://localhost:3000")
    expect(nextTrustedOrigins("http://localhost:3000")).toContain("http://localhost:3001")
  })

  it("treats an unset SITE_URL as local, never as a delivered site", () => {
    // Unset cannot be a client site: `SITE_URL` is in `siteRequiredShape` and
    // a deployment refuses to boot without one.
    expect(buildTrustedOrigins(undefined)).toEqual(["http://localhost:3000"])
  })

  it("does not repeat an origin that is already the site URL", () => {
    expect(buildTrustedOrigins("http://localhost:3000")).toEqual(["http://localhost:3000"])
  })
})
