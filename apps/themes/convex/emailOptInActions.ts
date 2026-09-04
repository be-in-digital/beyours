"use node";

/**
 * The confirmation email — the half of the double opt-in that was missing.
 *
 * `create` and `importBatch` minted a token, stored it against the subscriber
 * with a 48-hour expiry, and stopped there. `GET /email/confirm` was
 * registered, `confirmDoubleOptIn` worked, and `startWelcome` was wired behind
 * it. None of that was reachable, because **no code anywhere built the URL or
 * sent it**: a storefront signup was written `pending`, and `pageForSending`
 * only ever offers `active`. Every organic subscriber the restaurant collected
 * was a row it could never mail — an opt-in list you cannot mail is not a list.
 *
 * This is transactional mail, not marketing, and the difference decides two
 * things below. It carries no `List-Unsubscribe`: offering to unsubscribe
 * someone from a subscription they have not yet confirmed is nonsense, and
 * RFC 8058 one-click applies to bulk senders. And it falls back to the
 * deployment's own sender when the owner has not configured email marketing
 * yet — a visitor who signs up on day one must still be confirmable.
 */

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

function createSESClient() {
  return new SESv2Client({
    region: process.env.AWS_REGION ?? "eu-west-3",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

const ESC_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * The restaurant's own name reaches this template from the database, where an
 * owner typed it. Interpolating it raw would put whatever they typed into the
 * markup of an email we send on their behalf.
 */
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESC_MAP[ch] ?? ch);
}

function buildConfirmationHtml(params: {
  storeName: string;
  confirmUrl: string;
}): string {
  const storeName = esc(params.storeName);
  // Not escaped with `esc`: the URL goes in an href, where `&quot;` would
  // corrupt it. It is built from CONVEX_SITE_URL and a UUID we minted, and the
  // token is encoded at the call site.
  const confirmUrl = params.confirmUrl;

  return `<!DOCTYPE html>
<html lang="fr">
  <head><meta charset="utf-8"></head>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1a1a1a;margin:0;padding:0;background:#f4f4f5;">
    <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
      <div style="background:#ffffff;border-radius:16px;padding:40px;">
        <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">Confirmez votre inscription</h1>
        <p style="margin:0 0 8px;font-size:15px;color:#3f3f46;">
          Vous avez demandé à recevoir les actualités de ${storeName}.
          Un dernier clic et c'est fait.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${confirmUrl}" style="display:inline-block;background:#0A412D;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:999px;">Confirmer mon inscription</a>
        </div>
        <p style="margin:0;font-size:13px;color:#71717a;">
          Ce lien est valable 48 heures. Si vous n'êtes pas à l'origine de cette
          demande, ignorez cet email : aucune inscription ne sera enregistrée.
        </p>
      </div>
      <p style="text-align:center;margin:20px 0 0;font-size:12px;color:#71717a;">${storeName}</p>
    </div>
  </body>
</html>`;
}

function buildConfirmationText(params: {
  storeName: string;
  confirmUrl: string;
}): string {
  return [
    `Vous avez demandé à recevoir les actualités de ${params.storeName}.`,
    "",
    "Confirmez votre inscription en ouvrant ce lien :",
    params.confirmUrl,
    "",
    "Ce lien est valable 48 heures. Si vous n'êtes pas à l'origine de cette",
    "demande, ignorez cet email : aucune inscription ne sera enregistrée.",
  ].join("\n");
}

/**
 * Send one subscriber the link that confirms their consent.
 *
 * Scheduled from the mutation that created them rather than awaited, for the
 * same reason `confirmDoubleOptIn` schedules the welcome sequence: SES being
 * slow or refusing is not a reason for the signup itself to fail in front of
 * the visitor.
 */
export const sendConfirmation = internalAction({
  args: { subscriberId: v.id("emailSubscribers") },
  handler: async (ctx, args): Promise<void> => {
    const subscriber = await ctx.runQuery(
      internal.emailSubscribers.getByIdInternal,
      { id: args.subscriberId }
    );
    if (!subscriber) return;

    // Both are ordinary, not errors: a `manual` subscriber is `active` with no
    // token by design, and a row confirmed between the schedule and the send
    // has had its token cleared. Neither should produce a second email.
    if (subscriber.status !== "pending" || !subscriber.doubleOptInToken) return;

    const siteUrl = process.env.CONVEX_SITE_URL ?? "";
    if (!siteUrl) {
      // The three existing senders fall back to `""` here, which yields
      // `/email/confirm?token=…` — a relative path, and an unclickable link in
      // every mail client. Sending that would burn the token on a message that
      // cannot work, and the 48-hour expiry would run out before anyone
      // noticed. Refusing leaves the row `pending` and the token usable once
      // the deployment is configured.
      throw new Error(
        "CONVEX_SITE_URL is not set — refusing to send a confirmation link that would be relative"
      );
    }

    const confirmUrl = `${siteUrl.replace(/\/$/, "")}/email/confirm?token=${encodeURIComponent(
      subscriber.doubleOptInToken
    )}`;

    const store = await ctx.runQuery(internal.stores.internalGetById, {
      id: subscriber.storeId,
    });
    const storeName = store?.name ?? "votre restaurant";

    // The marketing config when the owner has set one up, so the mail comes
    // from the restaurant; the deployment's own sender otherwise, because a
    // visitor who signs up before the owner opens the email screen still has
    // to be confirmable.
    const config = await ctx.runQuery(internal.emailConfig.getInternal, {
      storeId: subscriber.storeId,
    });
    // `||`, not `??`: `emailConfig.fromEmail` is a required `v.string()` that
    // `upsert` accepts empty, and `??` would hand SES "" rather than falling
    // back — defeating the sentence above this one.
    const fromEmail =
      config?.fromEmail || process.env.AWS_SES_FROM_EMAIL || "";
    if (!fromEmail) {
      throw new Error(
        "Neither the store's email config nor AWS_SES_FROM_EMAIL provides a sender address"
      );
    }
    const fromAddress = config?.senderName
      ? `${config.senderName} <${fromEmail}>`
      : fromEmail;

    // Omitted when unset: on a client's own AWS account a configuration set
    // named for ours does not exist, and naming a missing one makes SES reject
    // the send outright.
    const configurationSet = process.env.AWS_SES_CONFIGURATION_SET;

    await createSESClient().send(
      new SendEmailCommand({
        FromEmailAddress: fromAddress,
        Destination: { ToAddresses: [subscriber.email] },
        ReplyToAddresses: config?.replyToEmail ? [config.replyToEmail] : undefined,
        ...(configurationSet ? { ConfigurationSetName: configurationSet } : {}),
        Content: {
          Simple: {
            Subject: {
              Data: `Confirmez votre inscription — ${storeName}`,
              Charset: "UTF-8",
            },
            Body: {
              Html: {
                Data: buildConfirmationHtml({ storeName, confirmUrl }),
                Charset: "UTF-8",
              },
              Text: {
                Data: buildConfirmationText({ storeName, confirmUrl }),
                Charset: "UTF-8",
              },
            },
            Headers: [
              // The webhook correlates bounces by these. A confirmation that
              // hard-bounces is the clearest possible evidence the address is
              // dead, and `markBounced` now suppresses a `Permanent` one on the
              // first event — so a typo'd signup stops costing sends
              // immediately instead of after three.
              { Name: "X-Subscriber-Id", Value: String(subscriber._id) },
              { Name: "X-Store-Id", Value: String(subscriber.storeId) },
            ],
          },
        },
      })
    );
  },
});
