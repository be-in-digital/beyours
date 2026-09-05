import { httpRouter } from "convex/server";
import { v } from "convex/values";
import { httpAction, internalMutation, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { recordSaActivity } from "./saActivity";
import { entitlementMessage } from "./maintenance";
/* Type-only: erased at compile time, so the SDK never enters this module's
   bundle. `http.ts` runs in the default Convex runtime, not "use node". */
import type Stripe from "stripe";
import {
  invoicePlanHint,
  invoiceSubscriptionId,
  legacyShapeWarning,
  optionalText,
  refId,
  subscriptionPeriod,
  toMillis,
} from "./stripeWebhookFacts";

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

/* ── What a handler may do ──
   These parameters used to be typed `{ runQuery: typeof Function.prototype; … }`.
   `Function.prototype` is `Function`, so every runQuery/runMutation/scheduler
   call was unchecked in BOTH directions — the value read back AND the payload
   written. That is half of why a webhook could read three fields that no
   longer exist and still type-check. The generated ctx is the real thing;
   the Pick is kept because it documents what each handler touches. */
type WebhookCtx = Pick<
  ActionCtx,
  "runQuery" | "runMutation" | "runAction" | "scheduler"
>;

/**
 * Stripe splits webhooks into two scopes, and an endpoint belongs to exactly
 * one. Events about OUR account (a customer paying us) arrive on an
 * account-scoped endpoint; events about CONNECTED accounts — our affiliates,
 * who are `express` accounts — arrive only on a Connect-scoped one
 * (`connect: true` at creation). See https://docs.stripe.com/connect/webhooks.
 *
 * Each endpoint signs with its own secret, so one route cannot serve both: the
 * signature of the other scope would never verify. Hence two routes sharing one
 * body, each reading the secret of the endpoint that feeds it.
 */
const stripeWebhookHandler = (secretEnvVar: string) =>
  httpAction(async (ctx, req) => {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    const webhookSecret = process.env[secretEnvVar];
    if (!webhookSecret) {
      console.error(`${secretEnvVar} not configured`);
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // Signature verification
    const valid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!valid) {
      return new Response("Invalid signature", { status: 400 });
    }

    /* `Stripe.Event` is the SDK's own discriminated union on `type`, so each
       `case` below narrows `data.object` to the right object and a field that
       moved between API versions is a compile error rather than `undefined` at
       runtime.

       This asserts the shape of what STRIPE SENT, which is rendered at the API
       version set on the webhook endpoint in the dashboard — independent of
       the SDK's pin, and not something this code can verify. `event.api_version`
       is the ground truth; where the two can disagree, ./stripeWebhookFacts
       reads both shapes and says so loudly. */
    const event = JSON.parse(body) as Stripe.Event;

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
        /* A delayed payment method (Klarna, Alma) completes the session BEFORE
           the money arrives, then settles or fails asynchronously — sometimes
           days later. Neither of these was handled, so a Klarna sale that
           later succeeded was never settled at all, and one that failed left
           an order marked « paid ». Both were required by
           tasks/web/referral-program-design.md. */
        case "checkout.session.async_payment_succeeded":
          await handleCheckoutCompleted(ctx, event);
          break;
        case "checkout.session.async_payment_failed":
          await handleCheckoutFailed(ctx, event);
          break;
        case "checkout.session.expired":
          await handleCheckoutExpired(ctx, event);
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
        case "account.application.deauthorized":
          await handleAccountDeauthorized(ctx, event);
          break;
        case "payout.failed":
          await handlePayoutFailed(ctx, event);
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
  });

/** Our own account: payments, subscriptions, disputes. */
http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: stripeWebhookHandler("STRIPE_WEBHOOK_SECRET"),
});

/** Connected accounts: the affiliates' `express` accounts. */
http.route({
  path: "/webhooks/stripe-connect",
  method: "POST",
  handler: stripeWebhookHandler("STRIPE_CONNECT_WEBHOOK_SECRET"),
});

/* ── 1. checkout.session.completed ── */

/**
 * A session settles an order only when Stripe says the money arrived.
 *
 * Serves `checkout.session.completed` AND
 * `checkout.session.async_payment_succeeded`: for an immediate method the
 * first carries `payment_status: "paid"` and settles; for a delayed one
 * (Klarna, Alma) the first carries `"unpaid"` and settles nothing, and the
 * second arrives when the money actually lands.
 */
