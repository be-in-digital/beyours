"use client"

import { Heart, Plus, Search, ShoppingBag, Star } from "lucide-react"
import { Skeleton, Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@beindigital-engine/ui/components"
import { formatPrice, isProductAvailable } from "@beindigital-engine/restaurant"
import type { ProductDoc } from "@beindigital-engine/restaurant"
import { useFavoritesStore } from "@/lib/stores/favorites-store"

interface ProductGridProps {
  products: ProductDoc[] | undefined
  storeId: string | null
  isStoreOpen: boolean
  onProductClick: (product: ProductDoc) => void
  onAddToCart: (product: ProductDoc) => void
}

export function ProductGrid({
  products,
  storeId,
  isStoreOpen,
  onProductClick,
  onAddToCart,
}: ProductGridProps) {
  const isFavorite = useFavoritesStore((s: { isFavorite: (productId: string, storeId: string) => boolean }) => s.isFavorite)
  const toggleFavorite = useFavoritesStore((s: { toggleFavorite: (productId: string, storeId: string) => void }) => s.toggleFavorite)

  // Loading state
  if (products === undefined) {
    return (
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-[2.5rem] border border-zinc-100 bg-white">
            <Skeleton className="aspect-[4/3] w-full" />
            <div className="p-8 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-1">
                  <Skeleton className="h-2 w-8" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-12 w-12 rounded-2xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Empty state
  if (products.length === 0) {
    return (
      <Empty className="col-span-full py-32">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Search className="h-5 w-5" />
          </EmptyMedia>
          <EmptyTitle>Aucun plat trouvé</EmptyTitle>
          <EmptyDescription>Essayez de modifier votre recherche ou vos filtres.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((product) => {
        const available = isProductAvailable(product)
        const canAdd = available && isStoreOpen

        return (
          <div
            key={product._id}
            onClick={() => onProductClick(product)}
            className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black/[0.04] border border-white/10 hover:border-emerald-100 transition-all group flex flex-col h-full cursor-pointer hover:-translate-y-2.5 duration-300"
          >
            {/* Image */}
            <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
              {product.images?.[0] ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="h-full w-full object-cover group-hover:scale-110 transition-all duration-700"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-300">
                  <ShoppingBag className="h-12 w-12" />
                </div>
              )}

              {/* Badge top-left */}
              <div className="absolute top-4 left-4 flex gap-2">
                {product.isFeatured ? (
                  <span className="bg-white/90 backdrop-blur-md text-zinc-800 border-none py-1.5 px-3 rounded-lg font-bold uppercase text-[9px] shadow-sm">
                    Populaire
                  </span>
                ) : !available ? (
                  <span className="bg-white/90 backdrop-blur-md text-zinc-800 border-none py-1.5 px-3 rounded-lg font-bold uppercase text-[9px] shadow-sm">
                    Indisponible
                  </span>
                ) : null}
              </div>

              {/* Favorite top-right */}
              {storeId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFavorite(product._id, storeId)
                  }}
                  className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-all hover:bg-white hover:scale-110"
                >
                  <Heart
                    className={`h-4 w-4 transition-colors ${
                      isFavorite(product._id, storeId)
                        ? "fill-red-500 text-red-500"
                        : "text-zinc-400"
                    }`}
                  />
                </button>
              )}

              {/* Unavailable overlay */}
              {!available && (
                <div className="absolute inset-0 bg-white/40" />
              )}
            </div>

            {/* Content */}
            <div className="p-8 flex flex-col flex-1">
              <h3 className="text-lg font-black tracking-tighter text-zinc-800 leading-tight mb-3 group-hover:text-emerald-700 transition-colors uppercase line-clamp-1">
                {product.name}
              </h3>

              {product.description && (
                <p className="text-xs text-zinc-400 line-clamp-2 mb-4 leading-relaxed">
                  {product.description}
                </p>
              )}

              <div className="mt-auto flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">
                    Prix
                  </span>
                  <span className="text-xl font-black text-[#0D5C3F] leading-none">
                    {formatPrice(product.price)}
                  </span>
                </div>

                {canAdd ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddToCart(product)
                    }}
                    className="h-12 w-12 rounded-2xl bg-[#0D5C3F] text-white hover:bg-orange-500 shadow-lg shadow-emerald-900/10 hover:scale-110 transition-all flex items-center justify-center"
                  >
                    <Plus className="h-6 w-6" />
                  </button>
                ) : (
                  <div className="h-12 w-12 rounded-2xl bg-zinc-100 text-zinc-300 flex items-center justify-center">
                    <Plus className="h-6 w-6" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
