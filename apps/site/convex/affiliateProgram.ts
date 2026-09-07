/* ── The kill-switch ──

   `affiliateSettings.programEnabled` had two writers — the admin console's
   « Programme actif » toggle (`admin.updateSettings`) and `saSeed` — and not
   one reader anywhere on the money path. Turning it off changed one boolean in
   one row and nothing else: codes still validated, checkouts still discounted,
   `referrals.createFromCheckout` still accrued a payable liability, and the
   Monday/Thursday payout cron still wired commissions to Stripe Connect
   accounts. A switch labelled « Programme actif » that stops nothing is worse
   than no switch, because it is reached for in exactly the moment something has
   gone wrong — a code leaked, a partner fired, a discount miscomputed — and it
   reports success while the leak continues.

   What OFF means, now that it is read. The programme takes on nothing new and
   no money leaves:

     - `referralCodes.lookupUsableCode` refuses every code, so `validateCode`
       answers « invalide » and `resolveForCheckout` answers `null` — the
       checkout then bills the list price, exactly as for a code that does not
       exist. `createCheckoutSession` needs no separate check because that
       function is the only way it learns a code is worth anything.
     - `referrals.createFromCheckout` records the commission as `blocked`
       rather than dropping it. A Stripe session stays payable for up to 24 h,
       so a sale that WAS discounted under the old setting can still settle
       after the switch is thrown; the row keeps that fact, reviewable through
       `admin.unblockReferralPayout`, and out of every path that pays.
     - `referrals.markValidatedAsPayable` marks nothing and
       `stripeConnect.processPayouts` transfers nothing.

   What it deliberately does NOT do: unmake commissions already accrued.
   `validatePendingReferrals` keeps ageing `pending` rows into `validated`,
   because that step moves no money and freezing it would silently rewrite what
   is owed for work already done. The two gates above are what stand between a
   `validated` row and a bank transfer.

   Plain module, no Convex registration and no DB access, so the rule can be
   read from a `"use node"` action without dragging a registered module into its
   bundle — same reasoning as ./affiliateStanding, ./stripeMode and
   ./referralDiscount. The ctx-bound readers live in ./affiliateSettings. */

/** What the programme is worth before anybody has configured it. */
export const AFFILIATE_SETTINGS_DEFAULTS = {
  defaultCommissionCents: 50000,
  defaultDiscountPercent: 10,
  validationDelayDays: 14,
  programEnabled: true,
} as const;

/** The fields every reader of `affiliateSettings` actually uses. */
export interface AffiliateSettings {
  defaultCommissionCents: number;
  defaultDiscountPercent: number;
  validationDelayDays: number;
  programEnabled: boolean;
}

/** Said in the log wherever the switch refuses something, and stored on the
 *  `blocked` commissions it produces so an operator can tell them apart. */
export const PROGRAM_DISABLED_REASON =
  "Programme de parrainage désactivé (affiliateSettings.programEnabled = false)";

/** Whether the programme may discount, accrue and pay. */
export function programIsEnabled(settings: AffiliateSettings): boolean {
  return settings.programEnabled;
}
