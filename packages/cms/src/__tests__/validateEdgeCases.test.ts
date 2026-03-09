import { describe, it, expect } from "vitest"
import { validateBlockValues } from "../validation/validateBlockValues"
import type { BlockDefinition, CmsBlockValues } from "../registry/types"

// ---------------------------------------------------------------------------
// Block definitions
// ---------------------------------------------------------------------------

const mediaBlock: BlockDefinition = {
  key: "media-test",
  label: "Media Test Block",
  fields: {
    heroImage: {
      type: "image",
      label: "Hero",
      required: true,
      translatable: false,
      hasCodeFallback: false,
    },
    logo: {
      type: "image",
      label: "Logo",
      required: false,
      translatable: false,
      hasCodeFallback: true,
    },
    promoVideo: {
      type: "video",
      label: "Promo",
      required: false,
      translatable: false,
      hasCodeFallback: true,
    },
    menu: {
      type: "file",
      label: "Menu PDF",
      required: false,
      translatable: false,
      hasCodeFallback: true,
    },
  },
}

const richBlock: BlockDefinition = {
  key: "rich-test",
  label: "Rich Content Block",
  fields: {
    body: {
      type: "richtext",
      label: "Body",
      required: true,
      maxLength: 500,
      hasCodeFallback: false,
    },
    footnote: {
      type: "richtext",
      label: "Footnote",
      maxLength: 200,
      hasCodeFallback: true,
    },
  },
}

const videoBlock: BlockDefinition = {
  key: "video-test",
  label: "Video Block",
  fields: {
    mainVideo: {
      type: "video",
      label: "Video",
      required: true,
      translatable: false,
      hasCodeFallback: false,
    },
  },
}

const allTypesBlock: BlockDefinition = {
  key: "all-types",
  label: "All Types Block",
  fields: {
    title: {
      type: "text",
      label: "Title",
      required: true,
      maxLength: 50,
      hasCodeFallback: true,
    },
    body: {
      type: "richtext",
      label: "Body",
      maxLength: 1000,
      hasCodeFallback: true,
    },
    banner: {
      type: "image",
      label: "Banner",
      translatable: false,
      hasCodeFallback: true,
    },
    video: {
      type: "video",
      label: "Video",
      translatable: false,
      hasCodeFallback: true,
    },
    attachment: {
      type: "file",
      label: "Attachment",
      translatable: false,
      hasCodeFallback: true,
    },
  },
}

// ---------------------------------------------------------------------------
// Helper: extract errors for a specific field
// ---------------------------------------------------------------------------
function errorsFor(result: ReturnType<typeof validateBlockValues>, fieldKey: string) {
  return result.errors.filter((e) => e.fieldKey === fieldKey)
}

// ---------------------------------------------------------------------------
// Required media fields
// ---------------------------------------------------------------------------

