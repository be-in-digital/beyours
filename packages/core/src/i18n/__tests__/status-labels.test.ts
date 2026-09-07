/**
 * The one status vocabulary the storefront reads through.
 *
 * WHAT WENT WRONG: `OrderStatusBadge` and `StoreStatusBadge` in
 * `@be-in-digital/ui` held eleven hardcoded English labels between them, with
 * no override prop, mounted on the diner's French order page and the French
 * store selector — « Preparing », « Out for Delivery », « Temporarily
 * Unavailable » between French sentences, unreachable by the translation layer
 * #148 shipped. There were two more copies of the same words: a private map in
 * the order page and `getOrderStatusLabel` in `@be-in-digital/restaurant`.
 * Four maps, two languages, one set of eleven states.
 *
 * This module is the one they all read now. It holds, per status, the
 * source-language word and the catalogue key — and `resolveStatusLabels` is
 * what turns the second into the first for the locale being rendered.
 */

import { describe, it, expect } from 'vitest'
import {
  ORDER_STATUS_KEYS,
  ORDER_STATUS_VOCABULARY,
  STATUS_LABEL_KEYS,
  STORE_STATUS_KEYS,
  STORE_STATUS_VOCABULARY,
  resolveStatusLabels,
} from '../status-labels'

describe('the vocabulary itself', () => {
  it('covers every order status it declares', () => {
    for (const status of ORDER_STATUS_KEYS) {
      const entry = ORDER_STATUS_VOCABULARY[status]
      expect(entry, status).toBeDefined()
      expect(entry.label.trim(), status).not.toBe('')
      expect(entry.key, status).toMatch(/^[a-z]+\.[A-Za-z]+$/)
    }
  })

  it('covers every store status it declares', () => {
    for (const status of STORE_STATUS_KEYS) {
      const entry = STORE_STATUS_VOCABULARY[status]
      expect(entry, status).toBeDefined()
      expect(entry.label.trim(), status).not.toBe('')
      expect(entry.key, status).toMatch(/^[a-z]+\.[A-Za-z]+$/)
    }
  })

  it('holds no English label', () => {
    // The defect, stated as a rule. Every one of these was a live label.
    const english = [
      'Pending',
      'Confirmed',
      'Preparing',
      'Ready',
      'Out for Delivery',
      'Delivered',
      'Completed',
      'Cancelled',
      'Open',
      'Closed',
      'Temporarily Unavailable',
    ]
    const labels = [
      ...ORDER_STATUS_KEYS.map((s) => ORDER_STATUS_VOCABULARY[s].label),
      ...STORE_STATUS_KEYS.map((s) => STORE_STATUS_VOCABULARY[s].label),
    ]

    for (const word of english) expect(labels).not.toContain(word)
  })

  it('gives out_for_delivery and delivered different words', () => {
    // They were once folded together, which showed a diner "Delivered" for an
    // order still in the van.
    expect(ORDER_STATUS_VOCABULARY.out_for_delivery.label).not.toBe(
      ORDER_STATUS_VOCABULARY.delivered.label
    )
    expect(ORDER_STATUS_VOCABULARY.out_for_delivery.key).not.toBe(
      ORDER_STATUS_VOCABULARY.delivered.key
    )
  })

  it('lists every key it asks a catalogue to answer', () => {
    // The app-side catalogue test reads this list; a key added to a
    // vocabulary and not to this list would go unchecked.
    expect(STATUS_LABEL_KEYS).toHaveLength(
      ORDER_STATUS_KEYS.length + STORE_STATUS_KEYS.length
    )
    expect(STATUS_LABEL_KEYS).toContain('order.preparing')
    expect(STATUS_LABEL_KEYS).toContain('storefront.storeTempUnavailable')
  })
})

describe('resolveStatusLabels', () => {
  it('returns what the translator answers', () => {
    const spanish: Record<string, string> = {
      'order.pending': 'Pendiente',
      'order.preparing': 'En preparación',
    }
    const labels = resolveStatusLabels(
      ORDER_STATUS_VOCABULARY,
      (key) => spanish[key] ?? key
    )

    expect(labels.pending).toBe('Pendiente')
    expect(labels.preparing).toBe('En preparación')
  })

  it('falls back to the source language when a key is unanswered', () => {
    // `t()` returns the key it was given when it cannot resolve one. Printing
    // `order.preparing` on a badge is worse than printing French.
    const labels = resolveStatusLabels(ORDER_STATUS_VOCABULARY, (key) => key)

    expect(labels.preparing).toBe('En préparation')
    expect(labels.cancelled).toBe('Annulée')
  })

  it('falls back on an empty answer too', () => {
    const labels = resolveStatusLabels(ORDER_STATUS_VOCABULARY, () => '')

    expect(labels.ready).toBe('Prête')
  })

  it('answers for every status, not only the translated ones', () => {
    const labels = resolveStatusLabels(STORE_STATUS_VOCABULARY, (key) =>
      key === 'store.openNow' ? 'Abierto' : key
    )

    expect(labels).toEqual({
      open: 'Abierto',
      closed: 'Fermé',
      temporarily_unavailable: 'Temporairement indisponible',
    })
  })
})
