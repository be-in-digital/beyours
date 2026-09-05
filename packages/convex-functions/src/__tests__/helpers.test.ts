import { describe, it, expect } from 'vitest'
import { generateOrderNumber, generateSlug, now } from '../helpers'

describe('helpers', () => {
  /**
   * These assertions blessed the defect they sat on top of.
   *
   * `toMatch(/^ORD-\d{4}-[A-Z0-9]{6}$/)` asserted the RANDOM format, against a
   * schema whose own comment promised `ORD-2026-0001` — so the test agreed with
   * the code and both disagreed with the documented contract. Worse,
   * "should generate unique order numbers" compared two consecutive calls and
   * passed, which reads as proof of uniqueness and is nothing of the kind: it
   * is one draw from 36^6, and the function was called with no uniqueness check
   * against the database at any of its three call sites.
   *
   * The function is now deprecated and uncalled; `numbering.ts` replaced it.
   * What is asserted here is only what is still true of it, plus the thing the
   * old test claimed and could not show.
   */
  describe('generateOrderNumber (deprecated)', () => {
    it('still produces the legacy random format', () => {
      // Pinned so that the disjointness argument in `formatOrderNumber` — five
      // digits cannot collide with six characters — keeps a test under it.
      expect(generateOrderNumber()).toMatch(/^ORD-\d{4}-[A-Z0-9]{6}$/)
    })

    it('cannot promise uniqueness, which is why it was replaced', () => {
      // 5000 draws from 36^6. A collision here is unlikely but not impossible,
      // and that is precisely the point: the assertion is on the SHAPE of the
      // guarantee, not on a lucky run. `allocateOrderNumber` needs no such
      // hedge — see `numbering.test.ts`.
      const drawn = new Set<string>()
      for (let i = 0; i < 5000; i++) drawn.add(generateOrderNumber())

      expect(drawn.size).toBeLessThanOrEqual(5000)
      expect(drawn.size).toBeGreaterThan(4900)
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
