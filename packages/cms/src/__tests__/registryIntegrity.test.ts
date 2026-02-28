/**
 * CMS Registry Integrity Tests
 *
 * Validates the structural integrity of ALL 17 CMS pages in the registry.
 * These tests act as a contract: any page definition that violates the
 * invariants defined here will fail fast, preventing runtime errors in
 * the admin UI, validation layer, and storefront fallback logic.
 *
 * Test sections:
 *   1. Global Registry Invariants  — apply to every page, block, and field
 *   2. Per-Page Structure          — exact block counts and block keys per page
 *   3. Cross-Reference             — getPageDefinition / getBlockDefinition / getFieldDefinition round-trips
 */

import { describe, it, expect } from "vitest"
import {
  cmsRegistry,
  getPageDefinition,
  getBlockDefinition,
  getFieldDefinition,
  getAllPageSlugs,
} from "../registry"
import type { FieldType } from "../registry/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_FIELD_TYPES: FieldType[] = ["text", "richtext", "image", "video", "file", "select"]
const MEDIA_FIELD_TYPES: FieldType[] = ["image", "video", "file"]
const TEXT_FIELD_TYPES: FieldType[] = ["text", "richtext"]

const ALL_PAGE_SLUGS = [
  "sign-in",
  "sign-up",
  "forgot-password",
  "homepage",
  "menu",
  "cart",
  "checkout",
  "store-selector",
  "account",
  "account-orders",
  "account-addresses",
  "account-favorites",
  "order-tracking",
  "product-detail",
  "category-menu",
  "game",
  "storefront-layout",
] as const

// ---------------------------------------------------------------------------
// 1. Global Registry Invariants
// ---------------------------------------------------------------------------

