import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/* ── Maintenance entitlement ──
   A site is sold with one year of maintenance, renewable annually. Renewing is
   what pays for the engine work; a site that stops renewing keeps running but
   stops receiving updates — the « gel de version » of the CGV.

   The client's update scripts (pnpm update:engine, pnpm update:template) ask
   this before pulling anything. The answer comes from the `subscriptions`
   table, which the Stripe webhook keeps current — NOT from
   saDeployments.maintenance, whose status label is only ever written at
   provisioning and would go stale the day it mattered.

   This gate is a courtesy, not a lock: the hard freeze is revoking the client's
   access to the private boilerplate repo and to the @be-in-digital/* registry
   (see apps/themes/docs/UPDATES.md). What this buys is a client who is told
   why the update stopped and how to renew, instead of a raw 403 from GitHub. */

/**
 * Issues a site's license key.
 * Opaque and unguessable, but not a secret worth defending: it proves nothing
 * beyond « this repo belongs to that deployment ». Whoever holds it can read a
 * maintenance status, not pull an update — that still needs the private repo
 * and the private registry.
 */
export function newLicenseKey(): string {
  return `bys_${crypto.randomUUID().replace(/-/g, "")}`;
}

/** Dunning window: Stripe keeps retrying a failed renewal for about 2 weeks. */
export const MAINTENANCE_GRACE_MS = 14 * 24 * 60 * 60 * 1000;

export type EntitlementReason =
  /** Subscription running. */
  | "active"
  /** Renewal failed, Stripe is still retrying — do not cut the client off yet. */
  | "grace"
  /** Cancelled but the paid period has not run out. */
  | "cancelled_covered"
  /** No subscription on record — allowed, and worth looking at. */
  | "unregistered"
  /** Paid period over, grace window closed. */
  | "expired"
  /** Cancelled and the paid period has run out. */
  | "cancelled"
  /** Never paid, or the first payment never completed. */
  | "unpaid";

export type Entitlement = {
  entitled: boolean;
  reason: EntitlementReason;
  /** End of the paid period, when one is known. */
  coveredUntil: number | null;
};

type SubscriptionState = {
  status: Doc<"subscriptions">["status"];
  currentPeriodEnd?: number;
};

/**
 * Decides whether a site may pull engine updates.
 *
 * Trusts Stripe's own label for « is this being paid »: an `active`
 * subscription entitles even if currentPeriodEnd looks stale, because a missed
 * webhook on our side must never cut off a client who is paying. The period
 * date only decides the cases where Stripe already says the money stopped.
 */
export function resolveEntitlement(input: {
  subscription: SubscriptionState | null;
  now: number;
}): Entitlement {
  const sub = input.subscription;

  /* No subscription linked: a site mid-provisioning, or a link we failed to
     make. Refusing here would block a client for a bookkeeping miss, so we let
     it through and name the reason for the console to pick up. */
  if (!sub) {
    return { entitled: true, reason: "unregistered", coveredUntil: null };
  }

  const coveredUntil = sub.currentPeriodEnd ?? null;

  switch (sub.status) {
    case "active":
      return { entitled: true, reason: "active", coveredUntil };

    case "past_due": {
      const deadline = (coveredUntil ?? input.now) + MAINTENANCE_GRACE_MS;
      return input.now <= deadline
        ? { entitled: true, reason: "grace", coveredUntil }
        : { entitled: false, reason: "expired", coveredUntil };
    }

    /* Cancelled mid-period: the year is paid for, it stays covered to its end. */
    case "canceled":
      return coveredUntil !== null && input.now <= coveredUntil
        ? { entitled: true, reason: "cancelled_covered", coveredUntil }
        : { entitled: false, reason: "cancelled", coveredUntil };

    case "unpaid":
    case "incomplete":
      return { entitled: false, reason: "unpaid", coveredUntil };
  }
}

