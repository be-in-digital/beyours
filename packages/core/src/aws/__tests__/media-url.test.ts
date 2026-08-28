import { describe, it, expect } from 'vitest'
import {
  MEDIA_PROXY_PATH,
  buildMediaUrl,
  mediaKeyFromUrl,
} from '../media-url'

const CDN = 'https://cdn.example.com'
const BUCKET = 'beyours-demo'
const LEGACY = `https://${BUCKET}.s3.eu-west-3.amazonaws.com`

describe('buildMediaUrl', () => {
  it('routes through the in-app proxy when no CDN is configured', () => {
    expect(buildMediaUrl('cms/abc/source.webp')).toBe(
      '/api/files/cms/abc/source.webp'
    )
  })

  it('never builds a direct S3 endpoint URL', () => {
    // The whole point of P0-34: this form only worked on a public bucket.
    for (const base of [undefined, '', '   ', CDN]) {
      expect(buildMediaUrl('products/x.webp', base)).not.toContain(
        'amazonaws.com'
      )
    }
  })

  it('uses the CDN when one fronts the bucket', () => {
    expect(buildMediaUrl('products/x.webp', CDN)).toBe(
      'https://cdn.example.com/products/x.webp'
    )
  })

  it('tolerates a trailing slash on the CDN base', () => {
    expect(buildMediaUrl('products/x.webp', `${CDN}/`)).toBe(
      'https://cdn.example.com/products/x.webp'
    )
  })

  it('tolerates a leading slash on the key', () => {
    expect(buildMediaUrl('/products/x.webp')).toBe('/api/files/products/x.webp')
  })

  it('treats a blank CDN base as unset', () => {
    expect(buildMediaUrl('products/x.webp', '   ')).toBe(
      '/api/files/products/x.webp'
    )
  })

  it('rejects an empty key', () => {
    expect(() => buildMediaUrl('')).toThrow()
    expect(() => buildMediaUrl('   ')).toThrow()
  })

  it('rejects a key that climbs out of the bucket prefix', () => {
    expect(() => buildMediaUrl('cms/../../etc/passwd')).toThrow()
  })

  it('exposes the proxy path it builds against', () => {
    expect(MEDIA_PROXY_PATH).toBe('/api/files')
  })
})

describe('mediaKeyFromUrl', () => {
  const OURS = { publicBaseUrl: CDN, bucketName: BUCKET }

  it('reads back what buildMediaUrl wrote, with and without a CDN', () => {
    const key = 'cms/abc/source.webp'

    expect(mediaKeyFromUrl(buildMediaUrl(key))).toBe(key)
    expect(mediaKeyFromUrl(buildMediaUrl(key, CDN), OURS)).toBe(key)
  })

  it('recovers the key from rows written before the bucket went private', () => {
    expect(mediaKeyFromUrl(`${LEGACY}/products/x.webp`, OURS)).toBe(
      'products/x.webp'
    )
  })

  it('handles the path-style S3 endpoint', () => {
    expect(
      mediaKeyFromUrl(
        `https://s3.eu-west-3.amazonaws.com/${BUCKET}/products/x.webp`,
        OURS
      )
    ).toBe('products/x.webp')
  })

  it('handles the app proxy given as an absolute URL', () => {
    expect(mediaKeyFromUrl('https://resto.fr/api/files/cms/a/source.webp')).toBe(
      'cms/a/source.webp'
    )
  })

  it('handles a CDN base that carries a path prefix', () => {
    expect(
      mediaKeyFromUrl('https://cdn.example.com/media/products/x.webp', {
        publicBaseUrl: 'https://cdn.example.com/media',
      })
    ).toBe('products/x.webp')
  })

  it('decodes percent-encoded keys', () => {
    expect(mediaKeyFromUrl(`${LEGACY}/cms/a%20b.webp`, OURS)).toBe('cms/a b.webp')
  })

  it('drops a query string', () => {
    expect(mediaKeyFromUrl('/api/files/products/x.webp?v=2')).toBe(
      'products/x.webp'
    )
  })

  it('decodes the proxy form too, not just the absolute ones', () => {
    expect(mediaKeyFromUrl('/api/files/cms/a%20b.webp')).toBe('cms/a b.webp')
  })

  it('does not throw on invalid percent-encoding', () => {
    expect(mediaKeyFromUrl('/api/files/cms/100%.webp')).toBe('cms/100%.webp')
  })

  it('returns null for media hosted elsewhere', () => {
    expect(mediaKeyFromUrl('https://images.unsplash.com/photo-1', OURS)).toBeNull()
    expect(mediaKeyFromUrl('https://cdn.example.com/x.webp')).toBeNull()
  })

  it('returns null for junk', () => {
    expect(mediaKeyFromUrl('')).toBeNull()
    expect(mediaKeyFromUrl('not a url')).toBeNull()
    expect(mediaKeyFromUrl('/api/files/')).toBeNull()
  })

  it('refuses a traversal attempt smuggled through a stored URL', () => {
    expect(mediaKeyFromUrl('/api/files/../../secret')).toBeNull()
  })

  it('survives a malformed AWS_S3_PUBLIC_BASE_URL', () => {
    expect(
      mediaKeyFromUrl(`${LEGACY}/products/x.webp`, {
        publicBaseUrl: 'not-a-url',
        bucketName: BUCKET,
      })
    ).toBe('products/x.webp')
  })

  describe('refuses to be talked into reading our own bucket', () => {
    // `analyze` and `generateAltText` take a caller-supplied URL and read the
    // key it yields from OUR bucket. "Looks like an S3 host" must therefore
    // never be enough — the bucket has to be the one we own.
    it('rejects another bucket at the same endpoint', () => {
      expect(
        mediaKeyFromUrl(
          'https://someone-else.s3.eu-west-3.amazonaws.com/backups/dump.sql',
          OURS
        )
      ).toBeNull()
    })

    it('rejects another bucket in the path style', () => {
      expect(
        mediaKeyFromUrl(
          'https://s3.eu-west-3.amazonaws.com/someone-else/backups/dump.sql',
          OURS
        )
      ).toBeNull()
    })

    it('claims no S3 URL at all when the bucket is unknown', () => {
      expect(mediaKeyFromUrl(`${LEGACY}/products/x.webp`)).toBeNull()
    })

    it('rejects a host that merely ends with the CDN name', () => {
      expect(
        mediaKeyFromUrl('https://evil-cdn.example.com/products/x.webp', OURS)
      ).toBeNull()
    })
  })
})