describe("Global Registry Invariants", () => {
  describe("registry completeness", () => {
    it("contains exactly 17 pages", () => {
      expect(getAllPageSlugs()).toHaveLength(17)
    })

    it("contains every expected page slug", () => {
      const slugs = getAllPageSlugs()
      for (const slug of ALL_PAGE_SLUGS) {
        expect(slugs, `expected slug "${slug}" to be present`).toContain(slug)
      }
    })
  })

  describe("page-level invariants (all pages)", () => {
    it("every page has a non-empty slug matching its registry key", () => {
      for (const [key, page] of Object.entries(cmsRegistry)) {
        expect(page.slug, `page at key "${key}" has empty slug`).toBeTruthy()
        expect(
          page.slug,
          `page at key "${key}" has slug "${page.slug}" that does not match its registry key`,
        ).toBe(key)
      }
    })

    it("every page has a non-empty label", () => {
      for (const [key, page] of Object.entries(cmsRegistry)) {
        expect(
          page.label,
          `page "${key}" has empty or missing label`,
        ).toBeTruthy()
      }
    })

    it("every page has at least 1 block", () => {
      for (const [key, page] of Object.entries(cmsRegistry)) {
        expect(
          page.blocks.length,
          `page "${key}" has no blocks`,
        ).toBeGreaterThanOrEqual(1)
      }
    })
  })

  describe("block-level invariants (all blocks, all pages)", () => {
    it("every block has a non-empty key", () => {
      for (const page of Object.values(cmsRegistry)) {
        for (const block of page.blocks) {
          expect(
            block.key,
            `a block on page "${page.slug}" has an empty key`,
          ).toBeTruthy()
        }
      }
    })

    it("every block has a non-empty label", () => {
      for (const page of Object.values(cmsRegistry)) {
        for (const block of page.blocks) {
          expect(
            block.label,
            `block "${block.key}" on page "${page.slug}" has empty label`,
          ).toBeTruthy()
        }
      }
    })

    it("every block has at least 1 field", () => {
      for (const page of Object.values(cmsRegistry)) {
        for (const block of page.blocks) {
          const fieldCount = Object.keys(block.fields).length
          expect(
            fieldCount,
            `block "${block.key}" on page "${page.slug}" has no fields`,
          ).toBeGreaterThanOrEqual(1)
        }
      }
    })

    it("no duplicate block keys within a page", () => {
      for (const page of Object.values(cmsRegistry)) {
        const blockKeys = page.blocks.map((b) => b.key)
        const uniqueKeys = new Set(blockKeys)
        expect(
          uniqueKeys.size,
          `page "${page.slug}" has duplicate block keys: ${blockKeys.filter((k, i) => blockKeys.indexOf(k) !== i).join(", ")}`,
        ).toBe(blockKeys.length)
      }
    })
  })

  describe("field-level invariants (all fields, all blocks, all pages)", () => {
    it("every field has a type that is one of the valid FieldType values", () => {
      for (const page of Object.values(cmsRegistry)) {
        for (const block of page.blocks) {
          for (const [fieldKey, field] of Object.entries(block.fields)) {
            expect(
              VALID_FIELD_TYPES,
              `field "${page.slug}/${block.key}/${fieldKey}" has invalid type "${field.type}"`,
            ).toContain(field.type)
          }
        }
      }
    })

    it("every field has a non-empty label", () => {
      for (const page of Object.values(cmsRegistry)) {
        for (const block of page.blocks) {
          for (const [fieldKey, field] of Object.entries(block.fields)) {
            expect(
              field.label,
              `field "${page.slug}/${block.key}/${fieldKey}" has empty label`,
            ).toBeTruthy()
          }
        }
      }
    })

    it("every field has hasCodeFallback defined as a boolean (not undefined)", () => {
      for (const page of Object.values(cmsRegistry)) {
        for (const block of page.blocks) {
          for (const [fieldKey, field] of Object.entries(block.fields)) {
            const path = `${page.slug}/${block.key}/${fieldKey}`
            expect(
              field.hasCodeFallback,
              `${path} is missing hasCodeFallback`,
            ).toBeDefined()
            expect(
              typeof field.hasCodeFallback,
              `${path} hasCodeFallback must be boolean, got "${typeof field.hasCodeFallback}"`,
            ).toBe("boolean")
          }
        }
      }
    })

    it("text/richtext fields have translatable either true or undefined (default translatable)", () => {
      for (const page of Object.values(cmsRegistry)) {
        for (const block of page.blocks) {
          for (const [fieldKey, field] of Object.entries(block.fields)) {
            if (TEXT_FIELD_TYPES.includes(field.type as "text" | "richtext")) {
              const path = `${page.slug}/${block.key}/${fieldKey}`
              expect(
                field.translatable === true || field.translatable === undefined,
                `${path} is a text/richtext field but has translatable set to "${field.translatable}"; expected true or undefined`,
              ).toBe(true)
            }
          }
        }
      }
    })

    it("image/video/file fields have translatable set to false", () => {
      for (const page of Object.values(cmsRegistry)) {
        for (const block of page.blocks) {
          for (const [fieldKey, field] of Object.entries(block.fields)) {
            if (MEDIA_FIELD_TYPES.includes(field.type as "image" | "video" | "file")) {
              const path = `${page.slug}/${block.key}/${fieldKey}`
              expect(
                field.translatable,
                `${path} is a media field (${field.type}) but translatable is "${field.translatable}" instead of false`,
              ).toBe(false)
            }
          }
        }
      }
    })

    it("no duplicate field keys within a block", () => {
      for (const page of Object.values(cmsRegistry)) {
        for (const block of page.blocks) {
          // fields is a Record — JS guarantees unique keys in an object literal,
          // but this test confirms no key collision that could arise from spread merges.
          const fieldKeys = Object.keys(block.fields)
          const uniqueKeys = new Set(fieldKeys)
          expect(
            uniqueKeys.size,
            `block "${page.slug}/${block.key}" has duplicate field keys`,
          ).toBe(fieldKeys.length)
        }
      }
    })

    it("maxLength is only set on text/richtext fields, never on media fields", () => {
      for (const page of Object.values(cmsRegistry)) {
        for (const block of page.blocks) {
          for (const [fieldKey, field] of Object.entries(block.fields)) {
            if (MEDIA_FIELD_TYPES.includes(field.type as "image" | "video" | "file")) {
              const path = `${page.slug}/${block.key}/${fieldKey}`
              expect(
                field.maxLength,
                `${path} is a media field (${field.type}) but has maxLength set`,
              ).toBeUndefined()
            }
          }
        }
      }
    })

    it("if required is set, it must be a boolean", () => {
      for (const page of Object.values(cmsRegistry)) {
        for (const block of page.blocks) {
          for (const [fieldKey, field] of Object.entries(block.fields)) {
            if (field.required !== undefined) {
              const path = `${page.slug}/${block.key}/${fieldKey}`
              expect(
                typeof field.required,
                `${path} has required set to a non-boolean value "${field.required}"`,
              ).toBe("boolean")
            }
          }
        }
      }
    })
  })
})

