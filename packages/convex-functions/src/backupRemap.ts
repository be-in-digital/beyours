/**
 * Rewriting the foreign keys of a restored backup.
 *
 * WHY THIS EXISTS. `importTable` deletes a table and re-inserts its rows
 * without their `_id` — Convex will not let you choose one. So every restored
 * `stores` row came back under a **new** id, while the products, menus, CMS
 * pages and promotions restored after it came back carrying the **old**
 * `storeId`. Nothing objected: `v.id("stores")` validates how an id is encoded,
 * not that it resolves, so the inserts succeeded and the deployment came up
 * with every catalogue detached from its establishment.
 *
 * It was irreversible, and it was silent. The owner's `userProfiles.storeIds`
 * still named the ids of stores that no longer existed, so the restore also
 * locked them out of every screen.
 *
 * WHAT THIS DOES. The import records `old id → new id` for every row it inserts
 * and carries that map forward, table by table, in the order dependencies
 * demand. Before a row is inserted, every id in it that the map knows is
 * rewritten. `userProfiles` is not part of the backup, so its `storeIds` are
 * rewritten in place at the end rather than replaced.
 *
 * WHAT IT DOES NOT DO. Orders, payments, kitchen tickets and team members are
 * neither exported nor imported. Their rows survive a restore still pointing at
 * ids that are now gone, and no map can help them — the documents they belong
 * to were never in the file.
 *
 * There is deliberately no count of those. Telling a reference from an ordinary
 * string needs a way to recognise a Convex id, and there is none that holds
 * across deployments — the map is the only authority, and by construction it
 * knows only ids the backup contained. A number that reports zero for exactly
 * the case it exists to catch is worse than saying plainly what a backup does
 * not carry, which is what the restore now does. What *can* be counted exactly
 * is `remapProfileStores`' `dropped`: a store someone had access to that the
 * file did not contain.
 */

/** `oldId → newId`, accumulated across the tables of one restore. */
export type IdMap = Record<string, string>

/**
 * A Convex id, as it appears in an exported row.
 *
 * There is no way to tell an id from any other string by looking at it, and
 * that is the point: the map is the only authority. A string is rewritten if
 * and only if the map has an entry for it, so a text field that happened to
 * contain an id would be rewritten too — which is what you want for a CMS block
 * that embeds one, and harmless everywhere else.
 */
function isRemappable(value: unknown, idMap: IdMap): value is string {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(idMap, value)
}

/**
 * Rewrite every id the map knows, anywhere inside `value`.
 *
 * Recurses through arrays and plain objects, so `targetProductIds: [...]` and a
 * nested CMS block's `productId` are reached as readily as a top-level
 * `storeId`. Anything else is returned untouched.
 */
export function remapIds<T>(value: T, idMap: IdMap): T {
  if (isRemappable(value, idMap)) return idMap[value] as unknown as T

  if (Array.isArray(value)) {
    return value.map((item) => remapIds(item, idMap)) as unknown as T
  }

  // Dates and other class instances are not part of a Convex export, but
  // guarding on the prototype keeps this from quietly rebuilding one as a bare
  // object if that ever changes.
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = remapIds(item, idMap)
    }
    return out as unknown as T
  }

  return value
}

/** The system fields an insert must not carry, and the id the map is keyed by. */
export function splitExportedRow(row: Record<string, unknown>): {
  oldId: string | undefined
  data: Record<string, unknown>
} {
  const { _id, _creationTime, ...data } = row
  return { oldId: typeof _id === "string" ? _id : undefined, data }
}
