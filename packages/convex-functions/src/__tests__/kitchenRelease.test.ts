import { describe, it, expect, vi } from "vitest"
import {
  releaseToKitchen,
  resolveStations,
  summariseOrderLines,
} from "../orders"
import { dedupeByOrder } from "../kitchenTickets"

/**
 * What reaches the pass, and when.
 *
 * Four of #164's sub-points and the whole of #136 meet in `releaseToKitchen`:
 *  - the ticket was created inside checkout, before any provider redirect, so
 *    an abandoned payment left the kitchen cooking an order nobody paid for;
 *  - `store.orderConfirmation` promised staff would validate an order first,
 *    and nothing implemented it, so the setting was withdrawn rather than kept;
 *  - `kitchenTickets.station` had no production writer at all, so the KDS
 *    station filter could never render;
 *  - `allergens` and `estimatedPrepTime` had one writer between them — the demo
 *    seed — so the printed allergen block and the overdue alarm were decoration.
 */

const NOW = 1_700_000_000_000

type Doc = Record<string, any>

function createCtx(docs: Record<string, Doc>) {
  const store: Record<string, Doc> = { ...docs }
  const inserted: Array<{ table: string; doc: Doc }> = []
  let counter = 0

  const db = {
    store,
    get: vi.fn(async (id: string) => store[id] ?? null),
    insert: vi.fn(async (table: string, doc: Doc) => {
      const id = `${table}:${++counter}`
      store[id] = { _id: id, ...doc }
      inserted.push({ table, doc })
      return id
    }),
    patch: vi.fn(async (id: string, updates: Doc) => {
      if (store[id]) Object.assign(store[id], updates)
    }),
    query: vi.fn((table: string) => ({
      withIndex: (_index: string, build: (q: any) => any) => {
        const equalities: Record<string, unknown> = {}
        const q: any = {
          eq: (field: string, value: unknown) => {
            equalities[field] = value
            return q
          },
        }
        build(q)
        const rows = Object.values(store).filter(
          (row) =>
            String(row._id).startsWith(`${table}:`) &&
            Object.entries(equalities).every(([f, val]) => row[f] === val)
        )
        return {
          first: async () => rows[0] ?? null,
          collect: async () => rows,
          take: async () => rows,
          order: () => ({ collect: async () => rows, take: async () => rows }),
        }
      },
    })),
  }

  return { ctx: { db }, inserted, store }
}

const PIZZA = {
  _id: "products:pizza",
  storeId: "stores:1",
  categoryId: "categories:pizzas",
  allergens: ["gluten", "lait"],
  preparationTime: 15,
}
const SALAD = {
  _id: "products:salad",
  storeId: "stores:1",
  categoryId: "categories:salades",
  allergens: ["moutarde"],
  preparationTime: 5,
}

function orderDoc(overrides: Doc = {}): Doc {
  return {
    _id: "orders:1",
    storeId: "stores:1",
    orderNumber: "CMD-1",
    type: "pickup",
    status: "pending",
    paymentStatus: "paid",
    source: "website",
    customerInfo: { name: "Camille", phone: "0600000000" },
    items: [
      {
        productId: "products:pizza",
        productName: "Margherita",
        quantity: 1,
        unitPrice: 1200,
        subtotal: 1200,
        selectedOptions: [],
        notes: "bien cuite",
      },
    ],
    createdAt: NOW,
    ...overrides,
  }
}

function baseDocs(storeOverrides: Doc = {}, order: Doc = orderDoc()) {
  return {
    "stores:1": { _id: "stores:1", name: "Chez Luigi", ...storeOverrides },
    "products:pizza": PIZZA,
    "products:salad": SALAD,
    [order._id]: order,
  }
}

// ---------------------------------------------------------------------------
// #136 — a paid order, and only a paid order, feeds the kitchen
// ---------------------------------------------------------------------------

