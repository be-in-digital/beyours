import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { recordSaActivity } from "./saActivity";

const planValidator = v.union(v.literal("essentielle"), v.literal("premium"));
const billingPeriodValidator = v.union(
  v.literal("monthly"),
  v.literal("yearly"),
);
const statusValidator = v.union(
  v.literal("active"),
  v.literal("past_due"),
  v.literal("canceled"),
  v.literal("unpaid"),
  v.literal("incomplete"),
);

/**
 * Why a maintenance subscription has nothing to charge.
 *
 * WHY THREE AND NOT A BOOLEAN: the caller used to report
 * `hasDefaultPaymentMethod: false`, and `resolveReusablePaymentMethod` answers
 * `null` for three unrelated reasons — a genuine BNPL sale, a
 * `paymentIntents.retrieve` that threw, and an event that carried no intent id
 * at all. The feed asserted the first one for all three, so an operator read
 * « Paiement initial réglé en BNPL (Alma/Klarna) » about a Stripe outage and
 * went looking for a card the customer may well have already given (#411). A
 * report that names the wrong cause is worse than one that names none.
 */
export const UNBILLABLE_REASONS = ["bnpl", "unreadable", "no_intent"] as const

export type UnbillableReason = (typeof UNBILLABLE_REASONS)[number]

const unbillableReasonValidator = v.union(
  v.literal("bnpl"),
  v.literal("unreadable"),
  v.literal("no_intent"),
);

/**
 * What the ops feed says about each, and what it asks for.
 *
 * French, like every other line in that feed: its readers are the BeInDigital
 * team. Each one ends on the action, because the entry exists to be acted on.
 */
const UNBILLABLE_REASON_SUMMARY: Record<UnbillableReason, string> = {
  bnpl:
    "Paiement initial réglé en BNPL (Alma/Klarna), qui ne peut pas être représenté hors session : " +
    "le premier renouvellement échouera. Récupérer une carte auprès du client avant la fin de la " +
    "période d'essai.",
  unreadable:
    "Le PaymentIntent du paiement initial n'a pas pu être lu chez Stripe : aucun moyen de paiement " +
    "n'a été rattaché au client, et le mode de règlement reste inconnu. Vérifier le paiement dans " +
    "le tableau de bord Stripe — s'il a été réglé par carte, rattacher cette carte au client ; " +
    "sinon en demander une.",
  no_intent:
    "L'événement Stripe ne portait aucun PaymentIntent — un rejeu d'un événement antérieur, en " +
    "général — donc rien n'a pu être rattaché au client. Retrouver le paiement initial dans le " +
    "tableau de bord Stripe et rattacher son moyen de paiement au client.",
};

export const create = internalMutation({
  args: {
    orderId: v.id("orders"),
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    customerEmail: v.string(),
    plan: planValidator,
    billingPeriod: billingPeriodValidator,
    status: statusValidator,
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    /* Why nothing can be charged when the trial ends, when that is the case.
       Optional so an older caller (or a replay) is not a type error; absent is
       « a reusable method was attached », which is the ordinary outcome and
       reports nothing. See `UNBILLABLE_REASON_SUMMARY`. */
    unbillableReason: v.optional(unbillableReasonValidator),
  },
  handler: async (ctx, args) => {
    /* ── One subscription per order, guarded where the write happens ──
       Stripe delivers checkout.session.completed at least once, and retries it.
       The webhook does look for an existing subscription before calling here,
       but that read sits in its own transaction and the write lands in another
       (httpAction reads → action → this mutation writes): two deliveries racing
       each other both read « none » and both insert. The check has to live
       inside the transaction that inserts. Convex mutations are serializable,
       so a second delivery either sees this row or is retried until it does.

       The duplicated state used to sustain itself: getByOrderId ran .unique()
       and threw once there were two rows, so the webhook's own guard stayed
       broken for that order for good. Both halves are handled — here we
       prevent, below we tolerate what is already on file. */
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .first();

    if (existing) {
      /* The same Stripe subscription recorded twice is a plain replay: nothing
         to report. A DIFFERENT one means the caller already created a second
         subscription at Stripe before reaching us — we refuse the row, but
         Stripe will bill that subscription all the same. No guard on this side
         can undo it, so it goes where ops look and not only into the logs. */
      if (existing.stripeSubscriptionId !== args.stripeSubscriptionId) {
        console.error(
          `[STRIPE] Duplicate maintenance subscription for order ${args.orderId}: ` +
            `${args.stripeSubscriptionId} was created at Stripe while ` +
            `${existing.stripeSubscriptionId} is already on file. Row refused — ` +
            `the extra subscription still has to be cancelled in Stripe.`,
        );
        await recordSaActivity(ctx, {
          kind: "system",
          action: "subscription_duplicate_refused",
          summary:
            `Deuxième abonnement de maintenance créé chez Stripe pour la commande ${args.orderId} ` +
            `(${args.stripeSubscriptionId}) alors que ${existing.stripeSubscriptionId} est déjà en base. ` +
            `La ligne en double a été refusée, mais l'abonnement en trop existe chez Stripe : ` +
            `l'annuler, sinon le client sera prélevé deux fois.`,
          customerEmail: args.customerEmail,
        });
      }
      return existing._id;
    }

    /* A maintenance subscription is `charge_automatically`. With no reusable
       payment method on the customer, its first renewal invoice — 240 to
       2 400 € — fails, dunning starts, and `/maintenance/status` eventually
       cuts the client's updates: a year after they paid, over a card nobody
       ever asked them for. That has to be somewhere an operator sees it while
       there is still a year to act — and it has to say which of the three
       things happened, because they need three different responses. */
    if (args.unbillableReason) {
      await recordSaActivity(ctx, {
        kind: "commerce",
        action: "subscription_without_payment_method",
        summary:
          `Abonnement de maintenance créé sans moyen de paiement réutilisable pour la commande ${args.orderId} ` +
          `(${args.stripeSubscriptionId}). ${UNBILLABLE_REASON_SUMMARY[args.unbillableReason]}`,
        customerEmail: args.customerEmail,
      });
    }

    const { unbillableReason: _reported, ...row } = args;
    return await ctx.db.insert("subscriptions", {
      ...row,
      createdAt: Date.now(),
    });
  },
});

