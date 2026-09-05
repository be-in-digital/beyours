/* ── One maintenance subscription per order, decided without credentials ──

   The other half of the duplicate-subscription problem. convex/subscriptions.ts
   guards the ROW: two concurrent deliveries of checkout.session.completed cannot
   both insert. That guard runs after the money has already moved — whichever
   delivery loses has, by then, created a second real subscription at Stripe,
   which bills the customer on every renewal until an operator cancels it in the
   dashboard. Refusing the row does not stop the charge.

   Stopping the charge means the second call must not create anything at Stripe.
   Two mechanisms, with deliberately different reach:

   1. A deterministic idempotency key. Stripe replays the ORIGINAL response for a
      repeated key instead of creating a second object, and stripe-node retries a
      409 (« key in use ») until the first request finishes — which is precisely
      the concurrent case. Stripe keeps a key for 24 h.

   2. Adoption. Past those 24 h the key is gone; and a delivery that created the
      subscription but died before recording the row leaves nothing on our side
      to find either. So we ask Stripe first: does this customer already carry a
      subscription for this orderId? Checkout opens a fresh Customer per session
      (customer_creation: "always"), so that customer's subscriptions belong to
      this order and to nothing else.

   Mechanism 1 only holds while the request body is identical across deliveries:
   Stripe refuses a reused key whose parameters changed, and that refusal would
   surface as a provisioning failure on a sale that is actually fine. Hence
   `maintenanceSubscriptionParams`, built from the order alone — and hence the
   trial expressed as a NUMBER OF DAYS rather than the `now + N days` timestamp
   it used to be, which two deliveries a second apart computed differently.

   Plain module on purpose — no "use node", no Convex registration, no Stripe
   client — so every decision above is unit-testable without credentials. The
   action that talks to Stripe is createSubscription in convex/stripe.ts. Same
   split as stripePriceAudit. */

import type Stripe from "stripe";

export type MaintenancePlan = "essentielle" | "premium";
export type MaintenanceBillingPeriod = "monthly" | "yearly";

/** Identifies the order whose maintenance is being billed. */
export type MaintenanceOrder = {
  orderId: string;
  plan: MaintenancePlan;
  billingPeriod: MaintenanceBillingPeriod;
};

/* The first period is collected at checkout, so Stripe must not bill until it
   runs out. Days, not a timestamp: see the note on determinism above. */
export const MAINTENANCE_TRIAL_DAYS: Record<MaintenanceBillingPeriod, number> = {
  monthly: 30,
  yearly: 365,
};

/**
 * The idempotency key for an order's maintenance subscription.
 *
 * Derived from exactly the order fields that `maintenanceSubscriptionParams`
 * reads, so « same key » and « same body » cannot come apart: a replayed
 * delivery of the same checkout gets Stripe's original answer back rather than
 * a second subscription. Well inside Stripe's 255-character limit.
 */
export function maintenanceIdempotencyKey(order: MaintenanceOrder): string {
  return `beyours:maintenance-subscription:${order.orderId}:${order.plan}:${order.billingPeriod}`;
}

/**
 * The subscription to create for an order — a pure function of the order, the
 * customer, the resolved Price and the tax setting.
 *
 * Nothing here may read a clock, a random source or anything else that differs
 * between two deliveries of the same webhook; that is what makes the key above
 * work rather than fail with an idempotency error.
 */
export function maintenanceSubscriptionParams(input: {
  order: MaintenanceOrder;
  stripeCustomerId: string;
  priceId: string;
  automaticTax: boolean;
}): Stripe.SubscriptionCreateParams {
  const { order } = input;
  return {
    customer: input.stripeCustomerId,
    items: [{ price: input.priceId }],
    trial_period_days: MAINTENANCE_TRIAL_DAYS[order.billingPeriod],
    ...(input.automaticTax ? { automatic_tax: { enabled: true } } : {}),
    metadata: {
      orderId: order.orderId,
      plan: order.plan,
      billingPeriod: order.billingPeriod,
    },
  };
}

/* The two statuses a subscription can hold while being certain never to bill
   again. Everything else — trialing, active, past_due, unpaid, incomplete,
   paused — is a live billing relationship, and creating a second one alongside
   it is the charge we are here to prevent. A subscription an operator has
   already cancelled must NOT be adopted: the order still needs one. */
const SPENT_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set([
  "canceled",
  "incomplete_expired",
]);

/**
 * The subscription Stripe already holds for this order, or null.
 *
 * Matches on `metadata.orderId` rather than on « this customer has any
 * subscription »: one owner buys one order per location, and each of those
 * orders is a separate sale that must be billed.
 */
export function findSubscriptionForOrder(
  subscriptions: readonly Stripe.Subscription[],
  orderId: string,
): Stripe.Subscription | null {
  return (
    subscriptions.find(
      (subscription) =>
        subscription.metadata?.orderId === orderId &&
        !SPENT_STATUSES.has(subscription.status),
    ) ?? null
  );
}
