/**
 * The bound on what a game may GIVE AWAY, as opposed to how often it may be
 * played.
 *
 * WHY THIS EXISTS, and why the rate limiter was not enough. #341 bounded every
 * public gamification endpoint with `consumeRateLimit`, keyed partly on the QR
 * row the server resolved, so rotating `fingerprint` stopped buying another
 * turn. What it bounded was the RATE. Measured against the real backend after
 * that fix: 500 anonymous calls spread over 40 table codes still issued **200
 * prizes in one hour** — `gamePlayPerStore` admits 200 plays an hour and a game
 * at a 100% win ratio turns every one of them into a free pizza. The stock is
 * decremented by an anonymous caller at DRAW time, long before a name or an
 * email is on record, so the loop costs the restaurant real food and costs the
 * attacker nothing.
 *
 * Lowering the play windows far enough to protect the budget would refuse real
 * players first — a table turning over is indistinguishable from a loop when
 * every caller is anonymous. So the bound belongs on the thing that actually
 * has value: the issuance itself.
 *
 * WHAT THIS IS: a rolling window on prizes issued per establishment, owned by
 * the restaurant. It is keyed on `qr.storeId` — a value the SERVER resolved
 * from the code printed on a table — so no argument the caller sends can move
 * it. It reuses the same `rateLimits` row shape and the same pure
 * `checkRateLimit` as every other window in this codebase, because an operator
 * asked "why did this refuse?" should read one kind of row, not two.
 *
 * WHAT THIS IS NOT, said plainly because the audit asked for it:
 *
 * - **It does not identify anybody.** A store whose stock is smaller than its
 *   window still loses that stock to a single loop; five prizes behind a
 *   fifty-prize window go in five calls. What the window bounds is the value
 *   that can leave in a day, not who takes it. Binding a play to a person needs
 *   a sign-in or an anti-automation check at the edge, and this platform has
 *   neither.
 * - **It is not a substitute for stock.** `prizes.remainingCount` is still the
 *   hard limit on a given prize. This is the softer, restaurant-wide one that
 *   stops every prize going at once.
 *
 * WHY EXHAUSTION LOSES RATHER THAN REFUSES: a play past the budget is resolved
 * as though no prize were in stock — the player plays, and the wheel lands on a
 * loss. Refusing the mutation instead would tell a prober exactly where the
 * budget sits, and would take the game away from an honest diner who did
 * nothing wrong. `rollOutcome` already returns false when nothing is in stock,
 * so this is the state the game has always had a screen for.
 */

import { checkRateLimit, type RateLimitRule, type RateLimitWindow } from "./rateLimit"

const HOUR_MS = 60 * 60_000

/** A restaurant's issuance budget, as the game stores it. */
export interface PrizeBudget {
  /** How many prizes may be issued inside one window. */
  maxPrizes: number
  /** The window's length, in hours. */
  windowHours: number
}

/**
 * What a game gets when its owner has configured nothing.
 *
 * Fifty prizes a day is far above what a restaurant gives away on purpose — a
 * busy service running a 30% win ratio issues a few dozen — and far below the
 * 4 800 plays a day the store window permits. The default is deliberately ON:
 * the establishment that never opens this setting is exactly the one the drain
 * was measured against, and an opt-in bound protects nobody.
 */
export const DEFAULT_PRIZE_BUDGET: PrizeBudget = { maxPrizes: 50, windowHours: 24 }

/**
 * The bounds an owner may set between.
 *
 * The floor is 1 rather than 0: a game that can never be won is what
 * `winRatio: 0` or an empty stock is for, and letting the budget express it too
 * would give an owner two ways to say the same thing and one way to switch the
 * game off by accident. The ceiling exists so the field cannot be used to
 * restore the unbounded behaviour by typing a large enough number.
 */
export const PRIZE_BUDGET_LIMITS = {
  minPrizes: 1,
  maxPrizes: 1_000,
  minWindowHours: 1,
  maxWindowHours: 24 * 7,
} as const

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.floor(value)))
}

/**
 * The budget in force for one game.
 *
 * Clamps rather than throws. This runs inside the public play path, where a
 * malformed row written by an older admin build must not take the game down —
 * and `games.update` takes `config: v.any()`, so a bad value can genuinely
 * reach here. `resolvePrizeBudget` is the one place that decides what a stored
 * value means, so the admin form and the player path cannot disagree.
 */
export function resolvePrizeBudget(game: {
  config?: { prizeBudget?: { maxPrizes?: number; windowHours?: number } }
}): PrizeBudget {
  const configured = game.config?.prizeBudget
  if (!configured) return DEFAULT_PRIZE_BUDGET
  return {
    maxPrizes: clamp(
      configured.maxPrizes ?? DEFAULT_PRIZE_BUDGET.maxPrizes,
      PRIZE_BUDGET_LIMITS.minPrizes,
      PRIZE_BUDGET_LIMITS.maxPrizes
    ),
    windowHours: clamp(
      configured.windowHours ?? DEFAULT_PRIZE_BUDGET.windowHours,
      PRIZE_BUDGET_LIMITS.minWindowHours,
      PRIZE_BUDGET_LIMITS.maxWindowHours
    ),
  }
}

