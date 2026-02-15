/**
 * Schémas de validation Zod pour SES
 * @module aws/ses/validation
 */

import { z } from 'zod'

/**
 * Schéma pour un email
 */
export const emailSchema = z.string().email('Email invalide')

/**
 * Schéma pour un ou plusieurs emails
 */
export const emailsSchema = z.union([emailSchema, z.array(emailSchema).min(1)])

/**
 * Schéma pour les paramètres d'envoi d'email
 */
export const sendEmailParamsSchema = z.object({
  to: emailsSchema,
  subject: z.string().min(1, 'Le sujet est requis'),
  html: z.string().min(1, 'Le contenu HTML est requis'),
  text: z.string().optional(),
  replyTo: emailSchema.optional(),
})

/**
 * Schéma pour les paramètres d'envoi avec template
 */
export const sendTemplatedEmailParamsSchema = z.object({
  to: emailsSchema,
  templateName: z.string().min(1, 'Le nom du template est requis'),
  templateData: z.record(z.unknown()),
  replyTo: emailSchema.optional(),
})

/**
 * Schéma pour les paramètres d'envoi en masse
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
 * Normalise un ou plusieurs emails en tableau
 */
export function normalizeEmails(to: string | string[]): string[] {
  return Array.isArray(to) ? to : [to]
}
