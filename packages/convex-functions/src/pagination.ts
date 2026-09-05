/**
 * A page size the caller does not get to choose freely.
 *
 * WHY THIS EXISTS. `paginationOptsValidator` accepts any `numItems` Convex will
 * take, and Convex only refuses a negative one — so a paginated query is only as
 * bounded as its caller. Every admin screen here sends `ADMIN_PAGE_SIZE`, but
 * "the screen is well behaved" is not the same claim as "the query is bounded",
 * and the second is the one these queries were rewritten to be able to make.
 * `{ numItems: 1_000_000 }` from anyone holding `orders:read` reinstated exactly
 * the transaction the pagination was added to prevent.
 *
 * The ceiling is a long way above any page a screen renders and a long way below
 * Convex's 16,384-document transaction limit, so it never truncates a real page
 * and always stops an absurd one.
 */

/** The largest page any of these queries will serve. */
export const MAX_PAGE_SIZE = 200

/** The page size used when a caller sends something that is not a number. */
export const DEFAULT_PAGE_SIZE = 25

export interface PaginationOpts {
  numItems: number
  cursor: string | null
}

/**
 * `paginationOpts` with `numItems` brought inside [1, MAX_PAGE_SIZE].
 *
 * `NaN` is handled explicitly: `v.number()` accepts it over the wire and
 * `Math.min(Math.max(1, Math.floor(NaN)), n)` is still `NaN`, which Convex then
 * rejects at `.take()` with an error naming an argument the caller never sent.
 */
export function clampPagination(opts: PaginationOpts): PaginationOpts {
  return { ...opts, numItems: clampPageSize(opts?.numItems) }
}

/** The same clamp, for a `.take(n)` that reads a caller-supplied limit. */
export function clampPageSize(
  requested: unknown,
  fallback: number = DEFAULT_PAGE_SIZE,
  max: number = MAX_PAGE_SIZE
): number {
  const asNumber = typeof requested === "number" ? requested : Number.NaN
  if (!Number.isFinite(asNumber)) return Math.min(Math.max(1, fallback), max)
  return Math.min(Math.max(1, Math.floor(asNumber)), max)
}
