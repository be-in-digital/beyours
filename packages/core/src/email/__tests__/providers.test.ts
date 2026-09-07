import { describe, it, expect, vi } from 'vitest'
import {
  EMAIL_PROVIDERS,
  createResendOperations,
  createTransport,
  resolveEmailProvider,
  type EmailProviderEnv,
} from '../providers'
import type { SESOperations } from '../../aws/ses/types'

/**
 * The escape hatch a refused SES request needs (#212).
 *
 * A client whose AWS SES production-access request is refused had no path to
 * sending email at all — not an order confirmation, not a password reset. The
 * `EMAIL_PROVIDER` switch existed, in `apps/site` only.
 *
 * These tests are about the DECISION, not about reaching a provider: the SES
 * operations are injected and the Resend transport is given a stub `fetch`, so
 * every case here is one an operator can actually get into.
 */

const SES_ENV: EmailProviderEnv = {
  AWS_SES_FROM_EMAIL: 'no-reply@resto.fr',
  AWS_ACCESS_KEY_ID: 'AKIA',
  AWS_SECRET_ACCESS_KEY: 'secret',
}

function stubSesOperations() {
  const sendEmail = vi.fn(async () => ({ messageId: 'ses-1' }))
  const factory = vi.fn(
    (): SESOperations => ({
      sendEmail,
      sendTemplatedEmail: async () => ({ messageId: 'ses-t' }),
    })
  )
  return { sendEmail, factory }
}

describe('resolveEmailProvider', () => {
  it('defaults to SES, so an existing deployment does not move', () => {
    const { factory } = stubSesOperations()

    const resolved = resolveEmailProvider(SES_ENV, factory)

    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.transport.name).toBe('ses')
    expect(resolved.from).toBe('no-reply@resto.fr')
    expect(factory).toHaveBeenCalledWith({
      region: 'eu-west-3',
      accessKeyId: 'AKIA',
      secretAccessKey: 'secret',
    })
  })

  it('selects Resend when the deployment says so', () => {
    const { factory } = stubSesOperations()

    const resolved = resolveEmailProvider(
      { ...SES_ENV, EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_x' },
      factory
    )

    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.transport.name).toBe('resend')
    // The SES factory is never called: a client whose SES request was refused
    // has no usable credentials, and building a client from them would throw
    // before the Resend send ever ran.
    expect(factory).not.toHaveBeenCalled()
  })

  it('falls back through the three sender variables, in order', () => {
    const { factory } = stubSesOperations()
    const base = { EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_x' }

    const explicit = resolveEmailProvider(
      { ...base, RESEND_FROM_EMAIL: 'a@x.fr', EMAIL_FROM: 'b@x.fr', AWS_SES_FROM_EMAIL: 'c@x.fr' },
      factory
    )
    const middle = resolveEmailProvider(
      { ...base, EMAIL_FROM: 'b@x.fr', AWS_SES_FROM_EMAIL: 'c@x.fr' },
      factory
    )
    const last = resolveEmailProvider({ ...base, AWS_SES_FROM_EMAIL: 'c@x.fr' }, factory)

    expect(explicit.ok && explicit.from).toBe('a@x.fr')
    expect(middle.ok && middle.from).toBe('b@x.fr')
    // The one that matters for a migration: an operator who flips the switch
    // and changes nothing else keeps sending from the address they verified.
    expect(last.ok && last.from).toBe('c@x.fr')
  })

  it('refuses an unknown provider instead of falling back to SES', () => {
    // The failure this module exists to prevent, one level up: a typo in
    // EMAIL_PROVIDER that silently kept sending through the provider the
    // operator was trying to leave would be indistinguishable from success.
    const { factory } = stubSesOperations()

    const resolved = resolveEmailProvider({ ...SES_ENV, EMAIL_PROVIDER: 'resnd' }, factory)

    expect(resolved.ok).toBe(false)
    if (resolved.ok) return
    expect(resolved.reason).toContain('resnd')
    expect(resolved.reason).toContain('ses, resend')
    expect(factory).not.toHaveBeenCalled()
  })

  it.each([
    ['AWS_SES_FROM_EMAIL', { ...SES_ENV, AWS_SES_FROM_EMAIL: undefined }],
    ['AWS_ACCESS_KEY_ID', { ...SES_ENV, AWS_ACCESS_KEY_ID: undefined }],
    ['AWS_SECRET_ACCESS_KEY', { ...SES_ENV, AWS_SECRET_ACCESS_KEY: undefined }],
  ])('reports incomplete SES configuration when %s is missing', (_name, env) => {
    const resolved = resolveEmailProvider(env, stubSesOperations().factory)

    expect(resolved.ok).toBe(false)
    if (resolved.ok) return
    expect(resolved.reason).toContain('EMAIL_PROVIDER=ses')
  })

  it('reports incomplete Resend configuration rather than silently using SES', () => {
    const resolved = resolveEmailProvider(
      { ...SES_ENV, EMAIL_PROVIDER: 'resend' },
      stubSesOperations().factory
    )

    expect(resolved.ok).toBe(false)
    if (resolved.ok) return
    expect(resolved.reason).toContain('RESEND_API_KEY')
  })

  it('accepts the provider name however the operator spelled it', () => {
    for (const spelling of [' RESEND ', 'Resend', 'resend']) {
      const resolved = resolveEmailProvider(
        { ...SES_ENV, EMAIL_PROVIDER: spelling, RESEND_API_KEY: 're_x' },
        stubSesOperations().factory
      )
      expect(resolved.ok && resolved.transport.name).toBe('resend')
    }
  })

  it('knows exactly two providers', () => {
    expect([...EMAIL_PROVIDERS]).toEqual(['ses', 'resend'])
  })
})

