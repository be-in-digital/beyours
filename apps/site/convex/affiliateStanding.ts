/* ── May this affiliate earn on a sale? ──

   The referral path used to ask only `status === "active"`, and `status` is
   about the account, not the contract. `affiliateUsers.createAfterSignup` is a
   PUBLIC mutation that hands any signed-in account an affiliate profile with
   `status: "active"` — so the whole chain was self-service:

       createAfterSignup -> status=active contractStatus=pending_contract
       generateMyCode    -> BID-FG2PY
       validateCode      -> valid=true, 10 %
       checkout          -> 875 000 instead of 950 000, commission accrued 50 000

   Sign up, grant yourself a profile, mint a code, and take 750 € off a friend's
   build while accruing a 500 € commission — with the contract unsigned. The
   same held for an affiliate whose contract version had been superseded:
   `contractVersions.activate` moves every active affiliate to
   `blocked_new_version`, and their code kept discounting regardless.

   The commission is the exposure. It is a payable liability the affiliate
   contract is the legal basis for, and `referrals.createFromCheckout` accrues
   it at checkout — long before the Stripe Connect and SIRET checks that gate
   the payout itself. The front end already refuses these affiliates their
   dashboard (`contractStatus !== "active"` on three pages); this is the
   backend agreeing with it.

   Plain module, no Convex registration, so the rule can be read and tested on
   its own — same reasoning as ./stripeMode, ./referralDiscount and
   ./emailIdentity. */

/** Why an affiliate may not earn, or `null` when they may. */
export type StandingRefusal =
  /* The account itself is suspended or rejected. */
  | "account_not_active"
  /* Signed up, never signed the contract. This is what self-service produces. */
  | "contract_pending"
  /* Signed an earlier version; a newer one is now required. */
  | "contract_superseded";

export interface AffiliateStanding {
  status: "active" | "suspended" | "rejected";
  /**
   * Optional in the schema. Absent means the row predates the contract system:
   * `migrations.addContractStatusToAffiliates` exists to grandfather those to
   * `"active"` and its comment says so. See {@link affiliateStandingRefusal}
   * for why absent is allowed rather than refused.
   */
  contractStatus?: "pending_contract" | "active" | "blocked_new_version";
}

/**
 * Whether this affiliate may discount a sale and earn on it.
 *
 * Returns the reason it may not, or `null` when it may.
 *
 * **On an absent `contractStatus`.** It is treated as permitted, deliberately,
 * and this is the one judgement here worth stating: absent means a row created
 * before the field existed, which the migration already decided to grandfather
 * in. No caller can produce it — `createAfterSignup` always writes
 * `pending_contract` — so allowing it closes the self-service hole completely
 * while not silently killing a real affiliate's code if that migration has not
 * been run yet. The front end is stricter (it treats absent as blocked), so an
 * affiliate in that state cannot reach their dashboard; the caller is expected
 * to log the divergence rather than let it stay invisible.
 */
export function affiliateStandingRefusal(
  affiliate: AffiliateStanding,
): StandingRefusal | null {
  if (affiliate.status !== "active") return "account_not_active";

  switch (affiliate.contractStatus) {
    case "pending_contract":
      return "contract_pending";
    case "blocked_new_version":
      return "contract_superseded";
    case "active":
    case undefined:
      return null;
  }
}

/** Whether this affiliate is one the grandfathering migration has not reached. */
export function isUngrandfathered(affiliate: AffiliateStanding): boolean {
  return affiliate.status === "active" && affiliate.contractStatus === undefined;
}
