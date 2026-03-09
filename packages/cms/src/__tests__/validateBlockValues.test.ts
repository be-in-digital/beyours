import { describe, it, expect } from "vitest"
import { validateBlockValues } from "../validation/validateBlockValues"
import type { BlockDefinition, CmsBlockValues } from "../registry/types"

const testBlock: BlockDefinition = {
  key: "test",
  label: "Test Block",
  fields: {
    title: {
      type: "text",
      label: "Title",
      required: true,
      maxLength: 10,
      hasCodeFallback: true,
    },
    description: {
      type: "richtext",
      label: "Description",
      maxLength: 20,
      hasCodeFallback: false,
    },
    image: {
      type: "image",
      label: "Image",
      required: false,
      translatable: false,
      hasCodeFallback: true,
    },
    requiredNoFallback: {
      type: "text",
      label: "Required No Fallback",
      required: true,
      hasCodeFallback: false,
    },
  },
}

describe("validateBlockValues", () => {
  it("should accept valid text values", () => {
    const values: CmsBlockValues = {
      title: { type: "text", textValue: "Hello" },
      requiredNoFallback: { type: "text", textValue: "Value" },
    }
    const result = validateBlockValues(values, testBlock)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("should reject unknown fields", () => {
    const values: CmsBlockValues = {
      title: { type: "text", textValue: "Hello" },
      unknownField: { type: "text", textValue: "Oops" },
      requiredNoFallback: { type: "text", textValue: "Value" },
    }
    const result = validateBlockValues(values, testBlock)
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe("unknown_field")
    expect(result.errors[0].fieldKey).toBe("unknownField")
  })

  it("should reject type mismatch", () => {
    const values: CmsBlockValues = {
      title: { type: "image", mediaId: "some-id" },
      requiredNoFallback: { type: "text", textValue: "Value" },
    }
    const result = validateBlockValues(values, testBlock)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === "type_mismatch")).toBe(true)
  })

  it("should skip required check when hasCodeFallback is true", () => {
    // title is required but has code fallback -> no error when missing
    const values: CmsBlockValues = {
      requiredNoFallback: { type: "text", textValue: "Value" },
    }
    const result = validateBlockValues(values, testBlock)
    expect(result.valid).toBe(true)
  })

  it("should fail required check when hasCodeFallback is false and field missing", () => {
    const values: CmsBlockValues = {
      title: { type: "text", textValue: "Hello" },
      // requiredNoFallback is missing
    }
    const result = validateBlockValues(values, testBlock)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === "required" && e.fieldKey === "requiredNoFallback")).toBe(true)
  })

  it("should fail required check when value is empty string", () => {
    const values: CmsBlockValues = {
      requiredNoFallback: { type: "text", textValue: "" },
    }
    const result = validateBlockValues(values, testBlock)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === "required" && e.fieldKey === "requiredNoFallback")).toBe(true)
  })

  describe("maxLength validation", () => {
    it("should accept text at exact max length", () => {
      const values: CmsBlockValues = {
        title: { type: "text", textValue: "1234567890" }, // 10 chars, maxLength=10
        requiredNoFallback: { type: "text", textValue: "Value" },
      }
      const result = validateBlockValues(values, testBlock)
      expect(result.valid).toBe(true)
    })

    it("should reject text exceeding max length by 1", () => {
      const values: CmsBlockValues = {
        title: { type: "text", textValue: "12345678901" }, // 11 chars, maxLength=10
        requiredNoFallback: { type: "text", textValue: "Value" },
      }
      const result = validateBlockValues(values, testBlock)
      expect(result.valid).toBe(false)
      expect(result.errors[0].code).toBe("max_length")
      expect(result.errors[0].fieldKey).toBe("title")
    })

    it("should strip HTML tags for richtext maxLength check", () => {
      // "Hello World" = 11 chars, under 20
      const values: CmsBlockValues = {
        description: { type: "richtext", textValue: "<b>Hello</b> World" },
        requiredNoFallback: { type: "text", textValue: "Value" },
      }
      const result = validateBlockValues(values, testBlock)
      expect(result.valid).toBe(true)
    })

    it("should reject richtext exceeding max length after stripping HTML", () => {
      // 21 chars after stripping tags, maxLength=20
      const values: CmsBlockValues = {
        description: { type: "richtext", textValue: "<b>123456789012345678901</b>" },
        requiredNoFallback: { type: "text", textValue: "Value" },
      }
      const result = validateBlockValues(values, testBlock)
      expect(result.valid).toBe(false)
      expect(result.errors[0].code).toBe("max_length")
    })

    it("should not check maxLength for undefined textValue", () => {
      const values: CmsBlockValues = {
        title: { type: "text" }, // no textValue
        requiredNoFallback: { type: "text", textValue: "Value" },
      }
      const result = validateBlockValues(values, testBlock)
      expect(result.valid).toBe(true)
    })
  })

  describe("isCleared handling", () => {
    it("should skip all validation for isCleared fields", () => {
      const values: CmsBlockValues = {
        title: { type: "text", isCleared: true },
        requiredNoFallback: { type: "text", textValue: "Value" },
      }
      const result = validateBlockValues(values, testBlock)
      expect(result.valid).toBe(true)
    })

    it("should skip type mismatch check for isCleared fields", () => {
      const values: CmsBlockValues = {
        title: { type: "image", isCleared: true }, // wrong type but cleared
        requiredNoFallback: { type: "text", textValue: "Value" },
      }
      const result = validateBlockValues(values, testBlock)
      expect(result.valid).toBe(true)
    })
  })

  describe("media fields", () => {
    it("should accept image field with mediaId", () => {
      const values: CmsBlockValues = {
        image: { type: "image", mediaId: "media-123", altText: "Alt text" },
        requiredNoFallback: { type: "text", textValue: "Value" },
      }
      const result = validateBlockValues(values, testBlock)
      expect(result.valid).toBe(true)
    })

    it("should accept image field without mediaId (optional)", () => {
      const values: CmsBlockValues = {
        image: { type: "image" },
        requiredNoFallback: { type: "text", textValue: "Value" },
      }
      const result = validateBlockValues(values, testBlock)
      expect(result.valid).toBe(true)
    })
  })

  describe("multiple errors", () => {
    it("should collect all errors at once", () => {
      const values: CmsBlockValues = {
        title: { type: "image" }, // type mismatch
        unknownField: { type: "text", textValue: "x" }, // unknown
        // requiredNoFallback missing -> required
      }
      const result = validateBlockValues(values, testBlock)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe("select field type", () => {
    const selectBlock: BlockDefinition = {
      key: "seo",
      label: "SEO",
      fields: {
        robots: {
          type: "select",
          label: "Robots",
          hasCodeFallback: true,
          options: [
            { value: "index, follow", label: "Index, Follow" },
            { value: "noindex, follow", label: "Noindex, Follow" },
            { value: "index, nofollow", label: "Index, Nofollow" },
            { value: "noindex, nofollow", label: "Noindex, Nofollow" },
          ],
        },
        requiredSelect: {
          type: "select",
          label: "Required Select",
          required: true,
          hasCodeFallback: false,
          options: [
            { value: "a", label: "A" },
            { value: "b", label: "B" },
          ],
        },
      },
    }

    it("should accept valid select value", () => {
      const values: CmsBlockValues = {
        robots: { type: "select", textValue: "index, follow" },
        requiredSelect: { type: "select", textValue: "a" },
      }
      const result = validateBlockValues(values, selectBlock)
      expect(result.valid).toBe(true)
    })

    it("should reject invalid select option", () => {
      const values: CmsBlockValues = {
        robots: { type: "select", textValue: "invalid-value" },
        requiredSelect: { type: "select", textValue: "a" },
      }
      const result = validateBlockValues(values, selectBlock)
      expect(result.valid).toBe(false)
      expect(result.errors[0].code).toBe("invalid_option")
      expect(result.errors[0].fieldKey).toBe("robots")
    })

    it("should accept empty select when hasCodeFallback", () => {
      const values: CmsBlockValues = {
        robots: { type: "select" }, // no textValue, has fallback
        requiredSelect: { type: "select", textValue: "b" },
      }
      const result = validateBlockValues(values, selectBlock)
      expect(result.valid).toBe(true)
    })

    it("should fail required select when empty and no fallback", () => {
      const values: CmsBlockValues = {
        // requiredSelect missing
      }
      const result = validateBlockValues(values, selectBlock)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === "required" && e.fieldKey === "requiredSelect")).toBe(true)
    })

    it("should reject type mismatch on select field", () => {
      const values: CmsBlockValues = {
        robots: { type: "text", textValue: "index, follow" },
        requiredSelect: { type: "select", textValue: "a" },
      }
      const result = validateBlockValues(values, selectBlock)
      expect(result.valid).toBe(false)
      expect(result.errors[0].code).toBe("type_mismatch")
    })

    it("should skip validation for isCleared select", () => {
      const values: CmsBlockValues = {
        robots: { type: "select", isCleared: true },
        requiredSelect: { type: "select", textValue: "a" },
      }
      const result = validateBlockValues(values, selectBlock)
      expect(result.valid).toBe(true)
    })
  })

  describe("empty values object", () => {
    it("should only fail on required fields without fallback", () => {
      const values: CmsBlockValues = {}
      const result = validateBlockValues(values, testBlock)
      // Only requiredNoFallback should fail (title is required but has fallback)
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].fieldKey).toBe("requiredNoFallback")
      expect(result.errors[0].code).toBe("required")
    })
  })
})
