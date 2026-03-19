/**
 * CMS Registry Validation Tests
 *
 * Tests the `validateCmsRegistry()` function which enforces:
 *   1. Unique group.id
 *   2. Unique group.order
 *   3. Every page.groupId references an existing group
 *   4. No orphan groups (every group has at least one page)
 */

import { describe, it, expect } from "vitest"
import { validateCmsRegistry } from "../registry/validation"
import type { PageDefinition, CmsGroupDefinition } from "../registry/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePage(
  slug: string,
  groupId?: string,
): PageDefinition {
  return {
    slug,
    label: slug,
    groupId,
    blocks: [
      {
        key: "content",
        label: "Content",
        fields: {
          title: { type: "text", label: "Title", hasCodeFallback: false },
        },
      },
    ],
  }
}

function makeGroups(...items: Array<[string, string, number]>): CmsGroupDefinition[] {
  return items.map(([id, label, order]) => ({ id, label, order }))
}

// ---------------------------------------------------------------------------
// Valid config
// ---------------------------------------------------------------------------

describe("validateCmsRegistry — valid configs", () => {
  it("accepts a valid config with groups and pages", () => {
    expect(() =>
      validateCmsRegistry({
        pages: {
          home: makePage("home", "main"),
          login: makePage("login", "auth"),
        },
        groups: makeGroups(["main", "Main", 1], ["auth", "Auth", 2]),
      }),
    ).not.toThrow()
  })

  it("accepts pages without groupId (ungrouped pages are allowed)", () => {
    expect(() =>
      validateCmsRegistry({
        pages: {
          home: makePage("home", "main"),
          about: makePage("about"), // no groupId
        },
        groups: makeGroups(["main", "Main", 1]),
      }),
    ).not.toThrow()
  })

  it("accepts empty config (no pages, no groups)", () => {
    expect(() =>
      validateCmsRegistry({ pages: {}, groups: [] }),
    ).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Duplicate group.id
// ---------------------------------------------------------------------------

describe("validateCmsRegistry — duplicate group.id", () => {
  it("throws when two groups have the same id", () => {
    expect(() =>
      validateCmsRegistry({
        pages: { home: makePage("home", "main") },
        groups: makeGroups(["main", "Main", 1], ["main", "Main 2", 2]),
      }),
    ).toThrow('Duplicate group id: "main"')
  })
})

// ---------------------------------------------------------------------------
// Duplicate group.order
// ---------------------------------------------------------------------------

describe("validateCmsRegistry — duplicate group.order", () => {
  it("throws when two groups have the same order", () => {
    expect(() =>
      validateCmsRegistry({
        pages: {
          home: makePage("home", "main"),
          login: makePage("login", "auth"),
        },
        groups: makeGroups(["main", "Main", 1], ["auth", "Auth", 1]),
      }),
    ).toThrow("Duplicate group order: 1")
  })
})

// ---------------------------------------------------------------------------
// Unknown groupId reference
// ---------------------------------------------------------------------------

describe("validateCmsRegistry — unknown groupId", () => {
  it("throws when a page references a non-existent group", () => {
    expect(() =>
      validateCmsRegistry({
        pages: { home: makePage("home", "unknown") },
        groups: makeGroups(["main", "Main", 1]),
      }),
    ).toThrow('Page "home" references unknown groupId "unknown"')
  })
})

// ---------------------------------------------------------------------------
// Orphan groups
// ---------------------------------------------------------------------------

describe("validateCmsRegistry — orphan groups", () => {
  it("throws when a group has no pages assigned", () => {
    expect(() =>
      validateCmsRegistry({
        pages: { home: makePage("home", "main") },
        groups: makeGroups(["main", "Main", 1], ["orphan", "Orphan", 2]),
      }),
    ).toThrow('Group "orphan"')
  })
})

// ---------------------------------------------------------------------------
// Multiple errors reported at once
// ---------------------------------------------------------------------------

describe("validateCmsRegistry — multiple errors", () => {
  it("reports all violations in a single error", () => {
    try {
      validateCmsRegistry({
        pages: {
          home: makePage("home", "missing"),
        },
        groups: makeGroups(
          ["a", "A", 1],
          ["a", "A dup", 1], // dup id + dup order
          ["lonely", "Lonely", 2], // orphan
        ),
      })
      expect.fail("should have thrown")
    } catch (e) {
      const msg = (e as Error).message
      expect(msg).toContain("Duplicate group id")
      expect(msg).toContain("Duplicate group order")
      expect(msg).toContain("unknown groupId")
      expect(msg).toContain("no pages assigned")
    }
  })
})