async function handleCheckoutCompleted(
  ctx: WebhookCtx,
  event:
    | Stripe.CheckoutSessionCompletedEvent
    | Stripe.CheckoutSessionAsyncPaymentSucceededEvent,
): Promise<void> {
  const session = event.data.object;
  const sessionId = session.id;

  /* ── The money question, asked before anything is settled ──
     `payment_status` was read NOWHERE. A session completed with
     « unpaid » — which is exactly what Klarna and Alma produce, and both are
     offered at checkout — marked the order paid, sent the confirmation, wrote
     a payment row, created the maintenance subscription and consumed a
     founders slot. Nothing later corrected it: there was no handler for the
     async events that say how it ended.

     `no_payment_required` is a legitimately settled session (a 100 % coupon),
     so it settles like « paid ». Anything else waits. */
  if (
    session.payment_status !== "paid" &&
    session.payment_status !== "no_payment_required"
  ) {
    console.log(
      `[STRIPE] Session ${sessionId} complétée mais payment_status=` +
        `« ${session.payment_status} » — commande laissée en attente ` +
        `jusqu'à checkout.session.async_payment_succeeded.`,
    );
    return;
  }
  /* `customer` is `string | Customer | DeletedCustomer | null`: narrowed, not
     cast, because an expanded object would otherwise be stringified into the
     id column. Same for `payment_intent` below. */
  const customerId = refId(session.customer);
  const customerEmail =
    optionalText(session.customer_details?.email) ??
    optionalText(session.customer_email);
  const metadata = session.metadata ?? undefined;

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
  const paymentMethodTypes = session.payment_method_types;
  let pmt: string = "card";
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
      amountCents: session.amount_total ?? order.amountCents,
      paymentMethod,
      isFounders: order.isFounders ?? false,
    });
  }

  // Create the payment — idempotent through the payment_intent (an existence
  // guard independent of the status: it still closes the payment row when a
  // replay follows a partial failure of the first pass).
  const paymentIntent = refId(session.payment_intent);
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
        amountCents: session.amount_total ?? 0,
        paymentMethod: pmt,
      });
    }
  }

  // ── Maintenance subscription (recurring billing) ──
  // Idempotent: the subscription is only created when none exists yet for this
  // order (a replay does not duplicate it). This check is the cheap first line
  // and nothing more — it reads in its own transaction, so two deliveries
  // racing each other both pass it; the guard that holds is the one inside
  // subscriptions.create, where the write happens.
  // Wrapped in a try/catch: a failure
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
    /* ── The referrer must own the code ──
       Both values are written by `createCheckoutSession`, which now derives
       them from the code the customer typed — so they agree by construction.
       This re-checks it because a Stripe session stays payable for up to 24 h:
       any session opened before that action stopped accepting a caller-chosen
       `referrerId` still carries one, and paying it out is the commission half
       of the same forgery. Cheap, and it fails closed. */
    const codeOwner = await ctx.runQuery(internal.referralCodes.ownerOf, {
      referralCodeId: metadata.referralCodeId as Id<"referralCodes">,
    });
    if (codeOwner === null || codeOwner !== metadata.referrerId) {
      console.error(
        `[REFERRAL] Session ${sessionId} : le code ${metadata.referralCodeId} ` +
          `n'appartient pas à l'apporteur ${metadata.referrerId} ` +
          `(propriétaire réel : ${codeOwner ?? "aucun"}) — commission refusée.`,
      );
      return;
    }

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

/* ── 1b. checkout.session.async_payment_failed / .expired ── */

/**
 * The order behind a session, or `null` with the reason logged.
 *
 * Shared by the two terminal handlers below, which both only ever need to
 * move a status.
 */
async function orderForSession(
  ctx: Pick<WebhookCtx, "runQuery">,
  sessionId: string,
  eventType: string,
): Promise<Doc<"orders"> | null> {
  const order = await ctx.runQuery(internal.orders.getByStripeSessionId, {
    stripeSessionId: sessionId,
  });
  if (!order) {
    console.error(`${eventType}: aucune commande pour la session ${sessionId}`);
    return null;
  }
  return order;
}

/**
 * A delayed payment bounced. The order never was paid, and must not look it.
 *
 * Only ever moves a PENDING order: a session that failed after the order was
 * settled by another event is not this handler's to undo — a refund or a
 * dispute is (see handleChargeReversal), and those carry the money detail this
 * one does not have.
 */
