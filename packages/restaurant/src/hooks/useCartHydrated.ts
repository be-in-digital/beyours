'use client'

import { useEffect, useState } from 'react'
import { useCartStore } from '../stores/cart'

/**
 * Whether the cart has been read back from localStorage yet.
 *
 * The cart is persisted, and persistence is not instant: on the first render
 * after a page load the store is empty, and it fills a tick later. Any guard
 * that reads `items.length` before that sees an empty basket and acts on it —
 * which is how a customer arriving at `/checkout` with a full cart was sent
 * back to `/cart`, and how one returning from the payment provider lost their
 * checkout.
 *
 * False until this component has mounted, and never read from the store during
 * render.
 *
 * `persist.hasHydrated()` is true long before a selector reports the persisted
 * cart: localStorage is read when the module is imported, but zustand reads
 * through `useSyncExternalStore`, and React serves the *server* snapshot — the
 * store's initial state, an empty basket — for the whole hydration render. So
 * asking the flag during that render answered "hydrated" over an empty cart,
 * which is the answer this hook exists to prevent. The checkout guard believed
 * it and sent a full basket to /cart on every cold arrival.
 *
 * After mount there is no server snapshot left to serve, so the flag and the
 * cart agree. That costs one render on a client-side navigation too, where
 * this used to return `true` outright — a render in which the checkout shows
 * nothing, and which the guard would otherwise spend acting on a cart that is
 * not there yet.
 */
export function useCartHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (useCartStore.persist?.hasHydrated?.() ?? true) {
      setHydrated(true)
      return
    }

    // Still reading. `onFinishHydration` fires once the store holds what
    // localStorage had, and by then this component is long past its own
    // hydration render.
    return useCartStore.persist?.onFinishHydration?.(() => setHydrated(true))
  }, [])

  return hydrated
}