describe("required media fields", () => {
  it("required image with mediaId is valid", () => {
    const values: CmsBlockValues = {
      heroImage: { type: "image", mediaId: "media-abc" },
    }
    const result = validateBlockValues(values, mediaBlock)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("required image without mediaId produces a required error", () => {
    const values: CmsBlockValues = {
      heroImage: { type: "image" },
    }
    const result = validateBlockValues(values, mediaBlock)
    expect(result.valid).toBe(false)
    expect(errorsFor(result, "heroImage").some((e) => e.code === "required")).toBe(true)
  })

  it("required image set to isCleared produces a required error", () => {
    // isCleared skips field-level checks but the required loop still fires
    // because the value exists with isCleared=true and hasCodeFallback=false
    const values: CmsBlockValues = {
      heroImage: { type: "image", isCleared: true },
    }
    const result = validateBlockValues(values, mediaBlock)
    expect(result.valid).toBe(false)
    expect(errorsFor(result, "heroImage").some((e) => e.code === "required")).toBe(true)
  })

  it("required image field entirely absent produces a required error", () => {
    // No heroImage key at all in values
    const values: CmsBlockValues = {}
    const result = validateBlockValues(values, mediaBlock)
    expect(result.valid).toBe(false)
    expect(errorsFor(result, "heroImage").some((e) => e.code === "required")).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Required video fields — hasContent for video inside MEDIA_TYPES uses mediaId
// ---------------------------------------------------------------------------

describe("required video fields", () => {
  it("required video with mediaId is valid", () => {
    const values: CmsBlockValues = {
      mainVideo: { type: "video", mediaId: "vid-001" },
    }
    const result = validateBlockValues(values, videoBlock)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("required video with embedUrl but no mediaId produces a required error", () => {
    // hasContent for MEDIA_TYPES only checks mediaId; the embedUrl branch is
    // shadowed because "video" is already matched in MEDIA_TYPES before the
    // explicit type === "video" branch
    const values: CmsBlockValues = {
      mainVideo: { type: "video", embedUrl: "https://youtube.com/watch?v=abc" },
    }
    const result = validateBlockValues(values, videoBlock)
    expect(result.valid).toBe(false)
    expect(errorsFor(result, "mainVideo").some((e) => e.code === "required")).toBe(true)
  })

  it("required video with neither mediaId nor embedUrl produces a required error", () => {
    const values: CmsBlockValues = {
      mainVideo: { type: "video" },
    }
    const result = validateBlockValues(values, videoBlock)
    expect(result.valid).toBe(false)
    expect(errorsFor(result, "mainVideo").some((e) => e.code === "required")).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Video field specifics (optional video in mediaBlock)
// ---------------------------------------------------------------------------

describe("video field specifics (optional field)", () => {
  // Baseline: provide heroImage so the required check on that field passes
  const base: CmsBlockValues = {
    heroImage: { type: "image", mediaId: "img-001" },
  }

  it("video with embedUrl only is valid (no required constraint)", () => {
    const values: CmsBlockValues = {
      ...base,
      promoVideo: { type: "video", embedUrl: "https://vimeo.com/123456" },
    }
    const result = validateBlockValues(values, mediaBlock)
    expect(result.valid).toBe(true)
    expect(errorsFor(result, "promoVideo")).toHaveLength(0)
  })

  it("video with mediaId only is valid", () => {
    const values: CmsBlockValues = {
      ...base,
      promoVideo: { type: "video", mediaId: "vid-999" },
    }
    const result = validateBlockValues(values, mediaBlock)
    expect(result.valid).toBe(true)
    expect(errorsFor(result, "promoVideo")).toHaveLength(0)
  })

  it("video with both embedUrl and mediaId is valid", () => {
    const values: CmsBlockValues = {
      ...base,
      promoVideo: { type: "video", mediaId: "vid-999", embedUrl: "https://youtube.com/watch?v=xyz" },
    }
    const result = validateBlockValues(values, mediaBlock)
    expect(result.valid).toBe(true)
    expect(errorsFor(result, "promoVideo")).toHaveLength(0)
  })

  it("video with embedUrl and embedProvider is valid", () => {
    const values: CmsBlockValues = {
      ...base,
      promoVideo: {
        type: "video",
        embedUrl: "https://youtube.com/watch?v=xyz",
        embedProvider: "youtube",
      },
    }
    const result = validateBlockValues(values, mediaBlock)
    expect(result.valid).toBe(true)
    expect(errorsFor(result, "promoVideo")).toHaveLength(0)
  })

  it("video with empty embedUrl string is valid (no required constraint on optional field)", () => {
    // An empty embedUrl does not cause an error on an optional video field;
    // hasContent checks mediaId only via MEDIA_TYPES and the field is not required
    const values: CmsBlockValues = {
      ...base,
      promoVideo: { type: "video", embedUrl: "" },
    }
    const result = validateBlockValues(values, mediaBlock)
    expect(result.valid).toBe(true)
    expect(errorsFor(result, "promoVideo")).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Richtext specifics
// ---------------------------------------------------------------------------

describe("richtext specifics", () => {
  // richBlock.body: required, maxLength 500, no fallback
  // richBlock.footnote: optional, maxLength 200, has fallback

  it("nested HTML tags are stripped before length check — inner text 4 chars is under 500", () => {
    // <p><strong><em>text</em></strong></p> strips to "text" (4 chars)
    const values: CmsBlockValues = {
      body: { type: "richtext", textValue: "<p><strong><em>text</em></strong></p>" },
    }
    const result = validateBlockValues(values, richBlock)
    expect(result.valid).toBe(true)
    expect(errorsFor(result, "body")).toHaveLength(0)
  })

  it("HTML entities like &amp; are NOT decoded — counted as-is in character length", () => {
    // stripHtml only removes tag tokens (<...>); entities remain verbatim.
    // "&amp;" = 5 chars, so "a &amp; b" = 9 chars after stripping — well under 500.
    const values: CmsBlockValues = {
      body: { type: "richtext", textValue: "a &amp; b" },
    }
    const result = validateBlockValues(values, richBlock)
    expect(result.valid).toBe(true)
    expect(errorsFor(result, "body")).toHaveLength(0)
  })

  it("self-closing tags <br/> and <hr/> are fully stripped — result is 0 chars with no max_length error", () => {
    // stripHtml removes the tag tokens and leaves an empty string (0 chars).
    // hasContent for richtext checks !!value.textValue && value.textValue.trim().length > 0.
    // The raw textValue "<br/><hr/>" is non-empty and non-whitespace so hasContent
    // returns true — no required error is raised.
    // The stripped length (0) is not over the 500 maxLength, so no max_length error either.
    const values: CmsBlockValues = {
      body: { type: "richtext", textValue: "<br/><hr/>" },
    }
    const result = validateBlockValues(values, richBlock)
    expect(result.valid).toBe(true)
    // No max_length error — 0 stripped chars is below 500
    expect(errorsFor(result, "body").some((e) => e.code === "max_length")).toBe(false)
    // No required error — hasContent sees non-empty raw textValue
    expect(errorsFor(result, "body").some((e) => e.code === "required")).toBe(false)
  })

  it("richtext at exact maxLength after stripping HTML is valid", () => {
    // footnote maxLength = 200; wrap 200 x-chars in a tag
    const inner = "x".repeat(200)
    const values: CmsBlockValues = {
      body: { type: "richtext", textValue: "required content" },
      footnote: { type: "richtext", textValue: `<p>${inner}</p>` },
    }
    const result = validateBlockValues(values, richBlock)
    expect(result.valid).toBe(true)
    expect(errorsFor(result, "footnote")).toHaveLength(0)
  })

  it("richtext at maxLength+1 after stripping HTML produces max_length error", () => {
    // footnote maxLength = 200; 201 x-chars inside a tag
    const inner = "x".repeat(201)
    const values: CmsBlockValues = {
      body: { type: "richtext", textValue: "required content" },
      footnote: { type: "richtext", textValue: `<p>${inner}</p>` },
    }
    const result = validateBlockValues(values, richBlock)
    expect(result.valid).toBe(false)
    expect(errorsFor(result, "footnote").some((e) => e.code === "max_length")).toBe(true)
  })

  it("richtext required field with whitespace-only value produces required error", () => {
    // hasContent trims before checking, so "   " yields empty after trim
    const values: CmsBlockValues = {
      body: { type: "richtext", textValue: "   " },
    }
    const result = validateBlockValues(values, richBlock)
    expect(result.valid).toBe(false)
    expect(errorsFor(result, "body").some((e) => e.code === "required")).toBe(true)
  })

  it("richtext body at exactly 500 chars after HTML strip is valid", () => {
    const inner = "a".repeat(500)
    const values: CmsBlockValues = {
      body: { type: "richtext", textValue: `<div>${inner}</div>` },
    }
    const result = validateBlockValues(values, richBlock)
    expect(result.valid).toBe(true)
    expect(errorsFor(result, "body")).toHaveLength(0)
  })

  it("richtext body at 501 chars after HTML strip produces max_length error", () => {
    const inner = "a".repeat(501)
    const values: CmsBlockValues = {
      body: { type: "richtext", textValue: `<div>${inner}</div>` },
    }
    const result = validateBlockValues(values, richBlock)
    expect(result.valid).toBe(false)
    expect(errorsFor(result, "body").some((e) => e.code === "max_length")).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Image with altText
// ---------------------------------------------------------------------------

describe("image with altText", () => {
  const base: CmsBlockValues = {
    heroImage: { type: "image", mediaId: "img-001" },
  }

  it("image with mediaId and altText is valid", () => {
    const values: CmsBlockValues = {
      heroImage: { type: "image", mediaId: "img-001", altText: "A hero banner" },
    }
    const result = validateBlockValues(values, mediaBlock)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("image with mediaId and empty altText is valid", () => {
    const values: CmsBlockValues = {
      heroImage: { type: "image", mediaId: "img-001", altText: "" },
    }
    const result = validateBlockValues(values, mediaBlock)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("optional image with only altText but no mediaId does not produce a type_mismatch or required error", () => {
    // logo is optional (required: false), so no required error.
    // altText alone does not constitute a content value for an image field —
    // but neither does it cause a type error since the field type matches.
    const values: CmsBlockValues = {
      ...base,
      logo: { type: "image", altText: "Our logo" },
    }
    const result = validateBlockValues(values, mediaBlock)
    expect(result.valid).toBe(true)
    expect(errorsFor(result, "logo")).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// isCleared edge cases
// ---------------------------------------------------------------------------

describe("isCleared edge cases", () => {
  it("all fields cleared — only required-without-fallback fields produce errors", () => {
    // In mediaBlock: heroImage is required + no fallback -> error
    // logo, promoVideo, menu are optional or have fallback -> no errors
    const values: CmsBlockValues = {
      heroImage: { type: "image", isCleared: true },
      logo: { type: "image", isCleared: true },
      promoVideo: { type: "video", isCleared: true },
      menu: { type: "file", isCleared: true },
    }
    const result = validateBlockValues(values, mediaBlock)
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].fieldKey).toBe("heroImage")
    expect(result.errors[0].code).toBe("required")
  })

  it("isCleared with a wrong type value still skips type check", () => {
    // The field-level loop continues immediately on isCleared, so type_mismatch
    // is never evaluated.
    const values: CmsBlockValues = {
      heroImage: { type: "image", mediaId: "img-001" }, // satisfy required
      logo: { type: "video", isCleared: true },         // wrong type but cleared
    }
    const result = validateBlockValues(values, mediaBlock)
    expect(result.valid).toBe(true)
    expect(errorsFor(result, "logo")).toHaveLength(0)
  })

  it("isCleared on a required field with hasCodeFallback skips the required check entirely", () => {
    // allTypesBlock.title: required=true, hasCodeFallback=true
    // The required loop has `if (!fieldDef.required || fieldDef.hasCodeFallback) continue`
    // so title is never evaluated regardless of isCleared.
    const values: CmsBlockValues = {
      title: { type: "text", isCleared: true },
    }
    const result = validateBlockValues(values, allTypesBlock)
    expect(result.valid).toBe(true)
    expect(errorsFor(result, "title")).toHaveLength(0)
  })

  it("isCleared on a required field without fallback produces a required error", () => {
    // videoBlock.mainVideo: required=true, hasCodeFallback=false
    const values: CmsBlockValues = {
      mainVideo: { type: "video", isCleared: true },
    }
    const result = validateBlockValues(values, videoBlock)
    expect(result.valid).toBe(false)
    expect(errorsFor(result, "mainVideo").some((e) => e.code === "required")).toBe(true)
  })

  it("isCleared on an optional field produces no error", () => {
    const values: CmsBlockValues = {
      heroImage: { type: "image", mediaId: "img-001" },
      menu: { type: "file", isCleared: true },
    }
    const result = validateBlockValues(values, mediaBlock)
    expect(result.valid).toBe(true)
    expect(errorsFor(result, "menu")).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Multiple blocks — validation is independent per block definition
// ---------------------------------------------------------------------------

describe("multiple blocks — independent validation", () => {
  it("same values validated against different block definitions produce different results", () => {
    // Values that satisfy videoBlock but not mediaBlock (heroImage missing)
    const values: CmsBlockValues = {
      mainVideo: { type: "video", mediaId: "vid-001" },
    }

    const videoResult = validateBlockValues(values, videoBlock)
    expect(videoResult.valid).toBe(true)

    // Against mediaBlock these values have an unknown field (mainVideo) and a
    // missing required field (heroImage)
    const mediaResult = validateBlockValues(values, mediaBlock)
    expect(mediaResult.valid).toBe(false)
    expect(mediaResult.errors.some((e) => e.code === "unknown_field" && e.fieldKey === "mainVideo")).toBe(true)
    expect(mediaResult.errors.some((e) => e.code === "required" && e.fieldKey === "heroImage")).toBe(true)
  })

  it("validating richBlock values against videoBlock produces unknown_field errors", () => {
    const values: CmsBlockValues = {
      body: { type: "richtext", textValue: "Some content" },
    }
    const result = validateBlockValues(values, videoBlock)
    expect(result.valid).toBe(false)
    // "body" is unknown in videoBlock; "mainVideo" is required and missing
    expect(result.errors.some((e) => e.code === "unknown_field" && e.fieldKey === "body")).toBe(true)
    expect(result.errors.some((e) => e.code === "required" && e.fieldKey === "mainVideo")).toBe(true)
  })

  it("richBlock and mediaBlock validations do not interfere with each other", () => {
    const richValues: CmsBlockValues = {
      body: { type: "richtext", textValue: "Valid body text" },
    }
    const mediaValues: CmsBlockValues = {
      heroImage: { type: "image", mediaId: "img-001" },
    }

    const richResult = validateBlockValues(richValues, richBlock)
    const mediaResult = validateBlockValues(mediaValues, mediaBlock)

    expect(richResult.valid).toBe(true)
    expect(mediaResult.valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// All types in one block (allTypesBlock)
// ---------------------------------------------------------------------------

describe("allTypesBlock — all types present", () => {
  it("all fields with valid values is valid", () => {
    const values: CmsBlockValues = {
      title: { type: "text", textValue: "Welcome" },
      body: { type: "richtext", textValue: "<p>Some rich content</p>" },
      banner: { type: "image", mediaId: "img-banner" },
      video: { type: "video", mediaId: "vid-intro" },
      attachment: { type: "file", mediaId: "file-pdf" },
    }
    const result = validateBlockValues(values, allTypesBlock)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("all fields cleared — no errors because all have hasCodeFallback", () => {
    // Every field in allTypesBlock has hasCodeFallback: true, so the required
    // loop skips them all. isCleared passes field-level checks too.
    const values: CmsBlockValues = {
      title: { type: "text", isCleared: true },
      body: { type: "richtext", isCleared: true },
      banner: { type: "image", isCleared: true },
      video: { type: "video", isCleared: true },
      attachment: { type: "file", isCleared: true },
    }
    const result = validateBlockValues(values, allTypesBlock)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("empty values object produces no errors when all fields have hasCodeFallback", () => {
    const values: CmsBlockValues = {}
    const result = validateBlockValues(values, allTypesBlock)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("mix of valid, missing, and cleared fields — correct independent validation per field", () => {
    // Only provide title and body; banner, video, attachment are omitted.
    // All have hasCodeFallback so no required errors expected.
    const values: CmsBlockValues = {
      title: { type: "text", textValue: "Title present" },
      body: { type: "richtext", isCleared: true },
      // banner, video, attachment absent
    }
    const result = validateBlockValues(values, allTypesBlock)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("type mismatch for each field type is reported with code type_mismatch", () => {
    // Provide every field with the wrong type
    const values: CmsBlockValues = {
      title: { type: "richtext", textValue: "wrong" },   // expects text
      body: { type: "text", textValue: "wrong" },        // expects richtext
      banner: { type: "video", mediaId: "x" },           // expects image
      video: { type: "image", mediaId: "x" },            // expects video
      attachment: { type: "image", mediaId: "x" },       // expects file
    }
    const result = validateBlockValues(values, allTypesBlock)
    expect(result.valid).toBe(false)

    const mismatchFields = result.errors
      .filter((e) => e.code === "type_mismatch")
      .map((e) => e.fieldKey)

    expect(mismatchFields).toContain("title")
    expect(mismatchFields).toContain("body")
    expect(mismatchFields).toContain("banner")
    expect(mismatchFields).toContain("video")
    expect(mismatchFields).toContain("attachment")
    expect(mismatchFields).toHaveLength(5)
  })

  it("title maxLength violation does not prevent other fields from being validated", () => {
    // title maxLength = 50; provide 51 chars
    const longTitle = "a".repeat(51)
    const values: CmsBlockValues = {
      title: { type: "text", textValue: longTitle },
      body: { type: "richtext", textValue: "<b>wrong body type would not fail</b>" },
      banner: { type: "image", mediaId: "img-001" },
    }
    const result = validateBlockValues(values, allTypesBlock)
    expect(result.valid).toBe(false)
    expect(errorsFor(result, "title").some((e) => e.code === "max_length")).toBe(true)
    // body and banner should not have errors
    expect(errorsFor(result, "body")).toHaveLength(0)
    expect(errorsFor(result, "banner")).toHaveLength(0)
  })
})
