/**
 * The status vocabulary must cover the statuses the schema actually admits.
 *
 * `@be-yours/core` owns the words and cannot see the schema — it depends
 * on nothing but zod and the AWS SDK. `@be-yours/convex-schema` owns the
 * statuses and holds no copy. This package depends on both, so this is the one
 * place the two lists can be held against each other.
 *
 * It matters because the failure is silent: a status the vocabulary has never
 * heard of falls through `OrderStatusBadge`'s unknown-status guard and renders
 * as « En attente » — a diner told their delivered order is still pending. The
 * badge declared six of eight statuses once already, and the caller papered
 * over the gap by folding two of them onto a third.
 */

import { describe, it, expect } from 'vitest'
import {
  ORDER_STATUS_VOCABULARY,
  STORE_STATUS_VOCABULARY,
  resolveStatusLabels,
} from '@be-yours/core/status-labels'
import {
  ORDER_STATUSES,
  PUBLISHED_STORE_STATUSES,
} from '@be-yours/convex-schema'
import { getOrderStatusLabel } from '../services/order'

describe('order statuses', () => {
  it('every status the schema admits has a word', () => {
    const missing = ORDER_STATUSES.filter(
      (status) => !(status in ORDER_STATUS_VOCABULARY)
    )
    expect(missing).toEqual([])
  })

  it('the vocabulary invents none of its own', () => {
    const extra = Object.keys(ORDER_STATUS_VOCABULARY).filter(
      (status) => !(ORDER_STATUSES as readonly string[]).includes(status)
    )
    expect(extra).toEqual([])
  })
})

describe('store statuses', () => {
  it('every published status has a word', () => {
    const missing = PUBLISHED_STORE_STATUSES.filter(
      (status) => !(status in STORE_STATUS_VOCABULARY)
    )
    expect(missing).toEqual([])
  })

  it('draft has none, deliberately', () => {
    // A draft establishment is not listed and not orderable; the badge renders
    // it as closed through its unknown-status guard, which is the conservative
    // reading. Giving it a word here would suggest it is a state a diner can
    // legitimately meet.
    expect('draft' in STORE_STATUS_VOCABULARY).toBe(false)
  })
})

describe('one vocabulary, not four', () => {
  it('the pure label helper answers from the same source as the badges', () => {
    // `getOrderStatusLabel` used to carry its own English map, one package
    // away from the badge's own English map.
    for (const status of ORDER_STATUSES) {
      expect(getOrderStatusLabel(status)).toBe(
        ORDER_STATUS_VOCABULARY[status].label
      )
    }
  })

  it('a translated locale reaches every status', () => {
    // What `useOrderStatusLabels` does, minus the React. The hook is a
    // `useMemo` over exactly this call.
    const labels = resolveStatusLabels(
      ORDER_STATUS_VOCABULARY,
      (key) => `[${key}]`
    )

    for (const status of ORDER_STATUSES) {
      expect(labels[status]).toBe(`[${ORDER_STATUS_VOCABULARY[status].key}]`)
    }
  })
})
