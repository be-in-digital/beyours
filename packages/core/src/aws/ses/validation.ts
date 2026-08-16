/**
 * Zod validation schemas for SES
 * @module aws/ses/validation
 */

import { z } from 'zod'

/**
 * Schema for a single email address
 */
export const emailSchema = z.string().email('Email invalide')

/**
 * Schema for one or more email addresses
 */
export const emailsSchema = z.union([emailSchema, z.array(emailSchema).min(1)])

/**
 * Schema for the email send parameters
 */
export const sendEmailParamsSchema = z.object({
  to: emailsSchema,
  subject: z.string().min(1, 'Le sujet est requis'),
  html: z.string().min(1, 'Le contenu HTML est requis'),
  text: z.string().optional(),
  replyTo: emailSchema.optional(),
})

/**
 * Schema for the templated email send parameters
 */
export const sendTemplatedEmailParamsSchema = z.object({
  to: emailsSchema,
  templateName: z.string().min(1, 'Le nom du template est requis'),
  templateData: z.record(z.string(), z.unknown()),
  replyTo: emailSchema.optional(),
})

/**
 * Schema for the bulk email send parameters
 */
export const sendBulkEmailParamsSchema = z.object({
  recipients: z
    .array(
      z.object({
        to: emailSchema,
        subject: z.string().min(1),
        html: z.string().min(1),
        text: z.string().optional(),
      })
    )
    .min(1, 'Au moins un destinataire est requis'),
  replyTo: emailSchema.optional(),
})

/**
 * Normalizes one or more email addresses into an array
 */
export function normalizeEmails(to: string | string[]): string[] {
  return Array.isArray(to) ? to : [to]
}