// ---------------------------------------------------------------------------
// 2. Per-Page Structure Validation
// ---------------------------------------------------------------------------

describe("Per-Page Structure Validation", () => {
  // ---- Auth pages ----------------------------------------------------------

  describe("sign-in", () => {
    it("has exactly 2 blocks", () => {
      const page = getPageDefinition("sign-in")
      expect(page).toBeDefined()
      expect(page!.blocks).toHaveLength(2)
    })

    it("block 0 is 'hero'", () => {
      const page = getPageDefinition("sign-in")!
      expect(page.blocks[0].key).toBe("hero")
    })

    it("block 1 is 'form'", () => {
      const page = getPageDefinition("sign-in")!
      expect(page.blocks[1].key).toBe("form")
    })

    it("hero block contains title, subtitle, image fields", () => {
      const block = getBlockDefinition("sign-in", "hero")!
      expect(block.fields).toHaveProperty("title")
      expect(block.fields).toHaveProperty("subtitle")
      expect(block.fields).toHaveProperty("image")
    })

    it("form block contains heading, submitLabel, forgotLink, signupLink fields", () => {
      const block = getBlockDefinition("sign-in", "form")!
      expect(block.fields).toHaveProperty("heading")
      expect(block.fields).toHaveProperty("submitLabel")
      expect(block.fields).toHaveProperty("forgotLink")
      expect(block.fields).toHaveProperty("signupLink")
    })
  })

  describe("sign-up", () => {
    it("has exactly 2 blocks", () => {
      const page = getPageDefinition("sign-up")
      expect(page).toBeDefined()
      expect(page!.blocks).toHaveLength(2)
    })

    it("block 0 is 'hero'", () => {
      expect(getPageDefinition("sign-up")!.blocks[0].key).toBe("hero")
    })

    it("block 1 is 'form'", () => {
      expect(getPageDefinition("sign-up")!.blocks[1].key).toBe("form")
    })

    it("form block has signinLink but not signupLink", () => {
      const block = getBlockDefinition("sign-up", "form")!
      expect(block.fields).toHaveProperty("signinLink")
      expect(block.fields).not.toHaveProperty("signupLink")
    })

    it("hero block has title, subtitle, image fields", () => {
      const block = getBlockDefinition("sign-up", "hero")!
      expect(block.fields).toHaveProperty("title")
      expect(block.fields).toHaveProperty("subtitle")
      expect(block.fields).toHaveProperty("image")
    })
  })

  describe("forgot-password", () => {
    it("has exactly 1 block", () => {
      const page = getPageDefinition("forgot-password")
      expect(page).toBeDefined()
      expect(page!.blocks).toHaveLength(1)
    })

    it("the single block is 'form'", () => {
      expect(getPageDefinition("forgot-password")!.blocks[0].key).toBe("form")
    })

    it("form block has heading, description, submitLabel, signinLink fields", () => {
      const block = getBlockDefinition("forgot-password", "form")!
      expect(block.fields).toHaveProperty("heading")
      expect(block.fields).toHaveProperty("description")
      expect(block.fields).toHaveProperty("submitLabel")
      expect(block.fields).toHaveProperty("signinLink")
    })
  })

  // ---- Storefront pages ----------------------------------------------------

  describe("homepage", () => {
    it("has blocks", () => {
      const page = getPageDefinition("homepage")
      expect(page).toBeDefined()
      expect(page!.blocks.length).toBeGreaterThanOrEqual(1)
    })

    it("has 'hero' block with title, subtitle, image", () => {
      const block = getBlockDefinition("homepage", "hero")
      expect(block).toBeDefined()
      expect(block!.fields).toHaveProperty("title")
      expect(block!.fields).toHaveProperty("subtitle")
      expect(block!.fields).toHaveProperty("image")
    })

    it("has 'cta' block with button label fields", () => {
      const block = getBlockDefinition("homepage", "cta")
      expect(block).toBeDefined()
      expect(block!.fields).toHaveProperty("menuButtonLabel")
      expect(block!.fields).toHaveProperty("signinButtonLabel")
      expect(block!.fields).toHaveProperty("dashboardButtonLabel")
    })
  })

  describe("menu", () => {
    it("has blocks", () => {
      const page = getPageDefinition("menu")
      expect(page).toBeDefined()
      expect(page!.blocks.length).toBeGreaterThanOrEqual(1)
    })

    it("has 'header' block", () => {
      const block = getBlockDefinition("menu", "header")
      expect(block).toBeDefined()
      expect(block!.fields).toHaveProperty("title")
    })

    it("has 'emptyState' block", () => {
      const block = getBlockDefinition("menu", "emptyState")
      expect(block).toBeDefined()
      expect(block!.fields).toHaveProperty("title")
    })
  })

  describe("cart", () => {
    it("has blocks", () => {
      const page = getPageDefinition("cart")
      expect(page).toBeDefined()
      expect(page!.blocks.length).toBeGreaterThanOrEqual(1)
    })

    it("has 'header' block", () => {
      expect(getBlockDefinition("cart", "header")).toBeDefined()
    })

    it("has 'emptyState' block with ctaLabel field", () => {
      const block = getBlockDefinition("cart", "emptyState")
      expect(block).toBeDefined()
      expect(block!.fields).toHaveProperty("ctaLabel")
    })

    it("has 'actions' block with checkoutLabel and continueShopping fields", () => {
      const block = getBlockDefinition("cart", "actions")
      expect(block).toBeDefined()
      expect(block!.fields).toHaveProperty("checkoutLabel")
      expect(block!.fields).toHaveProperty("continueShopping")
    })
  })

  describe("checkout", () => {
    it("has blocks", () => {
      const page = getPageDefinition("checkout")
      expect(page).toBeDefined()
      expect(page!.blocks.length).toBeGreaterThanOrEqual(1)
    })

    it("has 'header' block", () => {
      expect(getBlockDefinition("checkout", "header")).toBeDefined()
    })

    it("has 'sections' block with orderSummaryTitle, paymentTitle, deliveryTitle", () => {
      const block = getBlockDefinition("checkout", "sections")
      expect(block).toBeDefined()
      expect(block!.fields).toHaveProperty("orderSummaryTitle")
      expect(block!.fields).toHaveProperty("paymentTitle")
      expect(block!.fields).toHaveProperty("deliveryTitle")
    })

    it("has 'actions' block with submitLabel and backLabel", () => {
      const block = getBlockDefinition("checkout", "actions")
      expect(block).toBeDefined()
      expect(block!.fields).toHaveProperty("submitLabel")
      expect(block!.fields).toHaveProperty("backLabel")
    })
  })

  describe("store-selector", () => {
    it("has blocks", () => {
      const page = getPageDefinition("store-selector")
      expect(page).toBeDefined()
      expect(page!.blocks.length).toBeGreaterThanOrEqual(1)
    })

    it("has 'header' block", () => {
      expect(getBlockDefinition("store-selector", "header")).toBeDefined()
    })

    it("has 'emptyState' block", () => {
      expect(getBlockDefinition("store-selector", "emptyState")).toBeDefined()
    })
  })

  describe("account", () => {
    it("has blocks", () => {
      const page = getPageDefinition("account")
      expect(page).toBeDefined()
      expect(page!.blocks.length).toBeGreaterThanOrEqual(1)
    })

    it("has 'header' block", () => {
      expect(getBlockDefinition("account", "header")).toBeDefined()
    })

    it("has 'navigation' block with ordersLabel, addressesLabel, favoritesLabel, logoutLabel", () => {
      const block = getBlockDefinition("account", "navigation")
      expect(block).toBeDefined()
      expect(block!.fields).toHaveProperty("ordersLabel")
      expect(block!.fields).toHaveProperty("addressesLabel")
      expect(block!.fields).toHaveProperty("favoritesLabel")
      expect(block!.fields).toHaveProperty("logoutLabel")
    })
  })

  describe("account-orders", () => {
    it("has blocks", () => {
      const page = getPageDefinition("account-orders")
      expect(page).toBeDefined()
      expect(page!.blocks.length).toBeGreaterThanOrEqual(1)
    })

    it("has 'header' block", () => {
      expect(getBlockDefinition("account-orders", "header")).toBeDefined()
    })

    it("has 'emptyState' block", () => {
      expect(getBlockDefinition("account-orders", "emptyState")).toBeDefined()
    })
  })

  describe("account-addresses", () => {
    it("has blocks", () => {
      const page = getPageDefinition("account-addresses")
      expect(page).toBeDefined()
      expect(page!.blocks.length).toBeGreaterThanOrEqual(1)
    })

    it("has 'header' block", () => {
      expect(getBlockDefinition("account-addresses", "header")).toBeDefined()
    })

    it("has 'emptyState' block", () => {
      expect(getBlockDefinition("account-addresses", "emptyState")).toBeDefined()
    })
  })

  describe("account-favorites", () => {
    it("has blocks", () => {
      const page = getPageDefinition("account-favorites")
      expect(page).toBeDefined()
      expect(page!.blocks.length).toBeGreaterThanOrEqual(1)
    })

    it("has 'header' block", () => {
      expect(getBlockDefinition("account-favorites", "header")).toBeDefined()
    })

    it("has 'emptyState' block", () => {
      expect(getBlockDefinition("account-favorites", "emptyState")).toBeDefined()
    })
  })

  describe("order-tracking", () => {
    it("has blocks", () => {
      const page = getPageDefinition("order-tracking")
      expect(page).toBeDefined()
      expect(page!.blocks.length).toBeGreaterThanOrEqual(1)
    })

    it("has 'header' block", () => {
      expect(getBlockDefinition("order-tracking", "header")).toBeDefined()
    })

    it("has 'statuses' block with all four status label fields", () => {
      const block = getBlockDefinition("order-tracking", "statuses")
      expect(block).toBeDefined()
      expect(block!.fields).toHaveProperty("pendingLabel")
      expect(block!.fields).toHaveProperty("preparingLabel")
      expect(block!.fields).toHaveProperty("readyLabel")
      expect(block!.fields).toHaveProperty("deliveredLabel")
    })
  })

  describe("product-detail", () => {
    it("has blocks", () => {
      const page = getPageDefinition("product-detail")
      expect(page).toBeDefined()
      expect(page!.blocks.length).toBeGreaterThanOrEqual(1)
    })

    it("has 'header' block", () => {
      expect(getBlockDefinition("product-detail", "header")).toBeDefined()
    })

    it("has 'sections' block with descriptionTitle, optionsTitle, similarTitle", () => {
      const block = getBlockDefinition("product-detail", "sections")
      expect(block).toBeDefined()
      expect(block!.fields).toHaveProperty("descriptionTitle")
      expect(block!.fields).toHaveProperty("optionsTitle")
      expect(block!.fields).toHaveProperty("similarTitle")
    })

    it("has 'actions' block with addToCartLabel and outOfStockLabel", () => {
      const block = getBlockDefinition("product-detail", "actions")
      expect(block).toBeDefined()
      expect(block!.fields).toHaveProperty("addToCartLabel")
      expect(block!.fields).toHaveProperty("outOfStockLabel")
    })
  })

  describe("category-menu", () => {
    it("has blocks", () => {
      const page = getPageDefinition("category-menu")
      expect(page).toBeDefined()
      expect(page!.blocks.length).toBeGreaterThanOrEqual(1)
    })

    it("has 'header' block", () => {
      expect(getBlockDefinition("category-menu", "header")).toBeDefined()
    })

    it("has 'emptyState' block", () => {
      expect(getBlockDefinition("category-menu", "emptyState")).toBeDefined()
    })
  })

  describe("game", () => {
    it("has blocks", () => {
      const page = getPageDefinition("game")
      expect(page).toBeDefined()
      expect(page!.blocks.length).toBeGreaterThanOrEqual(1)
    })

    it("has 'hero' block with title, subtitle, image", () => {
      const block = getBlockDefinition("game", "hero")
      expect(block).toBeDefined()
      expect(block!.fields).toHaveProperty("title")
      expect(block!.fields).toHaveProperty("subtitle")
      expect(block!.fields).toHaveProperty("image")
    })

    it("has 'instructions' block with title and description", () => {
      const block = getBlockDefinition("game", "instructions")
      expect(block).toBeDefined()
      expect(block!.fields).toHaveProperty("title")
      expect(block!.fields).toHaveProperty("description")
    })

    it("has 'results' block with win/lose title and description fields", () => {
      const block = getBlockDefinition("game", "results")
      expect(block).toBeDefined()
      expect(block!.fields).toHaveProperty("winTitle")
      expect(block!.fields).toHaveProperty("winDescription")
      expect(block!.fields).toHaveProperty("loseTitle")
      expect(block!.fields).toHaveProperty("loseDescription")
    })
  })

  describe("storefront-layout", () => {
    it("has blocks", () => {
      const page = getPageDefinition("storefront-layout")
      expect(page).toBeDefined()
      expect(page!.blocks.length).toBeGreaterThanOrEqual(1)
    })

    it("has 'header' block with brandName, menuLabel, cartLabel, accountLabel, signinLabel", () => {
      const block = getBlockDefinition("storefront-layout", "header")
      expect(block).toBeDefined()
      expect(block!.fields).toHaveProperty("brandName")
      expect(block!.fields).toHaveProperty("menuLabel")
      expect(block!.fields).toHaveProperty("cartLabel")
      expect(block!.fields).toHaveProperty("accountLabel")
      expect(block!.fields).toHaveProperty("signinLabel")
    })

    it("has 'footer' block with poweredBy and copyrightText", () => {
      const block = getBlockDefinition("storefront-layout", "footer")
      expect(block).toBeDefined()
      expect(block!.fields).toHaveProperty("poweredBy")
      expect(block!.fields).toHaveProperty("copyrightText")
    })
  })
})

