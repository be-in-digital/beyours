/**
 * CMS Registry
 *
 * Configurable registry of CMS-editable pages and their content zones.
 * Used by admin UI (form generation), validation (mutations), and storefront (fallback logic).
 *
 * Each application calls `setCmsRegistry()` at module load time to register its pages.
 */

import type {
  PageDefinition,
  BlockDefinition,
  FieldDefinition,
  CmsGroupDefinition,
} from "./types"
import { validateCmsRegistry } from "./validation"

let _pages: Record<string, PageDefinition> = {}
let _groups: CmsGroupDefinition[] = []

/**
 * Initialize the CMS registry with app-specific pages and groups.
 * Must be called before any handler invocation (module-level side effect).
 * Validates the config and throws on any integrity violation.
 */
export function setCmsRegistry(config: {
  pages: Record<string, PageDefinition>
  groups: CmsGroupDefinition[]
}): void {
  validateCmsRegistry(config)
  _pages = config.pages
  _groups = [...config.groups].sort((a, b) => a.order - b.order)
}

/** Get the full registry (pages + groups) */
export function getCmsRegistry() {
  return { pages: _pages, groups: _groups }
}

/** Get the registered CMS groups, sorted by order */
export function getCmsGroups(): CmsGroupDefinition[] {
  return _groups
}

/** Get the definition for a page by its slug */
export function getPageDefinition(slug: string): PageDefinition | undefined {
  if (Object.keys(_pages).length === 0) {
    throw new Error(
      "CMS registry is empty. Call setCmsRegistry() before accessing page definitions."
    )
  }
  return _pages[slug]
}

/** Get all registered page slugs */
export function getAllPageSlugs(): string[] {
  if (Object.keys(_pages).length === 0) {
    throw new Error(
      "CMS registry is empty. Call setCmsRegistry() before accessing page slugs."
    )
  }
  return Object.keys(_pages)
}

/** Get a block definition within a page */
export function getBlockDefinition(
  pageSlug: string,
  blockKey: string,
): BlockDefinition | undefined {
  const page = _pages[pageSlug]
  if (!page) return undefined
  return page.blocks.find((b) => b.key === blockKey)
}

/** Get a field definition within a block */
export function getFieldDefinition(
  pageSlug: string,
  blockKey: string,
  fieldKey: string,
): FieldDefinition | undefined {
  const block = getBlockDefinition(pageSlug, blockKey)
  if (!block) return undefined
  return block.fields[fieldKey]
}
