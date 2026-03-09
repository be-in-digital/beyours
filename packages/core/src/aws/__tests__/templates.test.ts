/**
 * Tests pour les templates d'email
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

    it('devrait générer un sujet correct', () => {
      const subject = orderConfirmationTemplate.subject(mockData)
      expect(subject).toBe('Commande confirmée - #ORD-12345')
    })

    it('devrait générer du HTML valide', () => {
      const html = orderConfirmationTemplate.html(mockData)

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('ORD-12345')
      expect(html).toContain('John Doe')
      expect(html).toContain('Pizza Margherita')
      expect(html).toContain('Coca Cola')
      expect(html).toContain('34.00€')
      expect(html).toContain('123 Main Street, Paris, France')
    })

    it('devrait générer du texte correct', () => {
      const text = orderConfirmationTemplate.text(mockData)

      expect(text).toContain('Commande confirmée')
      expect(text).toContain('ORD-12345')
      expect(text).toContain('John Doe')
      expect(text).toContain('Pizza Margherita x 2 - 12.50€')
      expect(text).toContain('Total : 34.00€')
    })

    it('devrait interpoler les données correctement', () => {
      const html = orderConfirmationTemplate.html(mockData)

      // Vérifier que les quantités et prix sont corrects
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

    it('devrait générer un sujet correct', () => {
      const subject = passwordResetTemplate.subject(mockData)
      expect(subject).toBe('Réinitialisation de votre mot de passe')
    })

    it('devrait générer du HTML valide avec lien', () => {
      const html = passwordResetTemplate.html(mockData)

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('Jane Doe')
      expect(html).toContain('href="https://example.com/reset?token=xyz123"')
      expect(html).toContain('24 heures')
      expect(html).toContain('⚠️')
    })

    it('devrait générer du texte avec avertissement', () => {
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

    it('devrait générer un sujet personnalisé', () => {
      const subject = welcomeTemplate.subject(mockData)
      expect(subject).toBe('Bienvenue Alice Smith !')
    })

    it('devrait générer du HTML avec fonctionnalités', () => {
      const html = welcomeTemplate.html(mockData)

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('Alice Smith')
      expect(html).toContain('href="https://example.com/dashboard"')
      expect(html).toContain('Gestion de vos commandes')
      expect(html).toContain('Suivi en temps réel')
      expect(html).toContain('✅')
    })

    it('devrait générer du texte avec liste de fonctionnalités', () => {
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
      redemptionCode: 'WIN-ABC123',
      expirationDate: '2026-03-15',
      storeName: 'Pizza Roma',
    }

    it('devrait générer un sujet avec nom du prix', () => {
      const subject = prizeWonTemplate.subject(mockData)
      expect(subject).toBe('Félicitations ! Vous avez gagné : Dessert gratuit')
    })

    it('devrait générer du HTML avec code de rédemption', () => {
      const html = prizeWonTemplate.html(mockData)

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('Bob Johnson')
      expect(html).toContain('Dessert gratuit')
      expect(html).toContain('WIN-ABC123')
      expect(html).toContain('2026-03-15')
      expect(html).toContain('Pizza Roma')
    })

    it('devrait générer du texte avec informations du prix', () => {
      const text = prizeWonTemplate.text(mockData)

      expect(text).toContain('Bob Johnson')
      expect(text).toContain('Dessert gratuit')
      expect(text).toContain('WIN-ABC123')
      expect(text).toContain('2026-03-15')
      expect(text).toContain('Pizza Roma')
    })
  })

  describe('getTemplate', () => {
    it('devrait retourner le template orderConfirmation', () => {
      const template = getTemplate('orderConfirmation')
      expect(template.name).toBe('orderConfirmation')
    })

    it('devrait retourner le template passwordReset', () => {
      const template = getTemplate('passwordReset')
      expect(template.name).toBe('passwordReset')
    })

    it('devrait retourner le template welcome', () => {
      const template = getTemplate('welcome')
      expect(template.name).toBe('welcome')
    })

    it('devrait retourner le template prizeWon', () => {
      const template = getTemplate('prizeWon')
      expect(template.name).toBe('prizeWon')
    })

    it('devrait rejeter un template inexistant', () => {
      expect(() =>
        // @ts-expect-error - Test d'erreur
        getTemplate('nonexistent')
      ).toThrow('Template "nonexistent" introuvable')
    })
  })

  describe('HTML Validity', () => {
    it('tous les templates devraient générer du HTML bien formé', () => {
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
          redemptionCode: 'WIN-TEST123',
          expirationDate: '2026-01-01',
          storeName: 'Test Store',
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
