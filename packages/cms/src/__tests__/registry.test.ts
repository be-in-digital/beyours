import { describe, it, expect, beforeEach } from "vitest"
import {
  setCmsRegistry,
  getCmsRegistry,
  getCmsGroups,
  getPageDefinition,
  getBlockDefinition,
  getFieldDefinition,
  getAllPageSlugs,
} from "../registry"
import type { PageDefinition, CmsGroupDefinition } from "../registry/types"

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockGroups: CmsGroupDefinition[] = [
  { id: "main", label: "Main", order: 1 },
  { id: "auth", label: "Auth", order: 2 },
]

const mockPages: Record<string, PageDefinition> = {
  homepage: {
    slug: "homepage",
    label: "Homepage",
    description: "The homepage",
    groupId: "main",
    blocks: [
      {
        key: "hero",
        label: "Hero Section",
        fields: {
          title: {
            type: "text",
            label: "Title",
            required: true,
            maxLength: 100,
            hasCodeFallback: true,
          },
          subtitle: {
            type: "text",
            label: "Subtitle",
            maxLength: 200,
            hasCodeFallback: true,
          },
          image: {
            type: "image",
            label: "Image",
            translatable: false,
            hasCodeFallback: true,
          },
        },
      },
      {
        key: "cta",
        label: "Call to Action",
        fields: {
          buttonLabel: {
            type: "text",
            label: "Button Label",
            maxLength: 50,
            hasCodeFallback: true,
          },
        },
      },
    ],
  },
  "sign-in": {
    slug: "sign-in",
    label: "Sign In",
    groupId: "auth",
    blocks: [
      {
        key: "form",
        label: "Form",
        fields: {
          heading: {
            type: "text",
            label: "Heading",
            maxLength: 100,
            hasCodeFallback: true,
          },
          submitLabel: {
            type: "text",
            label: "Submit Label",
            maxLength: 50,
            hasCodeFallback: true,
          },
        },
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  setCmsRegistry({ pages: mockPages, groups: mockGroups })
})

describe("setCmsRegistry", () => {
  it("accepts valid config without throwing", () => {
    expect(() =>
      setCmsRegistry({ pages: mockPages, groups: mockGroups }),
    ).not.toThrow()
  })

  it("replaces previously registered pages", () => {
    const newPages: Record<string, PageDefinition> = {
      about: {
        slug: "about",
        label: "About",
        groupId: "main",
        blocks: [
          {
            key: "content",
            label: "Content",
            fields: {
              text: { type: "text", label: "Text", hasCodeFallback: false },
            },
          },
        ],
      },
    }
    setCmsRegistry({
      pages: newPages,
      groups: [{ id: "main", label: "Main", order: 1 }],
    })
    expect(getAllPageSlugs()).toEqual(["about"])
    expect(getPageDefinition("homepage")).toBeUndefined()
  })
})

describe("getCmsRegistry", () => {
  it("returns pages and groups", () => {
    const reg = getCmsRegistry()
    expect(Object.keys(reg.pages)).toEqual(["homepage", "sign-in"])
    expect(reg.groups).toHaveLength(2)
  })
})

describe("getCmsGroups", () => {
  it("returns groups sorted by order", () => {
    // Register with reversed order to verify sorting
    setCmsRegistry({
      pages: mockPages,
      groups: [
        { id: "auth", label: "Auth", order: 2 },
        { id: "main", label: "Main", order: 1 },
      ],
    })
    const groups = getCmsGroups()
    expect(groups[0].id).toBe("main")
    expect(groups[1].id).toBe("auth")
  })
})

describe("getAllPageSlugs", () => {
  it("returns all registered page slugs", () => {
    const slugs = getAllPageSlugs()
    expect(slugs).toContain("homepage")
    expect(slugs).toContain("sign-in")
    expect(slugs).toHaveLength(2)
  })
})

describe("getPageDefinition", () => {
  it("returns page definition for valid slug", () => {
    const page = getPageDefinition("homepage")
    expect(page).toBeDefined()
    expect(page!.slug).toBe("homepage")
    expect(page!.label).toBe("Homepage")
  })

  it("returns undefined for unknown slug", () => {
    expect(getPageDefinition("nonexistent")).toBeUndefined()
  })
})

describe("getBlockDefinition", () => {
  it("returns block definition for valid page + block", () => {
    const block = getBlockDefinition("homepage", "hero")
    expect(block).toBeDefined()
    expect(block!.key).toBe("hero")
    expect(block!.fields).toHaveProperty("title")
  })

  it("returns undefined for unknown page", () => {
    expect(getBlockDefinition("nonexistent", "hero")).toBeUndefined()
  })

  it("returns undefined for unknown block", () => {
    expect(getBlockDefinition("homepage", "nonexistent")).toBeUndefined()
  })
})

describe("getFieldDefinition", () => {
  it("returns field definition for valid path", () => {
    const field = getFieldDefinition("homepage", "hero", "title")
    expect(field).toBeDefined()
    expect(field!.type).toBe("text")
    expect(field!.required).toBe(true)
    expect(field!.maxLength).toBe(100)
    expect(field!.hasCodeFallback).toBe(true)
  })

  it("returns image field with translatable=false", () => {
    const field = getFieldDefinition("homepage", "hero", "image")
    expect(field).toBeDefined()
    expect(field!.type).toBe("image")
    expect(field!.translatable).toBe(false)
  })

  it("returns undefined for unknown field", () => {
    expect(
      getFieldDefinition("homepage", "hero", "nonexistent"),
    ).toBeUndefined()
  })

  it("returns undefined for unknown block", () => {
    expect(
      getFieldDefinition("homepage", "nonexistent", "title"),
    ).toBeUndefined()
  })

  it("returns undefined for unknown page", () => {
    expect(
      getFieldDefinition("nonexistent", "hero", "title"),
    ).toBeUndefined()
  })
})
