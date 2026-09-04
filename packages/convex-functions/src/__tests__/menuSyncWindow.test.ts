/**
 * A burst of catalogue edits must book ONE menu push per platform, per store.
 *
 * The mutations used to queue `syncAllStores` — for both platforms — on every
 * write, and Convex does not dedupe scheduled jobs. Importing fifty products
 * queued a hundred sweeps, and every one of those sweeps then uploaded the menu
 * of every establishment on the deployment, not the one that had changed. Uber
 * caps the menu endpoint at roughly one call a minute per store, so most of
 * those uploads could only ever come back 429.
 *
 * These tests hold the claim itself. The scheduling that reads it is held from
 * the other side, in each app's `tests/convex/menu-sync-scheduling.test.ts`.
 */

import { describe, expect, it } from "vitest"
import {
  MENU_SYNC_WINDOW_MS,
  claimMenuSyncWindow,
  menuSyncKey,
} from "../rateLimit"

const T = 1_700_000_000_000

interface Row {
  _id: string
  key: string
  windowStart: number
  count: number
}

/**
 * The `{ db }` stub this package's tests use, narrowed to the one table and
 * one index the claim touches.
 */
function fakeDb() {
  const rows: Row[] = []
  let nextId = 1

  const ctx = {
    db: {
      query(table: string) {
        expect(table).toBe("rateLimits")
        return {
          withIndex(
            index: string,
            range: (q: { eq(field: string, value: string): unknown }) => unknown
          ) {
            expect(index).toBe("by_key")
            let wanted = ""
            range({
              eq(field: string, value: string) {
                expect(field).toBe("key")
                wanted = value
                return undefined
              },
            })
            return {
              first: async () => rows.find((r) => r.key === wanted) ?? null,
            }
          },
        }
      },
      async insert(table: string, doc: { key: string; windowStart: number; count: number }) {
        expect(table).toBe("rateLimits")
        const row: Row = { _id: `row${nextId++}`, ...doc }
        rows.push(row)
        return row._id
      },
      async patch(id: string, patch: { windowStart: number; count: number }) {
        const row = rows.find((r) => r._id === id)
        if (!row) throw new Error(`Patch on non-existent row ${id}`)
        Object.assign(row, patch)
      },
    },
  }

  return { ctx, rows }
}

const STORE = "kg2abcdefghijklmnopqrstuvwx"

describe("claimMenuSyncWindow", () => {
  it("gives the first edit of a window the claim, and books it for the window's end", async () => {
    const { ctx } = fakeDb()

    const claim = await claimMenuSyncWindow(ctx, "uberEats", STORE, T)

    expect(claim.claimed).toBe(true)
    // The end of the window, not five seconds in. A push at the leading edge
    // would upload the catalogue as it stood after ONE edit and drop the rest
    // of the burst until the window ran out; a menu upload is a full overwrite,
    // so the push that matters is the one carrying the final state.
    expect(claim.runAt).toBe(T + MENU_SYNC_WINDOW_MS)
  })

  it("collapses a fifty-product import into one push per platform", async () => {
    const { ctx } = fakeDb()

    let granted = 0
    for (let i = 0; i < 50; i++) {
      // A tenth of a second apart — a plausible import, well inside one window.
      const claim = await claimMenuSyncWindow(ctx, "uberEats", STORE, T + i * 100)
      if (claim.claimed) granted += 1
    }

    expect(granted).toBe(1)
  })

  it("keeps the two platforms independent", async () => {
    const { ctx } = fakeDb()

    const uber = await claimMenuSyncWindow(ctx, "uberEats", STORE, T)
    const roo = await claimMenuSyncWindow(ctx, "deliveroo", STORE, T)

    expect(uber.claimed).toBe(true)
    expect(roo.claimed).toBe(true)
  })

  it("does not let one restaurant's edit suppress another's push", async () => {
    const { ctx } = fakeDb()
    const other = "kg2zyxwvutsrqponmlkjihgfed"

    await claimMenuSyncWindow(ctx, "uberEats", STORE, T)
    const second = await claimMenuSyncWindow(ctx, "uberEats", other, T + 10)

    expect(second.claimed).toBe(true)
  })

  it("opens a fresh window once the old one has run out", async () => {
    const { ctx } = fakeDb()

    await claimMenuSyncWindow(ctx, "uberEats", STORE, T)
    const refused = await claimMenuSyncWindow(ctx, "uberEats", STORE, T + MENU_SYNC_WINDOW_MS - 1)
    const granted = await claimMenuSyncWindow(ctx, "uberEats", STORE, T + MENU_SYNC_WINDOW_MS)

    expect(refused.claimed).toBe(false)
    expect(granted.claimed).toBe(true)
    expect(granted.runAt).toBe(T + 2 * MENU_SYNC_WINDOW_MS)
  })

  it("writes exactly one counter row per platform and store", async () => {
    const { ctx, rows } = fakeDb()

    for (let i = 0; i < 20; i++) {
      await claimMenuSyncWindow(ctx, "uberEats", STORE, T + i)
      await claimMenuSyncWindow(ctx, "deliveroo", STORE, T + i)
    }

    expect(rows).toHaveLength(2)
  })
})

describe("menuSyncKey", () => {
  it("keeps the establishment id case-sensitive", () => {
    // NOT `rateLimitKey`, which lowercases its subject. That is right for an
    // email address and wrong for a Convex id: two establishments can differ by
    // the case of one character, and folding them together would let one
    // restaurant's edit claim the other's window and leave its menu unpushed.
    expect(menuSyncKey("uberEats", "kg2AAAA")).not.toBe(menuSyncKey("uberEats", "kg2aaaa"))
  })

  it("separates the platforms", () => {
    expect(menuSyncKey("uberEats", STORE)).not.toBe(menuSyncKey("deliveroo", STORE))
  })
})
