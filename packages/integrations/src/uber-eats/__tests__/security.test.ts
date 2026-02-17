/**
 * Security tests for Uber Eats webhook signature verification
 */

import { describe, it, expect } from 'vitest'
import { verifyUberEatsSignature } from '../security'

/**
 * Generate HMAC-SHA256 signature using Web Crypto API
 * (mirrors the implementation in the source)
 */
async function generateSignature(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const bodyData = encoder.encode(body)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, bodyData)
  const hashArray = Array.from(new Uint8Array(signatureBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('verifyUberEatsSignature', () => {
  const testSecret = 'test-client-secret-12345'
  const testBody = JSON.stringify({
    event_id: 'evt_123',
    event_type: 'orders.notification',
    event_time: 1234567890,
  })

  it('should return true for a valid signature', async () => {
    const validSignature = await generateSignature(testBody, testSecret)
    const result = await verifyUberEatsSignature(testBody, validSignature, testSecret)
    expect(result).toBe(true)
  })

  it('should return false for an invalid signature', async () => {
    const invalidSignature = 'deadbeefcafe1234567890abcdef'
    const result = await verifyUberEatsSignature(testBody, invalidSignature, testSecret)
    expect(result).toBe(false)
  })

  it('should return false for an empty signature', async () => {
    const result = await verifyUberEatsSignature(testBody, '', testSecret)
    expect(result).toBe(false)
  })

  it('should return false for an empty client secret', async () => {
    const validSignature = await generateSignature(testBody, testSecret)
    const result = await verifyUberEatsSignature(testBody, validSignature, '')
    expect(result).toBe(false)
  })

  it('should return false when body is tampered with', async () => {
    const validSignature = await generateSignature(testBody, testSecret)
    const tamperedBody = testBody + ' malicious addition'
    const result = await verifyUberEatsSignature(tamperedBody, validSignature, testSecret)
    expect(result).toBe(false)
  })

  it('should handle special characters in body', async () => {
    const specialBody = JSON.stringify({
      notes: 'Test order with émojis 🍕 and spëcial chars: <>&"\'',
    })
    const validSignature = await generateSignature(specialBody, testSecret)
    const result = await verifyUberEatsSignature(specialBody, validSignature, testSecret)
    expect(result).toBe(true)
  })

  it('should use constant-time comparison (different length signatures)', async () => {
    const validSignature = await generateSignature(testBody, testSecret)
    const shortSignature = validSignature.substring(0, 32)
    const result = await verifyUberEatsSignature(testBody, shortSignature, testSecret)
    expect(result).toBe(false)
  })

  it('should handle different secrets correctly', async () => {
    const secret1 = 'secret-1'
    const secret2 = 'secret-2'
    const signature1 = await generateSignature(testBody, secret1)
    const result = await verifyUberEatsSignature(testBody, signature1, secret2)
    expect(result).toBe(false)
  })
})
