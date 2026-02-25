/**
 * Tests for sourceHash utility
 */

import { describe, it, expect } from 'vitest'
import { computeSourceHash, normalizeText } from '../hash'

describe('normalizeText', () => {
  it('trims whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeText('hello   world')).toBe('hello world')
  })

  it('normalizes line endings', () => {
    expect(normalizeText('hello\r\nworld')).toBe('hello world')
  })

  it('handles tabs and newlines', () => {
    expect(normalizeText('hello\t\n  world')).toBe('hello world')
  })

  it('handles empty string', () => {
    expect(normalizeText('')).toBe('')
  })

  it('handles single word', () => {
    expect(normalizeText('pizza')).toBe('pizza')
  })
})

describe('computeSourceHash', () => {
  it('returns a hex string', () => {
    const hash = computeSourceHash('Hello world')
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('returns consistent hash for same input', () => {
    const hash1 = computeSourceHash('Pizza Margherita')
    const hash2 = computeSourceHash('Pizza Margherita')
    expect(hash1).toBe(hash2)
  })

  it('returns different hashes for different inputs', () => {
    const hash1 = computeSourceHash('Pizza Margherita')
    const hash2 = computeSourceHash('Pizza Napolitaine')
    expect(hash1).not.toBe(hash2)
  })

  it('normalizes before hashing — extra spaces produce same hash', () => {
    const hash1 = computeSourceHash('Pizza Margherita')
    const hash2 = computeSourceHash('  Pizza   Margherita  ')
    expect(hash1).toBe(hash2)
  })

  it('normalizes before hashing — different line endings produce same hash', () => {
    const hash1 = computeSourceHash('hello\nworld')
    const hash2 = computeSourceHash('hello\r\nworld')
    expect(hash1).toBe(hash2)
  })

  it('handles empty string', () => {
    const hash = computeSourceHash('')
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('handles unicode characters', () => {
    const hash = computeSourceHash('Crème brûlée aux fruits rouges')
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('handles emojis', () => {
    const hash = computeSourceHash('🍕 Pizza')
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })
})
