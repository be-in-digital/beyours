import { describe, it, expect } from "vitest"
import {
  DEFAULT_STORE_SERVICES,
  ORDER_TYPES,
  ORDER_TYPE_SERVICE,
  isOrderTypeOffered,
  resolveStoreServices,
} from "../storeServices"

/**
 * Which services an establishment offers (#224).
 *
 * `globalSettings.services` was written by the settings page and enforced
 * nowhere. The storefront read `store.overrides.services` alone — `undefined`
 * on every establishment that has not customised it — and the selector treated
 * `undefined` as "offer everything", so a restaurant that does not deliver
 * still showed Livraison. `orders.create` never looked at `args.type`, so the
 * order went through.
 */

const ALL_ON = {
  dineIn: true,
  takeaway: true,
  delivery: true,
  clickAndCollect: true,
}
const NO_DELIVERY = { ...ALL_ON, delivery: false }

describe("resolveStoreServices", () => {
  it("uses the global services when the establishment has no override", () => {
    // The case that was broken: no override is the normal state, not a gap.
    expect(resolveStoreServices({}, { services: NO_DELIVERY })).toEqual(NO_DELIVERY)
  })

  it("lets the establishment's override win", () => {
    expect(
      resolveStoreServices(
        { overrides: { services: NO_DELIVERY } },
        { services: ALL_ON }
      )
    ).toEqual(NO_DELIVERY)
  })

  it("honours an override that switches everything off", () => {
    // A location that has stopped serving is a real configuration, and `??`
    // over each field would have quietly turned it back on.
    const allOff = {
      dineIn: false,
      takeaway: false,
      delivery: false,
      clickAndCollect: false,
    }
    expect(
      resolveStoreServices({ overrides: { services: allOff } }, { services: ALL_ON })
    ).toEqual(allOff)
  })

  it("offers everything when nothing has been configured at all", () => {
    // A deployment whose settings row has never been saved. Refusing every
    // order type there would close a restaurant that has not visited the
    // settings page.
    expect(resolveStoreServices(null, null)).toEqual(DEFAULT_STORE_SERVICES)
    expect(resolveStoreServices({}, {})).toEqual(DEFAULT_STORE_SERVICES)
  })

  it("fills a missing field rather than returning undefined for it", () => {
    // Rows written before a switch existed.
    expect(
      resolveStoreServices({}, { services: { delivery: false } })
    ).toEqual({ ...DEFAULT_STORE_SERVICES, delivery: false })
  })
})

describe("isOrderTypeOffered", () => {
  it("maps each order type to the service it needs", () => {
    expect(ORDER_TYPE_SERVICE).toEqual({
      delivery: "delivery",
      pickup: "takeaway",
      dine_in: "dineIn",
    })
  })

  it("refuses delivery when the restaurant does not deliver", () => {
    expect(isOrderTypeOffered("delivery", NO_DELIVERY)).toBe(false)
    expect(isOrderTypeOffered("pickup", NO_DELIVERY)).toBe(true)
    expect(isOrderTypeOffered("dine_in", NO_DELIVERY)).toBe(true)
  })

  it("accepts every type when every service is on", () => {
    for (const type of ORDER_TYPES) {
      expect(isOrderTypeOffered(type, ALL_ON)).toBe(true)
    }
  })

  it("covers every order type", () => {
    // A new order type with no service behind it would silently be refused —
    // or worse, silently allowed. This is where that gets noticed.
    expect(ORDER_TYPES.sort()).toEqual(["delivery", "dine_in", "pickup"])
  })

  it("ignores clickAndCollect, which no order type carries", () => {
    // Three order types, four switches. Folding it into `takeaway` would make
    // the "À emporter" switch mean two things; leaving it out is the honest
    // reading until an order type exists for it.
    const onlyClickAndCollect = {
      dineIn: false,
      takeaway: false,
      delivery: false,
      clickAndCollect: true,
    }
    for (const type of ORDER_TYPES) {
      expect(isOrderTypeOffered(type, onlyClickAndCollect)).toBe(false)
    }
  })
})
