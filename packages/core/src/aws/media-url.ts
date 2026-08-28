/**
 * ┌─────────────────────────────────────────────────────────────┐
 * │  🔗 Media URL policy                                        │
 * │  The single answer to "where is this S3 object served       │
 * │  from?" — for the storefront, the admin and the backend.    │
 * └─────────────────────────────────────────────────────────────┘
 *
 * **The bucket is private.** No object in it is readable by an anonymous
 * request to the S3 endpoint, so nothing may hand out
 * `https://<bucket>.s3.<region>.amazonaws.com/<key>` — that form only ever
 * worked on a bucket whose objects anyone could read, and the product used to
 * build it in sixteen places while a seventeenth assumed the opposite.
 *
 * A key becomes a URL exactly two ways:
 *
 *   - `AWS_S3_PUBLIC_BASE_URL` set → `<base>/<key>`. A CDN (CloudFront with an
 *     origin access control) fronts the private bucket and is the public face
 *     of the media. Its host has to be in `next.config.ts` `remotePatterns`.
 *   - unset → `/api/files/<key>`, the app's own proxy. It reads S3 with the
 *     deployment's credentials, and only for the folders the product uploads
 *     to — the bucket is not a file host for anything else it may contain.
 *
 * The second form is relative on purpose: same-origin, so it needs no
 * `remotePatterns` entry and no extra DNS for a fresh deployment to render its
 * own images.
 *
 * @module aws/media-url
 */

/** Path the in-app S3 proxy is mounted at (`apps/*\/app/api/files/[...key]`). */
export const MEDIA_PROXY_PATH = '/api/files'

/** Matches `https://<bucket>.s3[.<region>].amazonaws.com/<key>` in either style. */
const S3_ENDPOINT_HOST = /^(?:(.+)\.)?s3[.-][a-z0-9-]+\.amazonaws\.com$/i

/**
 * Normalises a stored key: no leading slash, no query, no empty segment.
 * Throws on anything that could climb out of the bucket prefix.
 */
function normaliseKey(key: string): string {
  const trimmed = key.trim().replace(/^\/+/, '')

  if (!trimmed) {
    throw new Error('S3 key is empty')
  }
  if (trimmed.includes('..')) {
    throw new Error(`S3 key must not contain "..": ${key}`)
  }

  return trimmed
}

/**
 * Turns an S3 key into the URL the browser should request.
 *
 * @param key - S3 object key, e.g. `cms/<mediaId>/source.webp`
 * @param publicBaseUrl - CDN base, normally `process.env.AWS_S3_PUBLIC_BASE_URL`
 * @returns An absolute CDN URL, or the app-relative proxy path
 *
 * @example
 * buildMediaUrl('cms/abc/source.webp')
 * // → '/api/files/cms/abc/source.webp'
 * buildMediaUrl('cms/abc/source.webp', 'https://cdn.example.com')
 * // → 'https://cdn.example.com/cms/abc/source.webp'
 */
export function buildMediaUrl(key: string, publicBaseUrl?: string): string {
  const normalised = normaliseKey(key)
  const base = publicBaseUrl?.trim().replace(/\/+$/, '')

  return base ? `${base}/${normalised}` : `${MEDIA_PROXY_PATH}/${normalised}`
}

/** Where a URL has to come from before we will treat it as one of ours. */
export interface MediaOrigin {
  /** `AWS_S3_PUBLIC_BASE_URL` — the CDN in front of the bucket, if any. */
  publicBaseUrl?: string
  /**
   * `AWS_S3_BUCKET_NAME`. Required to claim a legacy direct-endpoint URL: the
   * hostname alone says "some S3 bucket", not "ours", and a caller who can
   * name a bucket must not be able to name a key we then read from our own.
   */
  bucketName?: string
}

/**
 * Recovers the S3 key from anything the product has ever stored as a media
 * URL. Rows written before the bucket went private still hold the direct S3
 * endpoint form, and a deployment that adopts a CDN later keeps rows written
 * under the proxy form — so every reader that needs a key (the image-to-product
 * pipeline, the alt-text call) goes through here rather than guessing.
 *
 * Deliberately strict: a URL is only "ours" if it is the app's own proxy path,
 * the configured CDN, or the configured bucket's own endpoint. Everything else
 * is somebody else's and is refused, because callers pass URLs the operator
 * typed.
 *
 * @returns The key, or `null` when the URL is not this deployment's media.
 *
 * @example
 * mediaKeyFromUrl('/api/files/products/a.webp')          // 'products/a.webp'
 * mediaKeyFromUrl('https://b.s3.eu-west-3.amazonaws.com/products/a.webp',
 *                 { bucketName: 'b' })                   // 'products/a.webp'
 * mediaKeyFromUrl('https://cdn.example.com/products/a.webp',
 *                 { publicBaseUrl: 'https://cdn.example.com' })
 *                                                        // 'products/a.webp'
 * mediaKeyFromUrl('https://images.unsplash.com/photo-1') // null
 */
export function mediaKeyFromUrl(
  url: string,
  origin: MediaOrigin = {}
): string | null {
  const value = url?.trim()
  if (!value) return null

  // Proxy form — relative, so it never parses as an absolute URL.
  if (value.startsWith(`${MEDIA_PROXY_PATH}/`)) {
    return safeKey(decode(value.slice(MEDIA_PROXY_PATH.length + 1)))
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return null
  }

  const path = decode(parsed.pathname).replace(/^\/+/, '')

  // Same app, absolute form (e.g. an email that embedded the full URL).
  if (parsed.pathname.startsWith(`${MEDIA_PROXY_PATH}/`)) {
    return safeKey(path.slice(MEDIA_PROXY_PATH.length))
  }

  // CDN form.
  const base = origin.publicBaseUrl?.trim().replace(/\/+$/, '')
  if (base) {
    try {
      const baseUrl = new URL(base)
      if (baseUrl.host === parsed.host) {
        const prefix = decode(baseUrl.pathname).replace(/^\/+|\/+$/g, '')
        return safeKey(prefix ? stripPrefix(path, prefix) : path)
      }
    } catch {
      // A malformed AWS_S3_PUBLIC_BASE_URL should not stop the other forms
      // from resolving.
    }
  }

  // Legacy direct-endpoint form, both `<bucket>.s3.<region>.amazonaws.com/<key>`
  // and the path style `s3.<region>.amazonaws.com/<bucket>/<key>` — and only
  // for the bucket this deployment owns.
  const bucket = origin.bucketName?.trim()
  const match = bucket ? S3_ENDPOINT_HOST.exec(parsed.host) : null
  if (match) {
    if (match[1]) {
      return match[1] === bucket ? safeKey(path) : null
    }
    const [first, ...rest] = path.split('/')
    return first === bucket ? safeKey(rest.join('/')) : null
  }

  return null
}

/**
 * Percent-decodes, and leaves the value alone when it is not valid encoding —
 * `decodeURIComponent` throws on a lone `%`, and a stored URL is data.
 */
function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** Drops `prefix/` from the front of `path`, or returns null if it isn't there. */
function stripPrefix(path: string, prefix: string): string | null {
  return path.startsWith(`${prefix}/`) ? path.slice(prefix.length + 1) : null
}

/** A key is only usable if it is non-empty and cannot climb out of the bucket. */
function safeKey(key: string | null): string | null {
  if (!key) return null

  const trimmed = key.replace(/^\/+/, '').split('?')[0]
  if (!trimmed || trimmed.includes('..')) return null

  return trimmed
}
