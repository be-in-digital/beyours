import { describe, it, expect } from "vitest"
import { resolveStoreSelection } from "../components/store-selection"

/**
 * `StoreGuard` documented an authorisation guarantee it never had (issue #91).
 * These cases hold the rule it does apply, so the corrected comment can be
 * checked against something that runs.
 *
 * The list it decides from is `stores.list`: public, unscoped, every
 * establishment of the deployment whoever is asking. Presence in that list is
 * therefore the whole of the check, and the last two cases say so by deciding
 * twice - once from the list the server returns today, once from the scoped
 * list issue #94 would return for the same session.
 */
describe("admin store selection", () => {
  const PARIS = { _id: "store_paris" }
  const LYON = { _id: "store_lyon" }
  const EVERY_STORE = [PARIS, LYON]

  it("decides nothing while the query is in flight", () => {
    expect(
      resolveStoreSelection({ storeId: LYON._id, stores: undefined })
    ).toEqual({ status: "pending" })
  })

  it("reports an empty deployment rather than selecting", () => {
    expect(resolveStoreSelection({ storeId: null, stores: [] })).toEqual({
      status: "empty",
    })
  })

  it("keeps a persisted id that is still in the list", () => {
    expect(
      resolveStoreSelection({ storeId: LYON._id, stores: EVERY_STORE })
    ).toEqual({ status: "selected" })
  })

  it("replaces a persisted id that has left the table", () => {
    // A deleted store, or an id left in this browser by another deployment.
    expect(
      resolveStoreSelection({ storeId: "store_deleted", stores: EVERY_STORE })
    ).toEqual({ status: "replace", storeId: PARIS._id })
  })

  it("selects the first establishment when nothing is persisted", () => {
    expect(
      resolveStoreSelection({ storeId: null, stores: EVERY_STORE })
    ).toEqual({ status: "replace", storeId: PARIS._id })
  })

  it("takes an empty persisted id as no selection", () => {
    expect(resolveStoreSelection({ storeId: "", stores: EVERY_STORE })).toEqual({
      status: "replace",
      storeId: PARIS._id,
    })
  })

  it("auto-selects an establishment the signed-in user cannot open", () => {
    // A manager whose `userProfiles.storeIds` holds Lyon alone, arriving with
    // no selection. Paris is in the list all the same, and Paris comes first,
    // so the page below asks for a store the server will refuse them.
    const authorised = EVERY_STORE.filter((store) => store._id === LYON._id)

    expect(
      resolveStoreSelection({ storeId: null, stores: EVERY_STORE })
    ).toEqual({ status: "replace", storeId: PARIS._id })

    // The same session once #94 scopes the query: nothing here changes.
    expect(resolveStoreSelection({ storeId: null, stores: authorised })).toEqual(
      { status: "replace", storeId: LYON._id }
    )
  })

  it("keeps a persisted id whose access was revoked, because the row remains", () => {
    // Detaching a manager from Paris empties their entry in
    // `userProfiles.storeIds`. It does not delete the establishment, so this
    // decision sees no change at all.
    const authorised = EVERY_STORE.filter((store) => store._id === LYON._id)

    expect(
      resolveStoreSelection({ storeId: PARIS._id, stores: EVERY_STORE })
    ).toEqual({ status: "selected" })

    expect(
      resolveStoreSelection({ storeId: PARIS._id, stores: authorised })
    ).toEqual({ status: "replace", storeId: LYON._id })
  })
})
