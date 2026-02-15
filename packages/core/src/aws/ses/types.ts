/**
 * Types pour le service SES
 * @module aws/ses/types
 */

/**
 * Paramètres pour l'envoi d'email
 */
export interface SendEmailParams {
  /** Destinataire(s) */
  to: string | string[]
  /** Sujet de l'email */
  subject: string
  /** Contenu HTML */
  html: string
  /** Contenu texte (fallback) */
  text?: string
  /** Email de réponse */
  replyTo?: string
}

/**
 * Paramètres pour l'envoi d'email avec template
 */
export interface SendTemplatedEmailParams<T = Record<string, unknown>> {
  /** Destinataire(s) */
  to: string | string[]
  /** Nom du template */
  templateName: string
  /** Données pour le template */
  templateData: T
  /** Email de réponse */
  replyTo?: string
}

/**
 * Paramètres pour l'envoi en masse
 */
export interface SendBulkEmailParams {
  /** Liste de destinataires */
  recipients: Array<{
    to: string
    subject: string
    html: string
    text?: string
  }>
  /** Email de réponse */
  replyTo?: string
}

/**
 * Résultat d'envoi d'email
 */
export interface SendEmailResult {
  /** ID du message */
  messageId: string
}

/**
 * Résultat d'envoi en masse
 */
export interface SendBulkEmailResult {
  /** Résultats individuels */
  results: Array<{
    to: string
    messageId?: string
    error?: string
  }>
}

/**
 * Interface pour les opérations SES (injectable)
 */
export interface SESOperations {
  /**
   * Envoie un email simple
   */
  sendEmail(params: {
    from: string
    to: string | string[]
    subject: string
    html: string
    text?: string
    replyTo?: string
  }): Promise<SendEmailResult>

  /**
   * Envoie un email avec template
   */
  sendTemplatedEmail(params: {
    from: string
    to: string | string[]
    templateName: string
    templateData: Record<string, unknown>
    replyTo?: string
  }): Promise<SendEmailResult>
}