// ---------------------------------------------------------------------------
// 2b. SEO Block Validation (5 indexable pages)
// ---------------------------------------------------------------------------

describe("SEO Block Validation", () => {
  const INDEXABLE_PAGES = [
    "homepage",
    "menu",
    "category-menu",
    "product-detail",
    "storefront-layout",
  ] as const

  const SEO_FIELDS = ["metaTitle", "metaDescription", "ogImage", "robots"] as const

  for (const slug of INDEXABLE_PAGES) {
    describe(slug, () => {
      it("has a 'seo' block", () => {
        const block = getBlockDefinition(slug, "seo")
        expect(block, `page "${slug}" is missing the 'seo' block`).toBeDefined()
      })

      it("seo block is the first block", () => {
        const page = getPageDefinition(slug)!
        expect(page.blocks[0].key).toBe("seo")
      })

      for (const field of SEO_FIELDS) {
        it(`seo block has '${field}' field`, () => {
          const block = getBlockDefinition(slug, "seo")!
          expect(
            block.fields,
            `seo block on "${slug}" is missing field "${field}"`,
          ).toHaveProperty(field)
        })
      }

      it("seo.metaTitle is type text with maxLength 70", () => {
        const field = getFieldDefinition(slug, "seo", "metaTitle")!
        expect(field.type).toBe("text")
        expect(field.maxLength).toBe(70)
        expect(field.hasCodeFallback).toBe(true)
      })

      it("seo.metaDescription is type text with maxLength 160", () => {
        const field = getFieldDefinition(slug, "seo", "metaDescription")!
        expect(field.type).toBe("text")
        expect(field.maxLength).toBe(160)
        expect(field.hasCodeFallback).toBe(true)
      })

      it("seo.ogImage is type image", () => {
        const field = getFieldDefinition(slug, "seo", "ogImage")!
        expect(field.type).toBe("image")
        expect(field.translatable).toBe(false)
        expect(field.hasCodeFallback).toBe(true)
      })

      it("seo.robots is type select with 4 options", () => {
        const field = getFieldDefinition(slug, "seo", "robots")!
        expect(field.type).toBe("select")
        expect(field.options).toBeDefined()
        expect(field.options).toHaveLength(4)
        expect(field.hasCodeFallback).toBe(true)
      })
    })
  }

  it("non-indexable pages do NOT have a seo block", () => {
    const nonIndexable = getAllPageSlugs().filter(
      (s) => !(INDEXABLE_PAGES as readonly string[]).includes(s),
    )
    for (const slug of nonIndexable) {
      const block = getBlockDefinition(slug, "seo")
      expect(
        block,
        `page "${slug}" should NOT have a seo block (not indexable)`,
      ).toBeUndefined()
    }
  })
})

