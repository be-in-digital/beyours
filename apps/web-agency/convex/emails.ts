import { v } from "convex/values";

import { internalAction } from "./_generated/server";

/**
 * sendContactEmail — internalAction qui envoie l'email de notification
 * "nouveau contact agence" via Resend (https://resend.com).
 *
 * Pourquoi un internalAction et pas une mutation :
 *   les mutations Convex sont sandboxées en V8 et ne peuvent pas faire
 *   d'appel réseau sortant. Les actions, oui. On utilise `fetch` direct
 *   plutôt que le SDK `resend` pour rester en V8 runtime (pas de "use node").
 *
 * Trigger : la mutation `submitContact` dans contactForms.ts schedule cette
 * action immédiatement après insertion en DB (sauf si honeypot triggered).
 *
 * Configuration nécessaire :
 *   - Compte Resend, domaine `beindigital.fr` vérifié (DNS)
 *   - Variable env Convex : `RESEND_API_KEY`
 *     → `pnpx convex env set RESEND_API_KEY re_...`
 *   - Variables optionnelles :
 *     `BID_CONTACT_TO`   — destinataire (default: hello@beindigital.fr)
 *     `BID_CONTACT_FROM` — expéditeur (default: Be in Digital <hello@beindigital.fr>)
 */
const DEFAULT_TO = "hello@beindigital.fr";
const DEFAULT_FROM = "Be in Digital <hello@beindigital.fr>";

export const sendContactEmail = internalAction({
  args: {
    name: v.string(),
    email: v.string(),
    message: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // En dev / sans clé, on log et on passe — la submission est déjà
      // persistée en DB de toute façon.
      console.warn(
        "[emails] RESEND_API_KEY manquante — l'email ne sera pas envoyé.",
      );
      return;
    }

    const to = process.env.BID_CONTACT_TO ?? DEFAULT_TO;
    const from = process.env.BID_CONTACT_FROM ?? DEFAULT_FROM;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: args.email,
        subject: `Nouveau contact agence — ${args.name}`,
        html: buildEmailHtml(args),
        text: buildEmailText(args),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Resend ${response.status}: ${detail}`);
    }
  },
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}

function buildEmailText({
  name,
  email,
  message,
}: {
  name: string;
  email: string;
  message: string;
}): string {
  return [
    `Nouveau contact agence`,
    ``,
    `De : ${name}`,
    `Email : ${email}`,
    ``,
    `Message :`,
    message,
    ``,
    `—`,
    `Be in Digital · Paris · beindigital.fr`,
  ].join("\n");
}

function buildEmailHtml({
  name,
  email,
  message,
}: {
  name: string;
  email: string;
  message: string;
}): string {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message);

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nouveau contact agence</title>
  </head>
  <body style="margin:0;padding:0;background:#090909;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e8e8e8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#090909;padding:48px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
            <tr>
              <td style="padding:0 0 28px 0;">
                <p style="margin:0;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#52cfaf;">
                  Nouveau contact agence
                </p>
                <h1 style="margin:10px 0 0 0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.15;font-weight:300;color:#ffffff;">
                  ${safeName}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="background:#141414;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;">
                <p style="margin:0 0 6px 0;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#52cfaf;">
                  Email
                </p>
                <p style="margin:0 0 24px 0;">
                  <a href="mailto:${safeEmail}" style="color:#ffffff;text-decoration:none;">${safeEmail}</a>
                </p>
                <p style="margin:0 0 6px 0;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#52cfaf;">
                  Message
                </p>
                <p style="margin:0;color:#cfcfcf;line-height:1.65;white-space:pre-wrap;">
${safeMessage}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 0 0 0;border-top:1px solid rgba(255,255,255,0.06);margin-top:24px;">
                <p style="margin:24px 0 0 0;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(232,232,232,0.4);">
                  Be in Digital · Paris · beindigital.fr
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
