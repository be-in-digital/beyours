"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "convex/react"
import { Search, Plus, Grid3x3, List } from "lucide-react"
import { useAdminStoreId, useDebounce, useAdminApi } from "../../hooks/admin-hooks"
import {
  Button,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  ButtonGroup,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@beindigital-engine/ui"
import { ProductsTable } from "./products-table"

export function ProductsPage() {
  const storeId = useAdminStoreId()
  const api = useAdminApi() as any
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"table" | "grid">("table")

  const debouncedSearch = useDebounce(searchQuery, 300)

  // Fetch products
  const products = useQuery(
    api?.products?.list,
    storeId ? { storeId } : "skip"
  )

  // Fetch categories for filter
  const categories = useQuery(
    api?.categories?.list,
    storeId ? { storeId } : "skip"
  )

  // Filter products based on search and filters
  const filteredProducts = products?.filter((product: any) => {
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

    // Source filter — matches the product source field (manual/uber_eats/deliveroo)
    if (sourceFilter !== "all") {
      const productSource = product.source ?? "manual"
      if (productSource !== sourceFilter) return false
    }

    return true
  })

  if (!storeId) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-sm text-muted-foreground">
          Veuillez sélectionner un établissement pour afficher les produits
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Menu & Produits</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your menu items, product catalog, and categories
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
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
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Toutes les catégories" />
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="inactive">Inactif</SelectItem>
          </SelectContent>
        </Select>

        {/* Source filter — filters by product origin (manual, Uber Eats, Deliveroo) */}
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Toutes les sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les sources</SelectItem>
            <SelectItem value="manual">Manuel</SelectItem>
            <SelectItem value="uber_eats">Uber Eats</SelectItem>
            <SelectItem value="deliveroo">Deliveroo</SelectItem>
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
        <Button asChild size="sm">
          <Link href="/products/new">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter
          </Link>
        </Button>
      </div>

      {/* Products table */}
      {!products ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">Chargement des produits...</p>
        </div>
      ) : filteredProducts && filteredProducts.length === 0 ? (
        <div className="text-center py-12 border border-border/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Aucun produit trouvé</p>
          {searchQuery || categoryFilter !== "all" || statusFilter !== "all" || sourceFilter !== "all" ? (
            <p className="text-xs text-muted-foreground mt-2">
              Essayez d'ajuster vos filtres
            </p>
          ) : (
            <Button asChild size="sm" className="mt-4">
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
    </div>
  )
}