async function handleCheckoutFailed(
  ctx: Pick<WebhookCtx, "runQuery" | "runMutation">,
  event: Stripe.CheckoutSessionAsyncPaymentFailedEvent,
): Promise<void> {
  const session = event.data.object;
  const order = await orderForSession(ctx, session.id, event.type);
  if (!order) return;

  if (order.status !== "pending") {
    console.log(
      `[STRIPE] Paiement différé échoué sur la session ${session.id} mais la ` +
        `commande ${order._id} est « ${order.status} » — laissée telle quelle.`,
    );
    return;
  }

  await ctx.runMutation(internal.orders.updateStatus, {
    orderId: order._id,
    status: "failed" as const,
  });
  console.log(
    `[STRIPE] Paiement différé échoué : commande ${order._id} marquée « failed ».`,
  );
}

/**
 * The customer never paid and the session can no longer be paid.
 *
 * Cancelling the order is what releases the founders slot it was holding:
 * `countFoundersSold` counts pending orders, so without this the seat stayed
 * held for the full FOUNDERS_HOLD_MS window after the session had already
 * become unpayable.
 */
async function handleCheckoutExpired(
  ctx: Pick<WebhookCtx, "runQuery" | "runMutation">,
  event: Stripe.CheckoutSessionExpiredEvent,
): Promise<void> {
  const session = event.data.object;
  const order = await orderForSession(ctx, session.id, event.type);
  if (!order) return;

  if (order.status !== "pending") {
    // A session can expire after being paid through another route; that order
    // is not ours to cancel.
    return;
  }

  await ctx.runMutation(internal.orders.updateStatus, {
    orderId: order._id,
    status: "cancelled" as const,
  });
  console.log(
    `[STRIPE] Session ${session.id} expirée : commande ${order._id} annulée ` +
      `(place fondateurs libérée le cas échéant).`,
  );
}

/* ── 2. invoice.payment_succeeded ── */

async function handleInvoiceSucceeded(
  ctx: WebhookCtx,
  event: Stripe.InvoicePaymentSucceededEvent,
): Promise<void> {
  const invoice = event.data.object;
  const invoiceId = invoice.id;
  const invoiceNumber = optionalText(invoice.number);
  const subscriptionRef = invoiceSubscriptionId(invoice);
  if (subscriptionRef.legacy) {
    console.error(
      legacyShapeWarning(`Facture ${invoiceId}`, event.api_version),
    );
  }
  const subscriptionId = subscriptionRef.id;
  const customerId = refId(invoice.customer);
  const customerEmail = optionalText(invoice.customer_email);
  const amountPaid = invoice.amount_paid;
  const invoicePdf = optionalText(invoice.invoice_pdf);
  const hostedUrl = optionalText(invoice.hosted_invoice_url);
  const periodStart = invoice.period_start;
  const periodEnd = invoice.period_end;
  // "subscription_create" = the 1st invoice (already covered by the order
  // confirmation); "subscription_cycle" = a real renewal → dedicated receipt.
  const billingReason = invoice.billing_reason;

  /* ── Which plan this renewal is for ──
     The Convex row is authoritative; the metadata Stripe snapshots onto the
     invoice is the second source. The `essentielle` literal is only reached
     when neither is available, and it is loud when it is: that silent default
     is what booked and receipted a Premium client's 2 400 € renewal as an
     Essentielle one for as long as the subscription id was unreadable. */
  let convexSubscriptionId: Id<"subscriptions"> | undefined;
  let plan: "essentielle" | "premium" | undefined;

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
  if (plan === undefined) {
    plan = invoicePlanHint(invoice);
  }
  if (plan === undefined) {
    console.error(
      `[STRIPE] Facture ${invoiceId} sans abonnement identifiable ` +
        `(subscription=${subscriptionId ?? "absent"}) : plan inconnu, ` +
        `enregistrée en « essentielle » par défaut — à vérifier avant tout ` +
        `envoi de reçu ou calcul de revenu.`,
    );
    plan = "essentielle";
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
      /* Both fall back to "" rather than being passed through as undefined:
         Stripe returns `null` where these validators want the key absent, and
         `v.string()` rejects both — which made the mutation throw, the handler
         answer 500, and Stripe retry the event forever. Neither column is an
         index; an invoice with a blank customer handle is recoverable, a
         renewal never recorded is not. */
      stripeCustomerId: customerId ?? "",
      customerEmail: customerEmail ?? "",
      plan,
      amountCents: amountPaid ?? 0,
      status: "paid" as const,
      invoicePdfUrl: invoicePdf,
      hostedInvoiceUrl: hostedUrl,
      periodStart: toMillis(periodStart),
      periodEnd: toMillis(periodEnd),
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
      periodStartMs: toMillis(periodStart),
      periodEndMs: toMillis(periodEnd),
    });
  }
}

/* ── 3. invoice.payment_failed ── */

