/**
 * CMS Registry Validation
 *
 * Validates the registry config at initialization time.
 * Throws an explicit error listing ALL violations at once.
 */

import type { PageDefinition, CmsGroupDefinition } from "./types"

export interface CmsRegistryConfig {
  pages: Record<string, PageDefinition>
  groups: CmsGroupDefinition[]
}

export function validateCmsRegistry(config: CmsRegistryConfig): void {
  const errors: string[] = []
  const groupIds = config.groups.map((g) => g.id)
  const orders = config.groups.map((g) => g.order)

  // 1. group.id unique
  const seenIds = new Set<string>()
  for (const id of groupIds) {
    if (seenIds.has(id)) {
      errors.push(`Duplicate group id: "${id}"`)
    }
    seenIds.add(id)
  }

  // 2. group.order unique
  const seenOrders = new Set<number>()
  for (const order of orders) {
    if (seenOrders.has(order)) {
      errors.push(`Duplicate group order: ${order}`)
    }
    seenOrders.add(order)
  }

  // 3. every page.groupId points at a group that exists
  const groupIdSet = new Set(groupIds)
  for (const [slug, page] of Object.entries(config.pages)) {
    if (page.groupId && !groupIdSet.has(page.groupId)) {
      errors.push(`Page "${slug}" references unknown groupId "${page.groupId}"`)
    }

    // 3b. page slug must match the record key
    if (page.slug && page.slug !== slug) {
      errors.push(
        `Page key "${slug}" does not match page.slug "${page.slug}"`
      )
    }

    // 3c. blockKeys must be unique within each page
    const blockKeys = new Set<string>()
    for (const block of page.blocks) {
      if (blockKeys.has(block.key)) {
        errors.push(`Page "${slug}" has duplicate blockKey "${block.key}"`)
      }
      blockKeys.add(block.key)
    }
  }

  // 4. no orphan groups (every group owns at least one page)
  const usedGroupIds = new Set(
    Object.values(config.pages)
      .map((p) => p.groupId)
      .filter(Boolean),
  )
  for (const group of config.groups) {
    if (!usedGroupIds.has(group.id)) {
      errors.push(`Group "${group.id}" (label: "${group.label}") has no pages assigned`)
    }
  }

  if (errors.length) {
    throw new Error(
      `[CMS Registry] Invalid config:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
    )
  }
}
