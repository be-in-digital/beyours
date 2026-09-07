/**
 * An owner can turn the card path off (#376, item 5).
 *
 * WHAT WENT WRONG: `globalSettings.payments.cardProvider` was a
 * `stripe | sumup` union — there was no value meaning "we do not take cards" —
 * and the storefront rendered the card tile unconditionally, pre-selected. A
 * cash-only food truck, one of the five verticals this engine is sold for,
 * shipped with a payment method it could not honour, leaving a pending order
 * nobody could pay. Auto-detection (#379) covers the deployment that MEANS to
 * take cards and cannot; it cannot infer the owner who simply does not.
 *
 * The rule itself is pinned server-side in
 * `@be-in-digital/convex-functions` (`cardPaymentAvailability.test.ts`) and the
 * storefront's reading of it in the two apps' checkout suites. This is the
 * admin half: the screen has a control for it, and the control is wired to the
 * value the server reads.
 *
 * Source-level, like its sibling `payment-connection-surface.test.ts` and for
 * the same reason: what is asserted is which control the JSX renders and which
 * value the save writes, and a rule asserted only through a helper stays green
 * while the component quietly stops calling it.
 */

import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

const SETTINGS = path.join(__dirname, "..", "pages", "settings")
const read = (file: string): string =>
  fs.readFileSync(path.join(SETTINGS, file), "utf8")

const tab = read("payments-tab.tsx")
const form = read("use-settings-form.ts")
const page = read("settings-page.tsx")

describe("the payments screen", () => {
  it("offers a switch for accepting cards at all", () => {
    expect(tab).toContain('id="cardEnabled"')
    expect(tab).toContain("onCheckedChange={setCardEnabled}")
  })

  it("hides the provider picker rather than greying it", () => {
    // A greyed-out picker invites "temporarily broken". An establishment that
    // does not take cards has simply answered the question above it.
    expect(tab).toContain("{cardEnabled && (")
  })

  it("says what turning it off does to the storefront", () => {
    expect(tab).toContain("Carte bancaire")
    expect(tab).toContain("disparaît de la commande en ligne")
  })

  it("warns when no payment method is left at all", () => {
    // Cards off, PayPal off, cash off: the checkout has nothing to offer and
    // its submit stays disabled. Better said here than discovered by a diner.
    expect(tab).toContain("!cardEnabled && !paypalEnabled && !cashEnabled")
    // Worded without naming a method: "Stripe", "SumUp" and "Espèces" may
    // appear only once each in this tab's readable text, or the e2e settings
    // spec's strict-mode locators resolve to two nodes.
    expect(tab).toContain("Activez-en au moins un")
  })
})

describe("what the screen saves", () => {
  it("writes cardProvider: none when the switch is off", () => {
    expect(form).toContain('cardProvider: cardEnabled ? cardProvider : "none"')
  })

  it("reads the stored none back into the switch", () => {
    expect(form).toContain('setCardEnabled(stored !== "none")')
  })

  it("keeps a provider to come back to", () => {
    // Turning cards back on must not require reconnecting Stripe, so `none`
    // resolves the picker to a real provider rather than leaving it empty.
    expect(form).toContain('setCardProvider(stored === "sumup" ? "sumup" : "stripe")')
  })

  it("is threaded from the hook to the tab", () => {
    // The gap this catches: state that exists, a control that renders, and
    // nothing connecting them — which is how a written-but-never-read field
    // gets shipped.
    expect(form).toContain("cardEnabled,\n    setCardEnabled,")
    expect(page).toContain("cardEnabled={cardEnabled}")
    expect(page).toContain("setCardEnabled={setCardEnabled}")
  })
})
