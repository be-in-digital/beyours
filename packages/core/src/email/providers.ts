/**
 * Which transport carries a deployment's email, chosen by `EMAIL_PROVIDER`.
 *
 * ## Why this exists
 *
 * Since every client owns its AWS account, every client files its own SES
 * production-access request, and approval is not guaranteed — one has already
 * been refused. `apps/site` grew an escape hatch for exactly that (a Resend
 * transport behind `EMAIL_PROVIDER`), but the switch was read in `apps/site`
 * only. A restaurant whose request is refused had **no path to sending email
 * at all**: no order confirmation, no password reset, no winning ticket. Its
 * options were appealing to AWS, or a code change in five files. See #212.
 *
 * ## The shape
 *
 * Deliberately built on `SESOperations`, the seam that already existed, rather
 * than beside it. That has three consequences worth keeping:
 *
 *  - **No AWS SDK here.** `createSESv2Operations` stays the single module in
 *    `packages/core` that imports `@aws-sdk/client-sesv2`, so a Convex isolate
 *    can pull this file in without it. The SES provider is the caller's
 *    injected operations, wrapped.
 *  - **Resend reuses everything.** `createResendOperations()` implements the
 *    same interface, so `createSESService(config, operations)` — validation,
 *    the sandbox rate limit, bulk batching, the templates — works unchanged
 *    over it.
 *  - **`resolveEmailProvider` never throws.** It returns a reason instead, so
 *    the caller can log a configuration problem rather than crash a scheduled
 *    action mid-campaign.
 *
 * ## What is NOT abstracted, on purpose
 *
 * `configurationSet` is SES's open/click tracking and has no Resend
 * equivalent. It travels on the message and the Resend transport ignores it,
 * which is the honest behaviour: a client on Resend loses open tracking, not
 * their email. `headers` IS carried by both — the RFC 8058 one-click
 * unsubscribe headers are not optional for bulk mail to Gmail and Yahoo.
 *
 * @module email/providers
 */

import type { SESOperations, SendEmailResult } from '../aws/ses/types'

/** The transports this build knows how to configure. */
export const EMAIL_PROVIDERS = ['ses', 'resend'] as const

export type EmailProviderName = (typeof EMAIL_PROVIDERS)[number]

export function isEmailProviderName(value: string): value is EmailProviderName {
  return (EMAIL_PROVIDERS as readonly string[]).includes(value)
}

/**
 * One message, sender and body already resolved.
 *
 * `from` is on the message rather than on the provider because the campaign
 * path formats it per store (`"Chez Luigi <no-reply@…>"`), while the
 * transactional path uses the deployment's own.
 */
export interface EmailMessage {
  from: string
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  /**
   * Extra headers. Carried by both transports: bulk mail to Gmail and Yahoo
   * has needed `List-Unsubscribe` and `List-Unsubscribe-Post` since February
   * 2024, and without them it is filtered or refused.
   */
  headers?: Record<string, string>
  /**
   * SES configuration set for open/click tracking. Ignored by Resend, which
   * has no equivalent — see the module note.
   */
  configurationSet?: string
}

/** Best-effort result. A transport reports failure; it does not throw. */
export interface EmailSendOutcome {
  sent: boolean
  /** Provider-side message id when the send succeeded. */
  id?: string
  /** Human-readable reason when `sent` is false. */
  error?: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function toAddresses(to: string | string[]): string[] {
  return Array.isArray(to) ? to : [to]
}

// ── Resend ──────────────────────────────────────────────────────────────────

export interface ResendConfig {
  apiKey: string
  /** Overridable so a test can point at a stub without patching global fetch. */
  endpoint?: string
  fetchImpl?: typeof fetch
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/**
 * Resend over plain `fetch`, with no SDK.
 *
 * No SDK on purpose: this has to load in a Convex isolate as readily as in
 * Node, and a dependency that ships Node built-ins would decide that for us.
 * The sender domain must be verified at Resend, the same obligation SES makes.
 */
export function createResendOperations(config: ResendConfig): SESOperations {
  const doFetch = config.fetchImpl ?? fetch
  const endpoint = config.endpoint ?? RESEND_ENDPOINT

  async function post(body: Record<string, unknown>): Promise<SendEmailResult> {
    const response = await doFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(
        `Resend a refusé l'envoi : HTTP ${response.status} ${response.statusText}${
          detail ? ` — ${detail}` : ''
        }`
      )
    }

    const data = (await response.json().catch(() => null)) as { id?: string } | null
    return { messageId: data?.id ?? 'unknown' }
  }

