import { describe, it, expect } from 'vitest'
import {
  clamp,
  confirmationHeadline,
  escapeHtml,
  formatAddress,
  formatCents,
  formatDateTime,
  formatRate,
  fulfilmentLines,
  paymentDueLine,
  paymentMethodLabel,
  renderOrderConfirmation,
  renderOrderConfirmationHtml,
  renderOrderConfirmationText,
  timingLine,
  type OrderConfirmationInput,
} from '../ses/order-confirmation'

/**
 * The email a diner gets when they pay.
 *
 * Until this shipped they got nothing at all, and the template that existed
 * could not simply be wired up: it read amounts in euros while the schema
 * stores cents, printed a delivery address over click-and-collect orders that
 * have none, never named the restaurant, and interpolated the diner's own free
 * text into HTML. Each of those has a test here.
 */

const BASE: OrderConfirmationInput = {
  orderNumber: 'ORD-2026-0001',
  customerName: 'Camille Martin',
  type: 'delivery',
  store: {
    name: 'Chez Luigi',
    address: { street: '12 rue des Lilas', city: 'Lyon', postalCode: '69003' },
    phone: '04 78 00 00 00',
  },
  items: [
    {
      name: 'Pizza Margherita',
      quantity: 2,
      subtotal: 2400,
      options: ['Taille : Grande'],
    },
    { name: 'Coca Cola', quantity: 1, subtotal: 300 },
  ],
  subtotal: 2700,
  taxAmount: 245,
  taxBreakdown: [{ ratePercent: 10, taxAmount: 245 }],
  deliveryFee: 490,
  total: 3190,
  deliveryAddress: {
    street: '5 avenue de la Gare',
    city: 'Lyon',
    postalCode: '69002',
    instructions: 'Interphone 42',
  },
  paymentMethod: 'card',
  trackingUrl: 'https://chez-luigi.fr/order/abc?token=xyz',
}

describe('formatCents', () => {
  it('reads the stored amount as cents, not as euros', () => {
    // The whole point. `3400` is 34,00\u00A0€; the old template rendered it 3400,00\u00A0€.
    expect(formatCents(3400)).toBe('34,00\u00A0€')
    expect(formatCents(0)).toBe('0,00\u00A0€')
    expect(formatCents(5)).toBe('0,05\u00A0€')
    expect(formatCents(99)).toBe('0,99\u00A0€')
  })

  it('groups thousands and keeps the euro sign attached', () => {
    expect(formatCents(123450)).toBe('1\u00A0234,50\u00A0€')
    expect(formatCents(100000000)).toBe('1\u00A0000\u00A0000,00\u00A0€')
  })

  it('survives a negative or nonsensical amount without producing NaN', () => {
    expect(formatCents(-250)).toBe('-2,50\u00A0€')
    expect(formatCents(Number.NaN)).toBe('0,00\u00A0€')
    expect(formatCents(Number.POSITIVE_INFINITY)).toBe('0,00\u00A0€')
  })
})

describe('formatRate', () => {
  it('writes a French percentage', () => {
    expect(formatRate(10)).toBe('10\u00A0%')
    expect(formatRate(5.5)).toBe('5,5\u00A0%')
    expect(formatRate(20)).toBe('20\u00A0%')
  })
})

describe('formatDateTime', () => {
  // 2026-03-12T18:30:00Z — 19:30 in Paris, which is what the diner reads.
  const INSTANT = Date.UTC(2026, 2, 12, 18, 30)

  it('writes a French date', () => {
    expect(formatDateTime(INSTANT)).toBe('12 mars 2026 à 18:30')
  })

  it("answers in the establishment's own wall clock", () => {
    expect(formatDateTime(INSTANT, 'Europe/Paris')).toBe('12 mars 2026 à 19:30')
  })

  it('falls back to UTC rather than throwing on a mistyped timezone', () => {
    expect(formatDateTime(INSTANT, 'Not/AZone')).toBe('12 mars 2026 à 18:30')
  })

  it('returns nothing for an unusable timestamp', () => {
    expect(formatDateTime(Number.NaN)).toBe('')
  })
})

describe('fulfilmentLines', () => {
  it('gives a delivery order the address it is going to', () => {
    const { heading, detail } = fulfilmentLines(BASE)

    expect(heading).toBe('Livraison')
    expect(detail).toEqual(['5 avenue de la Gare, 69002 Lyon', 'Interphone 42'])
  })

  it('gives a pickup order the restaurant, never a delivery address', () => {
    const { heading, detail } = fulfilmentLines({
      ...BASE,
      type: 'pickup',
      deliveryAddress: undefined,
    })

    expect(heading).toBe('À récupérer sur place')
    expect(detail).toEqual(['12 rue des Lilas, 69003 Lyon', '04 78 00 00 00'])
  })

  it('gives a dine-in order neither', () => {
    const { heading, detail } = fulfilmentLines({ ...BASE, type: 'dine_in' })

    expect(heading).toBe('Sur place')
    expect(detail).toEqual([])
  })
})

