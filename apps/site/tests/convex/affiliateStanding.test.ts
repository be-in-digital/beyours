/// <reference types="vite/client" />

/**
 * Who may earn a commission.
 *
 * The referral path asked only `status === "active"`, which is about the
 * ACCOUNT, not the contract — and `affiliateUsers.createAfterSignup` is a
 * public mutation that hands any signed-in account exactly that. Measured
 * before the fix, walking the whole chain as a stranger:
 *
 *     createAfterSignup -> status=active contractStatus=pending_contract
 *     generateMyCode    -> BID-FG2PY
 *     validateCode      -> valid=true, 10 %
 *     checkout          -> 875000 instead of 950000, commission accrued 50000
 *
 * The commission is the exposure: `referrals.createFromCheckout` accrues a
 * payable liability at checkout, and the affiliate contract is its legal basis.
 */

import { describe, expect, test } from "vitest";
import {
  affiliateStandingRefusal,
  isUngrandfathered,
  type AffiliateStanding,
} from "../../convex/affiliateStanding";

const standing = (over: Partial<AffiliateStanding> = {}): AffiliateStanding => ({
  status: "active",
  contractStatus: "active",
  ...over,
});

describe("who may earn", () => {
  test("an active affiliate with a signed contract", () => {
    expect(affiliateStandingRefusal(standing())).toBeNull();
  });

  test.each([
    ["signed up but never signed", "pending_contract", "contract_pending"],
    ["superseded by a new version", "blocked_new_version", "contract_superseded"],
  ])("an affiliate %s may not", (_label, contractStatus, refusal) => {
    const who = standing({
      contractStatus: contractStatus as AffiliateStanding["contractStatus"],
    });
    expect(affiliateStandingRefusal(who)).toBe(refusal);
  });

  test.each([
    ["suspended", "suspended"],
    ["rejected", "rejected"],
  ])("a %s account may not, whatever its contract says", (_label, status) => {
    /* The account check comes first, so a suspended affiliate holding a signed
       contract is still refused — and the reason names the account, not the
       contract, which is what an operator needs to see. */
    const who = standing({
      status: status as AffiliateStanding["status"],
      contractStatus: "active",
    });
    expect(affiliateStandingRefusal(who)).toBe("account_not_active");
  });

  test("every combination is decided, none falls through", () => {
    const statuses: AffiliateStanding["status"][] = ["active", "suspended", "rejected"];
    const contracts: AffiliateStanding["contractStatus"][] = [
      "active",
      "pending_contract",
      "blocked_new_version",
      undefined,
    ];
    for (const status of statuses) {
      for (const contractStatus of contracts) {
        const verdict = affiliateStandingRefusal({ status, contractStatus });
        expect(verdict === null || typeof verdict === "string").toBe(true);
      }
    }
  });
});

describe("the rows that predate the contract system", () => {
  /* Absent `contractStatus` is permitted on purpose. No caller can produce it
     — `createAfterSignup` always writes `pending_contract` — so allowing it
     closes the self-service hole completely while not killing a real
     affiliate's code if `migrations.addContractStatusToAffiliates`, whose
     stated job is to grandfather exactly these, has not been run. */
  test("an absent contractStatus is allowed", () => {
    expect(affiliateStandingRefusal(standing({ contractStatus: undefined }))).toBeNull();
  });

  test("and is flagged so it does not stay invisible", () => {
    expect(isUngrandfathered(standing({ contractStatus: undefined }))).toBe(true);
  });

  test.each([
    ["a signed contract", "active"],
    ["a pending one", "pending_contract"],
  ])("%s is not flagged", (_label, contractStatus) => {
    expect(
      isUngrandfathered(
        standing({ contractStatus: contractStatus as AffiliateStanding["contractStatus"] }),
      ),
    ).toBe(false);
  });

  test("a suspended account is not flagged either — it is refused on status", () => {
    expect(isUngrandfathered({ status: "suspended", contractStatus: undefined })).toBe(false);
  });
});
