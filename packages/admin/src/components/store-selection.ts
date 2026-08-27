/**
 * Which establishment an admin session should be looking at.
 *
 * The rule lives outside the component so it can be read and tested without a
 * browser, and so the limit below is stated where the decision is actually
 * made.
 *
 * WHAT THE CHECK IS. The persisted id is compared against `stores.list`, a
 * public query that collects every row of the `stores` table with no identity
 * involved (`packages/convex-functions/src/stores.ts`). The question it answers
 * is whether the establishment still exists in this deployment, not whether the
 * signed-in user may open it. It catches a deleted store, and an id left in
 * this browser by a deployment that no longer backs it.
 *
 * WHAT IT IS NOT. It is not an authorisation check, and the id it hands down is
 * not one the server has agreed to. Admin pages are gated per store by
 * `requireStoreAccess` against `userProfiles.storeIds`, and this module knows
 * nothing of that list: a manager attached to Lyon alone, arriving with no
 * selection, is auto-selected into whatever `stores[0]` happens to be and meets
 * "Access denied: you do not have access to this store" on the page below.
 * Scoping the query server-side is issue #94; until it lands, nothing here
 * guarantees the pages under `StoreGuard` receive a store their caller can
 * query.
 */

/** The only field of a store document this decision reads. */
export interface SelectableStore {
  _id: string
}

export type StoreSelectionDecision =
  /** The list has not arrived yet. Decide nothing. */
  | { status: "pending" }
  /** The deployment holds no establishment at all. */
  | { status: "empty" }
  /** The persisted id is in the list. Keep it. */
  | { status: "selected" }
  /** The persisted id is absent, or there is none. Write this one instead. */
  | { status: "replace"; storeId: string }

/**
 * Decide what to do with the persisted selection given the list the server
 * returned.
 */
export function resolveStoreSelection(params: {
  storeId: string | null
  stores: readonly SelectableStore[] | undefined
}): StoreSelectionDecision {
  const { storeId, stores } = params

  if (stores === undefined) return { status: "pending" }

  const first = stores[0]
  if (!first) return { status: "empty" }

  const stillListed = !!storeId && stores.some((store) => store._id === storeId)
  if (stillListed) return { status: "selected" }

  return { status: "replace", storeId: first._id }
}
