"use node";

/**
 * Email transport providers — multi-provider send layer.
 *
 * `deliver()` (in ./send) builds the branded email, resolves the sender, then
 * hands the raw message to ONE of these providers, chosen at runtime by the
 * `EMAIL_PROVIDER` env var. This keeps the sales site's transactional email off
 * the critical path of a single vendor: SES stays the default (client instances
 * keep using it), while the sales site can be flipped to Resend — approved in
 * days, DKIM — without waiting on AWS SES production access.
 *
 * Best-effort contract: `send()` NEVER throws. It returns
 * `{ sent, id?, error? }` so the caller can log and swallow. `"use node"` is
 * required because `SesProvider` pulls in the AWS SDK (Node built-ins); `fetch`
 * works in the Node runtime too, so `ResendProvider` co-locates here.
 *
 * Secrets (`RESEND_API_KEY`, `AWS_*` keys) are read from the Convex environment
 * only — never hard-coded or committed. See `resolveEmailTransport()` for the
 * full list of env vars.
 */

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

/** Raw message handed to a provider — sender + templating already resolved. */
export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Uniform provider result. Best-effort: never throws. */
export interface EmailResult {
  sent: boolean;
  /** Provider-side message id when the send succeeded. */
  id?: string;
  /** Human-readable failure reason when `sent` is false. */
  error?: string;
}

/** A pluggable transactional email transport. */
export interface EmailProvider {
  /** Stable identifier used in logs (e.g. "ses", "resend"). */
  readonly name: string;
  send(message: EmailMessage): Promise<EmailResult>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ── SES (SESv2) ───────────────────────────────────────────────────────────────

export interface SesProviderConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** AWS SES v2 transport — the historical default (behaviour unchanged). */
export class SesProvider implements EmailProvider {
  readonly name = "ses";
  private readonly client: SESv2Client;

  constructor(config: SesProviderConfig) {
    this.client = new SESv2Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const result = await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: message.from,
          Destination: { ToAddresses: [message.to] },
          Content: {
            Simple: {
              Subject: { Data: message.subject, Charset: "UTF-8" },
              Body: {
                Html: { Data: message.html, Charset: "UTF-8" },
                Text: { Data: message.text, Charset: "UTF-8" },
              },
            },
          },
        }),
      );
      return { sent: true, id: result.MessageId };
    } catch (error) {
      return { sent: false, error: errorMessage(error) };
    }
  }
}

// ── Resend (HTTP, no SDK) ───────────────────────────────────────────────────────

export interface ResendProviderConfig {
  apiKey: string;
}

/**
 * Resend transport via plain `fetch` (no SDK, stays runtime-portable). Approved
 * in days + DKIM, so it can carry the sales-site email without gating the launch
 * on AWS SES production access. The sender domain must be verified in Resend.
 */
export class ResendProvider implements EmailProvider {
  readonly name = "resend";
  private readonly apiKey: string;

  constructor(config: ResendProviderConfig) {
    this.apiKey = config.apiKey;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        return {
          sent: false,
          error: `HTTP ${response.status} ${response.statusText}${
            detail ? ` — ${detail}` : ""
          }`,
        };
      }

      const data = (await response.json().catch(() => null)) as
        | { id?: string }
        | null;
      return { sent: true, id: data?.id };
    } catch (error) {
      return { sent: false, error: errorMessage(error) };
    }
  }
}

// ── Selection / config ──────────────────────────────────────────────────────────

/**
 * A ready-to-use transport (provider + resolved sender), or a reason it could
 * not be configured. Never throws, so `deliver()` stays best-effort.
 */
export type EmailTransport =
  | { ok: true; provider: EmailProvider; from: string }
  | { ok: false; reason: string };

/**
 * Resolve the active transport from the Convex environment.
 *
 * Env vars:
 *   EMAIL_PROVIDER       "ses" (default when unset) | "resend"
 *   ── SES ──
 *   AWS_SES_FROM_EMAIL   verified sender
 *   AWS_ACCESS_KEY_ID    IAM access key
 *   AWS_SECRET_ACCESS_KEY IAM secret key
 *   AWS_REGION           default "eu-west-3"
 *   ── Resend ──
 *   RESEND_API_KEY       "re_…" secret (Convex env only, never committed)
 *   RESEND_FROM_EMAIL    verified sender at Resend
 *                        (falls back to EMAIL_FROM, then AWS_SES_FROM_EMAIL)
 */
export function resolveEmailTransport(): EmailTransport {
  const selected = (process.env.EMAIL_PROVIDER ?? "ses").trim().toLowerCase();

  if (selected === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    const from =
      process.env.RESEND_FROM_EMAIL ??
      process.env.EMAIL_FROM ??
      process.env.AWS_SES_FROM_EMAIL;
    if (!apiKey || !from) {
      return {
        ok: false,
        reason:
          "EMAIL_PROVIDER=resend mais config incomplète (RESEND_API_KEY et/ou expéditeur RESEND_FROM_EMAIL|EMAIL_FROM|AWS_SES_FROM_EMAIL manquant)",
      };
    }
    return { ok: true, provider: new ResendProvider({ apiKey }), from };
  }

  if (selected !== "ses") {
    return {
      ok: false,
      reason: `EMAIL_PROVIDER="${selected}" inconnu (valeurs supportées : "ses", "resend")`,
    };
  }

  // Défaut : SES — comportement historique inchangé.
  const region = process.env.AWS_REGION ?? "eu-west-3";
  const from = process.env.AWS_SES_FROM_EMAIL;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!from || !accessKeyId || !secretAccessKey) {
    return {
      ok: false,
      reason:
        "EMAIL_PROVIDER=ses mais config incomplète (AWS_SES_FROM_EMAIL / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY manquant)",
    };
  }
  return {
    ok: true,
    provider: new SesProvider({ region, accessKeyId, secretAccessKey }),
    from,
  };
}
