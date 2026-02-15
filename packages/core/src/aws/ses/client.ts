/**
 * Service SES pour l'envoi d'emails
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
 * Configuration pour le rate limiting SES
 */
const SES_RATE_LIMIT = 14 // emails par seconde (limite sandbox)
const BATCH_SIZE = 50 // taille des lots pour l'envoi en masse

/**
 * Service SES pour l'envoi d'emails
 */
export interface SESService {
  /**
   * Envoie un email simple
   * @param params - Paramètres d'envoi
   * @returns ID du message envoyé
   */
  sendEmail(params: SendEmailParams): Promise<SendEmailResult>

  /**
   * Envoie un email avec un template prédéfini
   * @param params - Paramètres d'envoi avec template
   * @returns ID du message envoyé
   */
  sendTemplatedEmail<T extends TemplateName>(
    params: SendTemplatedEmailParams<Parameters<(typeof import('./templates').sesEmailTemplates)[T]['html']>[0]>
  ): Promise<SendEmailResult>

  /**
   * Envoie des emails en masse avec rate limiting
   * @param params - Paramètres d'envoi en masse
   * @returns Résultats détaillés pour chaque email
   */
  sendBulkEmail(params: SendBulkEmailParams): Promise<SendBulkEmailResult>
}

/**
 * Crée une instance du service SES
 * @param config - Configuration SES
 * @param client - Client SES injectable
 * @returns Instance du service SES
 */
export function createSESService(
  config: SESConfig,
  client: SESOperations
): SESService {
  const { fromEmail, fromName, replyToEmail } = config

  /**
   * Formate l'adresse email de l'expéditeur
   */
  function formatFromAddress(): string {
    return fromName ? `${fromName} <${fromEmail}>` : fromEmail
  }

  /**
   * Attend un délai (pour le rate limiting)
   */
  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Divise un tableau en lots
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
      // Validation des paramètres
      const validatedParams = sendEmailParamsSchema.parse(params)
      const { to, subject, html, text, replyTo } = validatedParams

      // Envoi via le client SES
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
      // Validation des paramètres
      const validatedParams = sendTemplatedEmailParamsSchema.parse(params)
      const { to, templateName, templateData, replyTo } = validatedParams

      // Récupération du template
      const template = getTemplate(templateName as TemplateName)

      // Génération du contenu
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subject = template.subject(templateData as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const html = template.html(templateData as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = template.text(templateData as any)

      // Envoi via le client SES
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
      // Validation des paramètres
      const validatedParams = sendBulkEmailParamsSchema.parse(params)
      const { recipients, replyTo } = validatedParams

      const results: SendBulkEmailResult['results'] = []

      // Diviser en lots pour respecter les limites SES
      const batches = chunkArray(recipients, BATCH_SIZE)

      // Calculer le délai entre chaque email pour le rate limiting
      const delayBetweenEmails = Math.ceil(1000 / SES_RATE_LIMIT)

      for (const batch of batches) {
        // Traiter chaque email du lot
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
