"use node";

/**
 * Email sending — multi-provider transport (SES by default, Resend optional).
 *
 * One internalAction per transactional/notification email. `deliver()` resolves
 * the active provider + sender (via EMAIL_PROVIDER) in ./providers, then sends
 * best-effort: a delivery failure is logged (with the provider used + reason)
 * and swallowed so it never breaks the caller (Stripe webhook, contact mutation,
 * cron). Templates and layout are pure and live in ./templates + ./layout.
 *
 * SES stays the default, so client instances are unaffected; the sales site can
 * be flipped to Resend (approved in days, DKIM) by setting EMAIL_PROVIDER=resend
 * + RESEND_API_KEY, without gating the launch on AWS SES production access.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { resolveEmailTransport } from "./providers";
import {
  affiliateCommissionEmail,
  affiliateWelcomeEmail,
  contactConfirmationEmail,
  contactTeamNotificationEmail,
  deploymentHealthEmail,
  orderConfirmationEmail,
  orderTeamNotificationEmail,
  paymentFailedEmail,
  renewalReceiptEmail,
  type BuiltEmail,
} from "./templates";
import { siteOrigin } from "../siteOrigin";

// ── Runtime config ───────────────────────────────────────────────────────────

/** Public marketing site (absolute links + logo). */
const appUrl = siteOrigin;

function logoUrl(): string {
  return `${appUrl()}/logo.png`;
}

/** Team inbox for internal notifications (leads, etc.). */
function teamEmail(): string | null {
  return (
    process.env.BID_NOTIFY_EMAIL ??
    process.env.CONTACT_EMAIL ??
    process.env.AWS_SES_FROM_EMAIL ??
    null
  );
}

function bookingUrl(): string | undefined {
  // BOOKING_URL is the name going forward. CALENDLY_URL is kept as a fallback
  // because it is the name currently set on the deployed Convex environment:
  // dropping it here would silently strip the booking link out of the
  // post-purchase emails until someone remembered to rename the deployed var.
  return process.env.BOOKING_URL ?? process.env.CALENDLY_URL ?? undefined;
}

/**
 * Best-effort send: resolve the provider (SES by default, Resend if
 * EMAIL_PROVIDER=resend), delegate the raw send, log the provider used and any
 * error. Signature unchanged so callers stay untouched — this NEVER throws.
 */