async function handleInvoiceFailed(
  ctx: WebhookCtx,
  event: Stripe.InvoicePaymentFailedEvent,
): Promise<void> {
  const invoice = event.data.object;
  const invoiceId = invoice.id;
  const subscriptionRef = invoiceSubscriptionId(invoice);
  if (subscriptionRef.legacy) {
    console.error(
      legacyShapeWarning(`Facture ${invoiceId}`, event.api_version),
    );
  }
  const subscriptionId = subscriptionRef.id;
  const customerId = refId(invoice.customer);
  const customerEmail = optionalText(invoice.customer_email);
  const amountDue = invoice.amount_due;
  const hostedUrl = optionalText(invoice.hosted_invoice_url);
  const periodStart = invoice.period_start;
  const periodEnd = invoice.period_end;

  // Same resolution order as the succeeded path — a dunning email naming the
  // wrong plan is the same mis-statement as a receipt naming it.
  let convexSubscriptionId: Id<"subscriptions"> | undefined;
  let plan: "essentielle" | "premium" | undefined;

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
  plan ??= invoicePlanHint(invoice) ?? "essentielle";

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
      /* Both fall back to "" rather than being passed through as undefined:
         Stripe returns `null` where these validators want the key absent, and
         `v.string()` rejects both — which made the mutation throw, the handler
         answer 500, and Stripe retry the event forever. Neither column is an
         index; an invoice with a blank customer handle is recoverable, a
         renewal never recorded is not. */
      stripeCustomerId: customerId ?? "",
      customerEmail: customerEmail ?? "",
      plan,
      amountCents: amountDue ?? 0,
      status: "open" as const,
      periodStart: toMillis(periodStart),
      periodEnd: toMillis(periodEnd),
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
  ctx: Pick<WebhookCtx, "runMutation">,
  event: Stripe.CustomerSubscriptionUpdatedEvent,
): Promise<void> {
  const sub = event.data.object;
  const subscriptionId = sub.id;
  const status = sub.status;

  /* The period lives on the ITEMS on this API version. Reading it off the
     subscription returned `undefined` on every renewal, so `coveredUntil`
     never advanced and /maintenance/status told a paying client their
     maintenance had expired a year ago. */
  const period = subscriptionPeriod(sub);
  if (period.legacy) {
    console.error(
      legacyShapeWarning(`Abonnement ${subscriptionId}`, event.api_version),
    );
  }
  if (period.start === undefined && period.end === undefined) {
    /* Nothing is written rather than a zero: `updateStatus` patches only the
       fields it is given, so the last known-good period survives. A `0` would
       expire a client who is paying. */
    console.error(
      `[STRIPE] Abonnement ${subscriptionId} mis à jour sans période ` +
        `facturable (items.data vide) : période inchangée en base.`,
    );
  }

  const mappedStatus = mapSubscriptionStatus(status);

  await ctx.runMutation(internal.subscriptions.updateStatus, {
    stripeSubscriptionId: subscriptionId,
    status: mappedStatus,
    currentPeriodStart: toMillis(period.start),
    currentPeriodEnd: toMillis(period.end),
  });

  console.log(`Subscription ${subscriptionId} updated: ${status}`);
}

/* ── 5. customer.subscription.deleted ── */

async function handleSubscriptionDeleted(
  ctx: Pick<WebhookCtx, "runMutation">,
  event: Stripe.CustomerSubscriptionDeletedEvent,
): Promise<void> {
  const sub = event.data.object;
  const subscriptionId = sub.id;
  const canceledAt = sub.canceled_at;

  await ctx.runMutation(internal.subscriptions.updateStatus, {
    stripeSubscriptionId: subscriptionId,
    status: "canceled" as const,
    canceledAt: toMillis(canceledAt) ?? Date.now(),
  });

  console.log(`Subscription ${subscriptionId} canceled`);
}

/* ── 6. account.updated (Stripe Connect) ── */

async function handleAccountUpdated(
  ctx: Pick<WebhookCtx, "runQuery" | "runMutation">,
  event: Stripe.AccountUpdatedEvent,
): Promise<void> {
  const account = event.data.object;
  const accountId = account.id;

  const affiliate = await ctx.runQuery(
    internal.affiliateUsers.getByStripeAccountId,
    { stripeConnectAccountId: accountId },
  );
  if (!affiliate) {
    console.log(`No affiliate found for Stripe account ${accountId}`);
    return;
  }

  const payoutsEnabled = account.payouts_enabled;
  const detailsSubmitted = account.details_submitted;
  // `capabilities.transfers` is a real literal union on the SDK type, so this
  // comparison is now checked rather than a string against a cast record.
  const transfersActive = account.capabilities?.transfers === "active";

  const isActive = payoutsEnabled === true && transfersActive;
  const newStatus = isActive
    ? "active"
    : detailsSubmitted
      ? "pending"
      : "not_started";

  if (newStatus !== affiliate.stripeConnectStatus) {
    await ctx.runMutation(internal.affiliateUsers.updateStripeConnectStatus, {
      affiliateUserId: affiliate._id,
      stripeConnectStatus: newStatus,
    });
    console.log(`Stripe Connect status updated for ${accountId}: ${newStatus}`);
  }
}

