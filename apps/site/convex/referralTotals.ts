/**
 * One definition of what a set of referrals adds up to.
 *
 * WHY THIS EXISTS. The same commissions were counted in three places, over
 * three different caps, with the status sets retyped by hand each time:
 *
 *   `referrals.getMyStats`   — one affiliate's rows, `.take(200)`
 *   `admin.listAffiliates`   — one affiliate's rows, `.take(200)`
 *   `admin.getStats`         — every row in the deployment, `.take(500)`
 *
 * An affiliate with 205 paid commissions therefore read 100 000 € in their own
 * portal and 102 500 € on the admin dashboard, with nothing on either screen
 * saying a figure had been cut short. Two numbers for one sum, and the smaller
 * one shown to the person owed the money.
 *
 * Two rules follow, and they are the whole of this module:
 *
 *   1. THE STATUS SETS LIVE ONCE. `paying` — a commission claimed by a payout
 *      run and not yet confirmed — is the one that keeps being forgotten: it
 *      is OWED, not paid, and a failed run puts the row back to `payable`.
 *      Left out of both sets, an affiliate's earnings silently drop by one
 *      commission for as long as a transfer is in flight (#411). Written here,
 *      a fourth caller cannot forget it.
 *
 *   2. A TRUNCATED TOTAL SAYS SO. A cap on a money figure is not a bug by
 *      itself — a query has to stop somewhere — but a cap that is silent is.
 *      Every summary carries `truncated`, and the screens render it, so the
 *      number a person acts on is either complete or visibly a floor. Same
 *      contract as `orders.dashboardStats` in the engine.
 */

/** A referral row, as much of one as these sums need. */
export interface ReferralForTotals {
  status: string;
  commissionCents: number;
}

/**
 * The most referral rows any of these summaries will read in one transaction.
 *
 * One number, so the affiliate's own portal and the admin console cannot
 * disagree about the same commissions again. Chosen as the larger of the two
 * caps it replaces: raising a bound is safe, lowering one would newly truncate
 * figures that were complete.
 */
export const REFERRAL_SCAN_LIMIT = 500;

/**
 * Commissions the affiliate has actually been paid.
 *
 * `paid` and nothing else — this is money that has left the company.
 */
const PAID_STATUSES = new Set(["paid"]);

/**
 * Commissions that are owed and have not been paid.
 *
 * `paying` belongs here: the transfer is claimed but unconfirmed, and a failed
 * run returns the row to `payable`.
 */
const OWED_STATUSES = new Set(["pending", "validated", "payable", "paying"]);

/**
 * Commissions that have been validated and are on their way to being paid, or
 * already are — the "confirmed business" count, as opposed to the money.
 */
const VALIDATED_STATUSES = new Set([
  "validated",
  "payable",
  "paying",
  "paid",
]);

/** What a set of referrals adds up to. */
export interface ReferralTotals {
  totalReferrals: number;
  pendingCount: number;
  validatedCount: number;
  paidCount: number;
  /** Commissions actually paid out, in cents. */
  totalEarned: number;
  /** Commissions owed and not yet paid, in cents. */
  totalPending: number;
  /**
   * True when the read hit `REFERRAL_SCAN_LIMIT`, so every figure above is a
   * FLOOR rather than a total. The screens must say so.
   */
  truncated: boolean;
}

/**
 * Sum a page of referrals, and say whether it was the whole of them.
 *
 * `rows` is what came back from a `.take(REFERRAL_SCAN_LIMIT + 1)`; the extra
 * row is how truncation is detected, and it is dropped before anything is
 * counted so it cannot be counted twice by a caller that forgets.
 */
export function summariseReferrals(rows: ReferralForTotals[]): ReferralTotals {
  const truncated = rows.length > REFERRAL_SCAN_LIMIT;
  const counted = truncated ? rows.slice(0, REFERRAL_SCAN_LIMIT) : rows;

  let pendingCount = 0;
  let validatedCount = 0;
  let paidCount = 0;
  let totalEarned = 0;
  let totalPending = 0;

  for (const row of counted) {
    if (row.status === "pending") pendingCount += 1;
    if (VALIDATED_STATUSES.has(row.status)) validatedCount += 1;
    if (PAID_STATUSES.has(row.status)) {
      paidCount += 1;
      totalEarned += row.commissionCents;
    } else if (OWED_STATUSES.has(row.status)) {
      totalPending += row.commissionCents;
    }
  }

  return {
    totalReferrals: counted.length,
    pendingCount,
    validatedCount,
    paidCount,
    totalEarned,
    totalPending,
    truncated,
  };
}
