/**
 * What `prizeRedemptions.getStats` answers, and how to print it.
 *
 * The counters used to be lifetime totals, computed by reading every play and
 * every redemption the establishment had ever recorded. `gamePlays` takes a row
 * per QR scan, so that read outgrew Convex's transaction limit before anything
 * else in the product did, and both screens below went down together when it
 * did. The server now answers over a window and stops at a cap, which means the
 * labels have to say so — a number captioned "Parties jouées" that silently
 * means "in the last thirty days, up to two thousand" is worse than the query
 * it replaced.
 */

/** Mirrors `GAME_STATS_WINDOW_MS` in `@be-in-digital/convex-functions/gamePlay`. */
export const GAME_STATS_WINDOW_DAYS = 30

/** Suffix for a card whose number is a window rather than a total. */
export const GAME_STATS_WINDOW_SUFFIX = ` (${GAME_STATS_WINDOW_DAYS} j)`

export interface GameStats {
  /** Window start, in ms. */
  since: number
  /** True when the scan hit its cap, so every windowed number is a floor. */
  truncated: boolean
  totalPlays: number
  totalWins: number
  winRate: number
  totalRedeemed: number
  /** Live count of prizes still waiting at the till — not windowed. */
  pendingRedemptions: number
}

/**
 * A count the server may have stopped short of, printed honestly.
 *
 * `2 000+` rather than `2 000`, so nobody reads a floor as a total.
 */
export function formatStatCount(value: number, truncated: boolean): string {
  const printed = value.toLocaleString("fr-FR")
  return truncated ? `${printed}+` : printed
}