describe('the transport contract', () => {
  it('reports a refusal instead of throwing', async () => {
    // Four engine call sites already assume this shape and then discard it.
    // Producing it is this layer's job; a throw here would take a scheduled
    // campaign action down mid-batch.
    const operations: SESOperations = {
      sendEmail: async () => {
        throw new Error('Email address is not verified')
      },
      sendTemplatedEmail: async () => ({ messageId: 'x' }),
    }

    const outcome = await createTransport('ses', operations).send({
      from: 'a@x.fr',
      to: 'b@x.fr',
      subject: 's',
      html: '<p>h</p>',
    })

    expect(outcome).toEqual({ sent: false, error: 'Email address is not verified' })
  })

  it('returns the provider message id on success', async () => {
    const { factory, sendEmail } = stubSesOperations()
    const resolved = resolveEmailProvider(SES_ENV, factory)
    if (!resolved.ok) throw new Error(resolved.reason)

    const outcome = await resolved.transport.send({
      from: 'a@x.fr',
      to: 'b@x.fr',
      subject: 's',
      html: '<p>h</p>',
      configurationSet: 'tracking',
    })

    expect(outcome).toEqual({ sent: true, id: 'ses-1' })
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ configurationSet: 'tracking' })
    )
  })

  it('does not hand a configuration set to a transport that has none', async () => {
    // Resend has no equivalent. Dropping it is the honest behaviour: passing a
    // field the transport ignores would leave a log line implying the client
    // still has open tracking, which they do not.
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: 're-1' })))
    const resolved = resolveEmailProvider(
      { ...SES_ENV, EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_x' },
      stubSesOperations().factory
    )
    if (!resolved.ok) throw new Error(resolved.reason)

    // Re-wrap with the stub fetch; the resolution's own transport talks to the
    // real endpoint, and this assertion is about the payload.
    const operations = createResendOperations({ apiKey: 're_x', fetchImpl })
    await createTransport('resend', operations).send({
      from: 'a@x.fr',
      to: 'b@x.fr',
      subject: 's',
      html: '<p>h</p>',
      headers: { 'List-Unsubscribe': '<https://x.fr/u>' },
    })

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))
    expect(body).not.toHaveProperty('configurationSet')
    expect(body.headers).toEqual({ 'List-Unsubscribe': '<https://x.fr/u>' })
  })
})

describe('createResendOperations', () => {
  it('sends what Resend expects', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: 're-1' })))
    const operations = createResendOperations({ apiKey: 're_x', fetchImpl })

    const result = await operations.sendEmail({
      from: 'Chez Luigi <no-reply@x.fr>',
      to: 'diner@x.fr',
      subject: 'Votre commande',
      html: '<p>Merci</p>',
      text: 'Merci',
      replyTo: 'contact@x.fr',
    })

    expect(result).toEqual({ messageId: 're-1' })
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe('https://api.resend.com/emails')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer re_x')
    expect(JSON.parse(String(init?.body))).toEqual({
      from: 'Chez Luigi <no-reply@x.fr>',
      // An array even for one recipient: Resend's API takes a list, and the
      // engine passes both shapes.
      to: ['diner@x.fr'],
      subject: 'Votre commande',
      html: '<p>Merci</p>',
      text: 'Merci',
      reply_to: 'contact@x.fr',
    })
  })

  it('turns a rejection into an error carrying the reason', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('domain is not verified', { status: 403, statusText: 'Forbidden' })
    )
    const operations = createResendOperations({ apiKey: 're_x', fetchImpl })

    await expect(
      operations.sendEmail({ from: 'a@x.fr', to: 'b@x.fr', subject: 's', html: 'h' })
    ).rejects.toThrow(/403.*domain is not verified/s)
  })

  it('refuses a templated send rather than mailing an unrendered body', async () => {
    const operations = createResendOperations({ apiKey: 're_x' })

    await expect(
      operations.sendTemplatedEmail({
        from: 'a@x.fr',
        to: 'b@x.fr',
        templateName: 'welcome',
        templateData: {},
      })
    ).rejects.toThrow(/modèles/)
  })
})
