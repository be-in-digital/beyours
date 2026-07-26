import { httpRouter } from "convex/server";
import { v } from "convex/values";
import { httpAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { recordSaActivity } from "./saActivity";

const http = httpRouter();

// Convex Auth HTTP routes
auth.addHttpRoutes(http);

/* ═══════════════════════════════════════════════
   Webhook Stripe — 5 événements gérés :
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

  // Vérifier que le timestamp n'est pas trop vieux (5 minutes)
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

// Type souple pour les événements Stripe
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

    // Vérification signature
    const valid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!valid) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event: StripeEvent = JSON.parse(body);

    // Idempotence — si déjà processed, skip. Si existe mais pas processed, on re-tente.
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

  // Retrouver la commande
  const order = await ctx.runQuery(
    internal.orders.getByStripeSessionId,
    { stripeSessionId: sessionId },
  );
  if (!order) {
    console.error(`No order found for session ${sessionId}`);
    return;
  }

  // ── Idempotence de l'encaissement (fix paiement) ──
  // La transition pending→paid de la commande est notre clé d'idempotence pour
  // les effets NON idempotents par nature (email de confirmation). Un rejeu du
  // webhook Stripe (redelivery, ou 2ᵉ tentative après une erreur) retrouve la
  // commande déjà « paid » et NE réémet donc PAS l'email. Les autres effets
  // (ligne de paiement, abonnement) ont chacun leur propre garde d'existence.
  const firstProcessing = order.status !== "paid";

  // Méthode de paiement — payment_method_types contient les méthodes autorisées, pas celle utilisée.
  // On utilise payment_method_collection ou on infère : si une seule méthode autorisée, c'est celle-là.
  // Sinon, on regarde si Stripe indique la méthode dans les charges (non disponible dans session seule).
  const paymentMethodTypes = session.payment_method_types as string[] | undefined;
  let pmt = "card";
  if (paymentMethodTypes && paymentMethodTypes.length === 1) {
    pmt = paymentMethodTypes[0]!;
  }
  const paymentMethod = pmt === "alma" ? "alma" : pmt === "klarna" ? "klarna" : "card";

  // Effets à-envoyer-une-seule-fois, gardés par la transition pending→paid.
  // On flippe le statut EN PREMIER (clé d'idempotence), puis on programme
  // l'email : un rejeu ne repassera jamais ici (statut déjà « paid »).
  if (firstProcessing) {
    // Mettre à jour la commande (pending → paid)
    await ctx.runMutation(internal.orders.updateStatus, {
      orderId: order._id,
      status: "paid" as const,
      paymentMethod: paymentMethod as "card" | "alma" | "klarna",
    });

    // Email de confirmation au client (best-effort, ne bloque jamais le webhook).
    // amount_total = montant réellement débité (TTC si la TVA est active, sinon HT),
    // toujours juste, contrairement au montant HT stocké sur la commande.
    // Envoyé UNE seule fois (garde firstProcessing) — pas à chaque retry Stripe.
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

  // Créer le paiement — idempotent via le payment_intent (garde d'existence
  // indépendante du statut : referme la ligne de paiement même si un rejeu
  // survient après une panne partielle du 1er passage).
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

  // ── Abonnement maintenance (facturation récurrente) ──
  // Idempotent : on ne crée l'abonnement que s'il n'en existe pas déjà pour
  // cette commande (un rejeu ne double pas l'abonnement). Encapsulé dans un
  // try/catch : un échec APRÈS l'encaissement (ex. Price ID live absent) ne
  // doit PAS renvoyer 500 — sinon Stripe rejoue l'event en boucle et empile les
  // effets. On enregistre l'échec sur la commande + dans le flux d'activité ops,
  // puis on renvoie 200. Un rejeu ultérieur retentera (garde d'existence).
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
        });
        await ctx.runMutation(internal.http.recordSubscriptionOutcome, {
          orderId: order._id,
          status: "active" as const,
        });
      } catch (err) {
        // Le paiement est déjà encaissé : on N'ÉCHOUE PAS le webhook (pas de
        // 500 → pas de boucle de rejeu Stripe). On trace l'échec pour que
        // l'ops le VOIE et provisionne l'abonnement manuellement.
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

  // Créer le referral si applicable (idempotent sur orderId)
  if (metadata?.referralCodeId && metadata?.referrerId) {
    // Garde anti-auto-parrainage côté serveur (invariant, indépendant du front).
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
  const subscriptionId = invoice.subscription as string | undefined;
  const customerId = invoice.customer as string;
  const customerEmail = invoice.customer_email as string;
  const amountPaid = invoice.amount_paid as number;
  const invoicePdf = invoice.invoice_pdf as string | undefined;
  const hostedUrl = invoice.hosted_invoice_url as string | undefined;
  const periodStart = invoice.period_start as number | undefined;
  const periodEnd = invoice.period_end as number | undefined;
  // "subscription_create" = 1ʳᵉ facture (déjà couverte par la confirmation de
  // commande) ; "subscription_cycle" = vrai renouvellement → reçu dédié.
  const billingReason = invoice.billing_reason as string | undefined;

  // Trouver la subscription Convex (si liée)
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

  // Vérifier si la facture existe déjà
  const existingInvoice = await ctx.runQuery(
    internal.invoices.getByStripeInvoiceId,
    { stripeInvoiceId: invoiceId },
  );

  if (existingInvoice) {
    await ctx.runMutation(internal.invoices.updateStatus, {
      stripeInvoiceId: invoiceId,
      status: "paid" as const,
      invoicePdfUrl: invoicePdf,
      hostedInvoiceUrl: hostedUrl,
      paidAt: Date.now(),
    });
  } else {
    await ctx.runMutation(internal.invoices.create, {
      subscriptionId: convexSubscriptionId,
      stripeInvoiceId: invoiceId,
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

  // Reçu de renouvellement (seulement pour les vrais renouvellements ; la 1ʳᵉ
  // facture est déjà couverte par l'email de confirmation de commande).
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

  // Relance de paiement au client (dunning) : Stripe retentera automatiquement.
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

/* ── 7. charge.refunded / charge.dispute.created : clawback commission ──
   Remboursement complet ou rétrofacturation : la vente est défaite, la
   commission d'apport n'est plus due (art. 4.3 du contrat). On marque le
   paiement remboursé + la commande annulée, puis on reprend ou annule la
   commission. Remboursement partiel : ignoré (traitement manuel). Litige
   gagné après coup : réintégration manuelle. */

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

  // Remboursement partiel : on ne reprend pas la commission automatiquement.
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

  // Paiement remboursé + commande annulée (libère un slot fondateur).
  await ctx.runMutation(internal.payments.updateStatus, {
    paymentId: payment._id,
    status: "refunded" as const,
  });
  await ctx.runMutation(internal.orders.updateStatus, {
    orderId: payment.orderId,
    status: "cancelled" as const,
  });

  // Reprise / annulation de la commission d'apport le cas échéant.
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

/* ── Traçabilité du provisioning d'abonnement (fix paiement) ──
   Enregistre l'issue de la création de l'abonnement maintenance SUR la commande
   (`subscriptionStatus`) et, en cas d'échec, pousse une entrée dans le flux
   d'activité ops (saActivity kind:"system") : l'équipe VOIT ainsi une vente
   encaissée mais non provisionnée et la traite manuellement. Appelée par
   handleCheckoutCompleted (webhook Stripe), jamais 500 après encaissement. */
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

export default http;
