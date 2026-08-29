import { describe, it, expect } from 'vitest'
import {
  cartSignature,
  resolveCheckoutAttempt,
  type CheckoutAttempt,
} from '../services/checkout-attempt'

const basket = {
  storeId: 'stores:1',
  orderType: 'pickup',
  items: [
    { lineId: 'line-pizza', quantity: 1 },
    { lineId: 'line-drink', quantity: 2 },
  ],
}

describe('cartSignature', () => {
  it('is the same for the same basket', () => {
    expect(cartSignature(basket)).toBe(cartSignature({ ...basket }))
  })

  it('ignores the order the lines happen to be in', () => {
    expect(
      cartSignature({ ...basket, items: [...basket.items].reverse() })
    ).toBe(cartSignature(basket))
  })

  it('changes when a quantity changes', () => {
    expect(
      cartSignature({
        ...basket,
        items: [
          { lineId: 'line-pizza', quantity: 2 },
          { lineId: 'line-drink', quantity: 2 },
        ],
      })
    ).not.toBe(cartSignature(basket))
  })

  it('changes with the service, the establishment and the promotion', () => {
    expect(cartSignature({ ...basket, orderType: 'delivery' })).not.toBe(
      cartSignature(basket)
    )
    expect(cartSignature({ ...basket, storeId: 'stores:2' })).not.toBe(
      cartSignature(basket)
    )
    expect(cartSignature({ ...basket, promotionId: 'promotions:1' })).not.toBe(
      cartSignature(basket)
    )
  })
})

describe('resolveCheckoutAttempt', () => {
  const signature = cartSignature(basket)
  let minted = 0
  const mint = () => `key-${++minted}`

  it('mints a key on the first submission', () => {
    minted = 0
    const attempt = resolveCheckoutAttempt(null, signature, mint)
    expect(attempt).toEqual({ signature, key: 'key-1' })
  })

  it('reuses it when the same basket comes back', () => {
    // The case the ref could not cover: the customer returns from the payment
    // provider, the page remounts, and they press Pay again. Same key, so the
    // server hands back the order that already exists.
    minted = 0
    const first = resolveCheckoutAttempt(null, signature, mint)
    const second = resolveCheckoutAttempt(first, signature, mint)

    expect(second.key).toBe(first.key)
    expect(minted).toBe(1)
  })

  it('starts a new attempt when the basket changed', () => {
    // Reusing the key here would return an order for the *old* contents.
    minted = 0
    const stored: CheckoutAttempt = { signature, key: 'key-0' }
    const changed = cartSignature({
      ...basket,
      items: [{ lineId: 'line-pizza', quantity: 3 }],
    })

    const attempt = resolveCheckoutAttempt(stored, changed, mint)
    expect(attempt.key).not.toBe('key-0')
    expect(attempt.signature).toBe(changed)
  })

  it('ignores a stored attempt with no key in it', () => {
    minted = 0
    const attempt = resolveCheckoutAttempt(
      { signature, key: '' },
      signature,
      mint
    )
    expect(attempt.key).toBe('key-1')
  })
})
