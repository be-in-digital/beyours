import { describe, expect, it } from 'vitest'

import {
  orderReadySubject,
  readyHeadline,
  renderOrderReady,
  renderOrderReadyHtml,
  renderOrderReadyText,
  type OrderReadyInput,
} from '../ses/order-ready'

/**
 * The « votre commande est prête » notice (#96).
 *
 * Short on purpose: the confirmation carries the lines, the totals and the VAT.
 * This carries a number, a place and a time, because that is what somebody
 * reading it on a telephone in the street needs.
 */

const READY_AT = 1_700_000_000_000

const input = (over: Partial<OrderReadyInput> = {}): OrderReadyInput => ({
  orderNumber: 'ORD-2026-0042',
  customerName: 'Camille',
  fulfilment: 'pickup',
  store: {
    name: 'Chez Luigi',
    address: {
      street: '1 rue de la Paix',
      city: 'Paris',
      postalCode: '75002',
    },
    phone: '+33140000000',
  },
  readyAt: READY_AT,
  ...over,
})

describe('orderReadySubject', () => {
  it('names the order, because the inbox shows only the subject', () => {
    expect(orderReadySubject(input())).toBe('Votre commande ORD-2026-0042 est prête')
  })
})

describe('readyHeadline', () => {
  it('tells a collection customer where to go', () => {
    expect(readyHeadline(input())).toContain('Chez Luigi')
  })

  it('does not tell a seated diner to fetch their own food', () => {
    // The case that reads oddly if it is not written for.
    const seated = readyHeadline(input({ fulfilment: 'dine_in' }))
    expect(seated).not.toMatch(/attend|récupér/i)
  })

  it('names the table when there is one', () => {
    expect(readyHeadline(input({ fulfilment: 'dine_in', tableNumber: 'Terrasse 4' }))).toContain(
      'Terrasse 4'
    )
  })

  it('says something sensible for a dine-in order with no table', () => {
    // Platform dine-in orders carry no table of their own.
    expect(readyHeadline(input({ fulfilment: 'dine_in' }))).toContain('votre table')
  })
})

describe('the rendered notice', () => {
  it('carries the order number and the time in both bodies', () => {
    const rendered = renderOrderReady(input(), { timeZone: 'Europe/Paris' })
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain('ORD-2026-0042')
    }
  })

  it('gives a collection customer the address', () => {
    const text = renderOrderReadyText(input())
    expect(text).toContain('1 rue de la Paix')
  })

  it('does not give a seated diner the restaurant\'s street address', () => {
    // They are in it.
    const text = renderOrderReadyText(input({ fulfilment: 'dine_in' }))
    expect(text).not.toContain('1 rue de la Paix')
  })

  it('links to the live order page when there is one', () => {
    const html = renderOrderReadyHtml(
      input({ trackingUrl: 'https://luigi.example/order/abc?token=xyz' })
    )
    expect(html).toContain('https://luigi.example/order/abc?token=xyz')
    expect(html).toContain('Voir ma commande')
  })

  it('renders without a tracking link at all', () => {
    // No `SITE_URL` on a fresh deployment, and no view token on an order written
    // before they existed. Both mean "no button", not "no email".
    const html = renderOrderReadyHtml(input())
    expect(html).not.toContain('Voir ma commande')
  })

  it('escapes an establishment name that contains markup', () => {
    // The name is the owner's own text and reaches an HTML email.
    const html = renderOrderReadyHtml(
      input({ store: { name: '<script>alert(1)</script>' } })
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes an order number that contains markup', () => {
    const html = renderOrderReadyHtml(input({ orderNumber: '<b>x</b>' }))
    expect(html).not.toContain('<b>x</b>')
  })
})