describe('timingLine', () => {
  it('prefers the time the diner asked for', () => {
    expect(
      timingLine(
        { ...BASE, scheduledFor: Date.UTC(2026, 2, 12, 18, 30), estimatedPrepTime: 20 },
        'Europe/Paris'
      )
    ).toBe('Prévue pour le 12 mars 2026 à 19:30')
  })

  it("falls back to the kitchen's estimate", () => {
    expect(timingLine({ ...BASE, estimatedPrepTime: 20 })).toBe(
      'Prête dans environ 20 minutes'
    )
  })

  it('says nothing when there is nothing to say', () => {
    expect(timingLine(BASE)).toBeUndefined()
  })
})

describe('paymentMethodLabel', () => {
  it('names the providers in the diner\'s own words', () => {
    expect(paymentMethodLabel('card')).toBe('Carte bancaire')
    expect(paymentMethodLabel('sumup')).toBe('Carte bancaire')
    expect(paymentMethodLabel('paypal')).toBe('PayPal')
    expect(paymentMethodLabel('cash')).toBe('Espèces')
  })

  it('says nothing rather than something wrong', () => {
    expect(paymentMethodLabel(undefined)).toBeUndefined()
    expect(paymentMethodLabel('some_new_provider')).toBeUndefined()
  })
})

describe('escapeHtml', () => {
  it('neutralises markup', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    )
    expect(escapeHtml(`Tom & "Jerry" 'co'`)).toBe(
      'Tom &amp; &quot;Jerry&quot; &#39;co&#39;'
    )
  })
})

describe('renderOrderConfirmationHtml', () => {
  it('names the restaurant, so the email is not from nobody', () => {
    const html = renderOrderConfirmationHtml(BASE)

    expect(html).toContain('Chez Luigi')
    expect(html).toContain('ORD-2026-0001')
    expect(html).toContain('Camille Martin')
  })

  it('prices every line and the total in euros', () => {
    const html = renderOrderConfirmationHtml(BASE)

    expect(html).toContain('2 × Pizza Margherita')
    expect(html).toContain('24,00\u00A0€')
    expect(html).toContain('3,00\u00A0€')
    expect(html).toContain('Total payé')
    expect(html).toContain('31,90\u00A0€')
  })

  it('states the VAT contained in the total, one line per rate', () => {
    const html = renderOrderConfirmationHtml({
      ...BASE,
      taxBreakdown: [
        { ratePercent: 10, taxAmount: 200 },
        { ratePercent: 20, taxAmount: 45 },
      ],
    })

    expect(html).toContain('dont TVA 10\u00A0%')
    expect(html).toContain('dont TVA 20\u00A0%')
  })

  it('falls back to a single VAT line for an order with no breakdown', () => {
    const html = renderOrderConfirmationHtml({ ...BASE, taxBreakdown: undefined })

    expect(html).toContain('dont TVA')
    expect(html).toContain('2,45\u00A0€')
  })

  it('says nothing about VAT when nothing was taxed', () => {
    const html = renderOrderConfirmationHtml({
      ...BASE,
      taxAmount: 0,
      taxBreakdown: [],
    })

    expect(html).not.toContain('TVA')
  })

  it('omits the delivery row on a pickup order', () => {
    const html = renderOrderConfirmationHtml({
      ...BASE,
      type: 'pickup',
      deliveryFee: undefined,
      deliveryAddress: undefined,
      total: 2700,
    })

    expect(html).not.toContain('Livraison')
    expect(html).toContain('À récupérer sur place')
  })

  it('escapes the note the diner typed', () => {
    const html = renderOrderConfirmationHtml({
      ...BASE,
      notes: '<img src=x onerror="alert(1)">',
      items: [
        {
          name: '<b>Pizza</b>',
          quantity: 1,
          subtotal: 1000,
          notes: '</td><script>alert(2)</script>',
        },
      ],
    })

    expect(html).not.toContain('<script>')
    expect(html).not.toContain('onerror="alert(1)"')
    expect(html).toContain('&lt;b&gt;Pizza&lt;/b&gt;')
  })

  it('offers the live order page when there is one', () => {
    const html = renderOrderConfirmationHtml(BASE)

    expect(html).toContain('https://chez-luigi.fr/order/abc?token=xyz')
    expect(html).toContain('Suivre ma commande')
  })

  it('offers no button at all when the order has no view token', () => {
    const html = renderOrderConfirmationHtml({ ...BASE, trackingUrl: undefined })

    expect(html).not.toContain('Suivre ma commande')
  })

  it('shows a discount as money off, not money on', () => {
    const html = renderOrderConfirmationHtml({ ...BASE, discount: 500, total: 2690 })

    expect(html).toContain('Remise')
    expect(html).toContain('−5,00\u00A0€')
  })
})

