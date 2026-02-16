/**
 * AWS SES adapter using AWS SDK v3
 * @module aws/ses/adapter
 */

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import type { SESOperations } from './types'
import type { AWSConfig, SESConfig } from '../types'
import { createSESService } from './client'
import type { SESService } from './client'

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
        Content: {
          Simple: {
            Subject: { Data: params.subject, Charset: 'UTF-8' },
            Body: {
              Html: params.html ? { Data: params.html, Charset: 'UTF-8' } : undefined,
              Text: params.text ? { Data: params.text, Charset: 'UTF-8' } : undefined,
            },
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
  const region = process.env.AWS_REGION
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const fromEmail = process.env.AWS_SES_FROM_EMAIL

  if (!region || !accessKeyId || !secretAccessKey || !fromEmail) {
    throw new Error(
      'Missing required AWS SES environment variables: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SES_FROM_EMAIL'
    )
  }

  return {
    region,
    accessKeyId,
    secretAccessKey,
    fromEmail,
    fromName: process.env.AWS_SES_FROM_NAME,
    replyToEmail: process.env.AWS_SES_REPLY_TO_EMAIL,
  }
}

/**
 * Creates a fully configured SES service from environment variables
 * @returns Initialized SES service ready to send emails
 * @throws {Error} If environment variables are not properly configured
 */
export function getSESService(): SESService {
  const config = getSESConfig()
  const operations = createSESv2Operations(config)
  return createSESService(config, operations)
}
