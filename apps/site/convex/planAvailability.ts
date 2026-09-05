/* Which plans are open for sale — the single source of truth.

   Read by the checkout (convex/stripe.ts), which refuses a plan that is not
   open, and by the pricing page (components/pricing/pricing-data.ts), which
   badges it « À venir » and swaps the call to action for a lead capture.

   The two have to agree, and until now they did not. `/checkout` reads its
   plan straight off the query string (components/checkout/checkout-content.tsx)
   and `createCheckoutSession` accepts `plan: "premium"` as a first-class
   literal, so the card's « À venir » badge was decoration: /checkout?plan=premium
   collected 7 500 € HT + 2 000 €/an for a deliverable that does not exist. A
   badge is not a guard. This file is the guard.

   Premium is "coming_soon" because its defining deliverable — the native iOS
   and Android application, and the whole €4 000 creation delta over Essentielle
   — has no implementation: apps/themes/.template/mobile is a one-screen
   placeholder, outside the pnpm workspace, never built, signed or submitted to
   either store. Flip it to "open" in the same commit that ships the
   application, and not one commit earlier.

   Plain constants and a type-only import, for the same reason as
   planPrices.ts: both the Convex bundler and the Next bundler pull this in,
   and convex/ never imports from lib/. */

import type { PlanId } from "./planPrices";

export type PlanAvailability = "open" | "coming_soon";

export const planAvailability = {
  essentielle: "open",
  premium: "coming_soon",
} as const satisfies Record<PlanId, PlanAvailability>;

export function isPlanOpenForSale(plan: PlanId): boolean {
  return planAvailability[plan] === "open";
}

/** Customer-facing refusal. Reaches the buyer, so it says what to do next. */
export function planClosedForSaleMessage(plan: PlanId): string {
  const label = plan === "essentielle" ? "Essentielle" : "Premium";
  return (
    `L'offre ${label} n'est pas encore ouverte à la vente : l'application mobile ` +
    `qu'elle inclut n'est pas encore disponible. Choisissez l'offre Essentielle, ` +
    `ou laissez-nous vos coordonnées pour être prévenu du lancement.`
  );
}
