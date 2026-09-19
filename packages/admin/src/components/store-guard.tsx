"use client"

import { useEffect } from "react"
import { useQuery } from "convex/react"
import { usePathname } from "next/navigation"
import { useAdminStoreSelection, type StoreDoc } from "@be-yours/restaurant"
import { Button } from "@be-yours/ui"
import { Store } from "lucide-react"
import Link from "next/link"
import { useAdminApiStore } from "../stores/admin-api-store"
import { adminRoutes } from "../config/admin-routes"
import { resolveStoreSelection } from "./store-selection"

const BYPASS_ROUTES = [adminRoutes.stores, adminRoutes.settings, adminRoutes.team]

interface StoreGuardProps {
  children: React.ReactNode
}

/**
 * Ensures a store is selected before rendering children.
 * Auto-selects the first store when the persisted one is not in the list.
 *
 * The list comes from `stores.list`, which is public and unscoped: it returns
 * every establishment of this deployment, whoever is asking. So the check this
 * guard performs is existence, not authorisation - it replaces an id that has
 * left the table, such as a deleted store, and it cannot replace one the
 * signed-in user is simply not allowed to open. Those pages still fail on the
 * server, where `requireStoreAccess` reads `userProfiles.storeIds`.
 *
 * The claim this replaces - a list scoped "for this account" - is what issue
 * #94 would make true. Until it lands, `resolveStoreSelection` carries the rule
 * and the full account of what it does not promise.
 */
export function StoreGuard({ children }: StoreGuardProps) {
  const pathname = usePathname()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex API is injected dynamically at runtime
  const api = useAdminApiStore((s) => s.api) as Record<string, Record<string, unknown>> | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex query ref is dynamic
  const stores = useQuery(api?.stores?.listAll ?? ("skip" as any)) as StoreDoc[] | undefined
  const storeId = useAdminStoreSelection((s) => s.storeId)
  const setStoreId = useAdminStoreSelection((s) => s.setStoreId)

  const decision = resolveStoreSelection({ storeId, stores })
  const replacementId = decision.status === "replace" ? decision.storeId : null

  useEffect(() => {
    if (replacementId) setStoreId(replacementId)
  }, [replacementId, setStoreId])

  const shouldBypass = BYPASS_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  )
  if (shouldBypass) return <>{children}</>

  if (decision.status === "pending") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
      </div>
    )
  }

  if (decision.status === "empty") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center max-w-sm space-y-5">
          <div className="mx-auto w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center">
            <Store className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-medium tracking-tight">Aucun établissement</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Créez votre premier établissement pour commencer.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={adminRoutes.stores}>Créer un établissement</Link>
          </Button>
        </div>
      </div>
    )
  }

  // While auto-selection is happening, show loading
  if (decision.status === "replace") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
      </div>
    )
  }

  return <>{children}</>
}
