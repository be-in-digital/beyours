import { describe, it, expect, vi } from "vitest"
import {
  updatePrintConfig,
  updateDisplayConfig,
  updateSoundConfig,
  updateOrderConfirmation,
} from "../stores"

// ---------------------------------------------------------------------------
// Mock Convex DB
// ---------------------------------------------------------------------------

function createMockDb(records: Record<string, any> = {}) {
  const store: Record<string, any> = { ...records }

  return {
    get: vi.fn(async (id: string) => store[id] ?? null),
    patch: vi.fn(async (id: string, updates: any) => {
      if (store[id]) {
        Object.assign(store[id], updates)
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// updatePrintConfig
// ---------------------------------------------------------------------------

describe("updatePrintConfig", () => {
  it("should export args and handler", () => {
    expect(updatePrintConfig).toHaveProperty("args")
    expect(typeof updatePrintConfig.handler).toBe("function")
  })

  it("should throw if store not found", async () => {
    const db = createMockDb()
    await expect(
      updatePrintConfig.handler({ db }, { id: "stores:missing", printConfig: undefined })
    ).rejects.toThrow("Store not found")
  })

  it("should patch printConfig on existing store", async () => {
    const db = createMockDb({ "stores:1": { _id: "stores:1" } })
    const config = {
      provider: "browser",
      triggers: ["confirmed", "ready"],
      paperSize: "80mm",
      enabled: true,
    }

    await updatePrintConfig.handler({ db }, { id: "stores:1", printConfig: config })

    expect(db.patch).toHaveBeenCalledWith("stores:1", expect.objectContaining({
      printConfig: config,
      updatedAt: expect.any(Number),
    }))
  })

  it("should allow clearing printConfig with undefined", async () => {
    const db = createMockDb({
      "stores:1": { _id: "stores:1", printConfig: { enabled: true } },
    })

    await updatePrintConfig.handler({ db }, { id: "stores:1", printConfig: undefined })

    expect(db.patch).toHaveBeenCalledWith("stores:1", expect.objectContaining({
      printConfig: undefined,
    }))
  })
})

// ---------------------------------------------------------------------------
// updateDisplayConfig
// ---------------------------------------------------------------------------

describe("updateDisplayConfig", () => {
  it("should throw if store not found", async () => {
    const db = createMockDb()
    await expect(
      updateDisplayConfig.handler({ db }, { id: "stores:missing", displayConfig: undefined })
    ).rejects.toThrow("Store not found")
  })

  it("should patch displayConfig on existing store", async () => {
    const db = createMockDb({ "stores:1": { _id: "stores:1" } })
    const config = { autoDismissEnabled: true, autoDismissMinutes: 10 }

    await updateDisplayConfig.handler({ db }, { id: "stores:1", displayConfig: config })

    expect(db.patch).toHaveBeenCalledWith("stores:1", expect.objectContaining({
      displayConfig: config,
      updatedAt: expect.any(Number),
    }))
  })

  it("should set updatedAt timestamp", async () => {
    const before = Date.now()
    const db = createMockDb({ "stores:1": { _id: "stores:1" } })

    await updateDisplayConfig.handler({ db }, {
      id: "stores:1",
      displayConfig: { autoDismissEnabled: false, autoDismissMinutes: 0 },
    })

    const updatedAt = db.patch.mock.calls[0]![1].updatedAt
    expect(updatedAt).toBeGreaterThanOrEqual(before)
    expect(updatedAt).toBeLessThanOrEqual(Date.now())
  })
})

// ---------------------------------------------------------------------------
// updateSoundConfig
// ---------------------------------------------------------------------------

describe("updateSoundConfig", () => {
  it("should throw if store not found", async () => {
    const db = createMockDb()
    await expect(
      updateSoundConfig.handler({ db }, { id: "stores:missing", soundConfig: undefined })
    ).rejects.toThrow("Store not found")
  })

  it("should patch soundConfig with 3 channels", async () => {
    const db = createMockDb({ "stores:1": { _id: "stores:1" } })
    const config = {
      newTicket: { enabled: true, volume: 80 },
      overdue: { enabled: true, volume: 100 },
      printerOffline: { enabled: false, volume: 50 },
    }

    await updateSoundConfig.handler({ db }, { id: "stores:1", soundConfig: config })

    expect(db.patch).toHaveBeenCalledWith("stores:1", expect.objectContaining({
      soundConfig: config,
    }))
  })
})

// ---------------------------------------------------------------------------
// updateOrderConfirmation
// ---------------------------------------------------------------------------

describe("updateOrderConfirmation", () => {
  it("should throw if store not found", async () => {
    const db = createMockDb()
    await expect(
      updateOrderConfirmation.handler({ db }, { id: "stores:missing", orderConfirmation: "auto" })
    ).rejects.toThrow("Store not found")
  })

  it("should set orderConfirmation to auto", async () => {
    const db = createMockDb({ "stores:1": { _id: "stores:1" } })

    await updateOrderConfirmation.handler({ db }, { id: "stores:1", orderConfirmation: "auto" })

    expect(db.patch).toHaveBeenCalledWith("stores:1", expect.objectContaining({
      orderConfirmation: "auto",
      updatedAt: expect.any(Number),
    }))
  })

  it("should set orderConfirmation to manual", async () => {
    const db = createMockDb({ "stores:1": { _id: "stores:1" } })

    await updateOrderConfirmation.handler({ db }, { id: "stores:1", orderConfirmation: "manual" })

    expect(db.patch).toHaveBeenCalledWith("stores:1", expect.objectContaining({
      orderConfirmation: "manual",
    }))
  })
})
