/* ── Founders offer ──
   The first 10 Essentielle builds with the creation offered (list price
   3 500 € excl. tax), only the annual maintenance staying due, in exchange for
   contractual commitments (case study, testimonial, right to name them as a
   reference). It ends when the slots run out, never on a date.
   Not stackable with a referral: a code applied = list price −10 %.
   Duplicated in lib/payment-providers.ts (FOUNDERS_OFFER) — keep them in sync.

   Plain module: no Convex function is registered here, only the constants and
   the pure decision the checkout action and the slot counter share. */

export const foundersOffer = {
  enabled: true,
  plan: "essentielle" as const,
  totalSlots: 10,
  creationCents: 0,
};

/* ── How long an unpaid checkout holds its slot ──
   countFoundersSold used to count « paid » orders only, so every checkout
   opened before the first webhook landed still saw 10 free slots and more than
   10 builds could go out free. A pending order holds its slot instead.

   This window used to be 24 h, matching the lifetime of a Stripe Checkout
   session. That answered the wrong question. « Can this session still be
   paid? » is about Stripe; « is somebody about to take this seat? » is what
   the counter asks, and the honest answer is minutes — a card clears in
   seconds and a redirect takes a couple of minutes. At 24 h the gap was
   reachable by anyone: `createCheckoutSession` is public and unauthenticated,
   so ten anonymous calls advertised « 0 places restantes » for a full day and
   handed `isFounders: false` to every genuine buyer who arrived in it.

   Thirty minutes is generous for a real payment and short enough that such a
   burst clears on its own. Two other things release a seat sooner or bound the
   damage: the webhook cancels the order on `checkout.session.expired`, and
   `orders.create` is rate-limited (see ./rateLimit).

   Releasing early can let the storefront advertise a seat that a slow payment
   later takes — the harmless direction, and one this window never covered
   anyway for the delayed methods that settle over days. What actually caps the
   offer is the Stripe coupon's max_redemptions; this counter only decides what
   the page says. */
export const FOUNDERS_HOLD_MS = 30 * 60 * 1000;

/** How the creation line is priced when the founders offer applies. */
export type FoundersPricingMode =
  /* Offer does not apply: creation billed at list price. */
  | "none"
  /* Creation at list price, zeroed by the PERSISTENT Stripe coupon — Stripe
     enforces the 10-slot cap itself through max_redemptions. */
  | "coupon"
  /* Creation billed as a 0 € line, cap left to the Convex counter alone.
     Only reachable without a Stripe key, i.e. when no real money moves. */
  | "zero-line";

/** Thrown when the offer applies but its cap cannot be enforced. */
export class FoundersOfferUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FoundersOfferUnavailableError";
  }
}

/**
 * Decides how to price the creation line for a founders sale.
 *
 * Refuses the sale rather than hand out a free build the cap cannot hold: with
 * no Stripe coupon nothing stops the eleventh customer, and each one past the
 * tenth costs 3 500 € excl. tax. A checkout that errors is a support ticket;
 * an uncapped offer is a hole in the revenue. Same principle as
 * resolveMaintenancePriceId — we never sell what we cannot bill.
 */
export function resolveFoundersPricing(input: {
  /** The offer applies to this order (slots left, right plan, no referral). */
  isFounders: boolean;
  couponId: string | null | undefined;
  creationProductId: string | null | undefined;
  /** A Stripe key is configured, so this checkout moves real money. */
  stripeLive: boolean;
  /** Env var name of the creation product, quoted in the error. */
  creationProductEnvName: string | undefined;
}): FoundersPricingMode {
  if (!input.isFounders) return "none";

  /* Both are required: the coupon caps the offer, the product is what the
     coupon is restricted to. With the coupon but no product the discount would
     spread pro rata over the maintenance line — the right total, the wrong
     split on the customer's invoice. */
  if (input.couponId && input.creationProductId) return "coupon";

  if (input.stripeLive) {
    const missing = !input.couponId
      ? "STRIPE_FOUNDERS_COUPON_ID"
      : (input.creationProductEnvName ?? "STRIPE_PRODUCT_CREATION_*");
    throw new FoundersOfferUnavailableError(
      `${missing} manquant en env : l'offre fondateurs ne peut pas être plafonnée. ` +
        `Créer le coupon Stripe (max_redemptions = ${foundersOffer.totalSlots}, ` +
        `applies_to le produit création) et poser les deux variables sur l'env Convex ` +
        `avant toute vente. Vente refusée : sans plafond, chaque site au-delà du ` +
        `dixième part gratuitement (3 500 € HT).`,
    );
  }

  /* No Stripe key: nothing is charged and no real build is given away. */
  return "zero-line";
}
