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
 * Returns `true` immediately when hydration has already happened (a
 * client-side navigation), so it costs a render only on a cold load.
 */
export function useCartHydrated(): boolean {
  const [hydrated, setHydrated] = useState<boolean>(
    () => useCartStore.persist?.hasHydrated?.() ?? true
  )

  useEffect(() => {
    if (hydrated) return

    const unsubscribe = useCartStore.persist?.onFinishHydration?.(() =>
      setHydrated(true)
    )

    // A store that finished hydrating between the first render and this effect
    // would never fire the event above.
    if (useCartStore.persist?.hasHydrated?.()) setHydrated(true)

    return unsubscribe
  }, [hydrated])

  return hydrated
}
