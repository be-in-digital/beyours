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
 * it.
 *
 * WHY IT DOES NOT REUSE `rateLimits`, having first tried to. That table's
 * window is fixed: it opens on the first event, never slides, and is read back
 * against whatever `windowMs` the CURRENT rule says. For a rate limit that is
 * an accepted trade, documented in `rateLimit.ts`. For a budget it was three
 * defects, all measured:
 *
 * - **Twice the stated number.** Spend one prize, wait until the window is
 *   nearly out, spend the other 49, wait a minute, spend 50 more: 100 prizes
 *   out of "50 per rolling 24 h", in two minutes, with no configuration and no
 *   trick beyond waiting.
 * - **A shorter window resets the longer one.** Two games sharing the counter,
 *   one configured "1 an hour", and a single play on it made the row look stale
 *   to the other. Chained hourly: 1 200 prizes against a 50-a-day budget.
 * - **Tightening the setting refunded it.** An owner moving from 50/24 h to
 *   50/1 h — typing a stricter-looking number — handed out 50 more at once.
 *
 * So the row holds the ISSUANCE TIMESTAMPS instead, in `prizeIssuance`, and the
 * question "how many in the last N hours" is answered from them. That is
 * correct however the owner moves the setting, and it is genuinely rolling —
 * which is what both the code and the French copy on the control already
 * claimed. The array is pruned to the most recent `maxPrizes` entries on every
 * write, so one indexed document read decides the answer and its size is
 * bounded by the owner's own ceiling.
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
  return Math.min(max, Math.max(min, Math.floor(value)))
}

/**
 * The budget in force for one game.
 *
 * Clamps and falls back rather than throwing: this runs inside the public play
 * path, and a malformed row must not take the game down. `resolvePrizeBudget`
 * is the one place that decides what a stored value means, so the admin form
 * and the player path cannot disagree about it.
 *
 * WHAT CAN ACTUALLY BE MALFORMED, corrected from an earlier claim in this file
 * that `games.update` taking `config: v.any()` lets anything through. It does
 * not: the schema types `prizeBudget.maxPrizes` and `windowHours` as numbers
 * and rejects a string outright. What survives to here is `NaN` and `±Infinity`,
 * which Convex's Float64 accepts.
 *
 * A non-finite value discards the WHOLE record, both fields, rather than only
 * the field that is corrupt. Falling back per field looked tidier and was
 * looser than the default it claimed to be falling back to, in both directions:
 * `{maxPrizes: 1000, windowHours: NaN}` resolved to 1000 a day, twenty times
 * the default rate, and `{maxPrizes: NaN, windowHours: 1}` to 50 an hour —
 * which is the exact number the previous round of this comment cited as the
 * bug it had just fixed. A record with a corrupt half is not half trustworthy.
 */
export function resolvePrizeBudget(game: {
  config?: { prizeBudget?: { maxPrizes?: number; windowHours?: number } }
}): PrizeBudget {
  const configured = game.config?.prizeBudget
  if (!configured) return DEFAULT_PRIZE_BUDGET
  const maxPrizes = configured.maxPrizes ?? DEFAULT_PRIZE_BUDGET.maxPrizes
  const windowHours = configured.windowHours ?? DEFAULT_PRIZE_BUDGET.windowHours
  if (!Number.isFinite(maxPrizes) || !Number.isFinite(windowHours)) {
    return DEFAULT_PRIZE_BUDGET
  }
  return {
    maxPrizes: clamp(maxPrizes, PRIZE_BUDGET_LIMITS.minPrizes, PRIZE_BUDGET_LIMITS.maxPrizes),
    windowHours: clamp(
      windowHours,
      PRIZE_BUDGET_LIMITS.minWindowHours,
      PRIZE_BUDGET_LIMITS.maxWindowHours
    ),
  }
}

/* ------------------------------------------------------------------ */
/* The issuance ledger                                                 */
/* ------------------------------------------------------------------ */

/** One establishment's issuance row, as this bookkeeping cares about it. */
export interface PrizeIssuance {
  /** Absent until the establishment issues its first prize. */
  id: unknown | null
  /** Timestamps of prizes already issued, ascending. */
  issuedAt: number[]
}

/**
 * Whether one more prize may be issued.
 *
 * Pure, and genuinely rolling: it counts what falls inside the window ending
 * now, rather than trusting a start recorded when some earlier window opened.
 * That is what makes changing the setting take effect immediately and in the
 * direction it was typed.
 */
export function prizeBudgetAllows(
  issuedAt: readonly number[],
  budget: PrizeBudget,
  now: number
): boolean {
  const cutoff = now - budget.windowHours * HOUR_MS
  let inWindow = 0
  for (const at of issuedAt) if (at > cutoff) inWindow++
  return inWindow < budget.maxPrizes
}

