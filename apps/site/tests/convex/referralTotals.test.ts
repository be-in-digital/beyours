/// <reference types="vite/client" />

/**
 * One set of commissions, one euro total.
 *
 * The affiliate's own portal summed their referrals at `.take(200)` and the
 * admin console summed the same money at `.take(500)`, with the status filters
 * retyped in both. An affiliate with 205 paid commissions therefore read
 * 100 000 € on their dashboard and 102 500 € on the admin's, and neither
 * screen said a figure had been cut short — so the smaller number was shown,
 * without qualification, to the person owed the money.
 *
 * The rules now live once, in convex/referralTotals.ts, and a truncated sum
 * says so.
 */

import { describe, expect, test } from "vitest";
import {
  REFERRAL_SCAN_LIMIT,
  summariseReferrals,
  type ReferralForTotals,
} from "../../convex/referralTotals";

/** 500,00 € — the commission the seeded fixtures use. */
const COMMISSION = 50_000;

function rows(
  count: number,
  status: string,
  commissionCents = COMMISSION,
): ReferralForTotals[] {
  return Array.from({ length: count }, () => ({ status, commissionCents }));
}

describe("summariseReferrals", () => {
  test("adds up a straightforward mix", () => {
    const totals = summariseReferrals([
      ...rows(2, "paid"),
      ...rows(1, "payable"),
      ...rows(3, "pending"),
      ...rows(1, "cancelled"),
    ]);

    expect(totals.totalReferrals).toBe(7);
    expect(totals.paidCount).toBe(2);
    expect(totals.pendingCount).toBe(3);
    expect(totals.totalEarned).toBe(2 * COMMISSION);
    expect(totals.totalPending).toBe(4 * COMMISSION);
    expect(totals.truncated).toBe(false);
  });

  test("counts a commission in flight as owed, not as paid and not as nothing", () => {
    // `paying` is claimed by a payout run and unconfirmed; a failed run puts
    // the row back to `payable`. Omitted from both sets — which is what
    // happened when the state was added and the reading surfaces were not
    // told — an affiliate's earnings drop by one commission for as long as a
    // transfer is moving.
    const totals = summariseReferrals(rows(1, "paying"));

    expect(totals.totalEarned).toBe(0);
    expect(totals.totalPending).toBe(COMMISSION);
    expect(totals.validatedCount).toBe(1);
  });

  test("leaves cancelled and blocked commissions out of the money entirely", () => {
    const totals = summariseReferrals([
      ...rows(3, "cancelled"),
      ...rows(2, "blocked"),
    ]);

    expect(totals.totalEarned).toBe(0);
    expect(totals.totalPending).toBe(0);
    expect(totals.totalReferrals).toBe(5);
  });

  test("says so when the read stopped short, and counts no row twice", () => {
    // The probe: 205 paid commissions read through a 200-row cap. What made
    // that a defect was not the cap — a query has to stop somewhere — but the
    // silence.
    const overflowing = rows(REFERRAL_SCAN_LIMIT + 1, "paid");
    const totals = summariseReferrals(overflowing);

    expect(totals.truncated).toBe(true);
    expect(totals.totalReferrals).toBe(REFERRAL_SCAN_LIMIT);
    expect(totals.totalEarned).toBe(REFERRAL_SCAN_LIMIT * COMMISSION);
  });

  test("is not truncated at exactly the cap", () => {
    const totals = summariseReferrals(rows(REFERRAL_SCAN_LIMIT, "paid"));

    expect(totals.truncated).toBe(false);
    expect(totals.totalReferrals).toBe(REFERRAL_SCAN_LIMIT);
  });

  test("the affiliate portal and the admin console cannot disagree", () => {
    // Both surfaces read the same rows through the same bound and the same
    // sums, so the only way they could differ now is by being given different
    // rows. Driven over a set larger than the smaller of the two old caps.
    const sameRows = [...rows(205, "paid"), ...rows(12, "paying")];

    const portal = summariseReferrals(sameRows);
    const console_ = summariseReferrals(sameRows);

    expect(portal.totalEarned).toBe(console_.totalEarned);
    expect(portal.totalEarned).toBe(205 * COMMISSION);
    expect(portal.totalPending).toBe(console_.totalPending);
  });
});