/** Message shown to the client by the update scripts. */
export function entitlementMessage(e: Entitlement): string {
  const until =
    e.coveredUntil !== null
      ? new Date(e.coveredUntil).toLocaleDateString("fr-FR")
      : null;
  switch (e.reason) {
    case "active":
      return until
        ? `Maintenance à jour jusqu'au ${until}.`
        : "Maintenance à jour.";
    case "grace":
      return `Le dernier paiement de maintenance a échoué. Les mises à jour restent ouvertes le temps que le prélèvement aboutisse — merci de vérifier votre moyen de paiement.`;
    case "cancelled_covered":
      return `Maintenance résiliée : la période payée court jusqu'au ${until}. Passé cette date, le site continuera de tourner mais ne recevra plus de mises à jour.`;
    case "unregistered":
      return "Aucun contrat de maintenance rattaché à ce site.";
    case "expired":
      return `La maintenance a expiré${until ? ` le ${until}` : ""}. Le site continue de fonctionner dans sa version actuelle ; les mises à jour reprennent dès le renouvellement.`;
    case "cancelled":
      return `La maintenance a été résiliée${until ? ` et la période payée s'est terminée le ${until}` : ""}. Le site continue de fonctionner dans sa version actuelle ; les mises à jour reprennent dès la reprise du contrat.`;
    case "unpaid":
      return "Aucun paiement de maintenance enregistré pour ce site. Les mises à jour reprennent dès la régularisation.";
  }
}

/* How many of a customer's subscriptions one lookup reads.
   Bounded so the biggest account cannot blow the read limit, and taken NEWEST
   FIRST: the row that still entitles is a recent one, the dead ones are
   history. The old bound kept the OLDEST 20, so a client with more than 20
   finished contracts had their live subscription fall outside the window and
   was refused an update they had paid for. */
const MAX_SUBSCRIPTIONS_SCANNED = 200;

/**
 * The most favourable verdict among several subscriptions, or null for none.
 *
 * A lookup can turn up more than one row: several sites on one email, contracts
 * that ended, and — for orders that predate the guard in ./subscriptions — a
 * duplicate written by two concurrent webhook deliveries. None of those may
 * cost a paying client their updates, so the best row decides.
 */
function mostFavourable(
  subscriptions: Doc<"subscriptions">[],
  now: number,
): Entitlement | null {
  return (
    subscriptions
      .map((subscription) => resolveEntitlement({ subscription, now }))
      .sort(
        (a, b) =>
          Number(b.entitled) - Number(a.entitled) ||
          (b.coveredUntil ?? 0) - (a.coveredUntil ?? 0),
      )[0] ?? null
  );
}

/**
 * Resolves a site's entitlement from its license key.
 * Prefers the subscription linked to the deployment's order; falls back to the
 * customer's subscriptions. Either way the most favourable row wins, so a
 * client running several sites is never blocked by whichever one happened to
 * come first — and neither reads with `.unique()`, so an order carrying
 * duplicate rows answers instead of throwing a 500 the client update scripts
 * would read as « API unreachable, update anyway ».
 */
export const byLicenseKey = internalQuery({
  args: { licenseKey: v.string() },
  handler: async (ctx, args) => {
    const deployment = await ctx.db
      .query("saDeployments")
      .withIndex("by_licenseKey", (q) => q.eq("licenseKey", args.licenseKey))
      .unique();

    if (!deployment) return null;

    const now = Date.now();

    if (deployment.orderId) {
      const linked = await ctx.db
        .query("subscriptions")
        .withIndex("by_orderId", (q) => q.eq("orderId", deployment.orderId!))
        .take(MAX_SUBSCRIPTIONS_SCANNED);
      const verdict = mostFavourable(linked, now);
      if (verdict) {
        return { site: deployment.name, ...verdict };
      }
    }

    const owned = await ctx.db
      .query("subscriptions")
      .withIndex("by_customerEmail", (q) =>
        q.eq("customerEmail", deployment.customerEmail),
      )
      .order("desc")
      .take(MAX_SUBSCRIPTIONS_SCANNED);

    return {
      site: deployment.name,
      ...(mostFavourable(owned, now) ??
        resolveEntitlement({ subscription: null, now })),
    };
  },
});
