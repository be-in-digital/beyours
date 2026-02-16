"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "convex/react"
import { Search, Plus, Grid3x3, List } from "lucide-react"
import { api } from "@/convex/_generated/api"
import type { Doc } from "@/convex/_generated/dataModel"
import { useAdminStoreId, useDebounce } from "@/lib/admin/hooks"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { ButtonGroup } from "@/components/ui/button-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProductsTable } from "./ProductsTable"
import { CategoriesContent } from "@/components/admin/categories/CategoriesContent"

export function ProductsContent() {
  const storeId = useAdminStoreId()
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"table" | "grid">("table")

  const debouncedSearch = useDebounce(searchQuery, 300)

  // Fetch products
  const products = useQuery(
    api.products.list,
    storeId ? { storeId } : "skip"
  )

  // Fetch categories for filter
  const categories = useQuery(
    api.categories.list,
    storeId ? { storeId } : "skip"
  )

  // Filter products based on search and filters
  const filteredProducts = products?.filter((product: Doc<"products">) => {
    // Search filter
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase()
      const matchesSearch =
        product.name.toLowerCase().includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower)
      if (!matchesSearch) return false
    }

    // Category filter
    if (categoryFilter !== "all" && product.categoryId !== categoryFilter) {
      return false
    }

    // Status filter
    if (statusFilter !== "all") {
      const isActive = statusFilter === "active"
      if (product.isActive !== isActive) return false
    }

    return true
  })

  if (!storeId) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-muted-foreground">
          Veuillez sélectionner un établissement pour afficher les produits
        </p>
      </div>
    )
  }

  return (
    <Tabs defaultValue="produits" className="space-y-6">
      {/* Header with tabs */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Menu & Produits</h1>
          <p className="text-muted-foreground mt-2">
            Manage your menu items, product catalog, and categories
          </p>
        </div>
        <TabsList>
          <TabsTrigger value="produits">Produits</TabsTrigger>
          <TabsTrigger value="categories">Catégories</TabsTrigger>
        </TabsList>
      </div>

      {/* Products Tab */}
      <TabsContent value="produits" className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <InputGroup>
              <InputGroupAddon>
                <Search className="h-4 w-4" />
              </InputGroupAddon>
              <InputGroupInput
                type="text"
                placeholder="Rechercher des produits..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </InputGroup>
          </div>

          {/* Category filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Toutes les catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categories?.map((category: Doc<"categories">) => (
                <SelectItem key={category._id} value={category._id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="inactive">Inactif</SelectItem>
            </SelectContent>
          </Select>

          {/* View mode toggle */}
          <ButtonGroup>
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("table")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("grid")}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
          </ButtonGroup>

          {/* Add Product button */}
          <Button asChild>
            <Link href="/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un produit
            </Link>
          </Button>
        </div>

        {/* Products table */}
        {!products ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Chargement des produits...</p>
          </div>
        ) : filteredProducts && filteredProducts.length === 0 ? (
          <div className="text-center py-12 border rounded-lg">
            <p className="text-muted-foreground">Aucun produit trouvé</p>
            {searchQuery || categoryFilter !== "all" || statusFilter !== "all" ? (
              <p className="text-sm text-muted-foreground mt-2">
                Essayez d&apos;ajuster vos filtres
              </p>
            ) : (
              <Button asChild className="mt-4">
                <Link href="/products/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Créez votre premier produit
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <ProductsTable
            products={filteredProducts || []}
            categories={categories || []}
          />
        )}
      </TabsContent>

      {/* Categories Tab */}
      <TabsContent value="categories">
        <CategoriesContent />
      </TabsContent>
    </Tabs>
  )
}
