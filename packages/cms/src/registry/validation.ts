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

  // 3. chaque page.groupId référence un groupe existant
  const groupIdSet = new Set(groupIds)
  for (const [slug, page] of Object.entries(config.pages)) {
    if (page.groupId && !groupIdSet.has(page.groupId)) {
      errors.push(`Page "${slug}" references unknown groupId "${page.groupId}"`)
    }
  }

  // 4. pas de groupe orphelin (chaque groupe a au moins une page)
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
