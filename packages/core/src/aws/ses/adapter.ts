/**
 * AWS SES adapter using AWS SDK v3
 * @module aws/ses/adapter
 */

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import type { SESOperations } from './types'
import type { AWSConfig, SESConfig } from '../types'
import { createSESService } from './client'
import type { SESService } from './client'
import { getSiteEnv } from '../../env'
import {
  createResendOperations,
  resolveEmailProvider,
  type EmailProviderEnv,
} from '../../email/providers'

/**
 * Creates SES operations using AWS SDK v3
 * @param config - AWS configuration with credentials
 * @returns SES operations implementation
 */
export function createSESv2Operations(config: AWSConfig): SESOperations {
  const client = new SESv2Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  return {
    async sendEmail(params) {
      const toAddresses = Array.isArray(params.to) ? params.to : [params.to]

      const command = new SendEmailCommand({
        FromEmailAddress: params.from,
        Destination: {
          ToAddresses: toAddresses,
        },
        ReplyToAddresses: params.replyTo ? [params.replyTo] : undefined,
        // Spread, not set to undefined: SES treats a present-but-empty
        // configuration set name as one that does not exist and fails the
        // send, so the key has to be ABSENT when there is none.
        ...(params.configurationSet
          ? { ConfigurationSetName: params.configurationSet }
          : {}),
        Content: {
          Simple: {
            Subject: { Data: params.subject, Charset: 'UTF-8' },
            Body: {
              Html: params.html ? { Data: params.html, Charset: 'UTF-8' } : undefined,
              Text: params.text ? { Data: params.text, Charset: 'UTF-8' } : undefined,
            },
            ...(params.headers
              ? {
                  Headers: Object.entries(params.headers).map(([Name, Value]) => ({
                    Name,
                    Value,
                  })),
                }
              : {}),
          },
        },
      })

      const response = await client.send(command)
      return { messageId: response.MessageId ?? 'unknown' }
    },

    async sendTemplatedEmail(params) {
      // For templated emails, we still use the simple email API with generated content
      // AWS SES templates are a separate feature that requires pre-configured templates
      const toAddresses = Array.isArray(params.to) ? params.to : [params.to]

      // Note: This implementation doesn't use AWS SES native templates
      // Instead, it relies on the template being rendered beforehand
      // For AWS native templates, you would need to create templates via AWS Console/API first
      const command = new SendEmailCommand({
        FromEmailAddress: params.from,
        Destination: {
          ToAddresses: toAddresses,
        },
        ReplyToAddresses: params.replyTo ? [params.replyTo] : undefined,
        Content: {
          Template: {
            TemplateName: params.templateName,
            TemplateData: JSON.stringify(params.templateData),
          },
        },
      })

      const response = await client.send(command)
      return { messageId: response.MessageId ?? 'unknown' }
    },
  }
}

/**
 * Reads SES configuration from environment variables
 * @returns SES configuration object
 * @throws {Error} If required environment variables are missing
 */
export function getSESConfig(): SESConfig {
  const site = getSiteEnv()

  const fromEmail = site.AWS_SES_FROM_EMAIL
  if (!fromEmail) {
    throw new Error('AWS_SES_FROM_EMAIL is required for SES')
  }

  // The credentials are the restaurant's own since 2026-08-28. The reader is
  // deliberately lenient — it never throws for a missing value — so the three
  // are `string | undefined` here even though the boot-time schema requires
  // them. Name the missing one rather than handing `undefined` to the SDK,
  // which fails later with a signature error that says nothing.
  const { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = site
  const missing = (
    [
      ['AWS_REGION', AWS_REGION],
      ['AWS_ACCESS_KEY_ID', AWS_ACCESS_KEY_ID],
      ['AWS_SECRET_ACCESS_KEY', AWS_SECRET_ACCESS_KEY],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missing.length > 0) {
    throw new Error(`${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} required for SES`)
  }

  return {
    region: AWS_REGION!,
    accessKeyId: AWS_ACCESS_KEY_ID!,
    secretAccessKey: AWS_SECRET_ACCESS_KEY!,
    fromEmail,
    fromName: site.AWS_SES_FROM_NAME,
    replyToEmail: site.AWS_SES_REPLY_TO_EMAIL,
  }
}

/**
 * The email service this deployment is configured for.
 *
 * SES unless `EMAIL_PROVIDER` says otherwise. That switch used to be read in
 * `apps/site` only, so a client whose AWS SES production-access request was
 * refused — and one has been — had no path to sending email at all. See #212
 * and `email/providers`.
 *
 * The provider decides the TRANSPORT and nothing else: `createSESService`
 * still wraps it, so the validation, the sender formatting, the sandbox rate
 * limit and the bulk batching are the same whichever way the mail leaves.
 *
 * @throws {Error} if the selected provider is not configured. Callers here are
 * boot-time or request-time paths where a misconfiguration must be loud; the
 * Convex actions use `resolveEmailProvider` directly, which reports instead.
 */
export function getEmailService(): SESService {
  const resolution = resolveEmailProvider(
    process.env as EmailProviderEnv,
    createSESv2Operations
  )
  if (!resolution.ok) throw new Error(resolution.reason)

  if (resolution.transport.name === 'resend') {
    const site = getSiteEnv()
    return createSESService(
      {
        // Region and credentials are SES's; on Resend they are unread, and
        // there may not be any. The sender is the half that matters.
        region: site.AWS_REGION ?? 'eu-west-3',
        accessKeyId: site.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: site.AWS_SECRET_ACCESS_KEY ?? '',
        fromEmail: resolution.from,
        fromName: site.AWS_SES_FROM_NAME,
        replyToEmail: site.AWS_SES_REPLY_TO_EMAIL,
      },
      createResendOperations({ apiKey: process.env.RESEND_API_KEY! })
    )
  }

  const config = getSESConfig()
  return createSESService(config, createSESv2Operations(config))
}

/**
 * @deprecated Use {@link getEmailService}. Kept because the name is spelled in
 * `route-handler.ts` and in the docs; it now honours `EMAIL_PROVIDER` too, so
 * "SES" in the name is no longer the whole truth.
 */
export function getSESService(): SESService {
  return getEmailService()
}
