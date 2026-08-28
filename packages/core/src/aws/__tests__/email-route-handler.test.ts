/**
 * Tests for the email route handler's authorization and link policy.
 *
 * This route sends from the restaurant's SES-verified domain, so every hole in
 * it is phishing under the client's brand rather than a broken feature.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEmailRouteHandler, MIN_EMAIL_API_SECRET_BYTES } from '../ses/route-handler'

const sendEmail = vi.fn()

vi.mock('../ses/adapter', () => ({
  getSESService: () => ({ sendEmail }),
}))

const SECRET = 'a'.repeat(MIN_EMAIL_API_SECRET_BYTES)
const ORIGIN = 'https://resto.example.com'

function request(
  body: unknown,
  { token, url = `${ORIGIN}/api/email/send` }: { token?: string; url?: string } = {}
): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  })
}

const passwordReset = (resetLink: string) => ({
  type: 'passwordReset',
  to: 'owner@resto.example.com',
  data: { resetLink, expirationTime: '1 hour', userName: 'Owner' },
})

beforeEach(() => {
  sendEmail.mockReset()
  sendEmail.mockResolvedValue({ messageId: 'msg-1' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('authorization', () => {
  const handler = createEmailRouteHandler({ secret: SECRET, linkOrigin: ORIGIN })

  it('accepts the configured secret', async () => {
    const res = await handler.POST(
      request(passwordReset(`${ORIGIN}/reset?t=1`), { token: SECRET })
    )
    expect(res.status).toBe(200)
    expect(sendEmail).toHaveBeenCalledOnce()
  })

  it('rejects a missing Authorization header', async () => {
    const res = await handler.POST(request(passwordReset(`${ORIGIN}/reset`)))
    expect(res.status).toBe(401)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('rejects a wrong secret of the same length', async () => {
    const res = await handler.POST(
      request(passwordReset(`${ORIGIN}/reset`), {
        token: 'b'.repeat(MIN_EMAIL_API_SECRET_BYTES),
      })
    )
    expect(res.status).toBe(401)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('rejects an empty bearer token', async () => {
    const res = await handler.POST(
      request(passwordReset(`${ORIGIN}/reset`), { token: '' })
    )
    expect(res.status).toBe(401)
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

// The reported vulnerability: `timingSafeEqual` over two EMPTY buffers returns
// true, and `BETTER_AUTH_SECRET=` shipped empty in every .env.example. An empty
// secret plus an empty token authenticated, and anyone could POST any recipient,
// subject and link.
describe('an unusable secret disables the route', () => {
  it.each([
    ['empty', ''],
    ['one character short', 'a'.repeat(MIN_EMAIL_API_SECRET_BYTES - 1)],
    ['whitespace', '   '],
  ])('refuses every request when the secret is %s', async (_label, secret) => {
    const handler = createEmailRouteHandler({ secret, linkOrigin: ORIGIN })

    for (const token of ['', secret, 'anything']) {
      const res = await handler.POST(
        request(passwordReset(`${ORIGIN}/reset`), { token })
      )
      expect(res.status).toBe(503)
    }
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('refuses when the secret is absent entirely', async () => {
    const handler = createEmailRouteHandler({
      secret: undefined as unknown as string,
      linkOrigin: ORIGIN,
    })
    const res = await handler.POST(
      request(passwordReset(`${ORIGIN}/reset`), { token: '' })
    )
    expect(res.status).toBe(503)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('says what to set, so the operator is not left guessing', async () => {
    const handler = createEmailRouteHandler({ secret: '', linkOrigin: ORIGIN })
    await handler.POST(request(passwordReset(`${ORIGIN}/reset`), { token: '' }))
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('EMAIL_API_SECRET'))
  })
})

// `z.string().url()` accepts any absolute URL, so the body used to choose where
// the "reset your password" button pointed — in a mail signed by the client.
describe('link origin', () => {
  const handler = createEmailRouteHandler({ secret: SECRET, linkOrigin: ORIGIN })

  it('accepts a link on the deployment origin', async () => {
    const res = await handler.POST(
      request(passwordReset(`${ORIGIN}/reset-password?token=abc`), { token: SECRET })
    )
    expect(res.status).toBe(200)
  })

  it.each([
    ['another host', 'https://evil.example/reset'],
    ['a lookalike subdomain', 'https://resto.example.com.evil.example/reset'],
    ['a different scheme', 'http://resto.example.com/reset'],
    ['javascript', 'javascript:alert(1)'],
  ])('refuses a %s link', async (_label, link) => {
    const res = await handler.POST(request(passwordReset(link), { token: SECRET }))
    expect([400]).toContain(res.status)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('applies to the welcome mail dashboard link too', async () => {
    const res = await handler.POST(
      request(
        {
          type: 'welcome',
          to: 'owner@resto.example.com',
          data: { userName: 'Owner', dashboardLink: 'https://evil.example/dash' },
        },
        { token: SECRET }
      )
    )
    expect(res.status).toBe(400)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("falls back to the request's own origin when none is configured", async () => {
    const handler = createEmailRouteHandler({ secret: SECRET })

    const ok = await handler.POST(
      request(passwordReset(`${ORIGIN}/reset`), { token: SECRET })
    )
    expect(ok.status).toBe(200)

    const bad = await handler.POST(
      request(passwordReset('https://evil.example/reset'), { token: SECRET })
    )
    expect(bad.status).toBe(400)
  })
})

describe('request validation still applies', () => {
  const handler = createEmailRouteHandler({ secret: SECRET, linkOrigin: ORIGIN })

  it('rejects an unknown email type', async () => {
    const res = await handler.POST(
      request({ type: 'invoice', to: 'a@b.com', data: {} }, { token: SECRET })
    )
    expect(res.status).toBe(400)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('rejects a malformed recipient', async () => {
    const res = await handler.POST(
      request(
        { ...passwordReset(`${ORIGIN}/reset`), to: 'not-an-email' },
        { token: SECRET }
      )
    )
    expect(res.status).toBe(400)
  })
})