async function deliver(toEmail: string, email: BuiltEmail): Promise<{ sent: boolean }> {
  const transport = resolveEmailTransport();
  if (!transport.ok) {
    console.warn(
      `[email] "${email.subject}" non envoyé à ${toEmail} — ${transport.reason}`,
    );
    return { sent: false };
  }

  const { provider, from } = transport;
  try {
    const result = await provider.send({
      from,
      to: toEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    if (result.sent) {
      console.log(
        `[email] "${email.subject}" envoyé à ${toEmail} via ${provider.name}` +
          (result.id ? ` (id=${result.id})` : ""),
      );
      return { sent: true };
    }

    console.error(
      `[email] "${email.subject}" ÉCHEC vers ${toEmail} via ${provider.name}` +
        (result.error ? ` : ${result.error}` : ""),
    );
    return { sent: false };
  } catch (error) {
    // Backstop: deliver must NEVER throw (Stripe webhook / contact form / cron).
    console.error(
      `[email] "${email.subject}" exception vers ${toEmail} via ${provider.name}:`,
      error,
    );
    return { sent: false };
  }
}

const planArg = v.union(v.literal("essentielle"), v.literal("premium"));

// ── Transactional (client) ────────────────────────────────────────────────────

export const sendOrderConfirmation = internalAction({
  args: {
    toEmail: v.string(),
    firstName: v.string(),
    restaurantName: v.string(),
    plan: planArg,
    orderType: v.union(v.literal("creation"), v.literal("maintenance")),
    amountCents: v.number(),
    paymentMethod: v.optional(v.string()),
    isFounders: v.optional(v.boolean()),
    /* The id behind `/checkout/success?orderId=…` (#528). Optional so an
       older scheduled job, or a caller that does not have it, still sends. */
    orderId: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    return deliver(
      args.toEmail,
      orderConfirmationEmail({
        firstName: args.firstName,
        restaurantName: args.restaurantName,
        plan: args.plan,
        orderType: args.orderType,
        amountCents: args.amountCents,
        paymentMethod: args.paymentMethod,
        isFounders: args.isFounders,
        logoUrl: logoUrl(),
        bookingUrl: bookingUrl(),
        /* The one instruction `kickoff-gate.tsx` gives a buyer who lands on
           the success page without a valid id: « ouvrez le lien reçu par
           email ». Until this line there was no such link in any mail. */
        ...(args.orderId
          ? { orderUrl: `${appUrl()}/checkout/success?orderId=${encodeURIComponent(args.orderId)}` }
          : {}),
      }),
    );
  },
});

export const sendRenewalReceipt = internalAction({
  args: {
    toEmail: v.string(),
    plan: planArg,
    amountCents: v.number(),
    invoiceUrl: v.optional(v.string()),
    periodStartMs: v.optional(v.number()),
    periodEndMs: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    return deliver(
      args.toEmail,
      renewalReceiptEmail({
        plan: args.plan,
        amountCents: args.amountCents,
        invoiceUrl: args.invoiceUrl,
        periodStartMs: args.periodStartMs,
        periodEndMs: args.periodEndMs,
        logoUrl: logoUrl(),
      }),
    );
  },
});

export const sendPaymentFailed = internalAction({
  args: {
    toEmail: v.string(),
    amountCents: v.number(),
    updateUrl: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    return deliver(
      args.toEmail,
      paymentFailedEmail({
        amountCents: args.amountCents,
        updateUrl: args.updateUrl,
        logoUrl: logoUrl(),
      }),
    );
  },
});

// ── Contact (prospect + team) ─────────────────────────────────────────────────

export const sendContactConfirmation = internalAction({
  args: { toEmail: v.string(), firstName: v.string() },
  handler: async (_ctx, args) => {
    return deliver(
      args.toEmail,
      contactConfirmationEmail({
        firstName: args.firstName,
        logoUrl: logoUrl(),
        discoverUrl: `${appUrl()}/decouvrir`,
      }),
    );
  },
});

export const sendContactTeamNotification = internalAction({
  args: {
    name: v.string(),
    email: v.string(),
    restaurant: v.optional(v.string()),
    message: v.string(),
    submittedAtMs: v.number(),
  },
  handler: async (_ctx, args) => {
    const to = teamEmail();
    if (!to) {
      console.warn("[email] BID_NOTIFY_EMAIL non configuré — lead non notifié");
      return { sent: false };
    }
    return deliver(
      to,
      contactTeamNotificationEmail({
        name: args.name,
        email: args.email,
        restaurant: args.restaurant,
        message: args.message,
        submittedAtMs: args.submittedAtMs,
        logoUrl: logoUrl(),
      }),
    );
  },
});

/**
 * The sale nobody was told about (#528).
 *
 * `checkout.session.completed` scheduled exactly one send — the buyer's
 * confirmation — and that mail promises a call « sous 24h ». Nothing told
 * anybody here that there was a call to make: `BID_NOTIFY_EMAIL` served contact
 * leads and supervision alerts, and the one event the business exists for went
 * nowhere. The clock starts when the buyer pays, not when somebody next opens
 * the ops console, so a dashboard is not a substitute for this.
 *
 * Scheduled from INSIDE the webhook's `firstProcessing` branch, beside the
 * buyer's mail and under the same guard. Stripe redelivers, and a second
 * « nouvelle vente » for one order is how an internal alert stops being read.
 *
 * Best-effort like every other send here: `deliver` never throws, so a team
 * mail that fails cannot fail a webhook that has already taken the money.
 */
export const sendOrderTeamNotification = internalAction({
  args: {
    orderId: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    restaurantName: v.string(),
    city: v.optional(v.string()),
    plan: v.string(),
    orderType: v.string(),
    billingPeriod: v.optional(v.string()),
    amountCents: v.number(),
    paymentMethod: v.string(),
    isFounders: v.boolean(),
    paidAtMs: v.number(),
  },
  handler: async (_ctx, args) => {
    const to = teamEmail();
    if (!to) {
      console.warn("[email] BID_NOTIFY_EMAIL non configuré — vente non notifiée");
      return { sent: false };
    }
    return deliver(
      to,
      orderTeamNotificationEmail({
        orderId: args.orderId,
        firstName: args.firstName,
        lastName: args.lastName,
        email: args.email,
        ...(args.phone ? { phone: args.phone } : {}),
        restaurantName: args.restaurantName,
        ...(args.city ? { city: args.city } : {}),
        plan: args.plan,
        orderType: args.orderType,
        ...(args.billingPeriod ? { billingPeriod: args.billingPeriod } : {}),
        amountCents: args.amountCents,
        paymentMethod: args.paymentMethod,
        isFounders: args.isFounders,
        paidAtMs: args.paidAtMs,
        logoUrl: logoUrl(),
        consoleUrl: `${appUrl()}/admin/commandes`,
      }),
    );
  },
});

/**
 * The alert the availability prober never sent.
 *
 * `saMonitoring` has probed every client deployment every ten minutes since
 * #346 and, on a health transition, written one row to an internal activity
 * feed. Nothing more. A restaurant that went down at 20 h 00 on a Saturday
 * paged no one, while « Monitoring 24/7 » was on the pricing page and « la
 * supervision » is in the CGV's own definition of Maintenance (#366).
 *
 * Addressed to the team inbox, which is what `BID_NOTIFY_EMAIL` already is.
 * **A destination is not a rota**: an address makes the alert exist, and only a
 * named person on call makes « 24/7 » literally true. That half is not code and
 * is recorded in `tasks/sales-readiness-backlog.md`.
 *
 * Deliberately NOT sent to the restaurateur. The prober lives in this
 * deployment and the client's System screen lives in theirs, so telling a
 * client their own site is down is a cross-deployment channel that has to be
 * designed rather than bolted onto a `deliver()` call — and an e-mail from us
 * saying "your site is down" that arrives before we have looked at it is worse
 * than useful.
 */
export const sendDeploymentHealthAlert = internalAction({
  args: {
    restaurantName: v.string(),
    domain: v.string(),
    previousHealth: v.string(),
    health: v.string(),
    uptime30d: v.optional(v.number()),
    message: v.optional(v.string()),
    changedAtMs: v.number(),
  },
  handler: async (_ctx, args) => {
    const to = teamEmail();
    if (!to) {
      console.warn(
        "[email] BID_NOTIFY_EMAIL non configuré — alerte de supervision non envoyée",
      );
      return { sent: false };
    }
    return deliver(
      to,
      deploymentHealthEmail({
        restaurantName: args.restaurantName,
        domain: args.domain,
        previousHealth: args.previousHealth,
        health: args.health,
        ...(args.uptime30d !== undefined ? { uptime30d: args.uptime30d } : {}),
        ...(args.message ? { message: args.message } : {}),
        changedAtMs: args.changedAtMs,
        consoleUrl: `${appUrl()}/admin/monitoring`,
        logoUrl: logoUrl(),
      }),
    );
  },
});

// ── Referral programme / affiliates ───────────────────────────────────────────

export const sendAffiliateWelcome = internalAction({
  args: { toEmail: v.string(), firstName: v.string() },
  handler: async (_ctx, args) => {
    return deliver(
      args.toEmail,
      affiliateWelcomeEmail({
        firstName: args.firstName,
        logoUrl: logoUrl(),
        dashboardUrl: `${appUrl()}/parrainage/dashboard`,
      }),
    );
  },
});

export const sendAffiliateCommission = internalAction({
  args: {
    toEmail: v.string(),
    amountCents: v.number(),
    customerLabel: v.optional(v.string()),
    paid: v.boolean(),
  },
  handler: async (_ctx, args) => {
    return deliver(
      args.toEmail,
      affiliateCommissionEmail({
        amountCents: args.amountCents,
        customerLabel: args.customerLabel,
        paid: args.paid,
        logoUrl: logoUrl(),
        dashboardUrl: `${appUrl()}/parrainage/dashboard`,
      }),
    );
  },
});
