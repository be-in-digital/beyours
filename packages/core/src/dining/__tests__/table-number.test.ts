import { describe, it, expect } from 'vitest'
import {
  MAX_TABLE_NUMBER_LENGTH,
  isValidTableNumber,
  normalizeTableNumber,
} from '../table-number'

describe('normalizeTableNumber', () => {
  it('keeps a plain number', () => {
    expect(normalizeTableNumber('12')).toBe('12')
  })

  it('keeps a label that is not a number', () => {
    // Dining rooms use these. Parsing the field as an integer would reject
    // half of them.
    expect(normalizeTableNumber('A3')).toBe('A3')
    expect(normalizeTableNumber('Terrasse 4')).toBe('Terrasse 4')
    expect(normalizeTableNumber('Bar 2')).toBe('Bar 2')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeTableNumber('  7  ')).toBe('7')
  })

  it('collapses internal whitespace so one table is one label', () => {
    expect(normalizeTableNumber('Table   4')).toBe('Table 4')
    expect(normalizeTableNumber('Table\t4')).toBe('Table 4')
  })

  it('returns undefined rather than an empty string', () => {
    // An empty string stored on an order is indistinguishable from a real
    // label until something prints it, and then the slip reads "TABLE" with
    // nothing after it — which looks like a fault, not a missing entry.
    expect(normalizeTableNumber('')).toBeUndefined()
    expect(normalizeTableNumber('   ')).toBeUndefined()
    expect(normalizeTableNumber('\t\n')).toBeUndefined()
  })

  it('returns undefined for a label made only of invisible characters', () => {
    // `\\s` matches NBSP and the BOM but not the zero-width family, so a label
    // pasted from Word as a lone U+200B used to survive `trim()` as a
    // one-character string: the storefront's required check saw a truthy
    // value, the server accepted it, and the slip printed `TABLE` with nothing
    // after it.
    for (const invisible of ['\u200b', '\u200c', '\u200d', '\u2060', '\ufeff', '\u00ad']) {
      expect(normalizeTableNumber(invisible)).toBeUndefined()
    }
  })

  it('strips control characters out of a real label', () => {
    // U+001B is the ESC/POS lead byte, and this label is bound for a printer.
    expect(normalizeTableNumber('A\u001b3')).toBe('A3')
    expect(normalizeTableNumber('12\u0000')).toBe('12')
  })

  it('strips a bidi override rather than printing a reversed table', () => {
    expect(normalizeTableNumber('\u202e12')).toBe('12')
  })

  it('keeps an invisible character from faking a valid label', () => {
    expect(isValidTableNumber(normalizeTableNumber('\u200b'))).toBe(true)
    expect(normalizeTableNumber('\u200b')).toBeUndefined()
  })

  it('returns undefined for a missing value', () => {
    expect(normalizeTableNumber(undefined)).toBeUndefined()
    expect(normalizeTableNumber(null)).toBeUndefined()
  })
})

describe('isValidTableNumber', () => {
  it('accepts a normal label', () => {
    expect(isValidTableNumber('12')).toBe(true)
    expect(isValidTableNumber('Terrasse 4')).toBe(true)
  })

  it('accepts undefined, because the field is optional everywhere', () => {
    expect(isValidTableNumber(undefined)).toBe(true)
  })

  it('accepts a label exactly at the limit', () => {
    expect(isValidTableNumber('T'.repeat(MAX_TABLE_NUMBER_LENGTH))).toBe(true)
  })

  it('rejects a label past the limit', () => {
    // A slip is 48mm or 72mm wide and the table is one line of it; past this
    // it is a paste accident that would push the rest off the roll.
    expect(isValidTableNumber('T'.repeat(MAX_TABLE_NUMBER_LENGTH + 1))).toBe(false)
  })

  it('rejects an empty string, which normalisation should never produce', () => {
    expect(isValidTableNumber('')).toBe(false)
  })
})