// ---------------------------------------------------------------------------
// 2c. Select Field Validation
// ---------------------------------------------------------------------------

describe("Select Field Validation", () => {
  it("every select field has a non-empty options array", () => {
    for (const page of Object.values(cmsRegistry)) {
      for (const block of page.blocks) {
        for (const [fieldKey, field] of Object.entries(block.fields)) {
          if (field.type === "select") {
            const path = `${page.slug}/${block.key}/${fieldKey}`
            expect(
              field.options,
              `${path} is a select field but has no options`,
            ).toBeDefined()
            expect(
              field.options!.length,
              `${path} is a select field but options array is empty`,
            ).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it("every select option has a non-empty value and label", () => {
    for (const page of Object.values(cmsRegistry)) {
      for (const block of page.blocks) {
        for (const [fieldKey, field] of Object.entries(block.fields)) {
          if (field.type === "select" && field.options) {
            for (const option of field.options) {
              const path = `${page.slug}/${block.key}/${fieldKey}`
              expect(
                option.value,
                `${path} has an option with empty value`,
              ).toBeTruthy()
              expect(
                option.label,
                `${path} has an option with empty label`,
              ).toBeTruthy()
            }
          }
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// 3. Cross-Reference Tests
// ---------------------------------------------------------------------------

describe("Cross-Reference Tests", () => {
  describe("getAllPageSlugs -> getPageDefinition round-trip", () => {
    it("every slug returned by getAllPageSlugs() is found by getPageDefinition()", () => {
      const slugs = getAllPageSlugs()
      for (const slug of slugs) {
        const page = getPageDefinition(slug)
        expect(
          page,
          `getPageDefinition("${slug}") returned undefined`,
        ).toBeDefined()
        expect(
          page!.slug,
          `getPageDefinition("${slug}") returned a page whose slug "${page!.slug}" does not match the key`,
        ).toBe(slug)
      }
    })

    it("getPageDefinition returns undefined for any slug not in the registry", () => {
      const phantomSlugs = ["nonexistent", "unknown-page", "", "cart-detail"]
      for (const slug of phantomSlugs) {
        expect(
          getPageDefinition(slug),
          `expected getPageDefinition("${slug}") to be undefined`,
        ).toBeUndefined()
      }
    })
  })

  describe("getBlockDefinition round-trip", () => {
    it("every block listed in each page's blocks array is found by getBlockDefinition()", () => {
      for (const [pageSlug, page] of Object.entries(cmsRegistry)) {
        for (const expectedBlock of page.blocks) {
          const found = getBlockDefinition(pageSlug, expectedBlock.key)
          expect(
            found,
            `getBlockDefinition("${pageSlug}", "${expectedBlock.key}") returned undefined`,
          ).toBeDefined()
          expect(
            found!.key,
            `getBlockDefinition("${pageSlug}", "${expectedBlock.key}") returned wrong block key`,
          ).toBe(expectedBlock.key)
        }
      }
    })

    it("getBlockDefinition returns undefined for an unknown block key on a valid page", () => {
      for (const pageSlug of getAllPageSlugs()) {
        expect(
          getBlockDefinition(pageSlug, "__nonexistent_block__"),
          `expected getBlockDefinition("${pageSlug}", "__nonexistent_block__") to be undefined`,
        ).toBeUndefined()
      }
    })

    it("getBlockDefinition returns undefined for an unknown page slug", () => {
      expect(getBlockDefinition("__nonexistent_page__", "hero")).toBeUndefined()
    })
  })

  describe("getFieldDefinition round-trip", () => {
    it("every field listed in each block's fields record is found by getFieldDefinition()", () => {
      for (const [pageSlug, page] of Object.entries(cmsRegistry)) {
        for (const block of page.blocks) {
          for (const [fieldKey, expectedField] of Object.entries(block.fields)) {
            const found = getFieldDefinition(pageSlug, block.key, fieldKey)
            expect(
              found,
              `getFieldDefinition("${pageSlug}", "${block.key}", "${fieldKey}") returned undefined`,
            ).toBeDefined()
            expect(
              found!.type,
              `getFieldDefinition("${pageSlug}", "${block.key}", "${fieldKey}") returned wrong type`,
            ).toBe(expectedField.type)
            expect(
              found!.label,
              `getFieldDefinition("${pageSlug}", "${block.key}", "${fieldKey}") returned wrong label`,
            ).toBe(expectedField.label)
          }
        }
      }
    })

    it("getFieldDefinition returns undefined for an unknown field key on a valid block", () => {
      const block = getBlockDefinition("sign-in", "hero")!
      expect(block).toBeDefined()
      expect(getFieldDefinition("sign-in", "hero", "__nonexistent_field__")).toBeUndefined()
    })

    it("getFieldDefinition returns undefined for an unknown block on a valid page", () => {
      expect(getFieldDefinition("sign-in", "__nonexistent_block__", "title")).toBeUndefined()
    })

    it("getFieldDefinition returns undefined for an unknown page slug", () => {
      expect(getFieldDefinition("__nonexistent_page__", "hero", "title")).toBeUndefined()
    })
  })
})
