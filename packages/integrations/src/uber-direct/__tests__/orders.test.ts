import { describe, it, expect } from "vitest"
import {
  buildCreateDeliveryRequest,
  splitCustomerName,
  isQuoteUsable,
  UberDirectPayloadError,
  type DeliverableOrder,
} from "../orders"

const quote = { estimateId: "est_abc123" }

function makeOrder(overrides: Partial<DeliverableOrder> = {}): DeliverableOrder {
  return {
    _id: "ord_1",
    orderNumber: "ORD-2026-0042",
    customerId: "user_9",
    customerInfo: { name: "Marie Dupont", phone: "+33612345678", email: "m@d.fr" },
    items: [
      { productName: "Pizza Reine", quantity: 2, unitPrice: 1250 },
      { productName: "Tiramisu", quantity: 1, unitPrice: 650, notes: "sans cacao" },
    ],
    subtotal: 3150,
    deliveryAddress: {
      street: "12 rue de Rivoli",
      city: "Paris",
      postalCode: "75004",
      country: "France",
      latitude: 48.8566,
      longitude: 2.3522,
      instructions: "Code 4512, 3e étage",
    },
    ...overrides,
  }
}

describe("splitCustomerName", () => {
  it("splits a first and last name", () => {
    expect(splitCustomerName("Marie Dupont")).toEqual({
      first_name: "Marie",
      last_name: "Dupont",
    })
  })

  it("keeps compound last names whole", () => {
    expect(splitCustomerName("Jean de La Fontaine")).toEqual({
      first_name: "Jean",
      last_name: "de La Fontaine",
    })
  })

  it("stands in for a missing last name rather than failing", () => {
    // Uber marks last_name required; a mononym is common on a restaurant order
    // and must not block the delivery.
    expect(splitCustomerName("Madonna")).toEqual({
      first_name: "Madonna",
      last_name: ".",
    })
  })

  it("survives an empty or whitespace name", () => {
    expect(splitCustomerName("   ")).toEqual({ first_name: "Client", last_name: "." })
  })
})

describe("buildCreateDeliveryRequest", () => {
  it("builds the documented body", () => {
    const body = buildCreateDeliveryRequest(makeOrder(), {
      uberStoreId: "store_xyz",
      quote,
    })

    expect(body.estimate_id).toBe("est_abc123")
    expect(body.pickup_at).toBe(0) // ASAP by default
    expect(body.pickup.store_id).toBe("store_xyz")
    expect(body.order_summary).toEqual({ currency_code: "EUR", order_value: 3150 })
  })

  it("sends the order number as the external id, not the document id", () => {
    // This is what the courier and Uber support read back over the phone.
    const body = buildCreateDeliveryRequest(makeOrder(), {
      uberStoreId: "store_xyz",
      quote,
    })
    expect(body.external_order_id).toBe("ORD-2026-0042")
    expect(body.external_order_id).not.toBe("ord_1")
  })

  it("carries every line of the order onto the manifest", () => {
    const body = buildCreateDeliveryRequest(makeOrder(), {
      uberStoreId: "store_xyz",
      quote,
    })
    expect(body.order_items).toHaveLength(2)
    expect(body.order_items[0]).toMatchObject({
      name: "Pizza Reine",
      quantity: 2,
      price: 1250,
      currency_code: "EUR",
    })
    expect(body.order_items[1]!.description).toBe("sans cacao")
  })

  it("passes coordinates through when the address has them", () => {
    const body = buildCreateDeliveryRequest(makeOrder(), {
      uberStoreId: "store_xyz",
      quote,
    })
    expect(body.dropoff.address.location).toEqual({
      latitude: 48.8566,
      longitude: 2.3522,
    })
    expect(body.dropoff.address.formatted_address).toBe(
      "12 rue de Rivoli, 75004 Paris, France"
    )
  })

  it("omits the location entirely when coordinates are missing", () => {
    // A half-filled location object is worse than none: Uber geocodes the
    // formatted address instead of trusting a (0,0) pair.
    const order = makeOrder()
    delete order.deliveryAddress!.latitude
    delete order.deliveryAddress!.longitude

    const body = buildCreateDeliveryRequest(order, {
      uberStoreId: "store_xyz",
      quote,
    })
    expect(body.dropoff.address.location).toBeUndefined()
    expect(body.dropoff.address.formatted_address).toBeTruthy()
  })

  it("forwards the delivery instructions to the courier", () => {
    const body = buildCreateDeliveryRequest(makeOrder(), {
      uberStoreId: "store_xyz",
      quote,
    })
    expect(body.dropoff.instructions).toBe("Code 4512, 3e étage")
  })

  it("honours a scheduled pickup time", () => {
    const at = 1_800_000_000_000
    const body = buildCreateDeliveryRequest(makeOrder(), {
      uberStoreId: "store_xyz",
      quote,
      pickupAt: at,
    })
    expect(body.pickup_at).toBe(at)
  })

  it("rounds fractional cents rather than sending them", () => {
    const body = buildCreateDeliveryRequest(
      makeOrder({
        items: [{ productName: "Café", quantity: 1, unitPrice: 199.6 }],
        subtotal: 199.6,
      }),
      { uberStoreId: "store_xyz", quote }
    )
    expect(body.order_items[0]!.price).toBe(200)
    expect(body.order_summary.order_value).toBe(200)
  })

  it("refuses an order with no delivery address", () => {
    expect(() =>
      buildCreateDeliveryRequest(makeOrder({ deliveryAddress: undefined }), {
        uberStoreId: "store_xyz",
        quote,
      })
    ).toThrow(UberDirectPayloadError)
  })

  it("refuses an order with no phone number", () => {
    // The courier cannot hand the bag over without one, and Uber rejects it.
    expect(() =>
      buildCreateDeliveryRequest(
        makeOrder({ customerInfo: { name: "Marie Dupont" } }),
        { uberStoreId: "store_xyz", quote }
      )
    ).toThrow(/MISSING_CUSTOMER_PHONE|phone/)
  })

  it("refuses an empty order", () => {
    expect(() =>
      buildCreateDeliveryRequest(makeOrder({ items: [] }), {
        uberStoreId: "store_xyz",
        quote,
      })
    ).toThrow(UberDirectPayloadError)
  })

  it("names the failure so the caller can act on it", () => {
    try {
      buildCreateDeliveryRequest(makeOrder({ deliveryAddress: undefined }), {
        uberStoreId: "store_xyz",
        quote,
      })
      expect.unreachable("should have thrown")
    } catch (err) {
      expect((err as UberDirectPayloadError).code).toBe("MISSING_DELIVERY_ADDRESS")
    }
  })
})

describe("isQuoteUsable", () => {
  it("accepts a quote that has not expired", () => {
    expect(isQuoteUsable({ expiresAt: 2_000 }, 1_000)).toBe(true)
  })

  it("rejects an expired quote", () => {
    expect(isQuoteUsable({ expiresAt: 1_000 }, 2_000)).toBe(false)
  })

  it("rejects a quote expiring exactly now", () => {
    expect(isQuoteUsable({ expiresAt: 1_000 }, 1_000)).toBe(false)
  })
})
