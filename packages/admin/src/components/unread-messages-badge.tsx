"use client"

import { useQuery } from "convex/react"
import { SidebarMenuBadge } from "../ui/sidebar"
import { useAdminApiStore } from "../stores/admin-api-store"
import { useAdminStore } from "../hooks/admin-hooks"

/* eslint-disable @typescript-eslint/no-explicit-any -- the Convex API is injected at runtime */
type AdminApi = any

/**
 * The count of contact messages nobody has opened yet.
 *
 * Without it the Messages screen is only found by someone already looking for
 * it: a customer writes, the row lands, and nothing on any other screen says
 * so. It lives beside the sidebar rather than inside it so that the nav keeps
 * rendering navigation and this keeps counting an inbox.
 *
 * Split in two because the layout injects `api` in an effect: the sidebar's
 * first render has none, and `useQuery` reads its function reference before it
 * looks at whether it is skipping. Nothing here calls a hook until there is an
 * API to call it with.
 */
export function UnreadMessagesBadge() {
  const api = useAdminApiStore((s) => s.api) as AdminApi

  if (!api?.contactMessages?.unreadCount || !api?.stores?.listAll) return null

  return <UnreadCount api={api} />
}

function UnreadCount({ api }: { api: AdminApi }) {
  /*
   * The store DOCUMENT, not the persisted id.
   *
   * That id lives in localStorage, which outlives the deployment that issued
   * it, and `unreadCount` is guarded: asked about a store this deployment does
   * not have, it refuses, and Convex raises the refusal out of `useQuery`
   * during render. This badge sits in the sidebar, outside `StoreGuard`, so
   * that render happens on EVERY admin page before the guard has repaired the
   * selection — it took `/dashboard/team` down exactly this way, which is the
   * shape of #224 and #119. `useAdminStore` resolves the id against
   * `stores.listAll` and answers null when it belongs to nobody here, so the
   * badge simply does not ask.
   */
  const store = useAdminStore()

  const unread = useQuery(
    api.contactMessages.unreadCount,
    store ? { storeId: store._id } : "skip"
  ) as { count: number; hasMore: boolean } | undefined

  // Nothing at zero, and nothing while the count is in flight: an empty badge
  // reads as a bug.
  if (!unread || unread.count === 0) return null

  return (
    <SidebarMenuBadge data-testid="unread-messages-badge">
      {unread.hasMore ? `${unread.count}+` : unread.count}
    </SidebarMenuBadge>
  )
}
