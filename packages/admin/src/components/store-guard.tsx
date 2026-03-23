"use client"

import { useEffect } from "react"
import { useQuery } from "convex/react"
import { usePathname } from "next/navigation"
import { useStoreStore, type StoreDoc } from "@beindigital-engine/restaurant"
import { Button } from "@beindigital-engine/ui"
import { Store } from "lucide-react"
import Link from "next/link"
import { useAdminApiStore } from "../stores/admin-api-store"
import { adminRoutes } from "../config/admin-routes"

const BYPASS_ROUTES = [adminRoutes.stores, adminRoutes.settings, adminRoutes.team]

interface StoreGuardProps {
  children: React.ReactNode
}

/**
 * Ensures a store is selected before rendering children.
 * Auto-selects the first store when none is selected.
 */
export function StoreGuard({ children }: StoreGuardProps) {
  const pathname = usePathname()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex API is injected dynamically at runtime
  const api = useAdminApiStore((s) => s.api) as Record<string, Record<string, unknown>> | null
  const setStoreId = useAdminApiStore((s) => s.setStoreId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex query ref is dynamic
  const stores = useQuery(api?.stores?.list ?? ("skip" as any)) as StoreDoc[] | undefined
  const currentStore = useStoreStore((state) => state.currentStore)
  const setCurrentStore = useStoreStore((state) => state.setCurrentStore)

  // Auto-select first store if none selected or if persisted store no longer exists
  useEffect(() => {
    if (!stores || stores.length === 0) return

    const needsSelection = !currentStore
      || !stores.some((s) => s._id === currentStore._id)

    if (needsSelection && stores[0]) {
      setCurrentStore(stores[0])
    }
  }, [stores, currentStore, setCurrentStore])

  // Sync currentStore._id to adminApiStore.storeId for all admin pages
  useEffect(() => {
    const id = currentStore?._id ?? null
    setStoreId(id)
  }, [currentStore, setStoreId])

  const shouldBypass = BYPASS_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  )
  if (shouldBypass) return <>{children}</>

  if (stores === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
      </div>
    )
  }

  if (stores.length === 0) {
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
  if (!currentStore) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
      </div>
    )
  }

  return <>{children}</>
}
