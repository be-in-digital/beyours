import { describe, it, expect } from "vitest"
import {
  cmsRegistry,
  getPageDefinition,
  getBlockDefinition,
  getFieldDefinition,
  getAllPageSlugs,
} from "../registry"

describe("cmsRegistry", () => {
  it("should contain all registered pages", () => {
    const slugs = getAllPageSlugs()
    // Auth pages
    expect(slugs).toContain("sign-in")
    expect(slugs).toContain("sign-up")
    expect(slugs).toContain("forgot-password")
    // Storefront pages
    expect(slugs).toContain("homepage")
    expect(slugs).toContain("menu")
    expect(slugs).toContain("cart")
    expect(slugs).toContain("checkout")
    expect(slugs).toContain("store-selector")
    expect(slugs).toContain("account")
    expect(slugs).toContain("account-orders")
    expect(slugs).toContain("account-addresses")
    expect(slugs).toContain("account-favorites")
    expect(slugs).toContain("order-tracking")
    expect(slugs).toContain("product-detail")
    expect(slugs).toContain("category-menu")
    expect(slugs).toContain("game")
    expect(slugs).toContain("storefront-layout")
    expect(slugs).toHaveLength(17)
  })

  it("should have unique slugs matching page definition slugs", () => {
    for (const [key, page] of Object.entries(cmsRegistry)) {
      expect(page.slug).toBe(key)
    }
  })

  it("should have unique block keys within each page", () => {
    for (const page of Object.values(cmsRegistry)) {
      const keys = page.blocks.map((b) => b.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
})

describe("getPageDefinition", () => {
  it("should return page definition for valid slug", () => {
    const page = getPageDefinition("sign-in")
    expect(page).toBeDefined()
    expect(page!.slug).toBe("sign-in")
    expect(page!.label).toBe("Page de connexion")
  })

  it("should return undefined for unknown slug", () => {
    expect(getPageDefinition("nonexistent")).toBeUndefined()
  })
})

describe("getBlockDefinition", () => {
  it("should return block definition for valid page + block", () => {
    const block = getBlockDefinition("sign-in", "hero")
    expect(block).toBeDefined()
    expect(block!.key).toBe("hero")
    expect(block!.fields).toHaveProperty("title")
    expect(block!.fields).toHaveProperty("subtitle")
    expect(block!.fields).toHaveProperty("image")
  })

  it("should return form block for sign-in", () => {
    const block = getBlockDefinition("sign-in", "form")
    expect(block).toBeDefined()
    expect(block!.fields).toHaveProperty("heading")
    expect(block!.fields).toHaveProperty("submitLabel")
    expect(block!.fields).toHaveProperty("forgotLink")
    expect(block!.fields).toHaveProperty("signupLink")
  })

  it("should return undefined for unknown page", () => {
    expect(getBlockDefinition("nonexistent", "hero")).toBeUndefined()
  })

  it("should return undefined for unknown block", () => {
    expect(getBlockDefinition("sign-in", "nonexistent")).toBeUndefined()
  })
})

describe("getFieldDefinition", () => {
  it("should return field definition for valid path", () => {
    const field = getFieldDefinition("sign-in", "hero", "title")
    expect(field).toBeDefined()
    expect(field!.type).toBe("text")
    expect(field!.required).toBe(true)
    expect(field!.maxLength).toBe(100)
    expect(field!.hasCodeFallback).toBe(true)
  })

  it("should return image field with translatable=false", () => {
    const field = getFieldDefinition("sign-in", "hero", "image")
    expect(field).toBeDefined()
    expect(field!.type).toBe("image")
    expect(field!.translatable).toBe(false)
  })

  it("should return undefined for unknown field", () => {
    expect(getFieldDefinition("sign-in", "hero", "nonexistent")).toBeUndefined()
  })

  it("should return undefined for unknown block", () => {
    expect(getFieldDefinition("sign-in", "nonexistent", "title")).toBeUndefined()
  })

  it("should return undefined for unknown page", () => {
    expect(getFieldDefinition("nonexistent", "hero", "title")).toBeUndefined()
  })
})

describe("sign-up page structure", () => {
  it("should have hero and form blocks", () => {
    const page = getPageDefinition("sign-up")
    expect(page).toBeDefined()
    expect(page!.blocks).toHaveLength(2)
    expect(page!.blocks[0].key).toBe("hero")
    expect(page!.blocks[1].key).toBe("form")
  })

  it("should have signinLink instead of signupLink in form", () => {
    const block = getBlockDefinition("sign-up", "form")
    expect(block!.fields).toHaveProperty("signinLink")
    expect(block!.fields).not.toHaveProperty("signupLink")
  })
})

describe("forgot-password page structure", () => {
  it("should have only form block", () => {
    const page = getPageDefinition("forgot-password")
    expect(page).toBeDefined()
    expect(page!.blocks).toHaveLength(1)
    expect(page!.blocks[0].key).toBe("form")
  })

  it("should have description field in form", () => {
    const field = getFieldDefinition("forgot-password", "form", "description")
    expect(field).toBeDefined()
    expect(field!.type).toBe("text")
    expect(field!.maxLength).toBe(300)
  })
})

describe("all fields have hasCodeFallback set", () => {
  it("should have hasCodeFallback defined on every field", () => {
    for (const page of Object.values(cmsRegistry)) {
      for (const block of page.blocks) {
        for (const [fieldKey, field] of Object.entries(block.fields)) {
          expect(
            field.hasCodeFallback,
            `${page.slug}/${block.key}/${fieldKey} missing hasCodeFallback`,
          ).toBeDefined()
        }
      }
    }
  })
})