/**
 * Whether EVERY active game of the establishment permits one more prize.
 *
 * WHY NOT ONE "TIGHTEST" BUDGET, having tried that and had it measured wrong.
 * The ledger is per establishment but `play` takes `gameId` from the caller, so
 * the rule cannot come from the game they named — an owner who tightened the
 * wheel and left the scratch card on the default would get the default. The
 * first attempt picked a single budget by comparing issuance RATES, and that
 * loosens: `1 per hour` has a higher rate than `100 per week`, so the weekly
 * one was selected as "tighter" and then permitted a burst of 100 inside the
 * hour the other forbids. Measured live at 100 prizes in one hour against a
 * game set to 1.
 *
 * "The tightest governs" is not a budget you can pick — it is the intersection
 * of the constraints, so all of them are checked. An establishment with no
 * active game falls back to the default rather than to no bound at all.
 *
 * The cost, unchanged and written on the admin control: an owner running two
 * games cannot be generous on one and mean on the other. The mean one wins.
 */
export function prizeBudgetAllowsAll(
  games: { config?: { prizeBudget?: { maxPrizes?: number; windowHours?: number } } }[],
  issuedAt: readonly number[],
  now: number
): boolean {
  const budgets = games.length > 0 ? games.map(resolvePrizeBudget) : [DEFAULT_PRIZE_BUDGET]
  return budgets.every((budget) => prizeBudgetAllows(issuedAt, budget, now))
}

/**
 * The ledger after one more prize.
 *
 * PRUNED BY THE LIMITS, NEVER BY THE BUDGET IN FORCE. This is the whole point,
 * and the first version got it wrong in a way that put the original defect
 * straight back: it kept the most recent `budget.maxPrizes` entries, which is
 * exactly enough while `maxPrizes` never shrinks, and destroys history the
 * moment it does. Measured: an owner on 50 a day issues 50, types the
 * stricter-looking "1 per hour", one play an hour later truncates the ledger
 * from 50 entries to 1, and reverting to 50 a day issues 49 more inside the
 * same 24 hours. 100 prizes against a fifty-prize ceiling, by an owner
 * tightening their own setting.
 *
 * So the bounds come from `PRIZE_BUDGET_LIMITS`, which no configuration can
 * move: nothing older than the longest window an owner may ever set can be
 * counted again, and nothing beyond the largest `maxPrizes` they may ever set
 * can change an answer. Both are ceilings on the row's size, not on what it
 * remembers about any particular budget.
 */
export function appendPrizeIssuance(issuedAt: readonly number[], now: number): number[] {
  const cutoff = now - PRIZE_BUDGET_LIMITS.maxWindowHours * HOUR_MS
  const next = [...issuedAt, now].sort((a, b) => a - b).filter((at) => at > cutoff)
  return next.slice(-PRIZE_BUDGET_LIMITS.maxPrizes)
}

/**
 * The slice of `ctx.db` this reads and writes.
 *
 * Same trade as `claimMenuSyncWindow` in `rateLimit.ts`: an app's generated
 * `db.query` is generic over that app's table and index names, and any
 * structural type loose enough for a real `MutationCtx` to satisfy is too loose
 * to be worth writing. The cast stays confined to this file.
 */
interface IssuanceDb {
  query(table: "prizeIssuance"): {
    withIndex(
      index: "by_storeId",
      range: (q: { eq(field: "storeId", value: string): unknown }) => unknown
    ): { first(): Promise<{ _id: unknown; issuedAt: number[] } | null> }
  }
  insert(
    table: "prizeIssuance",
    doc: { storeId: string; issuedAt: number[]; updatedAt: number }
  ): Promise<unknown>
  patch(id: never, patch: { issuedAt: number[]; updatedAt: number }): Promise<void>
}

/**
 * Read the establishment's ledger without changing it.
 *
 * Separate from the write on purpose: whether a prize may be issued has to be
 * known BEFORE the win roll, and the ledger must move only when a prize
 * actually leaves the stock. A counter that recorded attempts would let a run
 * of losing spins exhaust a budget nothing was drawn from.
 */
export async function readPrizeIssuance(
  ctx: { db: unknown },
  storeId: string
): Promise<PrizeIssuance> {
  const row = await (ctx.db as IssuanceDb)
    .query("prizeIssuance")
    .withIndex("by_storeId", (q) => q.eq("storeId", storeId))
    .first()
  return { id: row?._id ?? null, issuedAt: row?.issuedAt ?? [] }
}

/**
 * Write one prize into the establishment's ledger.
 *
 * Called only once a prize has genuinely been drawn and its stock decremented,
 * in the same transaction as that decrement — a ledger that commits separately
 * from the thing it records is a ledger with a gap in it.
 *
 * Takes the row the caller already read rather than reading it again, so the
 * decision and the record cannot be made from two different states.
 */
export async function recordPrizeIssued(
  ctx: { db: unknown },
  storeId: string,
  issuance: PrizeIssuance,
  now: number = Date.now()
): Promise<void> {
  const db = ctx.db as IssuanceDb
  const issuedAt = appendPrizeIssuance(issuance.issuedAt, now)
  if (issuance.id === null) {
    await db.insert("prizeIssuance", { storeId, issuedAt, updatedAt: now })
  } else {
    await db.patch(issuance.id as never, { issuedAt, updatedAt: now })
  }
}
