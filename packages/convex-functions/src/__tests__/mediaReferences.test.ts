import { describe, expect, it } from "vitest"

import {
  collectStrings,
  mediaReferenceNeedles,
  textReferencesMedia,
} from "../cmsMedia"

/**
 * Finding a media reference that is not an id.
 *
 * WHAT WAS BROKEN (#432.5). `deleteMedia` checked every place a media is
 * referenced BY ID — `cmsBlocks.values[].mediaId`, an article's `coverImageId`
 * and `ogImageId` — and an image dropped into an article's body is not one of
 * them. The editor writes `<img src="…">`, so the reference is a URL inside an
 * HTML string, `usageCount` never moves, and the library showed
 * « Utilisations : 0 » beside the delete button for a photograph on a published
 * page.
 *
 * The delete is not recoverable the way a row delete is: the S3 bytes go with
 * it, so the article is left with a broken image and the file is gone.
 *
 * These are the pure half — which strings count as a reference, and how a text
 * is searched. The end-to-end refusal is in each app's
 * `media-in-use.test.ts`.
 */

const MEDIA = {
  _id: "kg2abcdefghijklmnopqrstuvwx",
  s3Key: "cms/kg2abcdefghijklmnopqrstuvwx/source.webp",
  sourceUrl: "https://cdn.example.test/cms/kg2abcdefghijklmnopqrstuvwx/source.webp",
  thumbnailUrl: "https://cdn.example.test/cms/kg2abcdefghijklmnopqrstuvwx/thumb.webp",
  variants: {
    card: { url: "https://cdn.example.test/cms/kg2abcdefghijklmnopqrstuvwx/card.webp" },
    og: undefined,
  },
}

describe("mediaReferenceNeedles", () => {
  it("collects every identifier the media can be written as", () => {
    const needles = mediaReferenceNeedles(MEDIA)
    expect(needles).toContain(MEDIA._id)
    expect(needles).toContain(MEDIA.s3Key)
    expect(needles).toContain(MEDIA.sourceUrl)
    expect(needles).toContain(MEDIA.thumbnailUrl)
    expect(needles).toContain(MEDIA.variants.card.url)
  })

  it("includes the s3 key, because an app may serve through /api/files", () => {
    // The bucket is private and reads go through the app's own proxy, so the
    // markup can carry the KEY rather than a CDN URL.
    expect(mediaReferenceNeedles({ s3Key: "cms/abc/source.webp" })).toEqual([
      "cms/abc/source.webp",
    ])
  })

  it("drops anything too short to be one", () => {
    // A needle of `""` matches every document, and a three-character one
    // matches by accident. Either would refuse every delete in the library,
    // which is a worse failure than the one being fixed.
    expect(mediaReferenceNeedles({ s3Key: "", url: "a.webp" })).toEqual([])
  })

  it("returns nothing for a media that has not finished processing", () => {
    // A row exists between the presigned upload and `setMediaReady`, with no
    // key and no URL. It cannot be referenced by anything yet, and the absence
    // must not be read as "matches everything".
    expect(mediaReferenceNeedles({})).toEqual([])
  })

  it("does not duplicate a URL that appears twice", () => {
    const needles = mediaReferenceNeedles({
      url: "https://cdn.example.test/cms/a/source.webp",
      sourceUrl: "https://cdn.example.test/cms/a/source.webp",
    })
    expect(needles).toHaveLength(1)
  })
})

describe("textReferencesMedia", () => {
  const needles = mediaReferenceNeedles(MEDIA)

  it("finds the image an editor dropped into an article body", () => {
    const body =
      `<p>La pâte repose douze heures.</p>` +
      `<img src="${MEDIA.sourceUrl}" alt="La pâte" />` +
      `<p>Puis on l'étale.</p>`
    expect(textReferencesMedia(body, needles)).toBe(true)
  })

  it("finds it whatever the editor appended to the URL", () => {
    // A width query, a cache buster, a srcset entry. Matching the identifier
    // rather than parsing the attribute is what makes this hold.
    expect(
      textReferencesMedia(`<img src="${MEDIA.sourceUrl}?w=800" />`, needles)
    ).toBe(true)
    expect(
      textReferencesMedia(
        `<img srcset="${MEDIA.variants.card.url} 800w" />`,
        needles
      )
    ).toBe(true)
  })

  it("finds the id in a data attribute", () => {
    expect(
      textReferencesMedia(`<figure data-media-id="${MEDIA._id}"></figure>`, needles)
    ).toBe(true)
  })

  it("does not fire on another media's URL", () => {
    const other = "https://cdn.example.test/cms/kg9zyxwvutsrqponmlkjihgfe/source.webp"
    expect(textReferencesMedia(`<img src="${other}" />`, needles)).toBe(false)
  })

  it("is false for a body with no image, and for a missing one", () => {
    expect(textReferencesMedia("<p>Rien que du texte.</p>", needles)).toBe(false)
    expect(textReferencesMedia(undefined, needles)).toBe(false)
    expect(textReferencesMedia("", needles)).toBe(false)
  })

  it("is false when there is nothing to look for", () => {
    // The counterpart of the "not finished processing" case above: no needles
    // must mean no match, not every match.
    expect(textReferencesMedia(`<img src="${MEDIA.sourceUrl}" />`, [])).toBe(false)
  })
})

describe("collectStrings", () => {
  it("reaches a string however deeply a block nested it", () => {
    // `cmsBlocks.values` is `v.any()`: a rich-text field is a string on one
    // block and an array of nodes on another, so walking is the only reading
    // that does not depend on which editor wrote it.
    expect(
      collectStrings({
        heading: "Notre histoire",
        body: { nodes: [{ type: "image", attrs: { src: "cms/a/source.webp" } }] },
        tags: ["a", "b"],
      }).sort()
      // `type: "image"` is collected too, and that is correct: the walk reads
      // every string because it cannot know which key an editor put a URL
      // under. A needle is at least 8 characters, so a word like "image"
      // cannot be one.
    ).toEqual(["Notre histoire", "a", "b", "cms/a/source.webp", "image"])
  })

  it("ignores numbers, booleans and nulls rather than stringifying them", () => {
    expect(collectStrings({ n: 1, b: true, z: null, s: "x" })).toEqual(["x"])
  })

  it("returns nothing for an empty block", () => {
    expect(collectStrings({})).toEqual([])
  })
})
