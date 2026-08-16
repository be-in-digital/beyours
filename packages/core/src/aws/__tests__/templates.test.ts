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
  describe('orderConfirmationTemplate', () => {
    const mockData: OrderConfirmationData = {
      orderNumber: 'ORD-12345',
      customerName: 'John Doe',
      items: [
        { name: 'Pizza Margherita', quantity: 2, price: 12.5 },
        { name: 'Coca Cola', quantity: 3, price: 3.0 },
      ],
      total: 34.0,
      address: '123 Main Street, Paris, France',
    }

    it('generates the right subject', () => {
      const subject = orderConfirmationTemplate.subject(mockData)
      expect(subject).toBe('Commande confirmée - #ORD-12345')
    })

    it('generates valid HTML', () => {
      const html = orderConfirmationTemplate.html(mockData)

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('ORD-12345')
      expect(html).toContain('John Doe')
      expect(html).toContain('Pizza Margherita')
      expect(html).toContain('Coca Cola')
      expect(html).toContain('34.00€')
      expect(html).toContain('123 Main Street, Paris, France')
    })

    it('generates the right plain text', () => {
      const text = orderConfirmationTemplate.text(mockData)

      expect(text).toContain('Commande confirmée')
      expect(text).toContain('ORD-12345')
      expect(text).toContain('John Doe')
      expect(text).toContain('Pizza Margherita x 2 - 12.50€')
      expect(text).toContain('Total : 34.00€')
    })

    it('interpolates the data correctly', () => {
      const html = orderConfirmationTemplate.html(mockData)

      // Check that the quantities and prices are right
      expect(html).toContain('x 2')
      expect(html).toContain('x 3')
      expect(html).toContain('12.50')
      expect(html).toContain('3.00')
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
          items: [],
          total: 0,
          address: 'Test',
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
        expect(html).toContain('<html>')
        expect(html).toContain('</html>')
        expect(html).toContain('<head>')
        expect(html).toContain('<body>')
        expect(html).toContain('charset="utf-8"')
      })
    })
  })
})
