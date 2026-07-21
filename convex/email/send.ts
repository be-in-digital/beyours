"use node";

/**
 * Email sending — AWS SES (SESv2).
 *
 * One internalAction per transactional/notification email. Every send is
 * best-effort: a delivery failure is logged and swallowed so it never breaks
 * the caller (Stripe webhook, contact mutation, cron). Templates and layout
 * are pure and live in ./templates + ./layout.
 */

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
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
    "https://restaurant.beindigital.fr"
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

async function deliver(toEmail: string, email: BuiltEmail): Promise<{ sent: boolean }> {
  const region = process.env.AWS_REGION ?? "eu-west-3";
  const fromEmail = process.env.AWS_SES_FROM_EMAIL;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!fromEmail || !accessKeyId || !secretAccessKey) {
    console.warn(
      `[email] SES non configuré (AWS_SES_FROM_EMAIL / clés manquantes) — email "${email.subject}" non envoyé à ${toEmail}`,
    );
    return { sent: false };
  }

  const client = new SESv2Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: fromEmail,
        Destination: { ToAddresses: [toEmail] },
        Content: {
          Simple: {
            Subject: { Data: email.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: email.html, Charset: "UTF-8" },
              Text: { Data: email.text, Charset: "UTF-8" },
            },
          },
        },
      }),
    );
    return { sent: true };
  } catch (error) {
    console.error(`[email] Échec envoi "${email.subject}" à ${toEmail}:`, error);
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

// ── Parrainage / affiliés ──────────────────────────────────────────────────────

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
