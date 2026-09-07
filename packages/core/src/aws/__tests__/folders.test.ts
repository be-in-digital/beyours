import { describe, it, expect } from 'vitest'
import {
  S3_FOLDERS,
  PRIVATE_S3_FOLDERS,
  isKnownS3Folder,
  isPrivateS3Folder,
} from '../folders'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZES } from '../types'
import { buildMediaUrl } from '../media-url'
import { s3FolderSchema } from '../s3/validation'

/**
 * The bucket is private and `/api/files` is the only read path, so a folder an
 * upload accepts but the proxy does not serve produces a URL that 404s. The
 * proxy derives its allowlist from `ALLOWED_MIME_TYPES`, so these two lists
 * drifting apart is not a tidiness problem — it silently loses uploads.
 */
describe('S3 folder allowlist', () => {
  it('serves every folder the product can upload to', () => {
    const servable = Object.keys(ALLOWED_MIME_TYPES)
    const missing = S3_FOLDERS.filter((f) => !servable.includes(f))
    expect(missing).toEqual([])
  })

  it('sizes every folder it accepts', () => {
    for (const folder of S3_FOLDERS) {
      expect(MAX_FILE_SIZES[folder]).toBeGreaterThan(0)
    }
  })

  it('covers the folders whose images used to 404', () => {
    // Regression: these were accepted by convex/storageUpload.ts but absent
    // from the proxy's allowlist, so every such image was written and lost.
    for (const folder of ['categories', 'blogs', 'blog-auto', 'storefront', 'avatars']) {
      expect(isKnownS3Folder(folder)).toBe(true)
      expect(Object.keys(ALLOWED_MIME_TYPES)).toContain(folder)
    }
  })

  it('declares no folder the tables do not describe', () => {
    expect(Object.keys(ALLOWED_MIME_TYPES).sort()).toEqual([...S3_FOLDERS].sort())
    expect(Object.keys(MAX_FILE_SIZES).sort()).toEqual([...S3_FOLDERS].sort())
  })

  it('lets an upload target every folder it declares', () => {
    // `upload()` and `getPresignedUploadUrl()` both parse their options through
    // `s3FolderSchema`. It used to be a hand-written enum of six while
    // `S3_FOLDERS` grew to eleven, so `categories`, `storefront`, `blogs`,
    // `blog-auto` and `avatars` type-checked as `S3Folder` and threw at
    // runtime — the documented upload API refusing five folders the type says
    // are fine. Nothing in the apps called it, which is why nobody noticed.
    for (const folder of S3_FOLDERS) {
      expect(s3FolderSchema.safeParse(folder).success).toBe(true)
    }
    expect(s3FolderSchema.options.slice().sort()).toEqual([...S3_FOLDERS].sort())
  })

  it('refuses a folder the product does not declare', () => {
    expect(s3FolderSchema.safeParse('invoices').success).toBe(false)
  })

  it('fails closed on an unknown folder', () => {
    expect(isKnownS3Folder('invoices')).toBe(false)
    expect(isKnownS3Folder('')).toBe(false)
    expect(isKnownS3Folder('products-private')).toBe(false)
  })

  it('builds a proxy URL a served folder can actually answer', () => {
    const url = buildMediaUrl('categories/abc-123.webp')
    expect(url).toBe('/api/files/categories/abc-123.webp')
    expect(isKnownS3Folder(url.split('/')[3] as string)).toBe(true)
  })

  it('marks as private only folders it also declares servable', () => {
    // A private folder the proxy will not serve is a contradiction: the read
    // path would 404 before the session check ever ran, and the entry would
    // read as protection that is really absence.
    for (const folder of PRIVATE_S3_FOLDERS) {
      expect(isKnownS3Folder(folder)).toBe(true)
    }
  })

  it('leaves every folder the storefront renders anonymous', () => {
    // The storefront has no session. This is the invariant that makes #188 a
    // prefix split rather than an authenticated proxy, and the one a future
    // addition to PRIVATE_S3_FOLDERS has to be checked against.
    const publicFolders = S3_FOLDERS.filter((f) => !isPrivateS3Folder(f))
    expect(publicFolders).toContain('products')
    expect(publicFolders).toContain('categories')
    expect(publicFolders).toContain('storefront')
    expect(publicFolders).toContain('blogs')
    expect(publicFolders).toContain('branding')
  })
})
