"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Heart } from "lucide-react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Skeleton, Badge, Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@beindigital-engine/ui/components"
import { ProductCard } from "@beindigital-engine/ui/restaurant"
import {
  formatPrice,
  isProductAvailable,
  useCartStore,
} from "@beindigital-engine/restaurant"
import type { ProductDoc, CartItem } from "@beindigital-engine/restaurant"
import { useFavoritesStore, type FavoriteItem } from "@/lib/stores/favorites-store"
import { useStoreStatus } from "@/lib/hooks/use-store-status"
import { toast } from "sonner"

interface FavoritesGridProps {
  storeId: string
}

export function FavoritesGrid({ storeId }: FavoritesGridProps) {
  const favorites = useFavoritesStore((s: { favorites: FavoriteItem[] }) => s.favorites)
  const toggleFavorite = useFavoritesStore((s: { toggleFavorite: (productId: string, storeId: string) => void }) => s.toggleFavorite)
  const addItem = useCartStore((s: { addItem: (item: CartItem) => void }) => s.addItem)
  const { isOpen } = useStoreStatus(storeId)

  // All favorite product IDs (all stores)
  const allProductIds = useMemo(
    () => favorites.map((f) => f.productId as Id<"products">),
    [favorites]
  )

  // Fetch all favorite products in one batch
  const rawProducts = useQuery(
    api.products.getManyByIds,
    allProductIds.length > 0 ? { ids: allProductIds } : "skip"
  )
  const products = rawProducts as ProductDoc[] | undefined

  // Split into current store and other stores
  const { currentStoreFavorites, otherStoreFavorites } = useMemo(() => {
    if (!products) return { currentStoreFavorites: [] as ProductDoc[], otherStoreFavorites: [] as ProductDoc[] }

    const current: ProductDoc[] = []
    const other: ProductDoc[] = []

    for (const product of products) {
      if (product.storeId === storeId) {
        current.push(product)
      } else {
        other.push(product)
      }
    }

    return { currentStoreFavorites: current, otherStoreFavorites: other }
  }, [products, storeId])

  const handleAddToCart = (product: ProductDoc) => {
    if (!isProductAvailable(product) || !isOpen) return

    addItem({
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity: 1,
      options: [],
      imageUrl: product.images?.[0],
    })
    toast.success(`${product.name} ajouté à la Box`)
  }

  // Loading
  if (allProductIds.length > 0 && products === undefined) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    )
  }

  // Empty
  if (favorites.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Heart className="h-5 w-5" />
          </EmptyMedia>
          <EmptyTitle>Aucun favori</EmptyTitle>
          <EmptyDescription>Ajoutez des plats à vos favoris depuis le menu.</EmptyDescription>
        </EmptyHeader>
        <Link href="/menu" className="text-primary hover:underline text-sm">
          Voir le menu
        </Link>
      </Empty>
    )
  }

  return (
    <div className="space-y-8">
      {/* Current store favorites */}
      {currentStoreFavorites.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {currentStoreFavorites.map((product) => {
            const available = isProductAvailable(product)
            const canAdd = available && isOpen

            return (
              <div key={product._id} className="group relative">
                <button
                  onClick={() => toggleFavorite(product._id, storeId)}
                  className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-2 shadow-sm backdrop-blur"
                >
                  <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                </button>
                <ProductCard
                  name={product.name}
                  description={product.description}
                  price={formatPrice(product.price)}
                  image={product.images?.[0]}
                  onAddToCart={canAdd ? () => handleAddToCart(product) : undefined}
                  disabled={!canAdd}
                  className="rounded-2xl"
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Other store favorites */}
      {otherStoreFavorites.length > 0 && (
        <div>
          <h3 className="mb-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">
            Autres restaurants
          </h3>
          <div className="grid gap-4 opacity-60 sm:grid-cols-2 lg:grid-cols-3">
            {otherStoreFavorites.map((product) => (
              <div key={product._id} className="group relative">
                <div className="absolute left-3 top-3 z-10">
                  <Badge variant="secondary" className="text-[10px]">
                    Autre restaurant
                  </Badge>
                </div>
                <button
                  onClick={() => toggleFavorite(product._id, product.storeId)}
                  className="absolute right-3 top-3 z-10 rounded-full bg-background/80 p-2 shadow-sm backdrop-blur"
                >
                  <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                </button>
                <div title="Ce produit appartient à un autre restaurant">
                  <ProductCard
                    name={product.name}
                    description={product.description}
                    price={formatPrice(product.price)}
                    image={product.images?.[0]}
                    disabled
                    className="rounded-2xl"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