/** The budget as the shared window machinery wants it. */
export function prizeBudgetRule(budget: PrizeBudget): RateLimitRule {
  return {
    limit: budget.maxPrizes,
    windowMs: budget.windowHours * HOUR_MS,
    // Keyed on a Convex id, which is case-SENSITIVE: folding it would let one
    // establishment consume another's budget. Same reasoning as every id-keyed
    // rule in `rateLimit.ts`.
    foldSubjectCase: false,
  }
}

/**
 * The row key for one establishment's issuance window.
 *
 * Not a `RateLimitName`, because the limit and the window are the restaurant's
 * to choose and `RATE_LIMITS` holds the ones the product fixes. It shares the
 * table so that "why was this refused" has one answer.
 */
export function prizeBudgetKey(storeId: string): string {
  return `prizeBudget:${storeId}`
}

/** One `rateLimits` row, as this bookkeeping cares about it. */
interface BudgetRow {
  _id: unknown
  windowStart: number
  count: number
}

/**
 * The slice of `ctx.db` this reads and writes.
 *
 * Same trade as `claimMenuSyncWindow` in `rateLimit.ts`: an app's generated
 * `db.query` is generic over that app's table and index names, and any
 * structural type loose enough for a real `MutationCtx` to satisfy is too loose
 * to be worth writing. The cast stays confined to this file.
 */
interface BudgetDb {
  query(table: "rateLimits"): {
    withIndex(
      index: "by_key",
      range: (q: { eq(field: "key", value: string): unknown }) => unknown
    ): { first(): Promise<BudgetRow | null> }
  }
  insert(table: "rateLimits", doc: RateLimitWindow & { key: string }): Promise<unknown>
  patch(id: never, patch: RateLimitWindow): Promise<void>
}

/** What the current window has left. */
export interface PrizeBudgetState {
  /** True when at least one more prize may be issued. */
  allowed: boolean
  /** Prizes already issued inside the window in force. */
  issued: number
  /** When the window resets and issuance resumes. */
  resetsAt: number
}

/**
 * Read the establishment's issuance window without consuming it.
 *
 * Separate from the write on purpose: whether a prize may be issued has to be
 * known BEFORE the win roll, and the counter must move only when a prize
 * actually leaves the stock. A limiter that counted attempts would let a run of
 * losing spins exhaust a budget nothing was drawn from.
 */
export async function readPrizeBudget(
  ctx: { db: unknown },
  storeId: string,
  budget: PrizeBudget,
  now: number = Date.now()
): Promise<PrizeBudgetState> {
  const rule = prizeBudgetRule(budget)
  const existing = await (ctx.db as BudgetDb)
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", prizeBudgetKey(storeId)))
    .first()

  const live = existing && now - existing.windowStart < rule.windowMs ? existing : null
  const verdict = checkRateLimit(
    live ? { windowStart: live.windowStart, count: live.count } : null,
    rule,
    now
  )

  return {
    allowed: verdict.allowed,
    issued: live?.count ?? 0,
    resetsAt: verdict.retryAt ?? (live ? live.windowStart : now) + rule.windowMs,
  }
}

/**
 * Count one prize against the establishment's window.
 *
 * Called only once a prize has genuinely been drawn and its stock decremented,
 * in the same transaction as that decrement — a counter that commits separately
 * from the thing it counts is a counter with a gap in it.
 *
 * Never throws. By the time this runs the prize is already awarded, and the
 * caller established the budget had room; turning a bookkeeping edge into a
 * failed play would take a legitimately won prize away from the player who won
 * it.
 */
export async function recordPrizeIssued(
  ctx: { db: unknown },
  storeId: string,
  budget: PrizeBudget,
  now: number = Date.now()
): Promise<void> {
  const rule = prizeBudgetRule(budget)
  const db = ctx.db as BudgetDb
  const key = prizeBudgetKey(storeId)

  const existing = await db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first()

  const verdict = checkRateLimit(
    existing ? { windowStart: existing.windowStart, count: existing.count } : null,
    rule,
    now
  )
  // Refused means the window filled between the read and here, which a
  // serialisable transaction does not allow. Keep the row truthful anyway
  // rather than dropping the count: the prize did leave the stock.
  const next: RateLimitWindow = verdict.next ?? {
    windowStart: existing?.windowStart ?? now,
    count: (existing?.count ?? 0) + 1,
  }

  if (existing) {
    await db.patch(existing._id as never, next)
  } else {
    await db.insert("rateLimits", { key, ...next })
  }
}
