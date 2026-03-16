"use client"

import { useState, useMemo, useCallback, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Search, SlidersHorizontal, ChevronDown, X } from "lucide-react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@beindigital-engine/ui/components"
import {
  filterProducts,
  sortProducts,
  useCartStore,
  isProductAvailable,
} from "@beindigital-engine/restaurant"
import type { ProductDoc, ProductSortBy } from "@beindigital-engine/restaurant"
import type { Id } from "@/convex/_generated/dataModel"
import { useStoreId } from "@/lib/hooks/use-store-id"
import { useStoreStatus } from "@/lib/hooks/use-store-status"
import { ProductGrid } from "@/components/storefront/product-grid"
import { ProductDetailClient } from "@/components/storefront/product-detail-client"
import { MenuPagination } from "@/components/storefront/menu-pagination"
import { toast } from "sonner"

const ITEMS_PER_PAGE = 12

function MenuContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { storeId } = useStoreId()
  const { isOpen } = useStoreStatus(storeId)

  const addItem = useCartStore((s) => s.addItem)
  const cartStoreId = useCartStore((s) => s.storeId)

  // URL state
  const categorySlug = searchParams.get("category")
  const searchQuery = searchParams.get("q") ?? ""
  const sortBy = (searchParams.get("sort") as ProductSortBy) ?? "popular"

  // Local state
  const [search, setSearch] = useState(searchQuery)
  const [selectedProduct, setSelectedProduct] = useState<ProductDoc | null>(null)
  const [filters, setFilters] = useState({ availableOnly: false })
  const [currentPage, setCurrentPage] = useState(1)

  // Queries
  const products = useQuery(
    api.products.list,
    storeId ? { storeId: storeId as Id<"stores"> } : "skip"
  )
  const categories = useQuery(
    api.categories.list,
    storeId ? { storeId: storeId as Id<"stores"> } : "skip"
  )

  // Find active category ID from slug
  const activeCategoryId = useMemo(() => {
    if (!categorySlug || !categories) return undefined
    return categories.find((c: { slug: string; _id: string }) => c.slug === categorySlug)?._id
  }, [categorySlug, categories])

  // Filter & sort
  const filteredProducts = useMemo(() => {
    if (!products) return undefined
    const filtered = filterProducts(products, {
      categoryId: activeCategoryId,
      search: search || undefined,
      availableOnly: filters.availableOnly,
    })
    return sortProducts(filtered, sortBy)
  }, [products, activeCategoryId, search, sortBy, filters])

  // Reset page on filter/sort/category/search change
  useEffect(() => {
    setCurrentPage(1)
  }, [categorySlug, search, sortBy, filters])

  // Pagination
  const totalPages = filteredProducts ? Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) : 0
  const paginatedProducts = useMemo(() => {
    if (!filteredProducts) return undefined
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredProducts, currentPage])

  // URL helpers
  const updateSearchParams = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.replace(`/menu?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  const handleCategorySelect = (slug: string | null) => {
    updateSearchParams("category", slug)
  }

  const handleSearchSubmit = () => {
    updateSearchParams("q", search || null)
  }

  const handleQuickAdd = (product: ProductDoc) => {
    if (!storeId) return
    if (cartStoreId && cartStoreId !== storeId) {
      toast.error("Vous avez des articles d'un autre restaurant.")
      return
    }
    if (!isProductAvailable(product)) return

    if (product.options && product.options.length > 0) {
      setSelectedProduct(product)
      return
    }

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

  // Active category name
  const activeCategoryName = categorySlug
    ? categories?.find((c: { slug: string }) => c.slug === categorySlug)?.name ?? categorySlug
    : "Tout"

  const sortLabel = {
    popular: "Recommandé",
    name: "Nom A-Z",
    price: "Prix croissant",
  }[sortBy]

  return (
    <div className="min-h-screen bg-[#FDFCF6] text-zinc-900 font-sans overflow-x-hidden pt-20 transition-colors duration-500">
      {/* ─── HERO ─── */}
      <section className="pt-24 pb-20 px-6 md:px-12 bg-[#0D5C3F] relative overflow-hidden rounded-b-[4rem] md:rounded-b-[8rem]">
        {/* Decorative blurs */}
        <div className="absolute top-0 right-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-white/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-emerald-400/10 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-md px-4 py-1.5 rounded-full mb-8 font-black tracking-widest uppercase text-[10px] shadow-lg">
            Notre Carte
          </Badge>
          <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-none mb-8 italic">
            Découvrez Notre <br />
            <span className="text-orange-500 not-italic">Menu</span>
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto mb-12 font-medium">
            Explorez notre sélection de plats préparés avec soin
          </p>

          {/* Search bar */}
          <div className="max-w-3xl mx-auto relative group">
            <div className="bg-white rounded-[2rem] p-2 shadow-2xl flex items-center gap-2 border-4 border-white/10 group-focus-within:border-[#0D5C3F]/20 transition-all">
              <div className="pl-6 flex items-center justify-center">
                <Search className="h-6 w-6 text-zinc-400" />
              </div>
              <input
                type="text"
                placeholder="Rechercher un plat..."
                className="flex-1 h-14 bg-transparent border-none outline-none text-lg font-bold placeholder:text-zinc-300 text-zinc-900"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("")
                    updateSearchParams("q", null)
                  }}
                  className="p-2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
              <Button
                onClick={handleSearchSubmit}
                className="h-14 px-8 rounded-2xl bg-[#0D5C3F] hover:bg-[#0A412D] text-white font-black uppercase tracking-widest text-xs shadow-xl transition-all"
              >
                Rechercher
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CATEGORIES ─── */}
      <section className="py-12 max-w-7xl mx-auto uppercase px-6 md:px-12">
        <div className="flex items-center justify-start md:justify-center gap-4 mb-12 overflow-x-auto pb-8 pt-4 -mx-6 px-6 md:-mx-12 md:px-12 scrollbar-hide">
          <button
            onClick={() => handleCategorySelect(null)}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all duration-300 border-2 shrink-0 h-14 ${
              !categorySlug
                ? "bg-[#0D5C3F] border-[#0D5C3F] text-white shadow-[0_10px_20px_-5px_rgba(13,92,63,0.25)]"
                : "bg-white border-zinc-100 text-zinc-400 hover:border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <span className="text-xl leading-none">✨</span>
            Tout
          </button>
          {(categories ?? []).map((cat: { _id: string; slug: string; name: string }) => (
            <button
              key={cat._id}
              onClick={() => handleCategorySelect(cat.slug)}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all duration-300 border-2 shrink-0 h-14 ${
                categorySlug === cat.slug
                  ? "bg-[#0D5C3F] border-[#0D5C3F] text-white shadow-[0_10px_20px_-5px_rgba(13,92,63,0.25)]"
                  : "bg-white border-zinc-100 text-zinc-400 hover:border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* ─── SHOWING + FILTERS + SORT ─── */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-16 px-4 gap-6">
          <div>
            <h2 className="text-2xl font-black tracking-tighter text-zinc-800 uppercase">
              Affichage : <span className="text-emerald-500">{activeCategoryName}</span>
              <span className="ml-2 text-zinc-300">
                ({filteredProducts?.length ?? 0})
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Filter toggle */}
            <Button
              variant="outline"
              onClick={() => setFilters((prev) => ({ availableOnly: !prev.availableOnly }))}
              className={`h-12 rounded-xl border-zinc-100 bg-white font-bold text-zinc-600 gap-2 px-6 hover:bg-zinc-50 transition-all ${
                filters.availableOnly ? "border-[#0D5C3F] bg-emerald-50 text-[#0D5C3F]" : ""
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {filters.availableOnly ? "Disponible" : "Filtres"}
              {filters.availableOnly && (
                <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center bg-orange-500 rounded-full text-[10px] border-none">
                  1
                </Badge>
              )}
            </Button>

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-12 rounded-xl border-zinc-100 bg-white font-bold text-zinc-600 gap-2 px-6 hover:bg-zinc-50 transition-all"
                >
                  Trier par : <span className="text-[#0D5C3F] font-black">{sortLabel}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="rounded-2xl p-2 min-w-[200px] shadow-2xl border-zinc-100 bg-white">
                <DropdownMenuItem
                  onClick={() => updateSearchParams("sort", null)}
                  className="rounded-xl font-bold text-zinc-600 p-3 cursor-pointer hover:bg-zinc-50"
                >
                  Recommandé
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => updateSearchParams("sort", "name")}
                  className="rounded-xl font-bold text-zinc-600 p-3 cursor-pointer hover:bg-zinc-50"
                >
                  Nom A-Z
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => updateSearchParams("sort", "price")}
                  className="rounded-xl font-bold text-zinc-600 p-3 cursor-pointer hover:bg-zinc-50"
                >
                  Prix croissant
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ─── GRID ─── */}
        <div className="mb-8">
          <ProductGrid
            products={paginatedProducts}
            storeId={storeId}
            isStoreOpen={isOpen}
            onProductClick={setSelectedProduct}
            onAddToCart={handleQuickAdd}
          />
        </div>

        {/* ─── PAGINATION ─── */}
        <MenuPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </section>

      {/* ─── PRODUCT DETAIL DIALOG ─── */}
      <Dialog
        open={!!selectedProduct}
        onOpenChange={(open) => !open && setSelectedProduct(null)}
      >
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0 border-none rounded-[3rem]">
          <DialogTitle className="sr-only">Détail du produit</DialogTitle>
          {selectedProduct && storeId && (
            <ProductDetailClient
              product={selectedProduct}
              storeId={storeId}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function MenuPage() {
  return (
    <Suspense>
      <MenuContent />
    </Suspense>
  )
}
