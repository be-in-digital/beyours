"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery } from "convex/react"
import { Search, Plus, Grid3x3, List } from "lucide-react"
import { api } from "@/convex/_generated/api"
import { useAdminStoreId, useDebounce } from "@/lib/admin/hooks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

    return true
  })

  if (!storeId) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-muted-foreground">
          Please select a store to view products
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
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories?.map((category: any) => (
                <SelectItem key={category._id} value={category._id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          {/* View mode toggle */}
          <div className="flex gap-2">
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
          </div>

          {/* Add Product button */}
          <Button asChild>
            <Link href="/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Link>
          </Button>
        </div>

        {/* Products table */}
        {!products ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading products...</p>
          </div>
        ) : filteredProducts && filteredProducts.length === 0 ? (
          <div className="text-center py-12 border rounded-lg">
            <p className="text-muted-foreground">No products found</p>
            {searchQuery || categoryFilter !== "all" || statusFilter !== "all" ? (
              <p className="text-sm text-muted-foreground mt-2">
                Try adjusting your filters
              </p>
            ) : (
              <Button asChild className="mt-4">
                <Link href="/products/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first product
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