describe("releaseToKitchen", () => {
  it("writes nothing for an order whose payment never landed", async () => {
    const { ctx, inserted } = createCtx(
      baseDocs({}, orderDoc({ paymentStatus: "pending" }))
    )

    expect(await releaseToKitchen(ctx, "orders:1")).toBe(0)
    expect(inserted).toHaveLength(0)
  })

  it("puts one ticket on the pass for a paid order", async () => {
    const { ctx, inserted } = createCtx(baseDocs())

    expect(await releaseToKitchen(ctx, "orders:1")).toBe(1)
    expect(inserted).toHaveLength(1)
    expect(inserted[0]!.table).toBe("kitchenTickets")
  })

  it("refuses to plate the same dinner twice", async () => {
    const { ctx, inserted } = createCtx(baseDocs())

    await releaseToKitchen(ctx, "orders:1")
    // The Stripe webhook and the success page both land. That is normal.
    expect(await releaseToKitchen(ctx, "orders:1")).toBe(0)
    expect(inserted).toHaveLength(1)
  })

  it("writes nothing for a cancelled order", async () => {
    const { ctx } = createCtx(baseDocs({}, orderDoc({ status: "cancelled" })))
    expect(await releaseToKitchen(ctx, "orders:1")).toBe(0)
  })

  it("carries the customer's note through to the slip", async () => {
    const { ctx, inserted } = createCtx(baseDocs())
    await releaseToKitchen(ctx, "orders:1")

    expect(inserted[0]!.doc.items[0].notes).toBe("bien cuite")
  })
})

// ---------------------------------------------------------------------------
// #164.7 — "manual confirmation" is a setting something reads now
// ---------------------------------------------------------------------------

