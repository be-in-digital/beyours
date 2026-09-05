/**
 * Which sidebar entries an operator may be shown.
 *
 * WHY IT IS ITS OWN MODULE: the sidebar drew an entry from the RBAC role check
 * alone, while the server runs TWO gates on every store query
 * (`convex-functions/src/auth.ts`, `requireStorePermission`) — the role check,
 * and then `profileAllowsPermission`, which narrows the role to the modules the
 * owner actually ticked in the invite dialog. A member invited with `["orders"]`
 * was therefore shown every entry their role permits and refused by
 * `module_denied` on most of them.
 *
 * A link that opens an error page is worse than an absent link: the operator
 * cannot tell a right they were not granted from a product that is broken. So
 * the rule lives here, in one testable function, rather than inline in a React
 * component where only a browser could reach it.
 */

import { hasPermission, type Permission, type Role } from "@be-in-digital/core"
import { profileAllowsPermission } from "@be-in-digital/convex-functions/teamAccess"

import { navGroups, type NavEntry, type NavGroup } from "../config/nav-config"

/**
 * May this operator be shown this entry?
 *
 * The server's two gates, in the server's order. An entry with no
 * `requiredPermission` is always shown — the dashboard is the only one.
 *
 * `profileAllowsPermission` is imported rather than reimplemented: it is the
 * function the server calls, and a second copy of a policy is a second copy to
 * drift. It reads an empty module list as unrestricted, which is what every
 * existing deployment carries.
 */
export function canSeeNavEntry(
  role: Role,
  modules: string[],
  entry: NavEntry
): boolean {
  const permission = entry.requiredPermission
  if (!permission) return true
  if (!hasPermission(role, permission as Permission)) return false
  return profileAllowsPermission({ role, permissions: modules }, permission)
}

/**
 * The nav, filtered for one operator, with groups that emptied dropped.
 *
 * A group label with nothing under it reads as a section that failed to load.
 */
export function visibleNavGroups(role: Role, modules: string[]): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((entry) => canSeeNavEntry(role, modules, entry)),
    }))
    .filter((group) => group.items.length > 0)
}