/* How many rows sharing one Stripe id we are willing to touch. A pair is the
   realistic case (one webhook race); the bound only stops an unbounded scan. */
const MAX_DUPLICATE_ROWS = 16;

export const updateStatus = internalMutation({
  args: {
    stripeSubscriptionId: v.string(),
    status: statusValidator,
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    canceledAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    /* Every row carrying this Stripe id, not `.unique()`. Duplicates by
       `orderId` share one `stripeSubscriptionId`, so the rows `create` and
       `getByOrderId` already tolerate land here too — and `.unique()` threw,
       which returned 500 to Stripe, which retried the renewal for three days
       and never recorded it. That is the same self-sustaining shape the
       comment on `getByOrderId` describes: the read that was meant to repair
       the state was the one that could not run.
       Patching all of them keeps duplicates consistent rather than letting
       whichever row is read first answer differently. */
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeSubscriptionId", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .take(MAX_DUPLICATE_ROWS);
    if (subs.length === 0) return;

    const patch: Record<string, unknown> = { status: args.status };
    if (args.currentPeriodStart !== undefined)
      patch.currentPeriodStart = args.currentPeriodStart;
    if (args.currentPeriodEnd !== undefined)
      patch.currentPeriodEnd = args.currentPeriodEnd;
    if (args.canceledAt !== undefined) patch.canceledAt = args.canceledAt;

    for (const sub of subs) {
      await ctx.db.patch(sub._id, patch);
    }
  },
});

/**
 * The subscription carrying a Stripe id, or null.
 *
 * `.first()` rather than `.unique()`, for the reason spelled out on
 * `updateStatus` above: a duplicate pair makes `.unique()` throw, the webhook
 * answers 500, and the renewal is never recorded however many times Stripe
 * retries it. A duplicate is a bookkeeping fault; refusing to read is a
 * billing one.
 */
export const getByStripeSubscriptionId = internalQuery({
  args: { stripeSubscriptionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_stripeSubscriptionId", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .first();
  },
});

/**
 * The subscription on file for an order, or null.
 *
 * Not `.unique()`, on purpose: an order that already carries duplicate rows —
 * from a webhook race that predates the guard in `create` — still has to be
 * readable. This is the read the webhook consults to decide « one exists
 * already », so throwing here left the guard against duplicates broken for
 * exactly the orders that had one. The other read of these rows,
 * maintenance.byLicenseKey, tolerates duplicates for its own reason: it answers
 * GET /maintenance/status, and a 500 there reads to the client update scripts
 * as « API unreachable » — they then update anyway.
 */
export const getByOrderId = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .first();
  },
});

/* ── No public read here, on purpose ──
   `getByEmail` returned a customer's plan, status and Stripe ids for any email
   passed in. Same shape as the invoices one it sat beside, same absent caller.
   See ./invoices for the rule the client area follows instead. */

/**
 * Records that a refunded sale's subscription was stopped.
 *
 * Separate from the status patch so the ops feed carries one line per real
 * cancellation, and so a replayed webhook — which finds the row already
 * `canceled` and returns before reaching here — does not write a second.
 */
export const recordCancellation = internalMutation({
  args: {
    orderId: v.id("orders"),
    stripeSubscriptionId: v.string(),
    customerEmail: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await recordSaActivity(ctx, {
      kind: "commerce",
      action: "subscription_cancelled_after_reversal",
      summary:
        `Abonnement de maintenance ${args.stripeSubscriptionId} annulé pour la commande ${args.orderId} ` +
        `— ${args.reason}. La vente est défaite : plus aucun prélèvement de maintenance.`,
      customerEmail: args.customerEmail,
    });
  },
});

/**
 * Records a cancellation Stripe refused.
 *
 * The local row stays as it was on purpose: saying « canceled » here while
 * Stripe still holds a live subscription would hide the one thing an operator
 * has to act on — the client is still going to be charged.
 */
export const recordCancellationFailure = internalMutation({
  args: {
    orderId: v.id("orders"),
    stripeSubscriptionId: v.string(),
    customerEmail: v.string(),
    detail: v.string(),
  },
  handler: async (ctx, args) => {
    await recordSaActivity(ctx, {
      kind: "incident",
      action: "subscription_cancellation_failed",
      summary:
        `Annulation de l'abonnement ${args.stripeSubscriptionId} (commande ${args.orderId}) impossible ` +
        `— ${args.detail}. La vente est remboursée mais l'abonnement tourne toujours : ` +
        `l'annuler à la main dans Stripe, sinon le client sera prélevé.`,
      customerEmail: args.customerEmail,
    });
  },
});