/* ── 6b. account.application.deauthorized (Stripe Connect) ── */

/**
 * The affiliate disconnected their Stripe account from our platform. We keep the
 * row — their history and unpaid commissions matter — but nothing can be paid
 * out any more, so the gate `referrals.ts` reads has to close.
 */
async function handleAccountDeauthorized(
  ctx: Pick<WebhookCtx, "runQuery" | "runMutation">,
  event: Stripe.AccountApplicationDeauthorizedEvent,
): Promise<void> {
  // On Connect events the account id is top-level; `data.object` is the
  // application that was deauthorized, not the account.
  const accountId = event.account;
  if (!accountId) {
    console.error("account.application.deauthorized carried no account id");
    return;
  }

  const affiliate = await ctx.runQuery(
    internal.affiliateUsers.getByStripeAccountId,
    { stripeConnectAccountId: accountId },
  );
  if (!affiliate) {
    console.log(`No affiliate found for Stripe account ${accountId}`);
    return;
  }

  if (affiliate.stripeConnectStatus !== "disabled") {
    await ctx.runMutation(internal.affiliateUsers.updateStripeConnectStatus, {
      affiliateUserId: affiliate._id,
      stripeConnectStatus: "disabled",
    });
    console.log(`Affiliate ${accountId} deauthorized the platform: disabled`);
  }
}

/* ── 6c. payout.failed (Stripe Connect) ── */

/**
 * A payout to the affiliate bounced. Stripe disables the external account it
 * used, and no payout — automatic or manual — can go through until the
 * affiliate fixes their bank details. Paying again before that just fails
 * again, so close the gate rather than retrying into a wall.
 */
async function handlePayoutFailed(
  ctx: Pick<WebhookCtx, "runQuery" | "runMutation">,
  event: Stripe.PayoutFailedEvent,
): Promise<void> {
  const accountId = event.account;
  if (!accountId) {
    console.error("payout.failed carried no account id");
    return;
  }

  const affiliate = await ctx.runQuery(
    internal.affiliateUsers.getByStripeAccountId,
    { stripeConnectAccountId: accountId },
  );
  if (!affiliate) {
    console.log(`No affiliate found for Stripe account ${accountId}`);
    return;
  }

  const payout = event.data.object;
  console.error(
    `Payout ${payout.id} failed for affiliate ${accountId}: ` +
      `${payout.failure_message ?? payout.failure_code ?? "no reason given"}`,
  );

  if (affiliate.stripeConnectStatus !== "disabled") {
    await ctx.runMutation(internal.affiliateUsers.updateStripeConnectStatus, {
      affiliateUserId: affiliate._id,
      stripeConnectStatus: "disabled",
    });
  }
}

/* ── 7. charge.refunded / charge.dispute.created: commission clawback ──
   Full refund or chargeback: the sale is undone, so the referral commission
   is no longer owed (art. 4.3 of the contract). We mark the payment refunded
   + the order cancelled, then reverse or cancel the commission. Partial
   refund: ignored (handled manually). Dispute won afterwards: reinstated
   manually. */

async function handleChargeReversal(
  ctx: Pick<WebhookCtx, "runQuery" | "runMutation" | "runAction">,
  event: Stripe.ChargeRefundedEvent | Stripe.ChargeDisputeCreatedEvent,
  reason: string,
): Promise<void> {
  /* Partial refund: we do not claw the commission back automatically.
     `refunded` exists on a Charge and not on a Dispute, so this read only
     compiles inside the narrow — which is exactly what it meant all along,
     and was unenforced while the object was a bare record. */
  if (event.type === "charge.refunded" && event.data.object.refunded !== true) {
    console.log(
      `Remboursement partiel sur ${event.data.object.id} — clawback ignoré (manuel)`,
    );
    return;
  }

  const obj = event.data.object;
  const paymentIntent = refId(obj.payment_intent);
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
  stripeStatus: Stripe.Subscription.Status,
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
