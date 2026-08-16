/**
 * SES service for sending emails
 * @module aws/ses/client
 */

import type { SESConfig } from '../types'
import type {
  SESOperations,
  SendEmailParams,
  SendTemplatedEmailParams,
  SendBulkEmailParams,
  SendEmailResult,
  SendBulkEmailResult,
} from './types'
import {
  sendEmailParamsSchema,
  sendTemplatedEmailParamsSchema,
  sendBulkEmailParamsSchema,
  normalizeEmails,
} from './validation'
import { getTemplate, type TemplateName } from './templates'

/**
 * SES rate limiting configuration
 */
const SES_RATE_LIMIT = 14 // emails per second (sandbox limit)
const BATCH_SIZE = 50 // batch size for bulk sends

/**
 * SES service for sending emails
 */
export interface SESService {
  /**
   * Sends a plain email
   * @param params - Send parameters
   * @returns ID of the sent message
   */
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>

  /**
   * Sends an email from a predefined template
   * @param params - Templated send parameters
   * @returns ID of the sent message
   */
  sendTemplatedEmail<T extends TemplateName>(
    params: SendTemplatedEmailParams<Parameters<(typeof import('./templates').sesEmailTemplates)[T]['html']>[0]>
  ): Promise<SendEmailResult>

  /**
   * Sends emails in bulk with rate limiting
   * @param params - Bulk send parameters
   * @returns Per-email detailed results
   */
  sendBulkEmail(params: SendBulkEmailParams): Promise<SendBulkEmailResult>
}

/**
 * Creates an SES service instance
 * @param config - SES configuration
 * @param client - Injectable SES client
 * @returns The SES service instance
 */
export function createSESService(
  config: SESConfig,
  client: SESOperations
): SESService {
  const { fromEmail, fromName, replyToEmail } = config

  /**
   * Formats the sender address
   */
  function formatFromAddress(): string {
    return fromName ? `${fromName} <${fromEmail}>` : fromEmail
  }

  /**
   * Waits for a delay (used by the rate limiter)
   */
  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Splits an array into batches
   */
  function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  return {
    async sendEmail(params) {
      // Validate the parameters
      const validatedParams = sendEmailParamsSchema.parse(params)
      const { to, subject, html, text, replyTo } = validatedParams

      // Send through the SES client
      const result = await client.sendEmail({
        from: formatFromAddress(),
        to,
        subject,
        html,
        text,
        replyTo: replyTo ?? replyToEmail,
      })

      return result
    },

    async sendTemplatedEmail(params) {
      // Validate the parameters
      const validatedParams = sendTemplatedEmailParamsSchema.parse(params)
      const { to, templateName, templateData, replyTo } = validatedParams

      // Look up the template
      const template = getTemplate(templateName as TemplateName)

      // Render the content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subject = template.subject(templateData as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html = template.html(templateData as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = template.text(templateData as any)

      // Send through the SES client
      const result = await client.sendEmail({
        from: formatFromAddress(),
        to,
        subject,
        html,
        text,
        replyTo: replyTo ?? replyToEmail,
      })

      return result
    },

    async sendBulkEmail(params) {
      // Validate the parameters
      const validatedParams = sendBulkEmailParamsSchema.parse(params)
      const { recipients, replyTo } = validatedParams

      const results: SendBulkEmailResult['results'] = []

      // Split into batches to stay within the SES limits
      const batches = chunkArray(recipients, BATCH_SIZE)

      // Compute the per-email delay for rate limiting
      const delayBetweenEmails = Math.ceil(1000 / SES_RATE_LIMIT)

      for (const batch of batches) {
        // Process each email in the batch
        for (const recipient of batch) {
          try {
            const result = await client.sendEmail({
              from: formatFromAddress(),
              to: recipient.to,
              subject: recipient.subject,
              html: recipient.html,
              text: recipient.text,
              replyTo: replyTo ?? replyToEmail,
            })

            results.push({
              to: recipient.to,
              messageId: result.messageId,
            })
          } catch (error) {
            results.push({
              to: recipient.to,
              error:
                error instanceof Error
                  ? error.message
                  : "Erreur lors de l'envoi",
            })
          }

          // Rate limiting
          await delay(delayBetweenEmails)
        }
      }

      return { results }
    },
  }
}
