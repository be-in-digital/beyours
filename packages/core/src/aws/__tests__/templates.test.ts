/**
 * Tests for the email templates
 */

import { describe, it, expect } from 'vitest'
import {
  orderConfirmationTemplate,
  passwordResetTemplate,
  welcomeTemplate,
  prizeWonTemplate,
  getTemplate,
  type OrderConfirmationData,
  type SESPasswordResetData,
  type WelcomeData,
  type PrizeWonData,
} from '../ses/templates'

describe('Email Templates', () => {
  /**
   * These assertions used to bless the defect they were written over.
   *
   * The old fixture passed `total: 34.0` and `price: 12.5` and expected
   * `34.00€` back — amounts in EUROS, while every amount in `orders` is in
   * CENTS. The template was never called by anything, so the mismatch cost
   * nothing; wiring it up as it stood would have told a diner their 34 €
   * dinner came to 3 400,00 €. The test asserted the wrong unit, and a green
   * test on top of the bug is why it survived. It now asserts cents.
   */
  describe('orderConfirmationTemplate', () => {
    const mockData: OrderConfirmationData = {
      orderNumber: 'ORD-2026-0001',
      customerName: 'Camille Martin',
      type: 'delivery',
      store: {
        name: 'Chez Luigi',
        address: {
          street: '12 rue des Lilas',
          city: 'Lyon',
          postalCode: '69003',
        },
        phone: '04 78 00 00 00',
      },
      items: [
        { name: 'Pizza Margherita', quantity: 2, subtotal: 2500 },
        { name: 'Coca Cola', quantity: 3, subtotal: 900 },
      ],
      subtotal: 3400,
      taxAmount: 309,
      total: 3400,
      deliveryAddress: {
        street: '5 avenue de la Gare',
        city: 'Lyon',
        postalCode: '69002',
      },
    }

    it('names the establishment and the order in the subject', () => {
      const subject = orderConfirmationTemplate.subject(mockData)
      expect(subject).toBe(
        'Chez Luigi : votre commande ORD-2026-0001 est confirmée'
      )
    })

    it('generates valid HTML', () => {
      const html = orderConfirmationTemplate.html(mockData)

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('ORD-2026-0001')
      expect(html).toContain('Camille Martin')
      expect(html).toContain('Chez Luigi')
      expect(html).toContain('Pizza Margherita')
      expect(html).toContain('Coca Cola')
      expect(html).toContain('5 avenue de la Gare, 69002 Lyon')
    })

    it('renders cents as euros, not as euros again', () => {
      const html = orderConfirmationTemplate.html(mockData)

      // 3400 cents is 34,00 € — not 3 400,00 €, which is what reading the
      // stored amount as euros produced.
      expect(html).toContain('34,00\u00A0€')
      expect(html).not.toContain('3 400,00')
    })

    it('generates the right plain text', () => {
      const text = orderConfirmationTemplate.text(mockData)

      expect(text).toContain('votre commande ORD-2026-0001')
      expect(text).toContain('Camille Martin')
      expect(text).toContain('2 × Pizza Margherita  25,00\u00A0€')
      expect(text).toContain('Total payé : 34,00\u00A0€')
    })

    it('states the VAT contained in the total rather than adding it', () => {
      const text = orderConfirmationTemplate.text(mockData)

      expect(text).toContain('dont TVA : 3,09\u00A0€')
      expect(text).toContain('Total payé : 34,00\u00A0€')
    })
  })

  describe('passwordResetTemplate', () => {
    const mockData: SESPasswordResetData = {
      userName: 'Jane Doe',
      resetLink: 'https://example.com/reset?token=xyz123',
      expirationTime: '24 heures',
    }

    it('generates the right subject', () => {
      const subject = passwordResetTemplate.subject(mockData)
      expect(subject).toBe('Réinitialisation de votre mot de passe')
    })

    it('generates valid HTML with the link', () => {
      const html = passwordResetTemplate.html(mockData)

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('Jane Doe')
      expect(html).toContain('href="https://example.com/reset?token=xyz123"')
      expect(html).toContain('24 heures')
      expect(html).toContain('⚠️')
    })

    it('generates plain text with the warning', () => {
      const text = passwordResetTemplate.text(mockData)

      expect(text).toContain('Jane Doe')
      expect(text).toContain('https://example.com/reset?token=xyz123')
      expect(text).toContain('expire dans 24 heures')
      expect(text).toContain('⚠️')
    })
  })

  describe('welcomeTemplate', () => {
    const mockData: WelcomeData = {
      userName: 'Alice Smith',
      dashboardLink: 'https://example.com/dashboard',
    }

    it('generates a personalized subject', () => {
      const subject = welcomeTemplate.subject(mockData)
      expect(subject).toBe('Bienvenue Alice Smith !')
    })

    it('generates HTML with the features', () => {
      const html = welcomeTemplate.html(mockData)

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('Alice Smith')
      expect(html).toContain('href="https://example.com/dashboard"')
      expect(html).toContain('Gestion de vos commandes')
      expect(html).toContain('Suivi en temps réel')
      expect(html).toContain('✅')
    })

    it('generates plain text with the feature list', () => {
      const text = welcomeTemplate.text(mockData)

      expect(text).toContain('Alice Smith')
      expect(text).toContain('https://example.com/dashboard')
      expect(text).toContain('✅ Gestion de vos commandes')
      expect(text).toContain('✅ Suivi en temps réel')
    })
  })

  describe('prizeWonTemplate', () => {
    const mockData: PrizeWonData = {
      customerName: 'Bob Johnson',
      prizeName: 'Dessert gratuit',
      qrCode: 'https://example.com/qr/abc123.png',
      expirationDate: '2026-03-15',
    }

    it('generates a subject with the emoji and the prize name', () => {
      const subject = prizeWonTemplate.subject(mockData)
      expect(subject).toBe('🎉 Félicitations ! Vous avez gagné : Dessert gratuit')
    })

    it('generates HTML with the QR code', () => {
      const html = prizeWonTemplate.html(mockData)

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('Bob Johnson')
      expect(html).toContain('Dessert gratuit')
      expect(html).toContain('src="https://example.com/qr/abc123.png"')
      expect(html).toContain('2026-03-15')
      expect(html).toContain('🎉')
      expect(html).toContain('⏰')
    })

    it('generates plain text with the prize details', () => {
      const text = prizeWonTemplate.text(mockData)

      expect(text).toContain('Bob Johnson')
      expect(text).toContain('Dessert gratuit')
      expect(text).toContain('2026-03-15')
      expect(text).toContain('🎉')
      expect(text).toContain('🏆')
    })
  })

  describe('getTemplate', () => {
    it('returns the orderConfirmation template', () => {
      const template = getTemplate('orderConfirmation')
      expect(template.name).toBe('orderConfirmation')
    })

    it('returns the passwordReset template', () => {
      const template = getTemplate('passwordReset')
      expect(template.name).toBe('passwordReset')
    })

    it('returns the welcome template', () => {
      const template = getTemplate('welcome')
      expect(template.name).toBe('welcome')
    })

    it('returns the prizeWon template', () => {
      const template = getTemplate('prizeWon')
      expect(template.name).toBe('prizeWon')
    })

    it('rejects a template that does not exist', () => {
      expect(() =>
        // @ts-expect-error - Error-path test
        getTemplate('nonexistent')
      ).toThrow('Template "nonexistent" introuvable')
    })
  })

  describe('HTML Validity', () => {
    it('every template generates well-formed HTML', () => {
      const templates = [
        orderConfirmationTemplate,
        passwordResetTemplate,
        welcomeTemplate,
        prizeWonTemplate,
      ]

      const mockDatas = [
        {
          orderNumber: 'TEST',
          customerName: 'Test',
          type: 'pickup',
          store: { name: 'Test' },
          items: [],
          subtotal: 0,
          taxAmount: 0,
          total: 0,
        },
        {
          userName: 'Test',
          resetLink: 'https://test.com',
          expirationTime: '1h',
        },
        { userName: 'Test', dashboardLink: 'https://test.com' },
        {
          customerName: 'Test',
          prizeName: 'Test',
          qrCode: 'https://test.com/qr.png',
          expirationDate: '2026-01-01',
        },
      ] as const

      templates.forEach((template, index) => {
        const html = template.html(mockDatas[index] as any)

        expect(html).toContain('<!DOCTYPE html>')
        expect(html).toMatch(/<html(\s[^>]*)?>/)
        expect(html).toContain('</html>')
        expect(html).toContain('<head>')
        expect(html).toMatch(/<body(\s[^>]*)?>/)
        expect(html).toContain('charset="utf-8"')
      })
    })
  })
})