describe('renderOrderConfirmationText', () => {
  it('carries the same facts as the HTML part', () => {
    const text = renderOrderConfirmationText(BASE, { timeZone: 'Europe/Paris' })

    expect(text).toContain('Chez Luigi a bien reçu votre commande ORD-2026-0001')
    expect(text).toContain('2 × Pizza Margherita  24,00\u00A0€')
    expect(text).toContain('Taille : Grande')
    expect(text).toContain('Livraison : 4,90\u00A0€')
    expect(text).toContain('Total payé : 31,90\u00A0€')
    expect(text).toContain('Réglée par : Carte bancaire')
    expect(text).toContain('5 avenue de la Gare, 69002 Lyon')
    expect(text).toContain('https://chez-luigi.fr/order/abc?token=xyz')
  })

  it('carries no HTML', () => {
    const text = renderOrderConfirmationText({
      ...BASE,
      notes: '<script>alert(1)</script>',
    })

    expect(text).not.toContain('<div')
    expect(text).not.toContain('style=')
  })
})

describe('renderOrderConfirmation', () => {
  it('returns the three parts a sender needs', () => {
    const rendered = renderOrderConfirmation(BASE, { timeZone: 'Europe/Paris' })

    expect(rendered.subject).toBe(
      'Chez Luigi : votre commande ORD-2026-0001 est confirmée'
    )
    expect(rendered.html).toContain('<!DOCTYPE html>')
    expect(rendered.text).not.toContain('<!DOCTYPE html>')
  })

  it('renders an order with nothing optional on it at all', () => {
    // A dine-in cash order from a guest who gave a name and no more. Every
    // optional field absent is the common case, not the edge case.
    const bare: OrderConfirmationInput = {
      orderNumber: 'ORD-2026-0002',
      customerName: 'Alex',
      type: 'dine_in',
      store: { name: 'Le Comptoir' },
      items: [{ name: 'Café', quantity: 1, subtotal: 200 }],
      subtotal: 200,
      taxAmount: 0,
      total: 200,
    }

    const rendered = renderOrderConfirmation(bare)

    expect(rendered.subject).toContain('Le Comptoir')
    expect(rendered.html).toContain('2,00\u00A0€')
    expect(rendered.text).toContain('SUR PLACE')
    expect(rendered.html).not.toContain('undefined')
    expect(rendered.text).not.toContain('undefined')
  })
})

describe("an order that has not been paid for yet", () => {
  // A cash order-ahead: confirmed at checkout, collected for at handover. The
  // email must not thank the diner for a payment they have not made.
  const PENDING: OrderConfirmationInput = {
    ...BASE,
    type: "pickup",
    deliveryAddress: undefined,
    deliveryFee: undefined,
    paymentMethod: "cash",
    paymentPending: true,
    total: 2700,
  }

  it("does not claim the money arrived", () => {
    expect(confirmationHeadline(PENDING)).toBe(
      "Chez Luigi a bien reçu votre commande ORD-2026-0001."
    )
    expect(confirmationHeadline(BASE)).toBe(
      "Chez Luigi a bien reçu votre commande ORD-2026-0001 et votre paiement."
    )
  })

  it("says where the money is due", () => {
    expect(paymentDueLine(PENDING)).toBe("À régler sur place")
    expect(paymentDueLine({ ...PENDING, type: "delivery" })).toBe(
      "À régler à la livraison"
    )
    expect(paymentDueLine(BASE)).toBeUndefined()
  })

  it("labels the total as owed rather than settled", () => {
    const html = renderOrderConfirmationHtml(PENDING)

    expect(html).toContain("Total à régler")
    expect(html).not.toContain("Total payé")
    expect(html).toContain("À régler sur place")
    // And never both stories at once.
    expect(html).not.toContain("Réglée par")
  })

  it("carries the same story in the plain text part", () => {
    const text = renderOrderConfirmationText(PENDING)

    expect(text).toContain("Total à régler : 27,00\u00A0€")
    expect(text).toContain("À régler sur place")
    expect(text).not.toContain("et votre paiement")
  })
})

describe("clamp", () => {
  it("leaves ordinary text alone", () => {
    expect(clamp("sans oignons")).toBe("sans oignons")
    expect(clamp("  espacé  ")).toBe("espacé")
  })

  it("cuts free text an email cannot carry", () => {
    // Nothing caps `customerInfo.name` or the notes on the way in, and an
    // uncapped note is a message SES refuses — which is a diner who hears
    // nothing, the exact failure this email exists to close.
    const long = "a".repeat(5000)
    const clamped = clamp(long)

    expect(clamped.length).toBe(500)
    expect(clamped.endsWith("…")).toBe(true)
  })

  it("is applied to every field a stranger can write", () => {
    const html = renderOrderConfirmationHtml({
      ...BASE,
      customerName: "c".repeat(400),
      notes: "n".repeat(2000),
      store: { ...BASE.store, name: "s".repeat(400) },
      items: [
        {
          name: "Pizza",
          quantity: 1,
          subtotal: 1000,
          notes: "i".repeat(2000),
          options: ["o".repeat(400)],
        },
      ],
    })

    expect(html).not.toContain("n".repeat(600))
    expect(html).not.toContain("i".repeat(600))
    expect(html).not.toContain("o".repeat(200))
    expect(html).not.toContain("c".repeat(200))
  })

  it("keeps the subject to a length a mail client will show", () => {
    const subject = renderOrderConfirmation({
      ...BASE,
      store: { ...BASE.store, name: "s".repeat(500) },
    }).subject

    expect(subject.length).toBeLessThan(160)
  })
})
