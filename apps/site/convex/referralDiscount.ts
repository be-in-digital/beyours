/* ── The referral discount, decided server-side ──

   `createCheckoutSession` used to take `discountPercent` as an argument and
   bill it. The action is public and unauthenticated, `validateCode` hands the
   matching `referralCodeId` to anyone who asks, and affiliate codes are
   published by design — so the price of a build was whatever the caller said
   it was. A Premium build went out for 2 075 € instead of 8 750 €, and a
   percent above 100 wrote a NEGATIVE order that still reached « paid ».

   The rule that replaces it: the customer says which code they hold, the
   server says what it is worth. The derivation below is the only place that
   answer is computed, shared by the public `validateCode` (what the storefront
   displays) and the checkout (what the customer is charged) — the two used to
   be able to disagree, and the whole defect lived in that gap.

   Plain module, no Convex registration and no DB access, so the arithmetic can
   be read and tested on its own — same reasoning as ./stripeMode and
   ./foundersOffer. */

/** Used when `affiliateSettings` carries no row yet. */
export const DEFAULT_DISCOUNT_PERCENT = 10;

/** Widest a referral discount may ever be, whoever configured it. */
export const MAX_DISCOUNT_PERCENT = 100;

/** Thrown when a code resolves to a percent that cannot be billed. */
export class ReferralDiscountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferralDiscountError";
  }
}

/**
 * A discount that can be charged: a real number within [0, 100].
 *
 * Rejects the two shapes that produced money bugs — above 100 (a negative
 * order total) and below 0 (a surcharge dressed as a discount) — plus `NaN`
 * and `Infinity`, which `v.number()` accepts and arithmetic silently spreads.
 */
export function isBillableDiscountPercent(percent: number): boolean {
  return (
    Number.isFinite(percent) &&
    percent >= 0 &&
    percent <= MAX_DISCOUNT_PERCENT
  );
}

/**
 * The percent a code is worth: the affiliate's override, else the programme
 * default, else {@link DEFAULT_DISCOUNT_PERCENT}.
 *
 * Never reads a caller-supplied number. `undefined` overrides fall through on
 * purpose — an affiliate without one is on the programme rate.
 */
export function deriveDiscountPercent(input: {
  overridePercent: number | undefined;
  settingsPercent: number | undefined;
}): number {
  return (
    input.overridePercent ??
    input.settingsPercent ??
    DEFAULT_DISCOUNT_PERCENT
  );
}

/**
 * {@link deriveDiscountPercent}, refusing the sale when the answer cannot be
 * billed.
 *
 * An out-of-range percent is a configuration fault, caught here rather than
 * turned into an invoice. `admin.updateSettings` writes
 * `defaultDiscountPercent` behind `requireAdmin` and stores whatever number it
 * is given, so this is reachable today by a typo. `discountOverridePercent`
 * has no writer at all right now — `affiliateUsers.updateCommissionOverride`
 * is an internalMutation with no callers — so for that field this is a guard
 * against a future one and against rows written by hand or by a migration.
 *
 * Refusing is the safe direction: a stopped checkout is a support ticket, a
 * negative order is money already gone.
 */
export function requireBillableDiscountPercent(input: {
  overridePercent: number | undefined;
  settingsPercent: number | undefined;
  /** Quoted back in the error so ops know which code to look at. */
  code: string;
}): number {
  const percent = deriveDiscountPercent(input);
  if (!isBillableDiscountPercent(percent)) {
    throw new ReferralDiscountError(
      `Remise de parrainage invalide pour le code « ${input.code} » : ` +
        `${percent} % hors de l'intervalle 0–${MAX_DISCOUNT_PERCENT}. ` +
        `Corriger discountOverridePercent de l'apporteur ou ` +
        `defaultDiscountPercent des réglages avant toute vente.`,
    );
  }
  return percent;
}
