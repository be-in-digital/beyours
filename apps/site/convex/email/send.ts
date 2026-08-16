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
  orderConfirmationEmail,
  paymentFailedEmail,
  renewalReceiptEmail,
  type BuiltEmail,
} from "./templates";

// ── Runtime config ───────────────────────────────────────────────────────────

/** Public marketing site (absolute links + logo). */
function appUrl(): string {
  return (
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://beyours.fr"
  ).replace(/\/$/, "");
}

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
  return process.env.CALENDLY_URL ?? undefined;
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
