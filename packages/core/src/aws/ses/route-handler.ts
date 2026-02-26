/**
 * Next.js API route handler for sending emails via AWS SES
 * @module aws/ses/route-handler
 */

import { z } from 'zod'

/**
 * Constant-time string comparison to prevent timing attacks.
 * Replaces Node.js crypto.timingSafeEqual to avoid pulling
 * the crypto module into non-Node bundles.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length)
  let result = a.length ^ b.length
  for (let i = 0; i < maxLen; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return result === 0
}
import { passwordResetTemplate, welcomeTemplate } from './templates'
import type { SESPasswordResetData, WelcomeData } from './templates'
import { getSESService } from './adapter'

/**
 * Schema for email request validation
 * Uses discriminated union to ensure type safety for different email types
 */
const emailRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('passwordReset'),
    to: z.string().email(),
    data: z.object({
      resetLink: z.string().url(),
      expirationTime: z.string(),
      userName: z.string(),
    }),
  }),
  z.object({
    type: z.literal('welcome'),
    to: z.string().email(),
    data: z.object({
      userName: z.string(),
      dashboardLink: z.string().url(),
    }),
  }),
])

/**
 * Configuration for email route handler
 */
export interface EmailRouteConfig {
  /** Secret token for authenticating requests */
  secret: string
}

/**
 * Creates an email route handler for Next.js API routes.
 * Authenticates requests via Bearer token and sends emails via AWS SES.
 *
 * @param config - Configuration with secret for authentication
 * @returns Route handler with POST method
 *
 * @example
 * ```typescript
 * // app/api/email/send/route.ts
 * import { createEmailRouteHandler } from '@beindigital-engine/core/aws/ses'
 *
 * const handler = createEmailRouteHandler({
 *   secret: process.env.EMAIL_API_SECRET!
 * })
 *
 * export { handler as POST }
 * ```
 */
export function createEmailRouteHandler(config: EmailRouteConfig) {
  /**
   * POST handler for sending emails
   * @param req - Next.js request object
   * @returns JSON response with success status or error
   */
  async function POST(req: Request): Promise<Response> {
    try {
      // Validate authorization header
      const authHeader = req.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const token = authHeader.slice(7)

      // Constant-time comparison to prevent timing attacks
      if (!constantTimeEqual(token, config.secret)) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Parse and validate request body
      const body = await req.json()
      const parsed = emailRequestSchema.safeParse(body)

      if (!parsed.success) {
        return Response.json(
          { error: 'Invalid request', details: parsed.error.flatten() },
          { status: 400 }
        )
      }

      const { type, to, data } = parsed.data
      const sesService = getSESService()

      // Generate email content based on type
      let subject: string
      let html: string
      let text: string

      switch (type) {
        case 'passwordReset': {
          const templateData = data as SESPasswordResetData
          subject = passwordResetTemplate.subject(templateData)
          html = passwordResetTemplate.html(templateData)
          text = passwordResetTemplate.text(templateData)
          break
        }
        case 'welcome': {
          const templateData = data as WelcomeData
          subject = welcomeTemplate.subject(templateData)
          html = welcomeTemplate.html(templateData)
          text = welcomeTemplate.text(templateData)
          break
        }
      }

      // Send email via SES
      const result = await sesService.sendEmail({
        to,
        subject,
        html,
        text,
      })

      return Response.json({ success: true, messageId: result.messageId })
    } catch (error) {
      console.error('[email/send] Error:', error)
      return Response.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }

  return { POST }
}
