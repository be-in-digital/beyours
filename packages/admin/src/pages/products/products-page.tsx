"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useQuery } from "convex/react"
import { Plus, Grid3x3, List, X, ShoppingBag, ImagePlus } from "lucide-react"
import { useAdminStoreId, useDebounce, useAdminApi } from "../../hooks/admin-hooks"
import { ADMIN_PAGE_SIZE } from "../../lib/constants"
import {
  Button,
  SearchInput,
  ButtonGroup,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@beindigital-engine/ui"
import { ProductsTable } from "./products-table"
import { MenusTab } from "./menus-tab"

/** Build page numbers with ellipsis for large page counts */
function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | "ellipsis")[] = [1]
  if (current > 3) pages.push("ellipsis")

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push("ellipsis")
  pages.push(total)
  return pages
}

export function ProductsPage() {
  const storeId = useAdminStoreId()
  const api = useAdminApi() as any
  const [activeTab, setActiveTab] = useState("products")
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"table" | "grid">("table")
  const [currentPage, setCurrentPage] = useState(1)

  const debouncedSearch = useDebounce(searchQuery, 300)

  const products = useQuery(
    api?.products?.list,
    storeId ? { storeId } : "skip"
  )

  const categories = useQuery(
    api?.categories?.list,
    storeId ? { storeId } : "skip"
  )

  // Filter products
  const filteredProducts = useMemo(() => {
    return products?.filter((product: any) => {
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase()
        const matchesSearch =
          product.name.toLowerCase().includes(searchLower) ||
          product.description?.toLowerCase().includes(searchLower)
        if (!matchesSearch) return false
      }
      if (categoryFilter !== "all" && product.categoryId !== categoryFilter) return false
      if (statusFilter !== "all") {
        if (product.isActive !== (statusFilter === "active")) return false
      }
      if (sourceFilter !== "all") {
        if ((product.source ?? "manual") !== sourceFilter) return false
      }
      return true
    })
  }, [products, debouncedSearch, categoryFilter, statusFilter, sourceFilter])

  // Pagination
  const totalItems = filteredProducts?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / ADMIN_PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedProducts = useMemo(() => {
    if (!filteredProducts) return []
    const start = (safePage - 1) * ADMIN_PAGE_SIZE
    return filteredProducts.slice(start, start + ADMIN_PAGE_SIZE)
  }, [filteredProducts, safePage])

  // Reset page when filters change
  const handleFilterChange = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value)
    setCurrentPage(1)
  }

  const activeFilterCount = [categoryFilter, statusFilter, sourceFilter].filter(
    (f) => f !== "all"
  ).length

  const clearFilters = () => {
    setCategoryFilter("all")
    setStatusFilter("all")
    setSourceFilter("all")
    setSearchQuery("")
    setCurrentPage(1)
  }

  if (!storeId) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-sm text-muted-foreground">
          Veuillez sélectionner un établissement pour afficher les produits
        </p>
      </div>
    )
  }

  const paginationStart = totalItems > 0 ? (safePage - 1) * ADMIN_PAGE_SIZE + 1 : 0
  const paginationEnd = Math.min(safePage * ADMIN_PAGE_SIZE, totalItems)

  return (
    <div className="space-y-6">
      {/* Header — title + add button on the same row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Menu & Produits</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez votre carte, vos produits et vos formules
          </p>
        </div>
        {activeTab === "products" ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/products/from-image">
                <ImagePlus className="mr-2 h-4 w-4" />
                Creer depuis image
              </Link>
            </Button>
            <Button asChild>
              <Link href="/products/new">
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un produit
              </Link>
            </Button>
          </div>
        ) : (
          <MenusTabAddButton />
        )}
      </div>

      {/* Tabs: Produits | Menus */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="products">Produits</TabsTrigger>
          <TabsTrigger value="menus">Menus / Formules</TabsTrigger>
        </TabsList>

        {/* Products tab */}
        <TabsContent value="products">
          <div className="space-y-6">
            {/* Filters card */}
            <div className="rounded-lg border bg-card p-4 space-y-4">
              {/* Search bar — full width, prominent */}
              <SearchInput
                placeholder="Rechercher un produit par nom ou description..."
                value={searchQuery}
                onValueChange={(value) => { setSearchQuery(value); setCurrentPage(1) }}
              />

              {/* Filter row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  {/* Category filter */}
                  <Select value={categoryFilter} onValueChange={handleFilterChange(setCategoryFilter)}>
                    <SelectTrigger className="w-[170px] h-9 text-xs">
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les catégories</SelectItem>
                      {categories?.map((category: any) => (
                        <SelectItem key={category._id} value={category._id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Status filter */}
                  <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
                    <SelectTrigger className="w-[130px] h-9 text-xs">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="inactive">Inactif</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Source filter */}
                  <Select value={sourceFilter} onValueChange={handleFilterChange(setSourceFilter)}>
                    <SelectTrigger className="w-[150px] h-9 text-xs">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les sources</SelectItem>
                      <SelectItem value="manual">Manuel</SelectItem>
                      <SelectItem value="ai-image">IA (image)</SelectItem>
                      <SelectItem value="uber_eats">Uber Eats</SelectItem>
                      <SelectItem value="deliveroo">Deliveroo</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Clear filters */}
                  {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs">
                      <X className="mr-1 h-3 w-3" />
                      Réinitialiser
                    </Button>
                  )}
                </div>

                {/* View mode toggle — right side */}
                <ButtonGroup className="shrink-0">
                  <Button
                    variant={viewMode === "table" ? "default" : "outline"}
                    size="icon-sm"
                    onClick={() => setViewMode("table")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "grid" ? "default" : "outline"}
                    size="icon-sm"
                    onClick={() => setViewMode("grid")}
                  >
                    <Grid3x3 className="h-4 w-4" />
                  </Button>
                </ButtonGroup>
              </div>
            </div>

            {/* Products table */}
            {!products ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">Chargement des produits...</p>
              </div>
            ) : totalItems === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ShoppingBag />
                  </EmptyMedia>
                  <EmptyTitle>Aucun produit trouvé</EmptyTitle>
                  <EmptyDescription>
                    {searchQuery || activeFilterCount > 0
                      ? "Essayez de modifier vos filtres de recherche"
                      : "Créez votre premier produit pour commencer"}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  {searchQuery || activeFilterCount > 0 ? (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Réinitialiser les filtres
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/products/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Créez votre premier produit
                      </Link>
                    </Button>
                  )}
                </EmptyContent>
              </Empty>
            ) : (
              <>
                <ProductsTable
                  products={paginatedProducts}
                  categories={categories || []}
                />

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {paginationStart}-{paginationEnd} sur {totalItems} produit{totalItems > 1 ? "s" : ""}
                    </p>

                    <Pagination className="mx-0 w-auto justify-end">
                      <PaginationContent className="gap-0">
                        <ButtonGroup>
                          <PaginationItem>
                            <PaginationPrevious
                              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                              disabled={safePage <= 1}
                              aria-disabled={safePage <= 1}
                            />
                          </PaginationItem>

                          {getPageNumbers(safePage, totalPages).map((page, idx) =>
                            page === "ellipsis" ? (
                              <PaginationItem key={`ellipsis-${idx}`}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            ) : (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  isActive={page === safePage}
                                  onClick={() => setCurrentPage(page)}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            )
                          )}

                          <PaginationItem>
                            <PaginationNext
                              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                              disabled={safePage >= totalPages}
                              aria-disabled={safePage >= totalPages}
                            />
                          </PaginationItem>
                        </ButtonGroup>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* Menus tab */}
        <TabsContent value="menus">
          <MenusTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Add button for menus tab — uses event to open the MenusTab dialog
 */
function MenusTabAddButton() {
  return (
    <Button
      onClick={() => {
        // Dispatch custom event to open the menu form dialog from MenusTab
        window.dispatchEvent(new CustomEvent("open-menu-form"))
      }}
    >
      <Plus className="mr-2 h-4 w-4" />
      Ajouter un menu
    </Button>
  )
}
