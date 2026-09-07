/**
 * Types for the SES service
 * @module aws/ses/types
 */

/**
 * Parameters for sending an email
 */
export interface SendEmailParams {
  /** Recipient(s) */
  to: string | string[]
  /** Email subject */
  subject: string
  /** HTML body */
  html: string
  /** Plain text body (fallback) */
  text?: string
  /** Reply-to address */
  replyTo?: string
}

/**
 * Parameters for sending a templated email
 */
export interface SendTemplatedEmailParams<T = Record<string, unknown>> {
  /** Recipient(s) */
  to: string | string[]
  /** Template name */
  templateName: string
  /** Data injected into the template */
  templateData: T
  /** Reply-to address */
  replyTo?: string
}

/**
 * Parameters for a bulk send
 */
export interface SendBulkEmailParams {
  /** Recipient list */
  recipients: Array<{
    to: string
    subject: string
    html: string
    text?: string
  }>
  /** Reply-to address */
  replyTo?: string
}

/**
 * Result of an email send
 */
export interface SendEmailResult {
  /** Message ID */
  messageId: string
}

/**
 * Result of a bulk send
 */
export interface SendBulkEmailResult {
  /** Per-recipient results */
  results: Array<{
    to: string
    messageId?: string
    error?: string
  }>
}

/**
 * Injectable interface over the SES operations
 */
export interface SESOperations {
  /**
   * Sends a plain email
   */
  sendEmail(params: {
    from: string
    to: string | string[]
    subject: string
    html: string
    text?: string
    replyTo?: string
    /**
     * Extra headers, forwarded verbatim.
     *
     * Bulk mail to Gmail and Yahoo has needed `List-Unsubscribe` and
     * `List-Unsubscribe-Post` since February 2024; without them it is filtered
     * or refused, which looks exactly like "our campaigns get no opens". The
     * campaign path used to reach past this interface to a raw
     * `SendEmailCommand` to set them. Optional, so every existing caller and
     * every existing implementation is unaffected.
     */
    headers?: Record<string, string>
    /**
     * SES configuration set — open/click tracking, named per AWS account.
     *
     * Omitted rather than passed empty when there is none: an empty name is
     * not "no tracking" to SES, it is a name that does not exist, and it fails
     * the send. See `sesSending.resolveConfigurationSet`. A transport with no
     * equivalent (Resend) drops it rather than pretending to honour it.
     */
    configurationSet?: string
  }): Promise<SendEmailResult>

  /**
   * Sends an email rendered from a template
   */
  sendTemplatedEmail(params: {
    from: string
    to: string | string[]
    templateName: string
    templateData: Record<string, unknown>
    replyTo?: string
  }): Promise<SendEmailResult>
}
