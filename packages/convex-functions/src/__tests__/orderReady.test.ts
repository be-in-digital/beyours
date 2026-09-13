import { describe, expect, it } from "vitest"

import { orderReadyRefusal, type ReadyOrderRow } from "../orderReady"

/**
 * Who gets told their order is ready (#96).
 *
 * The product confirmed an order and then said nothing else, ever. A
 * click-and-collect customer had no way to know when to walk over except by
 * watching the tracking page, and the dining room's wall screen only helps
 * somebody already in the room.
 *
 * The decisions worth pinning are the refusals, because each one is a message
 * that would have been wrong to send.
 */

const order = (over: Partial<ReadyOrderRow> = {}): ReadyOrderRow => ({
  status: "ready",
  type: "pickup",
  customerInfo: { email: "camille@example.fr" },
  ...over,
})

describe("orderReadyRefusal", () => {
  it("lets a collection order through", () => {
    expect(orderReadyRefusal(order())).toBeNull()
  })

  it("lets a dine-in order through", () => {
    // The diner is already sitting down, and « votre commande arrive à la table »
    // is worth saying — it is the one they cannot see the pass from.
    expect(orderReadyRefusal(order({ type: "dine_in" }))).toBeNull()
  })

  it("refuses a delivery order", () => {
    /*
     * « Prête » on a delivery means the food left the kitchen, not that anything
     * is expected of the diner. Telling them to come and collect it would be
     * wrong, and the courier's own tracking is what covers the rest.
     */
    expect(orderReadyRefusal(order({ type: "delivery" }))).toBe("delivery_order")
  })

  it("refuses an order with no address", () => {
    expect(orderReadyRefusal(order({ customerInfo: {} }))).toBe("no_email")
    expect(orderReadyRefusal(order({ customerInfo: { email: "   " } }))).toBe("no_email")
  })

  it("refuses a second time", () => {
    // The claim. `ready` can be reached twice — a second station finishing, a
    // status corrected back and forward — and each would otherwise put another
    // identical email in the inbox.
    expect(orderReadyRefusal(order({ readyEmailAt: 1_700_000_000_000 }))).toBe(
      "already_dispatched"
    )
  })

  it("refuses a cancelled order", () => {
    // A real race: staff can cancel in the seconds between the kitchen marking
    // it ready and the scheduled action running.
    expect(orderReadyRefusal(order({ status: "cancelled" }))).toBe("cancelled")
  })

  it("refuses an address SES has already rejected", () => {
    // A hard bounce says the mailbox does not exist and a complaint says this
    // person reported us. Either damages the sending domain for every other
    // diner of the establishment.
    expect(orderReadyRefusal(order(), "bounced")).toBe("address_suppressed")
    expect(orderReadyRefusal(order(), "complained")).toBe("address_suppressed")
  })

  it("sends to an address SES has no complaint about", () => {
    expect(orderReadyRefusal(order(), "other")).toBeNull()
    expect(orderReadyRefusal(order(), "unknown")).toBeNull()
  })

  it("checks the cheap refusals before the address standing", () => {
    /* The order matters: `planOrderReady` runs this once without a standing to
       avoid a subscriber lookup for an order that was never getting a notice.
       A delivery order must therefore be refused on the first pass. */
    expect(orderReadyRefusal(order({ type: "delivery" }))).not.toBe(
      "address_suppressed"
    )
  })
})
