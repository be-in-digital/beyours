"use client"

import { useQuery } from "convex/react"
import { useStoreStore } from "@beindigital-engine/restaurant"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Store } from "lucide-react"
import Link from "next/link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface StoreGuardProps {
  children: React.ReactNode
}

/**
 * Store guard component
 * Ensures a store is selected before rendering children
 * Shows store selector or "create store" prompt if needed
 */
export function StoreGuard({ children }: StoreGuardProps) {
  const stores = useQuery(api.stores.list)
  const currentStore = useStoreStore((state) => state.currentStore)
  const setCurrentStore = useStoreStore((state) => state.setCurrentStore)

  // Loading state
  if (stores === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  // No stores exist - prompt to create first store
  if (stores.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Store className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold">No stores yet</h2>
          <p className="text-muted-foreground">
            Create your first store to start managing your restaurant.
          </p>
          <Button asChild>
            <Link href="/stores/new">Create your first store</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Stores exist but none selected - show selector
  if (!currentStore) {
    /**
     * Handle store selection change
     */
    const handleStoreChange = (storeId: string) => {
      const store = stores.find((s: any) => s._id === storeId)
      if (store) {
        setCurrentStore(store)
      }
    }

    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Store className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-semibold">Select a store</h2>
          <p className="text-muted-foreground">
            Choose which store you want to manage.
          </p>
          <Select onValueChange={handleStoreChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a store" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((store: any) => (
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

  // Store is selected - render children
  return <>{children}</>
}
