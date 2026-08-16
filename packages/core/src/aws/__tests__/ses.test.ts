/**
 * Tests for the SES service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSESService } from '../ses/client'
import type { SESConfig } from '../types'
import type { SESOperations } from '../ses/types'

describe('SES Service', () => {
  const mockConfig: SESConfig = {
    region: 'eu-west-1',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    fromEmail: 'noreply@example.com',
    fromName: 'BeYours',
    replyToEmail: 'support@example.com',
  }

  let mockClient: SESOperations

  beforeEach(() => {
    mockClient = {
      sendEmail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
      sendTemplatedEmail: vi
        .fn()
        .mockResolvedValue({ messageId: 'test-template-message-id' }),
    }
  })

  describe('sendEmail', () => {
    it('sends a simple email', async () => {
      const service = createSESService(mockConfig, mockClient)

      const result = await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Hello World</p>',
        text: 'Hello World',
      })

      expect(result).toEqual({ messageId: 'test-message-id' })
      expect(mockClient.sendEmail).toHaveBeenCalledWith({
        from: 'BeYours <noreply@example.com>',
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Hello World</p>',
        text: 'Hello World',
        replyTo: 'support@example.com',
      })
    })

    it('sends to several recipients', async () => {
      const service = createSESService(mockConfig, mockClient)

      await service.sendEmail({
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Test Email',
        html: '<p>Hello</p>',
      })

      expect(mockClient.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user1@example.com', 'user2@example.com'],
        })
      )
    })

    it('uses a custom replyTo', async () => {
      const service = createSESService(mockConfig, mockClient)

      await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        replyTo: 'custom@example.com',
      })

      expect(mockClient.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: 'custom@example.com',
        })
      )
    })

    it('rejects an invalid email', async () => {
      const service = createSESService(mockConfig, mockClient)

      await expect(
        service.sendEmail({
          to: 'invalid-email',
          subject: 'Test',
          html: '<p>Test</p>',
        })
      ).rejects.toThrow()
    })

    it('rejects an empty subject', async () => {
      const service = createSESService(mockConfig, mockClient)

      await expect(
        service.sendEmail({
          to: 'user@example.com',
          subject: '',
          html: '<p>Test</p>',
        })
      ).rejects.toThrow()
    })

    it('formats the sender without a name when fromName is missing', async () => {
      const configWithoutName = { ...mockConfig, fromName: undefined }
      const service = createSESService(configWithoutName, mockClient)

      await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      })

      expect(mockClient.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@example.com',
        })
      )
    })
  })

  describe('sendTemplatedEmail', () => {
    it('sends an email with the orderConfirmation template', async () => {
      const service = createSESService(mockConfig, mockClient)

      const result = await service.sendTemplatedEmail({
        to: 'customer@example.com',
        templateName: 'orderConfirmation',
        templateData: {
          orderNumber: 'ORD-12345',
          customerName: 'John Doe',
          items: [
            { name: 'Pizza', quantity: 2, price: 12.5 },
            { name: 'Drink', quantity: 1, price: 3.5 },
          ],
          total: 28.5,
          address: '123 Main St, Paris',
        },
      })

      expect(result).toEqual({ messageId: 'test-message-id' })
      expect(mockClient.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          subject: 'Commande confirmée - #ORD-12345',
          html: expect.stringContaining('ORD-12345'),
          text: expect.stringContaining('ORD-12345'),
        })
      )
    })

    it('sends an email with the passwordReset template', async () => {
      const service = createSESService(mockConfig, mockClient)

      await service.sendTemplatedEmail({
        to: 'user@example.com',
        templateName: 'passwordReset',
        templateData: {
          userName: 'Jane Doe',
          resetLink: 'https://example.com/reset?token=xyz',
          expirationTime: '24 heures',
        },
      })

      expect(mockClient.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Réinitialisation de votre mot de passe',
          html: expect.stringContaining('https://example.com/reset?token=xyz'),
        })
      )
    })

    it('sends an email with the welcome template', async () => {
      const service = createSESService(mockConfig, mockClient)

      await service.sendTemplatedEmail({
        to: 'newuser@example.com',
        templateName: 'welcome',
        templateData: {
          userName: 'Alice',
          dashboardLink: 'https://example.com/dashboard',
        },
      })

      expect(mockClient.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Bienvenue Alice !',
          html: expect.stringContaining('Alice'),
        })
      )
    })

    it('sends an email with the prizeWon template', async () => {
      const service = createSESService(mockConfig, mockClient)

      await service.sendTemplatedEmail({
        to: 'winner@example.com',
        templateName: 'prizeWon',
        templateData: {
          customerName: 'Bob',
          prizeName: 'Dessert gratuit',
          qrCode: 'https://example.com/qr/abc123.png',
          expirationDate: '2026-03-01',
        },
      })

      expect(mockClient.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '🎉 Félicitations ! Vous avez gagné : Dessert gratuit',
          html: expect.stringContaining('Dessert gratuit'),
        })
      )
    })

    it('rejects a template that does not exist', async () => {
      const service = createSESService(mockConfig, mockClient)

      await expect(
        service.sendTemplatedEmail({
          to: 'user@example.com',
          templateName: 'nonexistent' as any,
          templateData: {} as any,
        })
      ).rejects.toThrow('Template "nonexistent" introuvable')
    })
  })

  describe('sendBulkEmail', () => {
    it('sends several emails with rate limiting', async () => {
      const service = createSESService(mockConfig, mockClient)

      const result = await service.sendBulkEmail({
        recipients: [
          {
            to: 'user1@example.com',
            subject: 'Newsletter',
            html: '<p>Content 1</p>',
          },
          {
            to: 'user2@example.com',
            subject: 'Newsletter',
            html: '<p>Content 2</p>',
          },
          {
            to: 'user3@example.com',
            subject: 'Newsletter',
            html: '<p>Content 3</p>',
          },
        ],
      })

      expect(result.results).toHaveLength(3)
      expect(result.results.every((r) => r.messageId)).toBe(true)
      expect(mockClient.sendEmail).toHaveBeenCalledTimes(3)
    })

    it('handles partial failures', async () => {
      mockClient.sendEmail = vi
        .fn()
        .mockResolvedValueOnce({ messageId: 'msg-1' })
        .mockRejectedValueOnce(new Error('Sending failed'))
        .mockResolvedValueOnce({ messageId: 'msg-3' })

      const service = createSESService(mockConfig, mockClient)

      const result = await service.sendBulkEmail({
        recipients: [
          {
            to: 'user1@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
          },
          {
            to: 'user2@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
          },
          {
            to: 'user3@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
          },
        ],
      })

      expect(result.results).toEqual([
        { to: 'user1@example.com', messageId: 'msg-1' },
        { to: 'user2@example.com', error: 'Sending failed' },
        { to: 'user3@example.com', messageId: 'msg-3' },
      ])
    })

    it(
      'splits into batches of 50 emails',
      async () => {
        const service = createSESService(mockConfig, mockClient)

        const recipients = Array.from({ length: 120 }, (_, i) => ({
          to: `user${i}@example.com`,
          subject: 'Bulk',
          html: '<p>Bulk</p>',
        }))

        await service.sendBulkEmail({ recipients })

        // 120 emails = 3 batches (50 + 50 + 20)
        expect(mockClient.sendEmail).toHaveBeenCalledTimes(120)
      },
      15000 // 15s timeout to accommodate rate limiting
    )

    it('rejects an empty list', async () => {
      const service = createSESService(mockConfig, mockClient)

      await expect(
        service.sendBulkEmail({ recipients: [] })
      ).rejects.toThrow()
    })

    it('uses replyToEmail by default', async () => {
      const service = createSESService(mockConfig, mockClient)

      await service.sendBulkEmail({
        recipients: [
          {
            to: 'user@example.com',
            subject: 'Test',
            html: '<p>Test</p>',
          },
        ],
      })

      expect(mockClient.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: 'support@example.com',
        })
      )
    })
  })
})
