/**
 * The order and store status words, in the language the diner is reading.
 *
 * `OrderStatusBadge` and `StoreStatusBadge` are presentation: they take a
 * label and print it. These two hooks are what fills them, and they are the
 * seam the translation layer #148 shipped could not previously cross — both
 * badges held hardcoded English and no override prop, so a French storefront
 * showed « Preparing » and « Temporarily Unavailable » beside French copy.
 *
 * The keys and the source-language fallbacks live once, in
 * `@be-yours/core/status-labels`, so the word the badge prints untranslated
 * and the word this resolves cannot name different things.
 */

'use client'

import { useMemo } from 'react'
import {
  ORDER_STATUS_VOCABULARY,
  STORE_STATUS_VOCABULARY,
  resolveStatusLabels,
  type OrderStatusKey,
  type StoreStatusKey,
} from '@be-yours/core/status-labels'
import { useTranslation } from './useTranslation'

/**
 * `{ pending: "En attente", … }` for the locale being rendered.
 *
 * Pass straight to `OrderStatusBadge`'s `labels` prop. A key the catalogue
 * cannot answer falls back to the source-language word rather than printing
 * `order.preparing` on a badge.
 */
export function useOrderStatusLabels(): Record<OrderStatusKey, string> {
  const { t } = useTranslation()

  return useMemo(
    () => resolveStatusLabels(ORDER_STATUS_VOCABULARY, (key) => t(key)),
    [t]
  )
}

/** The same, for the three statuses a published establishment can be in. */
export function useStoreStatusLabels(): Record<StoreStatusKey, string> {
  const { t } = useTranslation()

  return useMemo(
    () => resolveStatusLabels(STORE_STATUS_VOCABULARY, (key) => t(key)),
    [t]
  )
}
