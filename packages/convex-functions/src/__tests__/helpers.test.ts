import { describe, it, expect } from 'vitest'
import { generateOrderNumber, generateSlug, now } from '../helpers'

describe('helpers', () => {
  describe('generateOrderNumber', () => {
    it('should generate order number with correct format', () => {
      const orderNumber = generateOrderNumber()

      // Format: ORD-YYYY-XXXX
      expect(orderNumber).toMatch(/^ORD-\d{4}-[A-Z0-9]{6}$/)
    })

    it('should include current year', () => {
      const orderNumber = generateOrderNumber()
      const currentYear = new Date().getFullYear()

      expect(orderNumber).toContain(`ORD-${currentYear}`)
    })

    it('should generate unique order numbers', () => {
      const order1 = generateOrderNumber()
      const order2 = generateOrderNumber()

      expect(order1).not.toBe(order2)
    })
  })

  describe('generateSlug', () => {
    it('should convert text to lowercase slug', () => {
      expect(generateSlug('Hello World')).toBe('hello-world')
    })

    it('should remove accents', () => {
      expect(generateSlug('Café Français')).toBe('cafe-francais')
      expect(generateSlug('Niño España')).toBe('nino-espana')
    })

    it('should replace spaces with hyphens', () => {
      expect(generateSlug('My Super Product')).toBe('my-super-product')
    })

    it('should remove special characters', () => {
      expect(generateSlug('Product #1 (Special!)')).toBe('product-1-special')
    })

    it('should remove leading and trailing hyphens', () => {
      expect(generateSlug('  -Product-  ')).toBe('product')
    })

    it('should handle multiple consecutive spaces', () => {
      expect(generateSlug('Product    Name')).toBe('product-name')
    })

    it('should handle empty string', () => {
      expect(generateSlug('')).toBe('')
    })
  })

  describe('now', () => {
    it('should return a number', () => {
      expect(typeof now()).toBe('number')
    })

    it('should return current timestamp', () => {
      const before = Date.now()
      const result = now()
      const after = Date.now()

      expect(result).toBeGreaterThanOrEqual(before)
      expect(result).toBeLessThanOrEqual(after)
    })

    it('should return timestamp in milliseconds', () => {
      const timestamp = now()

      // Should be a reasonable timestamp (after 2020)
      expect(timestamp).toBeGreaterThan(1577836800000) // 2020-01-01
    })
  })
})
