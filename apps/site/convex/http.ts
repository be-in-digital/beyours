import { httpRouter } from "convex/server";
import { v } from "convex/values";
import { httpAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { recordSaActivity } from "./saActivity";
import { entitlementMessage } from "./maintenance";

const http = httpRouter();

// Convex Auth HTTP routes
auth.addHttpRoutes(http);

/* ═══════════════════════════════════════════════
   Stripe webhook — 5 events handled:
   1. checkout.session.completed
   2. invoice.payment_succeeded
   3. invoice.payment_failed
   4. customer.subscription.updated
   5. customer.subscription.deleted
   ═══════════════════════════════════════════════ */

async function verifyStripeSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const parts = signature.split(",");
  const ts = parts.find((p) => p.startsWith("t="))?.slice(2);
  const sig = parts.find((p) => p.startsWith("v1="))?.slice(3);

  if (!ts || !sig) return false;

  // Make sure the timestamp is not too old (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(ts)) > 300) return false;

  const encoder = new TextEncoder();
  const payload = `${ts}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );
  const expectedSig = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSig === sig;
}

// Loose type for Stripe events
interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // Signature verification
    const valid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!valid) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event: StripeEvent = JSON.parse(body);

    // Idempotency — skip if already processed. If it exists but is not processed, retry.
    const existing = await ctx.runQuery(
      internal.stripeEvents.getByEventId,
      { eventId: event.id },
    );
    if (existing?.processed) {
      return new Response("Already processed", { status: 200 });
    }
    if (!existing) {
      await ctx.runMutation(internal.stripeEvents.create, {
        eventId: event.id,
        eventType: event.type,
      });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(ctx, event);
          break;
        case "invoice.payment_succeeded":
          await handleInvoiceSucceeded(ctx, event);
          break;
        case "invoice.payment_failed":
          await handleInvoiceFailed(ctx, event);
          break;
        case "customer.subscription.updated":
          await handleSubscriptionUpdated(ctx, event);
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(ctx, event);
          break;
        case "account.updated":
          await handleAccountUpdated(ctx, event);
          break;
        case "charge.refunded":
          await handleChargeReversal(ctx, event, "Remboursement du client");
          break;
        case "charge.dispute.created":
          await handleChargeReversal(
            ctx,
            event,
            "Litige / rétrofacturation (chargeback)",
          );
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      await ctx.runMutation(internal.stripeEvents.markProcessed, {
        eventId: event.id,
      });
    } catch (err) {
      console.error(`Error processing ${event.type}:`, err);
      return new Response("Processing error", { status: 500 });
    }

    return new Response("OK", { status: 200 });
  }),
});

/* ── 1. checkout.session.completed ── */

async function handleCheckoutCompleted(
  ctx: { runQuery: typeof Function.prototype; runMutation: typeof Function.prototype; runAction: typeof Function.prototype; scheduler: { runAfter: typeof Function.prototype } },
  event: StripeEvent,
) {
  const session = event.data.object;
  const sessionId = session.id as string;
  const customerId = session.customer as string | undefined;
  const customerEmail = (session.customer_details as Record<string, unknown>)?.email as string | undefined
    ?? session.customer_email as string | undefined;
  const metadata = session.metadata as Record<string, string> | undefined;

  // Look the order up
  const order = await ctx.runQuery(
    internal.orders.getByStripeSessionId,
    { stripeSessionId: sessionId },
  );
  if (!order) {
    console.error(`No order found for session ${sessionId}`);
    return;
  }

  // ── Payment collection idempotency (payment fix) ──
  // The order's pending→paid transition is our idempotency key for the effects
  // that are NOT idempotent by nature (the confirmation email). A replay of the
  // Stripe webhook (redelivery, or a 2nd attempt after an error) finds the order
  // already « paid » and therefore does NOT resend the email. The other effects
  // (payment row, subscription) each have their own existence guard.
  const firstProcessing = order.status !== "paid";

  // Payment method — payment_method_types holds the allowed methods, not the one used.
  // Either use payment_method_collection or infer it: with a single allowed method, that is the one.
  // Otherwise, check whether Stripe reports the method on the charges (not available on the session alone).
  const paymentMethodTypes = session.payment_method_types as string[] | undefined;
  let pmt = "card";
  if (paymentMethodTypes && paymentMethodTypes.length === 1) {
    pmt = paymentMethodTypes[0]!;
  }
  const paymentMethod = pmt === "alma" ? "alma" : pmt === "klarna" ? "klarna" : "card";

  // Send-exactly-once effects, guarded by the pending→paid transition.
  // Flip the status FIRST (the idempotency key), then schedule the email:
  // a replay will never come back through here (status already « paid »).
  if (firstProcessing) {
    // Update the order (pending → paid)
    await ctx.runMutation(internal.orders.updateStatus, {
      orderId: order._id,
      status: "paid" as const,
      paymentMethod: paymentMethod as "card" | "alma" | "klarna",
    });

    // Confirmation email to the customer (best-effort, never blocks the webhook).
    // amount_total = the amount actually charged (tax included when VAT is on,
    // excluded otherwise), always right, unlike the pre-tax amount on the order.
    // Sent ONCE (firstProcessing guard) — not on every Stripe retry.
    await ctx.scheduler.runAfter(0, internal.email.send.sendOrderConfirmation, {
      toEmail: order.customerEmail,
      firstName: order.customerFirstName,
      restaurantName: order.restaurantName,
      plan: order.plan,
      orderType: order.orderType,
      amountCents: (session.amount_total as number) ?? order.amountCents,
      paymentMethod,
      isFounders: order.isFounders ?? false,
    });
  }

  // Create the payment — idempotent through the payment_intent (an existence
  // guard independent of the status: it still closes the payment row when a
  // replay follows a partial failure of the first pass).
  const paymentIntent = session.payment_intent as string | undefined;
  if (paymentIntent) {
    const existingPayment = await ctx.runQuery(
      internal.payments.getByStripePaymentIntentId,
      { stripePaymentIntentId: paymentIntent },
    );
    if (!existingPayment) {
      await ctx.runMutation(internal.payments.create, {
        orderId: order._id,
        stripePaymentIntentId: paymentIntent,
        stripeSessionId: sessionId,
        amountCents: (session.amount_total as number) ?? 0,
        paymentMethod: pmt,
      });
    }
  }

  // ── Maintenance subscription (recurring billing) ──
  // Idempotent: the subscription is only created when none exists yet for this
  // order (a replay does not duplicate it). Wrapped in a try/catch: a failure
  // AFTER the payment was collected (e.g. a missing live Price ID) must NOT
  // return 500 — Stripe would replay the event in a loop and stack up effects.
  // We record the failure on the order + in the ops activity feed, then return
  // 200. A later replay will try again (existence guard).
  if (customerId && metadata?.billingPeriod) {
    const plan = metadata.plan as "essentielle" | "premium";
    const billingPeriod = metadata.billingPeriod as "monthly" | "yearly";

    const existingSub = await ctx.runQuery(internal.subscriptions.getByOrderId, {
      orderId: order._id,
    });

    if (!existingSub) {
      try {
        await ctx.runAction(internal.stripe.createSubscription, {
          orderId: order._id,
          stripeCustomerId: customerId,
          customerEmail: customerEmail ?? order.customerEmail,
          plan,
          billingPeriod,
          buyerType: order.buyerType,
        });
        await ctx.runMutation(internal.http.recordSubscriptionOutcome, {
          orderId: order._id,
          status: "active" as const,
        });
      } catch (err) {
        // The payment is already collected: we do NOT fail the webhook (no 500 →
        // no Stripe replay loop). We log the failure so that ops SEE it and
        // provision the subscription by hand.
        console.error(
          `[STRIPE] createSubscription a échoué pour la commande ${order._id} après encaissement — provisioning manuel requis:`,
          err,
        );
        await ctx.runMutation(internal.http.recordSubscriptionOutcome, {
          orderId: order._id,
          status: "failed" as const,
          customerEmail: customerEmail ?? order.customerEmail,
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Create the referral when applicable (idempotent on orderId)
  if (metadata?.referralCodeId && metadata?.referrerId) {
    // Server-side self-referral guard (an invariant, independent of the front end).
    const referrerEmail = await ctx.runQuery(
      internal.affiliateUsers.getEmailById,
      { affiliateUserId: metadata.referrerId as Id<"affiliateUsers"> },
    );
    const buyerEmail = (customerEmail ?? order.customerEmail).toLowerCase();

    if (referrerEmail && referrerEmail.toLowerCase() === buyerEmail) {
      console.log(
        `[REFERRAL] Auto-parrainage détecté au webhook (${buyerEmail}) — referral ignoré`,
      );
    } else {
      const settings = await ctx.runQuery(
        internal.affiliateSettings.getInternal,
        {},
      );
      const affiliate = await ctx.runQuery(internal.affiliateUsers.getById, {
        affiliateUserId: metadata.referrerId as Id<"affiliateUsers">,
      });

      const commissionCents =
        affiliate?.commissionOverrideCents ?? settings.defaultCommissionCents;

      const customerName =
        `${order.customerFirstName} ${order.customerLastName}`.trim() ||
        undefined;

      await ctx.runMutation(internal.referrals.createFromCheckout, {
        referrerId: metadata.referrerId as Id<"affiliateUsers">,
        referralCodeId: metadata.referralCodeId as Id<"referralCodes">,
        orderId: order._id,
        customerEmail: customerEmail ?? order.customerEmail,
        customerName,
        commissionCents,
        discountPercent: parseInt(metadata.discountPercent ?? "0") || 0,
        discountAmountCents:
          parseInt(metadata.discountAmountCents ?? "0") || 0,
      });

      console.log(
        `Referral created for order ${order._id} (referrer: ${metadata.referrerId})`,
      );
    }
  }
}

/* ── 2. invoice.payment_succeeded ── */

async function handleInvoiceSucceeded(
  ctx: { runQuery: typeof Function.prototype; runMutation: typeof Function.prototype; scheduler: { runAfter: typeof Function.prototype } },
  event: StripeEvent,
) {
  const invoice = event.data.object;
  const invoiceId = invoice.id as string;
  const invoiceNumber = invoice.number as string | undefined;
  const subscriptionId = invoice.subscription as string | undefined;
  const customerId = invoice.customer as string;
  const customerEmail = invoice.customer_email as string;
  const amountPaid = invoice.amount_paid as number;
  const invoicePdf = invoice.invoice_pdf as string | undefined;
  const hostedUrl = invoice.hosted_invoice_url as string | undefined;
  const periodStart = invoice.period_start as number | undefined;
  const periodEnd = invoice.period_end as number | undefined;
  // "subscription_create" = the 1st invoice (already covered by the order
  // confirmation); "subscription_cycle" = a real renewal → dedicated receipt.
  const billingReason = invoice.billing_reason as string | undefined;

  // Find the Convex subscription (when one is linked)
  let convexSubscriptionId: Id<"subscriptions"> | undefined;
  let plan: "essentielle" | "premium" = "essentielle";

  if (subscriptionId) {
    const sub = await ctx.runQuery(
      internal.subscriptions.getByStripeSubscriptionId,
      { stripeSubscriptionId: subscriptionId },
    );
    if (sub) {
      convexSubscriptionId = sub._id;
      plan = sub.plan;
    }
  }

  // Check whether the invoice already exists
  const existingInvoice = await ctx.runQuery(
    internal.invoices.getByStripeInvoiceId,
    { stripeInvoiceId: invoiceId },
  );

  if (existingInvoice) {
    await ctx.runMutation(internal.invoices.updateStatus, {
      stripeInvoiceId: invoiceId,
      status: "paid" as const,
      invoiceNumber,
      invoicePdfUrl: invoicePdf,
      hostedInvoiceUrl: hostedUrl,
      paidAt: Date.now(),
    });
  } else {
    await ctx.runMutation(internal.invoices.create, {
      subscriptionId: convexSubscriptionId,
      stripeInvoiceId: invoiceId,
      invoiceNumber,
      stripeCustomerId: customerId,
      customerEmail: customerEmail ?? "",
      plan,
      amountCents: amountPaid ?? 0,
      status: "paid" as const,
      invoicePdfUrl: invoicePdf,
      hostedInvoiceUrl: hostedUrl,
      periodStart: periodStart ? periodStart * 1000 : undefined,
      periodEnd: periodEnd ? periodEnd * 1000 : undefined,
      paidAt: Date.now(),
    });
  }

  // Renewal receipt (only for real renewals; the 1st invoice is already covered
  // by the order confirmation email).
  if (billingReason === "subscription_cycle" && customerEmail) {
    await ctx.scheduler.runAfter(0, internal.email.send.sendRenewalReceipt, {
      toEmail: customerEmail,
      plan,
      amountCents: amountPaid ?? 0,
      invoiceUrl: hostedUrl ?? invoicePdf,
      periodStartMs: periodStart ? periodStart * 1000 : undefined,
      periodEndMs: periodEnd ? periodEnd * 1000 : undefined,
    });
  }
}

/* ── 3. invoice.payment_failed ── */

async function handleInvoiceFailed(
  ctx: { runQuery: typeof Function.prototype; runMutation: typeof Function.prototype; scheduler: { runAfter: typeof Function.prototype } },
  event: StripeEvent,
) {
  const invoice = event.data.object;
  const invoiceId = invoice.id as string;
  const subscriptionId = invoice.subscription as string | undefined;
  const customerId = invoice.customer as string;
  const customerEmail = invoice.customer_email as string;
  const amountDue = invoice.amount_due as number;
  const hostedUrl = invoice.hosted_invoice_url as string | undefined;
  const periodStart = invoice.period_start as number | undefined;
  const periodEnd = invoice.period_end as number | undefined;

  let convexSubscriptionId: Id<"subscriptions"> | undefined;
  let plan: "essentielle" | "premium" = "essentielle";

  if (subscriptionId) {
    const sub = await ctx.runQuery(
      internal.subscriptions.getByStripeSubscriptionId,
      { stripeSubscriptionId: subscriptionId },
    );
    if (sub) {
      convexSubscriptionId = sub._id;
      plan = sub.plan;
    }
  }

  const existingInvoice = await ctx.runQuery(
    internal.invoices.getByStripeInvoiceId,
    { stripeInvoiceId: invoiceId },
  );

  if (existingInvoice) {
    await ctx.runMutation(internal.invoices.updateStatus, {
      stripeInvoiceId: invoiceId,
      status: "open" as const,
    });
  } else {
    await ctx.runMutation(internal.invoices.create, {
      subscriptionId: convexSubscriptionId,
      stripeInvoiceId: invoiceId,
      stripeCustomerId: customerId,
      customerEmail: customerEmail ?? "",
      plan,
      amountCents: amountDue ?? 0,
      status: "open" as const,
      periodStart: periodStart ? periodStart * 1000 : undefined,
      periodEnd: periodEnd ? periodEnd * 1000 : undefined,
    });
  }

  // Dunning email to the customer: Stripe will retry the payment automatically.
  if (customerEmail) {
    await ctx.scheduler.runAfter(0, internal.email.send.sendPaymentFailed, {
      toEmail: customerEmail,
      amountCents: amountDue ?? 0,
      updateUrl: hostedUrl,
    });
  }

  console.log(`Invoice payment failed: ${invoiceId} (subscription: ${subscriptionId})`);
}

/* ── 4. customer.subscription.updated ── */

async function handleSubscriptionUpdated(
  ctx: { runMutation: typeof Function.prototype },
  event: StripeEvent,
) {
  const sub = event.data.object;
  const subscriptionId = sub.id as string;
  const status = sub.status as string;
  const currentPeriodStart = sub.current_period_start as number | undefined;
  const currentPeriodEnd = sub.current_period_end as number | undefined;

  const mappedStatus = mapSubscriptionStatus(status);

  await ctx.runMutation(internal.subscriptions.updateStatus, {
    stripeSubscriptionId: subscriptionId,
    status: mappedStatus,
    currentPeriodStart: currentPeriodStart
      ? currentPeriodStart * 1000
      : undefined,
    currentPeriodEnd: currentPeriodEnd ? currentPeriodEnd * 1000 : undefined,
  });

  console.log(`Subscription ${subscriptionId} updated: ${status}`);
}

/* ── 5. customer.subscription.deleted ── */

async function handleSubscriptionDeleted(
  ctx: { runMutation: typeof Function.prototype },
  event: StripeEvent,
) {
  const sub = event.data.object;
  const subscriptionId = sub.id as string;
  const canceledAt = sub.canceled_at as number | undefined;

  await ctx.runMutation(internal.subscriptions.updateStatus, {
    stripeSubscriptionId: subscriptionId,
    status: "canceled" as const,
    canceledAt: canceledAt ? canceledAt * 1000 : Date.now(),
  });

  console.log(`Subscription ${subscriptionId} canceled`);
}

/* ── 6. account.updated (Stripe Connect) ── */

async function handleAccountUpdated(
  ctx: { runQuery: typeof Function.prototype; runMutation: typeof Function.prototype },
  event: StripeEvent,
) {
  const account = event.data.object;
  const accountId = account.id as string;

  const affiliate = await ctx.runQuery(
    internal.affiliateUsers.getByStripeAccountId,
    { stripeConnectAccountId: accountId },
  );
  if (!affiliate) {
    console.log(`No affiliate found for Stripe account ${accountId}`);
    return;
  }

  const payoutsEnabled = account.payouts_enabled as boolean | undefined;
  const detailsSubmitted = account.details_submitted as boolean | undefined;
  const capabilities = account.capabilities as Record<string, string> | undefined;
  const transfersActive = capabilities?.transfers === "active";

  const isActive = payoutsEnabled === true && transfersActive;
  const newStatus = isActive
    ? "active"
    : detailsSubmitted
      ? "pending"
      : "not_started";

  if (newStatus !== affiliate.stripeConnectStatus) {
    await ctx.runMutation(internal.affiliateUsers.updateStripeConnectStatus, {
      affiliateUserId: affiliate._id,
      stripeConnectStatus: newStatus as "not_started" | "pending" | "active" | "disabled",
    });
    console.log(`Stripe Connect status updated for ${accountId}: ${newStatus}`);
  }
}

/* ── 7. charge.refunded / charge.dispute.created: commission clawback ──
   Full refund or chargeback: the sale is undone, so the referral commission
   is no longer owed (art. 4.3 of the contract). We mark the payment refunded
   + the order cancelled, then reverse or cancel the commission. Partial
   refund: ignored (handled manually). Dispute won afterwards: reinstated
   manually. */

async function handleChargeReversal(
  ctx: {
    runQuery: typeof Function.prototype;
    runMutation: typeof Function.prototype;
    runAction: typeof Function.prototype;
  },
  event: StripeEvent,
  reason: string,
) {
  const obj = event.data.object;

  // Partial refund: we do not claw the commission back automatically.
  if (event.type === "charge.refunded" && obj.refunded !== true) {
    console.log(
      `Remboursement partiel sur ${obj.id as string} — clawback ignoré (manuel)`,
    );
    return;
  }

  const paymentIntent = obj.payment_intent as string | undefined;
  if (!paymentIntent) {
    console.warn(`${event.type}: pas de payment_intent, ignoré`);
    return;
  }

  const payment = await ctx.runQuery(
    internal.payments.getByStripePaymentIntentId,
    { stripePaymentIntentId: paymentIntent },
  );
  if (!payment) {
    console.warn(`${event.type}: aucun paiement pour PI ${paymentIntent}`);
    return;
  }

  // Payment refunded + order cancelled (frees up a founder slot).
  await ctx.runMutation(internal.payments.updateStatus, {
    paymentId: payment._id,
    status: "refunded" as const,
  });
  await ctx.runMutation(internal.orders.updateStatus, {
    orderId: payment.orderId,
    status: "cancelled" as const,
  });

  // Reverse / cancel the referral commission where applicable.
  const referral = await ctx.runQuery(internal.referrals.getByOrderId, {
    orderId: payment.orderId,
  });
  if (referral && referral.status !== "cancelled") {
    await ctx.runAction(internal.stripeConnect.reverseReferralCommission, {
      referralId: referral._id,
      reason,
    });
  }

  console.log(
    `Clawback traité (${event.type}) pour la commande ${payment.orderId}`,
  );
}

/* ── Helper ── */

function mapSubscriptionStatus(
  stripeStatus: string,
): "active" | "past_due" | "canceled" | "unpaid" | "incomplete" {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "unpaid":
      return "unpaid";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    default:
      return "active";
  }
}

/* ── Subscription provisioning traceability (payment fix) ──
   Records the outcome of the maintenance subscription creation ON the order
   (`subscriptionStatus`) and, on failure, pushes an entry into the ops activity
   feed (saActivity kind:"system"): the team then SEES a sale that was collected
   but never provisioned and handles it by hand. Called by
   handleCheckoutCompleted (Stripe webhook), never 500 after collection. */
export const recordSubscriptionOutcome = internalMutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(v.literal("active"), v.literal("failed")),
    customerEmail: v.optional(v.string()),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, { subscriptionStatus: args.status });

    if (args.status === "failed") {
      await recordSaActivity(ctx, {
        kind: "system",
        action: "subscription_provisioning_failed",
        summary:
          `Vente encaissée mais abonnement maintenance NON créé (commande ${args.orderId})` +
          (args.detail ? ` — ${args.detail}` : "") +
          ". Abonnement/provisioning à créer manuellement.",
        customerEmail: args.customerEmail,
      });
    }
  },
});

/* ═══════════════════════════════════════════════
   Maintenance entitlement — GET /maintenance/status?key=…

   Asked by a client site's update scripts before they pull anything
   (apps/themes/scripts/lib/maintenance.mjs). Read-only, no side effect, and
   deliberately forgiving: an unknown key answers « unregistered » rather than
   an error, so the scripts can tell « we have no contract on file » apart from
   « the API is down » — the second must never block a client who pays.
   ═══════════════════════════════════════════════ */

http.route({
  path: "/maintenance/status",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const key = new URL(request.url).searchParams.get("key");

    const json = (body: Record<string, unknown>) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      });

    if (!key) {
      return json({
        found: false,
        entitled: true,
        reason: "unregistered",
        coveredUntil: null,
        message: entitlementMessage({
          entitled: true,
          reason: "unregistered",
          coveredUntil: null,
        }),
      });
    }

    const result = await ctx.runQuery(internal.maintenance.byLicenseKey, {
      licenseKey: key,
    });

    if (!result) {
      return json({
        found: false,
        entitled: true,
        reason: "unregistered",
        coveredUntil: null,
        message: entitlementMessage({
          entitled: true,
          reason: "unregistered",
          coveredUntil: null,
        }),
      });
    }

    return json({
      found: true,
      site: result.site,
      entitled: result.entitled,
      reason: result.reason,
      coveredUntil: result.coveredUntil,
      message: entitlementMessage(result),
    });
  }),
});

export default http;
