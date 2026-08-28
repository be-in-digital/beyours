import { describe, it, expect } from 'vitest'
import {
  PUBLIC_S3_FOLDERS,
  PRIVATE_S3_FOLDERS,
  S3_FOLDERS,
  isPublicS3Key,
  isKnownS3Folder,
  buildAssetUrl,
} from '../prefixes'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZES } from '../types'

/**
 * These tests pin the access decision recorded in
 * apps/docs/deployment/s3-bucket-policy.md. A change that makes one of them
 * fail is a change to who can read customer uploads.
 */
describe('S3 prefix visibility', () => {
  it('never classifies a private folder as public', () => {
    for (const folder of PRIVATE_S3_FOLDERS) {
      expect(isPublicS3Key(`${folder}/abc-123.webp`)).toBe(false)
    }
  })

  it('classifies every public folder as public', () => {
    for (const folder of PUBLIC_S3_FOLDERS) {
      expect(isPublicS3Key(`${folder}/abc-123.webp`)).toBe(true)
    }
  })

  it('keeps the public and private lists disjoint', () => {
    const overlap = PUBLIC_S3_FOLDERS.filter((f) =>
      (PRIVATE_S3_FOLDERS as readonly string[]).includes(f)
    )
    expect(overlap).toEqual([])
  })

  it('fails closed on an unrecognised prefix', () => {
    expect(isPublicS3Key('invoices/secret.pdf')).toBe(false)
    expect(isPublicS3Key('secret.pdf')).toBe(false)
    expect(isPublicS3Key('')).toBe(false)
    expect(isKnownS3Folder('invoices')).toBe(false)
  })

  it('does not treat a lookalike prefix as public', () => {
    // `products` is public; `products-private` must not inherit that.
    expect(isPublicS3Key('products-private/abc.webp')).toBe(false)
    expect(isPublicS3Key('cms-backup/abc.webp')).toBe(false)
  })

  it('covers every folder in the MIME and size tables', () => {
    for (const folder of S3_FOLDERS) {
      expect(ALLOWED_MIME_TYPES[folder]).toBeDefined()
      expect(MAX_FILE_SIZES[folder]).toBeGreaterThan(0)
    }
  })
})

describe('buildAssetUrl', () => {
  const cdn = 'https://cdn.example.com'

  it('sends private keys to the authenticated proxy, never to a CDN', () => {
    expect(buildAssetUrl('users/abc.webp', cdn)).toBe('/api/files/users/abc.webp')
    expect(buildAssetUrl('avatars/abc.webp', cdn)).toBe('/api/files/avatars/abc.webp')
  })

  it('sends public keys to the configured origin', () => {
    expect(buildAssetUrl('products/abc.webp', cdn)).toBe(
      'https://cdn.example.com/products/abc.webp'
    )
  })

  it('does not double the separator when the base has a trailing slash', () => {
    expect(buildAssetUrl('products/abc.webp', 'https://cdn.example.com/')).toBe(
      'https://cdn.example.com/products/abc.webp'
    )
  })

  it('refuses to invent an origin for a public key', () => {
    expect(() => buildAssetUrl('products/abc.webp', undefined)).toThrow(
      /AWS_S3_PUBLIC_BASE_URL is required/
    )
  })

  it('accepts an explicit fallback origin', () => {
    expect(
      buildAssetUrl('products/abc.webp', undefined, 'https://bucket.s3.eu-west-3.amazonaws.com')
    ).toBe('https://bucket.s3.eu-west-3.amazonaws.com/products/abc.webp')
  })

  it('still routes private keys to the proxy even with a fallback origin', () => {
    expect(
      buildAssetUrl('users/abc.webp', undefined, 'https://bucket.s3.eu-west-3.amazonaws.com')
    ).toBe('/api/files/users/abc.webp')
  })
})
