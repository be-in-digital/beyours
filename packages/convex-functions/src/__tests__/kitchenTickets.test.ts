import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  create,
  updateStatus,
  markPickedUp,
  markPrintSent,
  markPrintFailed,
  requestReprint,
  getOverdueCount,
  getPrintStuckCount,
  getForDisplay,
  getByTrackingToken,
  getPrintQueue,
} from "../kitchenTickets"

// ---------------------------------------------------------------------------
// Mock Convex DB helpers
// ---------------------------------------------------------------------------

function createMockDb(records: Record<string, any> = {}) {
  const store: Record<string, any> = { ...records }

  return {
    get: vi.fn(async (id: string) => store[id] ?? null),
    insert: vi.fn(async (table: string, doc: any) => {
      const id = `${table}:${Date.now()}`
      store[id] = { _id: id, ...doc }
      return id
    }),
    patch: vi.fn(async (id: string, updates: any) => {
      if (store[id]) {
        Object.assign(store[id], updates)
      }
    }),
    query: vi.fn((table: string) => {
      const items = Object.values(store).filter(
        (r: any) => r._table === table || true
      )
      return {
        withIndex: vi.fn(() => ({
          order: vi.fn(() => ({
            collect: vi.fn(async () => items),
          })),
          first: vi.fn(async () => items[0] ?? null),
          collect: vi.fn(async () => items),
        })),
        collect: vi.fn(async () => items),
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// Exports structure
// ---------------------------------------------------------------------------

describe("kitchenTickets exports", () => {
  it("should export create with args and handler", () => {
    expect(create).toHaveProperty("args")
    expect(create).toHaveProperty("handler")
    expect(typeof create.handler).toBe("function")
  })

  it("should export updateStatus with args and handler", () => {
    expect(updateStatus).toHaveProperty("args")
    expect(typeof updateStatus.handler).toBe("function")
  })

  it("should export markPickedUp with args and handler", () => {
    expect(markPickedUp).toHaveProperty("args")
    expect(typeof markPickedUp.handler).toBe("function")
  })

  it("should export markPrintSent with args and handler", () => {
    expect(markPrintSent).toHaveProperty("args")
    expect(typeof markPrintSent.handler).toBe("function")
  })

  it("should export markPrintFailed with args and handler", () => {
    expect(markPrintFailed).toHaveProperty("args")
    expect(typeof markPrintFailed.handler).toBe("function")
  })

  it("should export requestReprint with args and handler", () => {
    expect(requestReprint).toHaveProperty("args")
    expect(typeof requestReprint.handler).toBe("function")
  })

  it("should export query functions", () => {
    expect(typeof getOverdueCount.handler).toBe("function")
    expect(typeof getPrintStuckCount.handler).toBe("function")
    expect(typeof getForDisplay.handler).toBe("function")
    expect(typeof getByTrackingToken.handler).toBe("function")
    expect(typeof getPrintQueue.handler).toBe("function")
  })
})

// ---------------------------------------------------------------------------
// create mutation
// ---------------------------------------------------------------------------

describe("create mutation", () => {
  it("should create a ticket with pending status", async () => {
    const db = createMockDb({
      "stores:1": {
        _id: "stores:1",
        printConfig: undefined,
      },
    })

    const id = await create.handler({ db }, {
      storeId: "stores:1",
      orderId: "orders:1",
      orderNumber: "ORD-2026-ABC",
      orderType: "pickup",
      items: [{ productName: "Burger", quantity: 2, options: ["No onions"] }],
      priority: "normal",
      source: "website",
      trackingToken: "abc123token",
    })

    expect(db.insert).toHaveBeenCalledOnce()
    const insertCall = db.insert.mock.calls[0]!
    expect(insertCall[0]).toBe("kitchenTickets")
    expect(insertCall[1]).toMatchObject({
      status: "pending",
      orderNumber: "ORD-2026-ABC",
      orderType: "pickup",
      trackingToken: "abc123token",
    })
  })

  it("should set printStatus=pending when store has print enabled with confirmed trigger", async () => {
    const db = createMockDb({
      "stores:1": {
        _id: "stores:1",
        printConfig: {
          enabled: true,
          triggers: ["confirmed", "reprint"],
          provider: "browser",
          paperSize: "80mm",
        },
      },
    })

    await create.handler({ db }, {
      storeId: "stores:1",
      orderId: "orders:1",
      orderNumber: "ORD-001",
      orderType: "dine_in",
      items: [{ productName: "Pizza", quantity: 1, options: [] }],
      priority: "normal",
      source: "website",
      trackingToken: "tok123",
    })

    const doc = db.insert.mock.calls[0]![1]
    expect(doc.printStatus).toBe("pending")
    expect(doc.printRequestedAt).toBeTypeOf("number")
    expect(doc.printTrigger).toBe("confirmed")
  })

  it("should set printStatus=not_required when print disabled", async () => {
    const db = createMockDb({
      "stores:1": {
        _id: "stores:1",
        printConfig: { enabled: false, triggers: [], provider: "browser", paperSize: "80mm" },
      },
    })

    await create.handler({ db }, {
      storeId: "stores:1",
      orderId: "orders:1",
      orderNumber: "ORD-002",
      orderType: "pickup",
      items: [{ productName: "Sushi", quantity: 3, options: [] }],
      priority: "normal",
      source: "pos",
      trackingToken: "tok456",
    })

    const doc = db.insert.mock.calls[0]![1]
    expect(doc.printStatus).toBe("not_required")
    expect(doc.printRequestedAt).toBeUndefined()
  })

  it("should calculate estimatedReadyAt from estimatedPrepTime", async () => {
    const before = Date.now()
    const db = createMockDb({ "stores:1": { _id: "stores:1" } })

    await create.handler({ db }, {
      storeId: "stores:1",
      orderId: "orders:1",
      orderNumber: "ORD-003",
      orderType: "delivery",
      items: [{ productName: "Ramen", quantity: 1, options: [] }],
      priority: "normal",
      source: "website",
      trackingToken: "tok789",
      estimatedPrepTime: 15, // 15 minutes
    })

    const doc = db.insert.mock.calls[0]![1]
    expect(doc.estimatedReadyAt).toBeGreaterThanOrEqual(before + 15 * 60_000)
    expect(doc.estimatedReadyAt).toBeLessThanOrEqual(Date.now() + 15 * 60_000)
  })
})

// ---------------------------------------------------------------------------
// updateStatus mutation
// ---------------------------------------------------------------------------

describe("updateStatus mutation", () => {
  it("should throw if ticket not found", async () => {
    const db = createMockDb()
    await expect(
      updateStatus.handler({ db }, { id: "missing:1", status: "in_progress" })
    ).rejects.toThrow("Kitchen ticket not found")
  })

  it("should set startedAt when moving to in_progress", async () => {
    const ticket = {
      _id: "kt:1",
      storeId: "stores:1",
      status: "pending",
      startedAt: undefined,
    }
    const db = createMockDb({ "kt:1": ticket })

    await updateStatus.handler({ db }, { id: "kt:1", status: "in_progress" })

    expect(db.patch).toHaveBeenCalledWith("kt:1", expect.objectContaining({
      status: "in_progress",
      startedAt: expect.any(Number),
    }))
  })

  it("should NOT overwrite startedAt if already set", async () => {
    const existingStartedAt = 1000000
    const ticket = {
      _id: "kt:2",
      storeId: "stores:1",
      status: "in_progress",
      startedAt: existingStartedAt,
    }
    const db = createMockDb({ "kt:2": ticket })

    await updateStatus.handler({ db }, { id: "kt:2", status: "in_progress" })

    const patchArgs = db.patch.mock.calls[0]![1]
    expect(patchArgs.startedAt).toBeUndefined()
  })

  it("should set readyAt when moving to ready", async () => {
    const ticket = {
      _id: "kt:3",
      storeId: "stores:1",
      status: "in_progress",
    }
    const db = createMockDb({
      "kt:3": ticket,
      "stores:1": { _id: "stores:1", printConfig: undefined },
    })

    await updateStatus.handler({ db }, { id: "kt:3", status: "ready" })

    expect(db.patch).toHaveBeenCalledWith("kt:3", expect.objectContaining({
      status: "ready",
      readyAt: expect.any(Number),
    }))
  })

  it("should trigger ready-print when store config has ready trigger", async () => {
    const ticket = {
      _id: "kt:4",
      storeId: "stores:2",
      status: "in_progress",
    }
    const store = {
      _id: "stores:2",
      printConfig: {
        enabled: true,
        triggers: ["ready", "reprint"],
        provider: "browser",
        paperSize: "80mm",
      },
    }
    const db = createMockDb({ "kt:4": ticket, "stores:2": store })

    await updateStatus.handler({ db }, { id: "kt:4", status: "ready" })

    expect(db.patch).toHaveBeenCalledWith("kt:4", expect.objectContaining({
      printStatus: "pending",
      printTrigger: "ready",
      printRequestedAt: expect.any(Number),
    }))
  })

  it("should set completedAt when moving to completed", async () => {
    const ticket = {
      _id: "kt:5",
      storeId: "stores:1",
      status: "ready",
    }
    const db = createMockDb({ "kt:5": ticket })

    await updateStatus.handler({ db }, { id: "kt:5", status: "completed" })

    expect(db.patch).toHaveBeenCalledWith("kt:5", expect.objectContaining({
      status: "completed",
      completedAt: expect.any(Number),
    }))
  })
})

// ---------------------------------------------------------------------------
// markPickedUp mutation
// ---------------------------------------------------------------------------

describe("markPickedUp mutation", () => {
  it("should throw if ticket not found", async () => {
    const db = createMockDb()
    await expect(
      markPickedUp.handler({ db }, { id: "missing:1" })
    ).rejects.toThrow("Kitchen ticket not found")
  })

  it("should set pickedUpAt timestamp", async () => {
    const ticket = { _id: "kt:10", status: "ready" }
    const db = createMockDb({ "kt:10": ticket })

    await markPickedUp.handler({ db }, { id: "kt:10" })

    expect(db.patch).toHaveBeenCalledWith("kt:10", expect.objectContaining({
      pickedUpAt: expect.any(Number),
      updatedAt: expect.any(Number),
    }))
  })
})

// ---------------------------------------------------------------------------
// markPrintSent mutation
// ---------------------------------------------------------------------------

describe("markPrintSent mutation", () => {
  it("should throw if ticket not found", async () => {
    const db = createMockDb()
    await expect(
      markPrintSent.handler({ db }, { id: "missing:1" })
    ).rejects.toThrow("Kitchen ticket not found")
  })

  it("should set printStatus=printed and increment printAttempts", async () => {
    const ticket = {
      _id: "kt:20",
      printStatus: "pending",
      printAttempts: 0,
    }
    const db = createMockDb({ "kt:20": ticket })

    await markPrintSent.handler({ db }, { id: "kt:20" })

    expect(db.patch).toHaveBeenCalledWith("kt:20", expect.objectContaining({
      printStatus: "printed",
      printAttempts: 1,
      lastPrintAt: expect.any(Number),
      printFailedAt: undefined,
      lastPrintError: undefined,
    }))
  })

  it("should increment existing printAttempts", async () => {
    const ticket = {
      _id: "kt:21",
      printStatus: "pending",
      printAttempts: 3,
    }
    const db = createMockDb({ "kt:21": ticket })

    await markPrintSent.handler({ db }, { id: "kt:21" })

    const patchArgs = db.patch.mock.calls[0]![1]
    expect(patchArgs.printAttempts).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// markPrintFailed mutation
// ---------------------------------------------------------------------------

describe("markPrintFailed mutation", () => {
  it("should throw if ticket not found", async () => {
    const db = createMockDb()
    await expect(
      markPrintFailed.handler({ db }, { id: "missing:1" })
    ).rejects.toThrow("Kitchen ticket not found")
  })

  it("should set printStatus=failed with reason", async () => {
    const ticket = {
      _id: "kt:30",
      printStatus: "pending",
      printAttempts: 1,
    }
    const db = createMockDb({ "kt:30": ticket })

    await markPrintFailed.handler({ db }, { id: "kt:30", reason: "Timeout" })

    expect(db.patch).toHaveBeenCalledWith("kt:30", expect.objectContaining({
      printStatus: "failed",
      printAttempts: 2,
      printFailedAt: expect.any(Number),
      lastPrintError: "Timeout",
    }))
  })

  it("should handle missing reason gracefully", async () => {
    const ticket = { _id: "kt:31", printAttempts: 0 }
    const db = createMockDb({ "kt:31": ticket })

    await markPrintFailed.handler({ db }, { id: "kt:31" })

    const patchArgs = db.patch.mock.calls[0]![1]
    expect(patchArgs.lastPrintError).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// requestReprint mutation
// ---------------------------------------------------------------------------

describe("requestReprint mutation", () => {
  it("should throw if ticket not found", async () => {
    const db = createMockDb()
    await expect(
      requestReprint.handler({ db }, { id: "missing:1" })
    ).rejects.toThrow("Kitchen ticket not found")
  })

  it("should set printStatus=pending with reprint trigger", async () => {
    const ticket = { _id: "kt:40", printStatus: "printed" }
    const db = createMockDb({ "kt:40": ticket })

    await requestReprint.handler({ db }, { id: "kt:40" })

    expect(db.patch).toHaveBeenCalledWith("kt:40", expect.objectContaining({
      printStatus: "pending",
      printTrigger: "reprint",
      printRequestedAt: expect.any(Number),
    }))
  })
})

// ---------------------------------------------------------------------------
// getByTrackingToken query
// ---------------------------------------------------------------------------

describe("getByTrackingToken query", () => {
  it("should return null for unknown token", async () => {
    const db = createMockDb()
    // Override query to return empty
    db.query = vi.fn(() => ({
      withIndex: vi.fn(() => ({
        first: vi.fn(async () => null),
        take: vi.fn(async () => []),
      })),
    })) as any

    const result = await getByTrackingToken.handler({ db }, { token: "unknown" })
    expect(result).toBeNull()
  })

  it("should return client-safe ticket data with store branding", async () => {
    const ticket = {
      _id: "kt:50",
      storeId: "stores:1",
      orderNumber: "ORD-001",
      status: "in_progress",
      orderType: "delivery",
      createdAt: 1000,
      startedAt: 2000,
      readyAt: undefined,
      completedAt: undefined,
      estimatedReadyAt: 5000,
      trackingToken: "tok-abc",
    }
    const store = {
      _id: "stores:1",
      name: "Pizza Palace",
      slug: "pizza-palace",
      address: { street: "123 Main St", city: "Paris" },
    }

    const db = {
      get: vi.fn(async (id: string) => {
        if (id === "stores:1") return store
        return null
      }),
      query: vi.fn(() => ({
        withIndex: vi.fn(() => ({
          first: vi.fn(async () => ticket),
          take: vi.fn(async () => [ticket]),
        })),
      })),
    }

    const result = await getByTrackingToken.handler({ db }, { token: "tok-abc" })

    expect(result).not.toBeNull()
    expect(result!.orderNumber).toBe("ORD-001")
    expect(result!.status).toBe("in_progress")
    expect(result!.storeBranding).toMatchObject({
      name: "Pizza Palace",
      slug: "pizza-palace",
    })
    // Should NOT leak sensitive fields
    expect(result).not.toHaveProperty("items")
    expect(result).not.toHaveProperty("customerPhone")
    expect(result).not.toHaveProperty("assignedTo")
  })
})

// ---------------------------------------------------------------------------
// getForDisplay query
// ---------------------------------------------------------------------------

describe("getForDisplay query", () => {
  it("should throw if store not found", async () => {
    const db = createMockDb()
    db.get = vi.fn(async () => null)

    await expect(
      getForDisplay.handler({ db }, { storeId: "stores:missing" })
    ).rejects.toThrow("Store not found")
  })

  it("should return storeBranding with name and slug", async () => {
    const store = {
      _id: "stores:1",
      name: "Sushi Bar",
      slug: "sushi-bar",
      displayConfig: { autoDismissEnabled: true, autoDismissMinutes: 15 },
    }

    const db = {
      get: vi.fn(async () => store),
      query: vi.fn(() => ({
        withIndex: vi.fn(() => ({
          order: vi.fn(() => ({
            collect: vi.fn(async () => []),
            take: vi.fn(async () => []),
          })),
          collect: vi.fn(async () => []),
        })),
      })),
    }

    const result = await getForDisplay.handler({ db }, { storeId: "stores:1" })

    expect(result.storeBranding).toEqual({
      name: "Sushi Bar",
      slug: "sushi-bar",
    })
    expect(result.displayConfig).toMatchObject({
      autoDismissEnabled: true,
      autoDismissMinutes: 15,
    })
    expect(result.serverNow).toBeTypeOf("number")
  })

  it("should use default displayConfig when none configured", async () => {
    const store = {
      _id: "stores:1",
      name: "Test",
      slug: "test",
      // no displayConfig
    }

    const db = {
      get: vi.fn(async () => store),
      query: vi.fn(() => ({
        withIndex: vi.fn(() => ({
          order: vi.fn(() => ({
            collect: vi.fn(async () => []),
            take: vi.fn(async () => []),
          })),
          collect: vi.fn(async () => []),
        })),
      })),
    }

    const result = await getForDisplay.handler({ db }, { storeId: "stores:1" })

    expect(result.displayConfig).toEqual({
      autoDismissEnabled: true,
      autoDismissMinutes: 15,
    })
  })
})

// ===========================================================================
// SCENARIO TESTS — Full lifecycle simulations
// ===========================================================================

describe("Scenario: Complete ticket lifecycle (website order, no print)", () => {
  let db: ReturnType<typeof createMockDb>
  let ticketId: string

  beforeEach(async () => {
    db = createMockDb({
      "stores:1": {
        _id: "stores:1",
        name: "Burger Joint",
        slug: "burger-joint",
        printConfig: { enabled: false, triggers: [], provider: "browser", paperSize: "80mm" },
      },
    })

    ticketId = await create.handler({ db }, {
      storeId: "stores:1",
      orderId: "orders:1",
      orderNumber: "ORD-2026-FLOW1",
      orderType: "dine_in",
      items: [{ productName: "Cheeseburger", quantity: 2, options: ["Extra cheese"] }],
      priority: "normal",
      source: "website",
      trackingToken: "tok-flow-1",
      estimatedPrepTime: 10,
    })
  })

  it("should create ticket with pending status and not_required print", () => {
    const doc = db.insert.mock.calls[0]![1]
    expect(doc.status).toBe("pending")
    expect(doc.printStatus).toBe("not_required")
    expect(doc.estimatedReadyAt).toBeTypeOf("number")
  })

  it("should transition pending → in_progress with startedAt", async () => {
    // Manually set ticket in mock store for subsequent calls
    db.get = vi.fn(async (id: string) => {
      if (id === ticketId) return { _id: ticketId, storeId: "stores:1", status: "pending", startedAt: undefined }
      if (id === "stores:1") return db.get.mock.results[0]?.value
      return null
    }) as any

    await updateStatus.handler({ db }, { id: ticketId, status: "in_progress" })

    const patch = db.patch.mock.calls[0]![1]
    expect(patch.status).toBe("in_progress")
    expect(patch.startedAt).toBeTypeOf("number")
  })

  it("should transition in_progress → ready with readyAt, no print trigger", async () => {
    db.get = vi.fn(async (id: string) => {
      if (id === ticketId) return { _id: ticketId, storeId: "stores:1", status: "in_progress", startedAt: Date.now() }
      if (id === "stores:1") return { _id: "stores:1", printConfig: { enabled: false, triggers: [] } }
      return null
    }) as any

    await updateStatus.handler({ db }, { id: ticketId, status: "ready" })

    const patch = db.patch.mock.calls[0]![1]
    expect(patch.status).toBe("ready")
    expect(patch.readyAt).toBeTypeOf("number")
    expect(patch.printStatus).toBeUndefined() // no print trigger
  })

  it("should transition ready → completed with completedAt", async () => {
    db.get = vi.fn(async (id: string) => {
      if (id === ticketId) return { _id: ticketId, storeId: "stores:1", status: "ready", readyAt: Date.now() }
      return null
    }) as any

    await updateStatus.handler({ db }, { id: ticketId, status: "completed" })

    const patch = db.patch.mock.calls[0]![1]
    expect(patch.status).toBe("completed")
    expect(patch.completedAt).toBeTypeOf("number")
  })
})

describe("Scenario: Ticket with auto-print on confirmed + ready", () => {
  let db: ReturnType<typeof createMockDb>
  let ticketId: string

  const storeWithPrint = {
    _id: "stores:2",
    name: "Pizza Place",
    slug: "pizza-place",
    printConfig: {
      enabled: true,
      triggers: ["confirmed", "ready", "reprint"],
      provider: "browser",
      paperSize: "80mm",
    },
  }

  beforeEach(async () => {
    db = createMockDb({ "stores:2": storeWithPrint })

    ticketId = await create.handler({ db }, {
      storeId: "stores:2",
      orderId: "orders:2",
      orderNumber: "ORD-2026-PRINT1",
      orderType: "delivery",
      items: [{ productName: "Margherita", quantity: 1, options: [] }],
      priority: "urgent",
      source: "uber_eats",
      trackingToken: "tok-print-1",
      customerName: "Jean Dupont",
      customerPhone: "+33612345678",
      deliveryNotes: "Code: 1234",
    })
  })

  it("should create with printStatus=pending and trigger=confirmed", () => {
    const doc = db.insert.mock.calls[0]![1]
    expect(doc.printStatus).toBe("pending")
    expect(doc.printTrigger).toBe("confirmed")
    expect(doc.printRequestedAt).toBeTypeOf("number")
    expect(doc.printAttempts).toBe(0)
  })

  it("should mark print sent after successful print", async () => {
    const ticket = { _id: ticketId, printStatus: "pending", printAttempts: 0 }
    db.get = vi.fn(async () => ticket) as any

    await markPrintSent.handler({ db }, { id: ticketId })

    const patch = db.patch.mock.calls[0]![1]
    expect(patch.printStatus).toBe("printed")
    expect(patch.printAttempts).toBe(1)
    expect(patch.lastPrintAt).toBeTypeOf("number")
    expect(patch.printFailedAt).toBeUndefined()
  })

  it("should trigger ready-print when transitioning to ready", async () => {
    const ticket = { _id: ticketId, storeId: "stores:2", status: "in_progress", printStatus: "printed" }
    db.get = vi.fn(async (id: string) => {
      if (id === ticketId) return ticket
      if (id === "stores:2") return storeWithPrint
      return null
    }) as any

    await updateStatus.handler({ db }, { id: ticketId, status: "ready" })

    const patch = db.patch.mock.calls[0]![1]
    expect(patch.printStatus).toBe("pending")
    expect(patch.printTrigger).toBe("ready")
    expect(patch.printRequestedAt).toBeTypeOf("number")
  })

  it("should handle print failure + reprint cycle", async () => {
    // Step 1: print fails
    const ticketPending = { _id: ticketId, printStatus: "pending", printAttempts: 0 }
    db.get = vi.fn(async () => ticketPending) as any
    await markPrintFailed.handler({ db }, { id: ticketId, reason: "Printer offline" })

    let patch = db.patch.mock.calls[0]![1]
    expect(patch.printStatus).toBe("failed")
    expect(patch.lastPrintError).toBe("Printer offline")
    expect(patch.printAttempts).toBe(1)

    // Step 2: staff requests reprint
    const ticketFailed = { _id: ticketId, printStatus: "failed", printAttempts: 1 }
    db.get = vi.fn(async () => ticketFailed) as any
    db.patch = vi.fn()

    await requestReprint.handler({ db }, { id: ticketId })

    patch = db.patch.mock.calls[0]![1]
    expect(patch.printStatus).toBe("pending")
    expect(patch.printTrigger).toBe("reprint")

    // Step 3: reprint succeeds
    const ticketReprint = { _id: ticketId, printStatus: "pending", printAttempts: 1 }
    db.get = vi.fn(async () => ticketReprint) as any
    db.patch = vi.fn()

    await markPrintSent.handler({ db }, { id: ticketId })

    patch = db.patch.mock.calls[0]![1]
    expect(patch.printStatus).toBe("printed")
    expect(patch.printAttempts).toBe(2)
  })
})

describe("Scenario: Pickup order with markPickedUp", () => {
  it("should go through full pickup flow: create → ready → picked up → completed", async () => {
    const db = createMockDb({
      "stores:1": { _id: "stores:1", printConfig: undefined },
    })

    // Create
    const ticketId = await create.handler({ db }, {
      storeId: "stores:1",
      orderId: "orders:3",
      orderNumber: "ORD-PICKUP-1",
      orderType: "pickup",
      items: [{ productName: "Sushi Set", quantity: 1, options: [] }],
      priority: "normal",
      source: "pos",
      trackingToken: "tok-pickup-1",
    })

    const doc = db.insert.mock.calls[0]![1]
    expect(doc.status).toBe("pending")

    // → in_progress
    db.get = vi.fn(async () => ({ _id: ticketId, storeId: "stores:1", status: "pending" })) as any
    await updateStatus.handler({ db }, { id: ticketId, status: "in_progress" })
    expect(db.patch.mock.calls[0]![1].startedAt).toBeTypeOf("number")

    // → ready
    db.get = vi.fn(async (id: string) => {
      if (id === ticketId) return { _id: ticketId, storeId: "stores:1", status: "in_progress", startedAt: Date.now() }
      if (id === "stores:1") return { _id: "stores:1", printConfig: undefined }
      return null
    }) as any
    db.patch = vi.fn()
    await updateStatus.handler({ db }, { id: ticketId, status: "ready" })
    expect(db.patch.mock.calls[0]![1].readyAt).toBeTypeOf("number")

    // Mark picked up
    db.get = vi.fn(async () => ({ _id: ticketId, status: "ready" })) as any
    db.patch = vi.fn()
    await markPickedUp.handler({ db }, { id: ticketId })
    expect(db.patch.mock.calls[0]![1].pickedUpAt).toBeTypeOf("number")

    // → completed
    db.get = vi.fn(async () => ({ _id: ticketId, storeId: "stores:1", status: "ready", pickedUpAt: Date.now() })) as any
    db.patch = vi.fn()
    await updateStatus.handler({ db }, { id: ticketId, status: "completed" })
    expect(db.patch.mock.calls[0]![1].completedAt).toBeTypeOf("number")
  })
})

describe("Scenario: Tracking token privacy", () => {
  it("should never leak sensitive data through tracking endpoint", async () => {
    const ticket = {
      _id: "kt:secret",
      storeId: "stores:1",
      orderNumber: "ORD-SECRET",
      status: "in_progress",
      orderType: "delivery",
      createdAt: Date.now() - 60_000,
      startedAt: Date.now() - 30_000,
      estimatedReadyAt: Date.now() + 300_000,
      trackingToken: "tok-secret",
      // Sensitive fields that must NOT appear in response
      items: [{ productName: "Secret Menu Item", quantity: 1, options: [] }],
      customerName: "Jean Secret",
      customerPhone: "+33600000000",
      deliveryNotes: "Building code: 9999",
      allergens: ["nuts", "gluten"],
      assignedTo: "staff:chef1",
      station: "Grill",
      printStatus: "printed",
      printAttempts: 2,
    }

    const store = {
      _id: "stores:1",
      name: "My Restaurant",
      slug: "my-restaurant",
      address: { street: "10 Rue de Paris", city: "Paris" },
    }

    const db = {
      get: vi.fn(async (id: string) => (id === "stores:1" ? store : null)),
      query: vi.fn(() => ({
        withIndex: vi.fn(() => ({
          first: vi.fn(async () => ticket),
          take: vi.fn(async () => [ticket]),
        })),
      })),
    }

    const result = await getByTrackingToken.handler({ db }, { token: "tok-secret" })

    expect(result).not.toBeNull()
    // Allowed fields
    expect(result!.orderNumber).toBe("ORD-SECRET")
    expect(result!.status).toBe("in_progress")
    expect(result!.storeBranding?.name).toBe("My Restaurant")

    // Forbidden fields — must NOT be in response
    expect(result).not.toHaveProperty("items")
    expect(result).not.toHaveProperty("customerName")
    expect(result).not.toHaveProperty("customerPhone")
    expect(result).not.toHaveProperty("deliveryNotes")
    expect(result).not.toHaveProperty("allergens")
    expect(result).not.toHaveProperty("assignedTo")
    expect(result).not.toHaveProperty("station")
    expect(result).not.toHaveProperty("printStatus")
    expect(result).not.toHaveProperty("printAttempts")
  })
})

describe("Scenario: Display auto-dismiss filtering", () => {
  it("should exclude ready tickets outside auto-dismiss window", async () => {
    const now = Date.now()
    const store = {
      _id: "stores:1",
      name: "Test",
      slug: "test",
      displayConfig: {
        autoDismissEnabled: true,
        autoDismissMinutes: 5, // 5 minutes
      },
    }

    const freshReady = {
      _id: "kt:fresh",
      orderNumber: "ORD-FRESH",
      status: "ready",
      createdAt: now - 120_000,
      readyAt: now - 60_000, // 1 min ago, within 5 min window
      pickedUpAt: undefined,
    }
    const staleReady = {
      _id: "kt:stale",
      orderNumber: "ORD-STALE",
      status: "ready",
      createdAt: now - 600_000,
      readyAt: now - 400_000, // 6.6 min ago, outside 5 min window
      pickedUpAt: undefined,
    }
    const pickedUpReady = {
      _id: "kt:picked",
      orderNumber: "ORD-PICKED",
      status: "ready",
      createdAt: now - 60_000,
      readyAt: now - 30_000,
      pickedUpAt: now - 10_000, // already picked up
    }

    let queryCallCount = 0
    const db = {
      get: vi.fn(async () => store),
      query: vi.fn(() => {
        queryCallCount++
        // Calls 1-2: pending + in_progress (preparing)
        if (queryCallCount <= 2) {
          return {
            withIndex: vi.fn(() => ({
              order: vi.fn(() => ({
                collect: vi.fn(async () => []),
                take: vi.fn(async () => []),
              })),
            })),
          }
        }
        // Call 3: ready tickets
        return {
          withIndex: vi.fn(() => ({
            order: vi.fn(() => ({
              collect: vi.fn(async () => [freshReady, staleReady, pickedUpReady]),
              take: vi.fn(async () => [freshReady, staleReady, pickedUpReady]),
            })),
          })),
        }
      }),
    }

    const result = await getForDisplay.handler({ db }, { storeId: "stores:1" })

    // Only freshReady should pass: within window, not picked up
    expect(result.ready).toHaveLength(1)
    expect(result.ready[0].orderNumber).toBe("ORD-FRESH")
  })

  it("should include all ready tickets when auto-dismiss disabled", async () => {
    const now = Date.now()
    const store = {
      _id: "stores:1",
      name: "Test",
      slug: "test",
      displayConfig: {
        autoDismissEnabled: false,
        autoDismissMinutes: 5,
      },
    }

    const oldReady = {
      _id: "kt:old",
      orderNumber: "ORD-OLD",
      status: "ready",
      createdAt: now - 3_600_000, // 1h ago
      readyAt: now - 3_000_000,   // 50min ago
      pickedUpAt: undefined,
    }

    let queryCallCount = 0
    const db = {
      get: vi.fn(async () => store),
      query: vi.fn(() => {
        queryCallCount++
        if (queryCallCount <= 2) {
          return {
            withIndex: vi.fn(() => ({
              order: vi.fn(() => ({
                collect: vi.fn(async () => []),
                take: vi.fn(async () => []),
              })),
            })),
          }
        }
        return {
          withIndex: vi.fn(() => ({
            order: vi.fn(() => ({
              collect: vi.fn(async () => [oldReady]),
              take: vi.fn(async () => [oldReady]),
            })),
          })),
        }
      }),
    }

    const result = await getForDisplay.handler({ db }, { storeId: "stores:1" })

    // Should include even very old ready tickets when auto-dismiss is off
    expect(result.ready).toHaveLength(1)
    expect(result.ready[0].orderNumber).toBe("ORD-OLD")
  })
})
