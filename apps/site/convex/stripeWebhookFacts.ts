/* ── Reading a Stripe webhook object, in one place ──

   Every field the webhook handlers pull off a Stripe object is read here, and
   only here. The reason is a defect this module exists to make impossible:

   The SDK pins API version 2026-02-25.clover. On that version
   `invoice.subscription` no longer exists — it moved to
   `parent.subscription_details.subscription` — and
   `subscription.current_period_start/end` moved to
   `items.data[].current_period_*`. `http.ts` still read the old shape through
   `Record<string, unknown>` and `as` casts, so `tsc` saw nothing and no test
   named the events. The result, measured on a real Premium renewal:

       invoice row: { plan: "essentielle", subscriptionId: null, amountCents: 240000 }
       currentPeriodEnd before = 1731536000000, after = 1731536000000

   Every renewal invoice was orphaned from its subscription and fell back to
   the `essentielle` default, so a Premium client's 2 400 € renewal was booked
   and receipted as an Essentielle one; and `coveredUntil` never advanced, so
   /maintenance/status told a paying client their maintenance had expired.

   The types come from the SDK, never hand-written: a local interface would go
   stale exactly the way `Record<string, unknown>` did, with nothing upstream
   to invalidate it. Bumping `stripe` now turns the next such migration into a
   red type-check instead of a silent mis-billing.

   Plain module — no Convex registration, no `"use node"`, and the Stripe
   import is type-only, so nothing of the SDK reaches the bundle. Same split as
   ./stripePriceAudit ↔ ./stripeAudit, and for the same reason: this is the
   part that can be wrong, so it is the part that gets unit-tested. */

import type Stripe from "stripe";

/* ── The shapes that were removed ──
   Named, so a legacy read is a deliberate, greppable thing rather than an
   `as any` scattered through a handler. Stripe renders each delivery at the
   API version configured ON THE WEBHOOK ENDPOINT, which is independent of the
   SDK's pin, and replays (automatic retries, "Resend") re-send the payload as
   it was first rendered. So an old shape can still arrive; it must be read,
   and it must be noisy. */
interface RemovedInvoiceFields {
  /** Top-level until 2025. Now `parent.subscription_details.subscription`. */
  subscription?: string | { id: string } | null;
}
interface RemovedSubscriptionFields {
  /** Top-level until 2025. Now `items.data[].current_period_*`. */
  current_period_start?: number | null;
  current_period_end?: number | null;
}

/** An id Stripe may hand back either bare or expanded. */
function idOf(
  ref: string | { id: string } | null | undefined,
): string | undefined {
  if (!ref) return undefined;
  return typeof ref === "string" ? ref : ref.id;
}

/** Where a subscription id was found on an invoice. */
export interface InvoiceSubscriptionRef {
  id: string | undefined;
  /** True when only the pre-clover field carried it — see {@link legacyShapeWarning}. */
  legacy: boolean;
}

/**
 * The subscription that generated an invoice.
 *
 * Reads the current shape first and falls back to the removed one, so a replay
 * of an event rendered at an older API version still links its invoice rather
 * than silently booking an orphan.
 */
export function invoiceSubscriptionId(
  invoice: Stripe.Invoice,
): InvoiceSubscriptionRef {
  const current = idOf(invoice.parent?.subscription_details?.subscription);
  if (current) return { id: current, legacy: false };

  const removed = idOf(
    (invoice as Stripe.Invoice & RemovedInvoiceFields).subscription,
  );
  if (removed) return { id: removed, legacy: true };

  return { id: undefined, legacy: false };
}

/**
 * The plan an invoice was raised for, from the subscription metadata Stripe
 * snapshots onto it (`createSubscription` sets it — see ./stripe).
 *
 * Second source, not the first: the Convex `subscriptions` row is
 * authoritative. This exists because the fallback when neither is available is
 * the literal `"essentielle"`, and that default is what billed a Premium
 * renewal as an Essentielle one for as long as the id was unreadable.
 */
export function invoicePlanHint(
  invoice: Stripe.Invoice,
): "essentielle" | "premium" | undefined {
  const plan = invoice.parent?.subscription_details?.metadata?.plan;
  return plan === "premium" || plan === "essentielle" ? plan : undefined;
}

/** A subscription's billing period, in Stripe's seconds. */
export interface SubscriptionPeriod {
  start: number | undefined;
  end: number | undefined;
  legacy: boolean;
}

/**
 * The current period of a subscription.
 *
 * Spans every item: earliest start, latest end. Ours are created single-item
 * (`items: [{ price }]` in ./stripe), so in practice there is one — but the
 * consumer is `maintenance.resolveEntitlement`, where under-reporting
 * `coveredUntil` cuts off a client who is paying and over-reporting only
 * serves them slightly too long. Erring long is the direction that file
 * already chose.
 *
 * Both undefined when there are no items: the caller must then write NOTHING
 * rather than a zero. `subscriptions.updateStatus` patches only defined
 * fields, so the last known-good period survives; a `0` would expire a paying
 * client instantly, which is worse than a stale value.
 */
export function subscriptionPeriod(
  subscription: Stripe.Subscription,
): SubscriptionPeriod {
  const items = subscription.items?.data ?? [];
  if (items.length > 0) {
    return {
      start: Math.min(...items.map((i) => i.current_period_start)),
      end: Math.max(...items.map((i) => i.current_period_end)),
      legacy: false,
    };
  }

  const removed = subscription as Stripe.Subscription &
    RemovedSubscriptionFields;
  if (removed.current_period_start != null || removed.current_period_end != null) {
    return {
      start: removed.current_period_start ?? undefined,
      end: removed.current_period_end ?? undefined,
      legacy: true,
    };
  }

  return { start: undefined, end: undefined, legacy: false };
}

/**
 * What to log when a delivery arrived in a shape the pinned version removed.
 *
 * The fallback keeps the money right; this is what stops it hiding the cause.
 * A legacy read means the webhook ENDPOINT is not on the SDK's API version,
 * and that is a dashboard setting somebody has to align.
 */
export function legacyShapeWarning(
  what: string,
  apiVersion: string | null | undefined,
): string {
  return (
    `[STRIPE] ${what} livré dans un format ANTÉRIEUR à ${STRIPE_PINNED_API_VERSION} ` +
    `(api_version=${apiVersion ?? "inconnue"}). Champ lu via le repli de ` +
    `compatibilité : aligner la version d'API de l'endpoint webhook dans le ` +
    `dashboard Stripe sur celle du SDK.`
  );
}

/** The version this code is written against — see ./stripeWebhookFacts header. */
export const STRIPE_PINNED_API_VERSION = "2026-02-25.clover";

/** Milliseconds from Stripe's seconds, or `undefined`. */
export function toMillis(seconds: number | null | undefined): number | undefined {
  return seconds == null ? undefined : seconds * 1000;
}

/**
 * A Stripe reference as a plain id, dropping an expanded object or a `null`.
 *
 * Stripe returns `null` where Convex validators want the field absent:
 * `v.optional(v.string())` accepts a missing key, never `null`. Passing `null`
 * through made the mutation throw, the handler return 500, and Stripe retry
 * the event forever.
 */
export function refId(
  ref: string | { id: string } | null | undefined,
): string | undefined {
  return idOf(ref);
}

/** A nullable Stripe string as an optional one, for the same reason. */
export function optionalText(text: string | null | undefined): string | undefined {
  return text ?? undefined;
}
