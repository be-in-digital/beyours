/**
 * The two decisions the CMS media layer owns (#167).
 *
 * `assertMediaUploadAllowed` is the server-side allow-list. Before it existed,
 * `createMedia` inserted whatever it was handed: `validateMediaUpload` was
 * imported in exactly two places, `CmsMediaPicker` and `CmsMediaLibrary`, both
 * browser components. `createMedia` is a public Convex mutation, so the client
 * was never the boundary — it accepted `text/html` and a 5 GB SVG.
 *
 * `collectMediaS3Keys` is the other half of a deletion. `deleteMedia` removed
 * the Convex row alone — `DeleteObjectCommand` appeared nowhere in the
 * repository — so nothing has ever left the bucket. The keys have to be read
 * while the row still exists, because a mutation cannot reach S3 and the row is
 * gone by the time the scheduled purge runs.
 */

import { describe, expect, it } from "vitest"
import { assertMediaUploadAllowed, collectMediaS3Keys } from "../cmsMedia"

describe("assertMediaUploadAllowed", () => {
  const validImage = {
    filename: "plat-du-jour.jpg",
    mimeType: "image/jpeg",
    size: 2 * 1024 * 1024,
    kind: "image",
  }

  it("accepts a legitimate photograph", () => {
    expect(() => assertMediaUploadAllowed(validImage)).not.toThrow()
  })

  it("refuses text/html — an upload path that accepts HTML is stored XSS", () => {
    expect(() =>
      assertMediaUploadAllowed({
        filename: "payload.html",
        mimeType: "text/html",
        size: 512,
        kind: "file",
      }),
    ).toThrow(/Type MIME "text\/html" non autoris/)
  })

  it("refuses a 5 GB SVG", () => {
    expect(() =>
      assertMediaUploadAllowed({
        filename: "huge.svg",
        mimeType: "image/svg+xml",
        size: 5 * 1024 * 1024 * 1024,
        kind: "image",
      }),
    ).toThrow(/trop volumineux/)
  })

  it("refuses an image over the 10 MB cap", () => {
    expect(() =>
      assertMediaUploadAllowed({
        ...validImage,
        size: 10 * 1024 * 1024 + 1,
      }),
    ).toThrow(/trop volumineux/)
  })

  it("refuses a filename whose extension contradicts the MIME type", () => {
    expect(() =>
      assertMediaUploadAllowed({
        filename: "payload.html",
        mimeType: "image/png",
        size: 1024,
        kind: "image",
      }),
    ).toThrow(/ne correspond pas au type "image\/png"/)
  })

  it("refuses a kind that contradicts the MIME type", () => {
    // `kind` is a separate argument the caller chooses, and it is what
    // `confirmUpload` branches on.
    expect(() =>
      assertMediaUploadAllowed({ ...validImage, kind: "file" }),
    ).toThrow(/ne correspond pas au type MIME/)
  })

  it("refuses an empty filename", () => {
    expect(() =>
      assertMediaUploadAllowed({ ...validImage, filename: "  " }),
    ).toThrow(/nom de fichier est requis/)
  })
})

describe("collectMediaS3Keys", () => {
  it("returns the source key and every variant beside it", () => {
    // `processImage` writes variants as siblings of the source, so the keys are
    // derivable from `s3Key` alone and need no environment.
    const keys = collectMediaS3Keys({
      s3Key: "cms/abc/source.png",
      variants: {
        thumb: { url: "/api/files/cms/abc/thumb.webp" },
        card: { url: "/api/files/cms/abc/card.webp" },
        og: { url: "/api/files/cms/abc/og.webp" },
      },
    })

    expect([...keys].sort()).toEqual([
      "cms/abc/card.webp",
      "cms/abc/og.webp",
      "cms/abc/source.png",
      "cms/abc/thumb.webp",
    ])
  })

  it("does not invent a variant key the row does not carry", () => {
    const keys = collectMediaS3Keys({
      s3Key: "cms/abc/source.png",
      variants: { thumb: { url: "/api/files/cms/abc/thumb.webp" } },
    })

    expect([...keys].sort()).toEqual([
      "cms/abc/source.png",
      "cms/abc/thumb.webp",
    ])
  })

  it("recovers keys from a legacy row that only stored proxy URLs", () => {
    const keys = collectMediaS3Keys({
      url: "/api/files/cms/legacy/source.png",
      thumbnailUrl: "/api/files/cms/legacy/thumb.webp",
    })

    expect([...keys].sort()).toEqual([
      "cms/legacy/source.png",
      "cms/legacy/thumb.webp",
    ])
  })

  it("recovers keys from CDN URLs when the CDN base is known", () => {
    const keys = collectMediaS3Keys(
      {
        sourceUrl: "https://cdn.beyours.fr/cms/abc/source.png",
        variants: {
          thumb: { url: "https://cdn.beyours.fr/cms/abc/thumb.webp" },
        },
      },
      { publicBaseUrl: "https://cdn.beyours.fr" },
    )

    expect([...keys].sort()).toEqual([
      "cms/abc/source.png",
      "cms/abc/thumb.webp",
    ])
  })

  it("ignores a URL that is not this deployment's media", () => {
    // The row is data. A URL pointing at somebody else's host must not turn
    // into a key this deployment then deletes.
    const keys = collectMediaS3Keys({
      url: "https://images.unsplash.com/photo-1",
    })

    expect(keys).toEqual([])
  })

  it("deduplicates the key the two sources agree on", () => {
    const keys = collectMediaS3Keys({
      s3Key: "cms/abc/source.png",
      sourceUrl: "/api/files/cms/abc/source.png",
    })

    expect(keys).toEqual(["cms/abc/source.png"])
  })

  it("returns nothing for a row that never reached S3", () => {
    // A `processing` row abandoned before its PUT owns no object.
    expect(collectMediaS3Keys({})).toEqual([])
  })
})