  return {
    async sendEmail(params) {
      return post({
        from: params.from,
        to: toAddresses(params.to),
        subject: params.subject,
        html: params.html,
        ...(params.text ? { text: params.text } : {}),
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
        // Not optional for bulk mail: List-Unsubscribe and
        // List-Unsubscribe-Post are what keep a campaign out of the spam
        // folder at Gmail and Yahoo. Resend takes them as a flat object.
        ...(params.headers ? { headers: params.headers } : {}),
      })
    },

    async sendTemplatedEmail() {
      // The SES adapter documents the same limitation: neither provider's own
      // template feature is used, because the caller renders the HTML first.
      // Refusing loudly beats sending something unrendered.
      throw new Error(
        'Resend ne rend pas les modèles côté fournisseur — rendre le HTML puis appeler sendEmail'
      )
    },
  }
}

// ── The transport ───────────────────────────────────────────────────────────

/** A transport is operations plus the name to put in a log line. */
export interface EmailTransport {
  readonly name: EmailProviderName
  send(message: EmailMessage): Promise<EmailSendOutcome>
}

export type EmailTransportResolution =
  | { ok: true; transport: EmailTransport; from: string }
  | { ok: false; reason: string }

/**
 * The environment a resolution reads. Passed in rather than read from
 * `process.env` so a test states the case it is testing.
 */
export interface EmailProviderEnv {
  EMAIL_PROVIDER?: string
  AWS_REGION?: string
  AWS_ACCESS_KEY_ID?: string
  AWS_SECRET_ACCESS_KEY?: string
  AWS_SES_FROM_EMAIL?: string
  AWS_SES_FROM_NAME?: string
  AWS_SES_CONFIGURATION_SET?: string
  RESEND_API_KEY?: string
  RESEND_FROM_EMAIL?: string
  EMAIL_FROM?: string
}

/**
 * Wrap raw operations into a best-effort transport.
 *
 * The `sent: false` shape is the contract every caller in the engine already
 * assumes — and the thing #212 also complains about, because four of them then
 * discard it. Reporting a refusal is this module's job; reading it is theirs.
 */
export function createTransport(
  name: EmailProviderName,
  operations: SESOperations,
  applyMessage: (message: EmailMessage) => EmailMessage = (m) => m
): EmailTransport {
  return {
    name,
    async send(message) {
      try {
        const result = await operations.sendEmail(applyMessage(message))
        return { sent: true, id: result.messageId }
      } catch (error) {
        return { sent: false, error: errorMessage(error) }
      }
    },
  }
}

/**
 * Pick the transport this deployment is configured for.
 *
 * `ses` when unset, so an existing deployment behaves exactly as before. An
 * UNKNOWN name is refused rather than falling back to SES: a typo in
 * `EMAIL_PROVIDER` that silently sent through the provider the operator was
 * trying to move away from is the failure this whole module exists to avoid.
 *
 * @param env the variables to read, normally `process.env`
 * @param createSesOperations builds the SES operations, injected so this file
 *   stays free of the AWS SDK — pass `createSESv2Operations` from
 *   `aws/ses/adapter`
 */
export function resolveEmailProvider(
  env: EmailProviderEnv,
  createSesOperations: (config: {
    region: string
    accessKeyId: string
    secretAccessKey: string
  }) => SESOperations
): EmailTransportResolution {
  const selected = (env.EMAIL_PROVIDER ?? 'ses').trim().toLowerCase()

  if (!isEmailProviderName(selected)) {
    return {
      ok: false,
      reason: `EMAIL_PROVIDER="${selected}" inconnu (valeurs supportées : ${EMAIL_PROVIDERS.join(', ')})`,
    }
  }

  if (selected === 'resend') {
    const apiKey = env.RESEND_API_KEY
    const from = env.RESEND_FROM_EMAIL ?? env.EMAIL_FROM ?? env.AWS_SES_FROM_EMAIL
    if (!apiKey || !from) {
      return {
        ok: false,
        reason:
          'EMAIL_PROVIDER=resend mais configuration incomplète (RESEND_API_KEY et/ou expéditeur RESEND_FROM_EMAIL|EMAIL_FROM|AWS_SES_FROM_EMAIL manquant)',
      }
    }
    return {
      ok: true,
      from,
      // The configuration set is dropped rather than passed and ignored: a
      // field that means nothing to this transport has no business travelling
      // through it and turning up in a log as though it had been honoured.
      transport: createTransport('resend', createResendOperations({ apiKey }), (message) => {
        const rest = { ...message }
        delete rest.configurationSet
        return rest
      }),
    }
  }

  const from = env.AWS_SES_FROM_EMAIL
  const accessKeyId = env.AWS_ACCESS_KEY_ID
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY
  if (!from || !accessKeyId || !secretAccessKey) {
    return {
      ok: false,
      reason:
        'EMAIL_PROVIDER=ses mais configuration incomplète (AWS_SES_FROM_EMAIL / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY manquant)',
    }
  }

  return {
    ok: true,
    from,
    transport: createTransport(
      'ses',
      createSesOperations({
        region: env.AWS_REGION ?? 'eu-west-3',
        accessKeyId,
        secretAccessKey,
      })
    ),
  }
}
