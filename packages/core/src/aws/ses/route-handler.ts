/**
 * Next.js API route handler for sending emails via AWS SES
 * @module aws/ses/route-handler
 */

import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
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

/** A secret shorter than this is treated as absent. */
export const MIN_EMAIL_API_SECRET_BYTES = 32

/**
 * Configuration for email route handler
 */
export interface EmailRouteConfig {
  /**
   * Secret the caller must present as a Bearer token. At least
   * `MIN_EMAIL_API_SECRET_BYTES` bytes — anything shorter, empty or absent
   * disables the route rather than weakening it.
   */
  secret: string
  /**
   * Origin every link in a sent email must belong to, normally `SITE_URL`.
   *
   * This handler sends from the restaurant's SES-verified domain, so a link
   * chosen by the caller is phishing under the client's brand. When omitted
   * the request's own origin is used, which is right for a deployment served
   * at its public URL and wrong behind a proxy that rewrites it — pass it
   * explicitly.
   */
  linkOrigin?: string
}

/** Constant-time secret comparison that cannot be satisfied by an empty value. */
function tokenMatches(token: string, secret: string): boolean {
  // Digesting first keeps both operands 32 bytes, so the comparison neither
  // returns early on a length mismatch nor leaks the secret's length. It also
  // removes the case this route was broken by: `timingSafeEqual` over two
  // EMPTY buffers returns true, so an empty secret accepted an empty token.
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest()
  return timingSafeEqual(digest(token), digest(secret))
}

/**
 * Is this link one the deployment itself would have produced?
 *
 * `z.string().url()` accepts `https://evil.example/reset` just as happily as
 * the real thing, and the recipient sees it sent from their restaurant.
 */
function isSameOrigin(link: string, origin: string): boolean {
  try {
    return new URL(link).origin === new URL(origin).origin
  } catch {
    return false
  }
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
 * import { createEmailRouteHandler } from '@be-in-digital/core/aws/ses'
 *
 * const handler = createEmailRouteHandler({
 *   secret: process.env.EMAIL_API_SECRET ?? process.env.BETTER_AUTH_SECRET!,
 *   linkOrigin: process.env.SITE_URL!,
 * })
 *
 * export { handler as POST }
 * ```
 */
export function createEmailRouteHandler(config: EmailRouteConfig) {
  // Decided once, at construction: a route that cannot authenticate anyone is
  // an open relay on a domain SES has verified, so it must not serve at all.
  // This does not throw — the module is imported while Next collects route
  // metadata at build time, where no secret is set and a throw would only
  // break the build. It refuses at request time instead.
  const secret = typeof config.secret === 'string' ? config.secret : ''
  const secretIsUsable = Buffer.byteLength(secret, 'utf8') >= MIN_EMAIL_API_SECRET_BYTES

  /**
   * POST handler for sending emails
   * @param req - Next.js request object
   * @returns JSON response with success status or error
   */
  async function POST(req: Request): Promise<Response> {
    try {
      if (!secretIsUsable) {
        console.error(
          `[email/send] Refusing every request: the configured secret is shorter than ${MIN_EMAIL_API_SECRET_BYTES} bytes. ` +
            'Set EMAIL_API_SECRET (or BETTER_AUTH_SECRET) to a value from `openssl rand -base64 32`.'
        )
        return Response.json({ error: 'Email route not configured' }, { status: 503 })
      }

      // Validate authorization header
      const authHeader = req.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const token = authHeader.slice(7)

      if (token.length === 0 || !tokenMatches(token, secret)) {
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

      // Every link we are about to put in front of a recipient must belong to
      // this deployment. Without this the body decides where the "reset your
      // password" button goes, and the mail still arrives signed by the
      // restaurant's own domain.
      const linkOrigin = config.linkOrigin ?? new URL(req.url).origin
      const link = type === 'passwordReset' ? data.resetLink : data.dashboardLink

      if (!isSameOrigin(link, linkOrigin)) {
        console.error(
          `[email/send] Refused a ${type} link outside ${linkOrigin}. Body-supplied links are how this route becomes a phishing relay.`
        )
        return Response.json({ error: 'Invalid request' }, { status: 400 })
      }

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
