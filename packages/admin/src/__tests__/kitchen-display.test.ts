import { describe, it, expect } from "vitest"
import {
  DEFAULT_DISPLAY_CONFIG,
  MAX_AUTO_DISMISS_MINUTES,
  MIN_AUTO_DISMISS_MINUTES,
  clampAutoDismissMinutes,
  resolveDisplayConfig,
} from "../lib/kitchen-display"

/**
 * The dining-room screen's auto-dismiss window (Q-2).
 *
 * `stores.displayConfig` had a schema field and a live reader in
 * `kitchenTickets.getForDisplay`, and its mutation was deleted on the claim
 * that nothing read it — so every establishment ran on the query's own
 * fallback and no screen could change it. These are the rules the editor that
 * writes it now depends on.
 *
 * The end-to-end proof that a stored window reaches the screen lives in
 * `apps/*\/tests/convex/kitchen-display-config.test.ts`, through the real
 * mutation and the real query. This file guards the numbers the form opens on.
 */

describe("DEFAULT_DISPLAY_CONFIG", () => {
  it("is the literal `kitchenTickets.getForDisplay` falls back to", () => {
    // Duplicated on purpose: the admin package cannot import the Convex
    // definitions, so the copy has to be asserted rather than shared. If
    // `getForDisplay` changes its fallback, this is what says so.
    expect(DEFAULT_DISPLAY_CONFIG).toEqual({
      autoDismissEnabled: true,
      autoDismissMinutes: 15,
    })
  })
})

describe("resolveDisplayConfig", () => {
  it("opens on the default when nothing is stored", () => {
    expect(resolveDisplayConfig(undefined)).toEqual(DEFAULT_DISPLAY_CONFIG)
    expect(resolveDisplayConfig(null)).toEqual(DEFAULT_DISPLAY_CONFIG)
  })

  it("keeps a stored window rather than overwriting it with the default", () => {
    expect(
      resolveDisplayConfig({ autoDismissEnabled: false, autoDismissMinutes: 45 })
    ).toEqual({ autoDismissEnabled: false, autoDismissMinutes: 45 })
  })

  it("fills in only the half a partial row is missing", () => {
    // A row written before the field was typed can carry one key. Reading
    // `undefined.autoDismissMinutes` into a number input is a React warning at
    // best and `NaN` in the mutation at worst.
    expect(resolveDisplayConfig({ autoDismissEnabled: false })).toEqual({
      autoDismissEnabled: false,
      autoDismissMinutes: DEFAULT_DISPLAY_CONFIG.autoDismissMinutes,
    })
  })
})

describe("the range this form offers", () => {
  it("is exactly the range the mutation enforces", async () => {
    // The clamp in `kitchen-display.ts` guards the FORM. The guard that holds
    // is `stores.updateDisplayConfig`, which refuses anything outside its own
    // MIN/MAX and writes nothing. If the two ranges drift apart the form
    // either offers a value the mutation rejects, or hides one it accepts —
    // both of which look to an owner like the save button is broken.
    //
    // Imported here rather than re-typed: this is a test, so pulling the
    // engine module in costs nothing at runtime, and a literal copied into an
    // assertion would drift with the thing it is supposed to catch.
    const engine = await import("@be-yours/convex-functions/stores")

    expect(MIN_AUTO_DISMISS_MINUTES).toBe(engine.MIN_AUTO_DISMISS_MINUTES)
    expect(MAX_AUTO_DISMISS_MINUTES).toBe(engine.MAX_AUTO_DISMISS_MINUTES)
  })
})

describe("clampAutoDismissMinutes", () => {
  it("holds the value inside the range the editor offers", () => {
    expect(clampAutoDismissMinutes(0)).toBe(MIN_AUTO_DISMISS_MINUTES)
    expect(clampAutoDismissMinutes(-30)).toBe(MIN_AUTO_DISMISS_MINUTES)
    expect(clampAutoDismissMinutes(10_000)).toBe(MAX_AUTO_DISMISS_MINUTES)
  })

  it("rounds, because the query multiplies it by 60 000", () => {
    expect(clampAutoDismissMinutes(15.4)).toBe(15)
    expect(clampAutoDismissMinutes(15.6)).toBe(16)
  })

  it("falls back rather than sending NaN through the mutation", () => {
    // An emptied number input reads as `Number("") === 0` or `NaN`; `NaN` in
    // `getForDisplay` makes every window comparison false, which empties the
    // ready column instead of widening it.
    expect(clampAutoDismissMinutes(Number.NaN)).toBe(
      DEFAULT_DISPLAY_CONFIG.autoDismissMinutes
    )
    expect(clampAutoDismissMinutes(Number.POSITIVE_INFINITY)).toBe(
      DEFAULT_DISPLAY_CONFIG.autoDismissMinutes
    )
  })
})
