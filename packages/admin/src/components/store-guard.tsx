"use client"

import { useQuery } from "convex/react"
import { usePathname } from "next/navigation"
import { useStoreStore } from "@beindigital-engine/restaurant"
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@beindigital-engine/ui"
import { Store } from "lucide-react"
import Link from "next/link"
import { useAdminApiStore } from "../stores/admin-api-store"

const BYPASS_ROUTES = ["/stores", "/settings", "/team"]

interface StoreGuardProps {
  children: React.ReactNode
}

/**
 * Ensures a store is selected before rendering children
 */
export function StoreGuard({ children }: StoreGuardProps) {
  const pathname = usePathname()
  const api = useAdminApiStore((s) => s.api) as Record<string, any> | null
  const stores = useQuery(api?.stores?.list ?? "skip" as any)
  const currentStore = useStoreStore((state) => state.currentStore)
  const setCurrentStore = useStoreStore((state) => state.setCurrentStore)

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
            <Link href="/stores">Créer un établissement</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!currentStore) {
    const handleStoreChange = (storeId: string) => {
      const store = (stores as any[]).find((s) => s._id === storeId)
      if (store) setCurrentStore(store)
    }

    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center max-w-sm space-y-5">
          <div className="mx-auto w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center">
            <Store className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-medium tracking-tight">Sélectionner un établissement</h2>
            <p className="text-sm text-muted-foreground">
              Choisissez l'établissement que vous souhaitez gérer.
            </p>
          </div>
          <Select onValueChange={handleStoreChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choisir un établissement" />
            </SelectTrigger>
            <SelectContent>
              {(stores as any[]).map((store) => (
                <SelectItem key={store._id} value={store._id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
