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
