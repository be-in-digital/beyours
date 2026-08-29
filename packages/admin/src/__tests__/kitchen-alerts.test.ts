import { describe, it, expect } from "vitest"
import {
  DEFAULT_SOUND_CONFIG,
  KITCHEN_ALERTS,
  clampVolume,
  resolveSoundConfig,
} from "../lib/kitchen-alerts"

/**
 * The kitchen display's alert catalogue (#243).
 *
 * `stores.soundConfig` had a mutation, a schema field and a reader, and no
 * screen that wrote it — so every kitchen ran on a literal hardcoded inside
 * `KitchenContent`. The catalogue now lives in one place, read by the editor
 * that writes the setting and by the display that plays it, and these are the
 * rules both depend on.
 */

describe("KITCHEN_ALERTS", () => {
  it("covers the three alerts the display raises", () => {
    expect(KITCHEN_ALERTS.map((a) => a.key)).toEqual([
      "newTicket",
      "overdue",
      "printerOffline",
    ])
  })

  it("has a default for every alert, and nothing else", () => {
    // A default missing for an alert leaves the display reading `undefined`; a
    // default for an alert nobody raises is a control that does nothing.
    expect(Object.keys(DEFAULT_SOUND_CONFIG).sort()).toEqual(
      KITCHEN_ALERTS.map((a) => a.key).sort()
    )
  })

  it("defaults every alert on", () => {
    // A kitchen that hears nothing misses orders. The failure of a silent
    // default is worse than the failure of a loud one.
    for (const { key } of KITCHEN_ALERTS) {
      expect(DEFAULT_SOUND_CONFIG[key].enabled).toBe(true)
    }
  })

  it("keeps the two repeating alerts marked as repeating", () => {
    // `overdue` and `printerOffline` fire every 30 seconds for as long as the
    // condition holds. The editor says so, because a customer-facing sound
    // that cannot be silenced is what makes staff unplug the screen.
    const repeating = KITCHEN_ALERTS.filter((a) => a.repeats).map((a) => a.key)
    expect(repeating).toEqual(["overdue", "printerOffline"])
  })
})

describe("resolveSoundConfig", () => {
  it("returns the defaults for an establishment that has none", () => {
    expect(resolveSoundConfig(null)).toEqual(DEFAULT_SOUND_CONFIG)
    expect(resolveSoundConfig(undefined)).toEqual(DEFAULT_SOUND_CONFIG)
    expect(resolveSoundConfig({})).toEqual(DEFAULT_SOUND_CONFIG)
  })

  it("keeps a muted alert muted", () => {
    // The case that matters most. Every default is `enabled: true`, so an
    // `enabled: false` lost anywhere in the chain is indistinguishable from no
    // configuration — and the overdue alarm keeps sounding in a kitchen that
    // switched it off.
    const resolved = resolveSoundConfig({ overdue: { enabled: false, volume: 100 } })
    expect(resolved.overdue.enabled).toBe(false)
  })

  it("keeps a volume of zero rather than reading it as unset", () => {
    // `?? ` and not `||`: 0 is a configured volume, not a missing one.
    expect(resolveSoundConfig({ newTicket: { volume: 0 } }).newTicket.volume).toBe(0)
  })

  it("fills in an alert the stored config predates", () => {
    // A row written before an alert existed. The display must not read
    // `undefined.enabled`.
    const resolved = resolveSoundConfig({ newTicket: { enabled: false, volume: 10 } })
    expect(resolved.overdue).toEqual(DEFAULT_SOUND_CONFIG.overdue)
    expect(resolved.printerOffline).toEqual(DEFAULT_SOUND_CONFIG.printerOffline)
  })

  it("fills in a half-written alert field by field", () => {
    const resolved = resolveSoundConfig({ overdue: { enabled: false } })
    expect(resolved.overdue).toEqual({
      enabled: false,
      volume: DEFAULT_SOUND_CONFIG.overdue.volume,
    })
  })
})

describe("clampVolume", () => {
  it("keeps a volume inside 0–100", () => {
    // The mutation is callable by anyone holding `stores:write`, and the
    // display turns this into a gain it would clamp silently.
    expect(clampVolume(-10)).toBe(0)
    expect(clampVolume(140)).toBe(100)
    expect(clampVolume(55)).toBe(55)
  })

  it("rounds, so the schema stores a whole percentage", () => {
    expect(clampVolume(72.4)).toBe(72)
  })

  it("turns a non-number into silence rather than NaN", () => {
    // `NaN / 100` reaches `gain.setValueAtTime` and throws, taking the kitchen
    // screen down on a bad row.
    expect(clampVolume(Number.NaN)).toBe(0)
    expect(clampVolume(Number.POSITIVE_INFINITY)).toBe(0)
  })
})