describe("store.orderConfirmation", () => {
  it("holds a paid order back when the establishment validates by hand", async () => {
    const { ctx, inserted } = createCtx(baseDocs({ orderConfirmation: "manual" }))

    expect(await releaseToKitchen(ctx, "orders:1")).toBe(0)
    expect(inserted).toHaveLength(0)
  })

  /**
   * Found by an adversarial probe, not by writing this fix.
   *
   * `force` originally skipped the payment check as well as the confirmation
   * one, which put #136 straight back through the admin: a customer abandons at
   * the provider, a member of staff clicks "Accepter la commande" on the
   * still-unpaid order, and the kitchen cooks it — looking exactly like a paid
   * one, since the KDS shows no payment state.
   */
  it("still refuses an UNPAID order when staff accept it by hand", async () => {
    const { ctx, inserted } = createCtx(
      baseDocs({ orderConfirmation: "manual" }, orderDoc({ paymentStatus: "pending" }))
    )

    expect(await releaseToKitchen(ctx, "orders:1", { force: true })).toBe(0)
    expect(inserted).toHaveLength(0)
  })

  it("releases it when staff accept, which is the workflow itself", async () => {
    const { ctx, inserted } = createCtx(baseDocs({ orderConfirmation: "manual" }))

    expect(await releaseToKitchen(ctx, "orders:1", { force: true })).toBe(1)
    expect(inserted).toHaveLength(1)
  })

  it("treats an establishment that never set it as automatic", async () => {
    const { ctx } = createCtx(baseDocs({}))
    expect(await releaseToKitchen(ctx, "orders:1")).toBe(1)
  })

  it("sends a paid order straight through when set to auto", async () => {
    const { ctx } = createCtx(baseDocs({ orderConfirmation: "auto" }))
    expect(await releaseToKitchen(ctx, "orders:1")).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// #164.1 — multi-station routing
// ---------------------------------------------------------------------------

const TWO_LINE_ORDER = orderDoc({
  items: [
    {
      productId: "products:pizza",
      productName: "Margherita",
      quantity: 1,
      unitPrice: 1200,
      subtotal: 1200,
      selectedOptions: [],
    },
    {
      productId: "products:salad",
      productName: "César",
      quantity: 1,
      unitPrice: 900,
      subtotal: 900,
      selectedOptions: [],
    },
  ],
})

const MAPPING = [
  { categoryId: "categories:pizzas", station: "chaud" },
  { categoryId: "categories:salades", station: "froid" },
]

describe("station routing", () => {
  it("resolves each line to the station its category is mapped to", async () => {
    const { ctx } = createCtx(baseDocs({ stationMapping: MAPPING }, TWO_LINE_ORDER))

    const stations = await resolveStations(ctx, "stores:1", TWO_LINE_ORDER.items)
    expect(stations).toEqual(["chaud", "froid"])
  })

  it("splits an order into one ticket per station it touches", async () => {
    const { ctx, inserted } = createCtx(
      baseDocs({ stationMapping: MAPPING }, TWO_LINE_ORDER)
    )

    expect(await releaseToKitchen(ctx, "orders:1")).toBe(2)

    const byStation = Object.fromEntries(
      inserted.map((entry) => [entry.doc.station, entry.doc.items])
    )
    expect(Object.keys(byStation).sort()).toEqual(["chaud", "froid"])
    expect(byStation.chaud).toHaveLength(1)
    expect(byStation.chaud![0].productName).toBe("Margherita")
    expect(byStation.froid![0].productName).toBe("César")
  })

  /**
   * Found by an adversarial probe. A token per station meant `/track` followed
   * whichever ticket came back first: the cold station finished the salad and
   * the customer read "prête" while the pizza was still in the oven.
   */
  it("gives an order's station tickets ONE tracking token", async () => {
    const { ctx, inserted } = createCtx(
      baseDocs({ stationMapping: MAPPING }, TWO_LINE_ORDER)
    )
    await releaseToKitchen(ctx, "orders:1")

    const tokens = new Set(inserted.map((entry) => entry.doc.trackingToken))
    expect(tokens.size).toBe(1)
  })

  /**
   * Also found by probe: every station slip carried the whole order's
   * allergens, so the cold station read "gluten" beside a salad — a warning
   * for a dish that is not on the paper.
   */
  it("gives each station the allergens and prep time of ITS OWN items", async () => {
    const { ctx, inserted } = createCtx(
      baseDocs({ stationMapping: MAPPING }, TWO_LINE_ORDER)
    )
    await releaseToKitchen(ctx, "orders:1")

    const byStation = Object.fromEntries(
      inserted.map((entry) => [entry.doc.station, entry.doc])
    )
    expect(byStation.chaud!.allergens).toEqual(["gluten", "lait"])
    expect(byStation.froid!.allergens).toEqual(["moutarde"])
    expect(byStation.chaud!.estimatedPrepTime).toBe(15)
    expect(byStation.froid!.estimatedPrepTime).toBe(5)
  })

  it("leaves an establishment with no mapping on one undifferentiated ticket", async () => {
    const { ctx, inserted } = createCtx(baseDocs({}, TWO_LINE_ORDER))

    expect(await releaseToKitchen(ctx, "orders:1")).toBe(1)
    expect(inserted[0]!.doc.station).toBeUndefined()
    expect(inserted[0]!.doc.items).toHaveLength(2)
  })

  it("keeps an unmapped category on the undifferentiated ticket", async () => {
    const { ctx, inserted } = createCtx(
      baseDocs(
        { stationMapping: [{ categoryId: "categories:pizzas", station: "chaud" }] },
        TWO_LINE_ORDER
      )
    )

    expect(await releaseToKitchen(ctx, "orders:1")).toBe(2)
    const stations = inserted.map((entry) => entry.doc.station)
    expect(stations).toContain("chaud")
    expect(stations).toContain(undefined)
  })
})

// ---------------------------------------------------------------------------
// #164.5 and #164.6 — the overdue alarm and the allergen block
// ---------------------------------------------------------------------------

describe("summariseOrderLines", () => {
  it("gathers the allergens of every product in the order", async () => {
    const { ctx } = createCtx(baseDocs({}, TWO_LINE_ORDER))

    const summary = await summariseOrderLines(ctx, TWO_LINE_ORDER.items)
    expect(summary.allergens.sort()).toEqual(["gluten", "lait", "moutarde"])
  })

  it("takes the longest prep time, because a kitchen cooks in parallel", async () => {
    const { ctx } = createCtx(baseDocs({}, TWO_LINE_ORDER))

    const summary = await summariseOrderLines(ctx, TWO_LINE_ORDER.items)
    expect(summary.estimatedPrepTime).toBe(15)
  })

  it("leaves prep time unset when no product declares one", async () => {
    const { ctx } = createCtx({
      "stores:1": { _id: "stores:1" },
      "products:plain": { _id: "products:plain", allergens: [] },
    })

    const summary = await summariseOrderLines(ctx, [
      {
        productId: "products:plain",
        productName: "Eau",
        quantity: 1,
        unitPrice: 100,
        subtotal: 100,
        selectedOptions: [],
      },
    ])
    expect(summary.estimatedPrepTime).toBeUndefined()
  })
})

describe("the slip the kitchen is handed", () => {
  it("carries the allergens the print layout has always had a block for", async () => {
    const { ctx, inserted } = createCtx(baseDocs())
    await releaseToKitchen(ctx, "orders:1")

    expect(inserted[0]!.doc.allergens).toEqual(["gluten", "lait"])
  })

  it("carries a prep time, so estimatedReadyAt exists for the overdue alarm", async () => {
    const { ctx, inserted } = createCtx(baseDocs())
    await releaseToKitchen(ctx, "orders:1")

    expect(inserted[0]!.doc.estimatedPrepTime).toBe(15)
    expect(inserted[0]!.doc.estimatedReadyAt).toBeDefined()
  })

  it("keeps the source of the order rather than assuming the website", async () => {
    const { ctx, inserted } = createCtx(
      baseDocs({}, orderDoc({ source: "uber_eats" }))
    )
    await releaseToKitchen(ctx, "orders:1")

    expect(inserted[0]!.doc.source).toBe("uber_eats")
  })
})

// ---------------------------------------------------------------------------
// The dining-room screen, once an order can be several tickets
// ---------------------------------------------------------------------------

describe("dedupeByOrder", () => {
  it("shows one row per order, not one per station", () => {
    const rows = dedupeByOrder([
      { orderNumber: "A17", status: "ready" },
      { orderNumber: "A17", status: "in_progress" },
    ])

    expect(rows).toHaveLength(1)
  })

  it("keeps the least advanced station, because an order is only as ready as its slowest", () => {
    expect(
      dedupeByOrder([
        { orderNumber: "A17", status: "ready" },
        { orderNumber: "A17", status: "pending" },
        { orderNumber: "A17", status: "in_progress" },
      ])[0]!.status
    ).toBe("pending")
  })

  /**
   * The rank table originally stopped at `ready` and fell back to 0, so a
   * finished station tied with `pending` and won. `/track` then announced
   * "Terminée" for an order whose main had not been started.
   */
  it("does not let a FINISHED station answer for an order still cooking", () => {
    expect(
      dedupeByOrder([
        { orderNumber: "A17", status: "completed" },
        { orderNumber: "A17", status: "pending" },
      ])[0]!.status
    ).toBe("pending")

    expect(
      dedupeByOrder([
        { orderNumber: "A17", status: "cancelled" },
        { orderNumber: "A17", status: "in_progress" },
      ])[0]!.status
    ).toBe("in_progress")
  })

  it("reports a finished order as finished when every station is", () => {
    expect(
      dedupeByOrder([
        { orderNumber: "A17", status: "completed" },
        { orderNumber: "A17", status: "completed" },
      ])[0]!.status
    ).toBe("completed")
  })

  it("does not let an unrecognised status win by default", () => {
    expect(
      dedupeByOrder([
        { orderNumber: "A17", status: "something_new" },
        { orderNumber: "A17", status: "in_progress" },
      ])[0]!.status
    ).toBe("in_progress")
  })

  it("leaves distinct orders alone", () => {
    const rows = dedupeByOrder([
      { orderNumber: "A17", status: "ready" },
      { orderNumber: "A18", status: "ready" },
    ])

    expect(rows.map((r) => r.orderNumber)).toEqual(["A17", "A18"])
  })
})

// ---------------------------------------------------------------------------
// Found by adversarial verification: manual mode could strand a paid order
// ---------------------------------------------------------------------------

describe("staff who accept before the money arrives", () => {
  /**
   * The order that could never be cooked.
   *
   * In manual mode, staff press "Accepter" on a phone order that has not been
   * paid yet. The payment check refuses — correctly. But `confirmed` is
   * reachable once and only from `pending`, so when the payment landed the
   * release ran without `force`, the manual gate held it, and there was no
   * button left anywhere to press: paid, accepted, and no ticket.
   */
  it("still get their ticket when the payment lands afterwards", async () => {
    const { ctx, inserted, store } = createCtx(
      baseDocs({ orderConfirmation: "manual" }, orderDoc({ paymentStatus: "pending" }))
    )

    // Staff accept first. Nothing is released: nobody has paid.
    expect(await releaseToKitchen(ctx, "orders:1", { force: true })).toBe(0)
    store["orders:1"]!.status = "confirmed"

    // The money arrives on the ordinary payment path, with no `force`.
    store["orders:1"]!.paymentStatus = "paid"
    expect(await releaseToKitchen(ctx, "orders:1")).toBe(1)
    expect(inserted).toHaveLength(1)
  })

  it("does not let an unaccepted paid order through in manual mode", async () => {
    const { ctx } = createCtx(baseDocs({ orderConfirmation: "manual" }))
    // status is still "pending": nobody has accepted it.
    expect(await releaseToKitchen(ctx, "orders:1")).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// NEW2-JOURNEY-4 — cash has no provider, so it has nothing to abandon
// ---------------------------------------------------------------------------

/**
 * The regression this seam caused, and the defect it was protecting against,
 * pinned side by side.
 *
 * Gating every path on `paymentStatus === "paid"` closed #136 — an abandoned
 * card checkout no longer feeds the kitchen — and broke order-ahead cash: the
 * checkout's cash branch shows "Commande confirmée !" without touching the
 * server, so the order sat at `pending`/`pending` and the pass stayed empty
 * until somebody opened the admin and recorded the money. In auto mode nobody
 * ever does, which is the whole point of auto mode.
 *
 * Both halves are tested here because fixing either one alone reopens the
 * other, and that has already happened once.
 */
describe("a cash order", () => {
  const cash = (extra: Doc = {}) =>
    baseDocs({}, orderDoc({ paymentMethod: "cash", paymentStatus: "pending", ...extra }))

  it("reaches the pass at checkout in auto mode, before the money is taken", async () => {
    const { ctx, inserted } = createCtx(cash())

    expect(await releaseToKitchen(ctx, "orders:1")).toBe(1)
    expect(inserted).toHaveLength(1)
  })

  it("waits for staff in manual mode, then goes when they accept", async () => {
    const { ctx, inserted, store } = createCtx(cash())
    store["stores:1"]!.orderConfirmation = "manual"

    expect(await releaseToKitchen(ctx, "orders:1")).toBe(0)
    expect(await releaseToKitchen(ctx, "orders:1", { force: true })).toBe(1)
    expect(inserted).toHaveLength(1)
  })

  it("is not plated twice when the till is recorded afterwards", async () => {
    const { ctx, inserted, store } = createCtx(cash())

    await releaseToKitchen(ctx, "orders:1")
    // `markCashPaid` runs later and calls the seam again.
    store["orders:1"]!.paymentStatus = "paid"
    expect(await releaseToKitchen(ctx, "orders:1")).toBe(0)
    expect(inserted).toHaveLength(1)
  })
})

describe("a card order", () => {
  const card = (extra: Doc = {}) =>
    baseDocs({}, orderDoc({ paymentMethod: "card", paymentStatus: "pending", ...extra }))

  it("stays off the pass while the provider has not confirmed (#136)", async () => {
    const { ctx, inserted } = createCtx(card())

    expect(await releaseToKitchen(ctx, "orders:1")).toBe(0)
    expect(inserted).toHaveLength(0)
  })

  it("stays off the pass even when staff accept the abandoned checkout", async () => {
    const { ctx, inserted } = createCtx(card())

    expect(await releaseToKitchen(ctx, "orders:1", { force: true })).toBe(0)
    expect(inserted).toHaveLength(0)
  })

  it("goes to the pass once the provider confirms", async () => {
    const { ctx } = createCtx(card({ paymentStatus: "paid" }))
    expect(await releaseToKitchen(ctx, "orders:1")).toBe(1)
  })
})
