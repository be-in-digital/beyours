"use client"

import { useState, useMemo, useCallback } from "react"
import Image from "next/image"
import { useMutation, useQuery } from "convex/react"
import {
  X,
  SlidersHorizontal,
  Minus,
  Plus,
  Package,
  AlertTriangle,
  XCircle,
  PackageOpen,
} from "lucide-react"
import { toast } from "sonner"
import { useAdminStoreId, useDebounce, useAdminApi } from "../../hooks/admin-hooks"
import { ADMIN_PAGE_SIZE } from "../../lib/constants"
import {
  Button,
  SearchInput,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Switch,
  Input,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  ButtonGroup,
} from "@be-in-digital/ui"

const PAGE_SIZE = 25

type StockStatus = "all" | "in_stock" | "low_stock" | "out_of_stock" | "untracked"

interface InventoryProduct {
  _id: string
  name: string
  images: string[]
  isActive: boolean
  categoryId: string
  stock?: {
    tracked: boolean
    quantity: number
    lowStockThreshold: number
    autoDisableWhenEmpty?: boolean
  }
}

/** Determine the stock status of a product */
function getStockStatus(product: InventoryProduct): StockStatus {
  if (!product.stock?.tracked) return "untracked"
  if (product.stock.quantity <= 0) return "out_of_stock"
  if (product.stock.quantity <= product.stock.lowStockThreshold) return "low_stock"
  return "in_stock"
}

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

/** Inline quantity editor with +/- buttons */
function QuantityEditor({
  productId,
  quantity,
  api,
}: {
  productId: string
  quantity: number
  api: any
}) {
  const [localQuantity, setLocalQuantity] = useState(quantity)
  const [saving, setSaving] = useState(false)
  const updateStock = useMutation(api?.products?.updateStock)

  const handleChange = useCallback(
    async (newQty: number) => {
      const clamped = Math.max(0, newQty)
      setLocalQuantity(clamped)
      setSaving(true)
      try {
        await updateStock({ id: productId, quantity: clamped })
      } catch {
        toast.error("Erreur lors de la mise a jour du stock")
        setLocalQuantity(quantity)
      } finally {
        setSaving(false)
      }
    },
    [productId, quantity, updateStock]
  )

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon-sm"
        className="h-7 w-7"
        onClick={() => handleChange(localQuantity - 1)}
        disabled={localQuantity <= 0 || saving}
      >
        <Minus className="h-3 w-3" />
      </Button>
      <Input
        type="number"
        min={0}
        value={localQuantity}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10)
          if (!isNaN(val)) handleChange(val)
        }}
        className="h-7 w-16 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        disabled={saving}
      />
      <Button
        variant="outline"
        size="icon-sm"
        className="h-7 w-7"
        onClick={() => handleChange(localQuantity + 1)}
        disabled={saving}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  )
}

/** Inline editable threshold */
function ThresholdEditor({
  productId,
  threshold,
  api,
}: {
  productId: string
  threshold: number
  api: any
}) {
  const [localValue, setLocalValue] = useState(threshold)
  const updateThreshold = useMutation(api?.products?.updateLowStockThreshold)

  const handleBlur = useCallback(async () => {
    if (localValue === threshold) return
    try {
      await updateThreshold({ id: productId, lowStockThreshold: localValue })
    } catch {
      toast.error("Erreur lors de la mise a jour du seuil")
      setLocalValue(threshold)
    }
  }, [localValue, threshold, productId, updateThreshold])

  return (
    <Input
      type="number"
      min={0}
      value={localValue}
      onChange={(e) => {
        const val = parseInt(e.target.value, 10)
        if (!isNaN(val)) setLocalValue(Math.max(0, val))
      }}
      onBlur={handleBlur}
      className="h-7 w-16 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  )
}

export function InventoryPage() {
  const storeId = useAdminStoreId()
  const api = useAdminApi() as any

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StockStatus>("all")
  const [currentPage, setCurrentPage] = useState(1)

  const debouncedSearch = useDebounce(searchQuery, 300)

  const products = useQuery(
    api?.products?.list,
    storeId ? { storeId } : "skip"
  ) as InventoryProduct[] | undefined

  const toggleStockTracking = useMutation(api?.products?.toggleStockTracking)
  const updateAutoDisable = useMutation(api?.products?.updateAutoDisable)

  // Stock status counters
  const statusCounts = useMemo(() => {
    if (!products) return { all: 0, in_stock: 0, low_stock: 0, out_of_stock: 0, untracked: 0 }
    const counts = { all: products.length, in_stock: 0, low_stock: 0, out_of_stock: 0, untracked: 0 }
    for (const p of products) {
      const status = getStockStatus(p)
      counts[status]++
    }
    return counts
  }, [products])

  // Filter products
  const filteredProducts = useMemo(() => {
    return products?.filter((product) => {
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase()
        if (!product.name.toLowerCase().includes(searchLower)) return false
      }
      if (statusFilter !== "all") {
        if (getStockStatus(product) !== statusFilter) return false
      }
      return true
    })
  }, [products, debouncedSearch, statusFilter])

  // Pagination
  const totalItems = filteredProducts?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedProducts = useMemo(() => {
    if (!filteredProducts) return []
    const start = (safePage - 1) * PAGE_SIZE
    return filteredProducts.slice(start, start + PAGE_SIZE)
  }, [filteredProducts, safePage])

  const handleFilterChange = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value)
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setCurrentPage(1)
  }

  const handleToggleTracking = async (productId: string, tracked: boolean) => {
    try {
      await toggleStockTracking({ id: productId, tracked })
      toast.success(tracked ? "Suivi de stock active" : "Suivi de stock desactive")
    } catch {
      toast.error("Erreur lors de la mise a jour du suivi")
    }
  }

  const handleToggleAutoDisable = async (productId: string, enabled: boolean) => {
    try {
      await updateAutoDisable({ id: productId, autoDisableWhenEmpty: enabled })
      toast.success(enabled ? "Desactivation automatique activee" : "Desactivation automatique desactivee")
    } catch {
      toast.error("Erreur lors de la mise a jour")
    }
  }

  if (!storeId) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-sm text-muted-foreground">
          Veuillez selectionner un etablissement pour afficher l'inventaire
        </p>
      </div>
    )
  }

  const paginationStart = totalItems > 0 ? (safePage - 1) * PAGE_SIZE + 1 : 0
  const paginationEnd = Math.min(safePage * PAGE_SIZE, totalItems)

  return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventaire</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerez le stock de vos produits en temps reel
          </p>
        </div>

        {/* Status summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatusCard
            label="En stock"
            count={statusCounts.in_stock}
            icon={<Package className="h-4 w-4 text-green-600" />}
            active={statusFilter === "in_stock"}
            onClick={() => handleFilterChange(setStatusFilter)(statusFilter === "in_stock" ? "all" : "in_stock")}
            className="border-green-200 bg-green-50/50"
          />
          <StatusCard
            label="Stock faible"
            count={statusCounts.low_stock}
            icon={<AlertTriangle className="h-4 w-4 text-orange-600" />}
            active={statusFilter === "low_stock"}
            onClick={() => handleFilterChange(setStatusFilter)(statusFilter === "low_stock" ? "all" : "low_stock")}
            className="border-orange-200 bg-orange-50/50"
          />
          <StatusCard
            label="Rupture"
            count={statusCounts.out_of_stock}
            icon={<XCircle className="h-4 w-4 text-red-600" />}
            active={statusFilter === "out_of_stock"}
            onClick={() => handleFilterChange(setStatusFilter)(statusFilter === "out_of_stock" ? "all" : "out_of_stock")}
            className="border-red-200 bg-red-50/50"
          />
          <StatusCard
            label="Non suivi"
            count={statusCounts.untracked}
            icon={<PackageOpen className="h-4 w-4 text-gray-500" />}
            active={statusFilter === "untracked"}
            onClick={() => handleFilterChange(setStatusFilter)(statusFilter === "untracked" ? "all" : "untracked")}
            className="border-gray-200 bg-gray-50/50"
          />
        </div>

        {/* Search */}
        <div className="rounded-lg border bg-card p-4">
          <SearchInput
            placeholder="Rechercher un produit par nom..."
            value={searchQuery}
            onValueChange={(value) => { setSearchQuery(value); setCurrentPage(1) }}
          />

          {/* Active filter indicator */}
          {(statusFilter !== "all" || searchQuery) && (
            <div className="flex items-center gap-2 mt-3">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Filtres actifs</span>
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs px-2">
                <X className="mr-1 h-3 w-3" />
                Reinitialiser
              </Button>
            </div>
          )}
        </div>

        {/* Table */}
        {!products ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">Chargement de l'inventaire...</p>
          </div>
        ) : totalItems === 0 ? (
          <div className="text-center py-12 border border-border/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Aucun produit trouve</p>
            {(searchQuery || statusFilter !== "all") && (
              <Button variant="ghost" size="sm" className="mt-3" onClick={clearFilters}>
                Reinitialiser les filtres
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="border border-border/50 rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Image</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Quantite</TableHead>
                    <TableHead>Seuil alerte</TableHead>
                    <TableHead>Auto-desactivation</TableHead>
                    <TableHead>Suivi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProducts.map((product) => {
                    const status = getStockStatus(product)
                    const isUntracked = status === "untracked"

                    return (
                      <TableRow
                        key={product._id}
                        className={isUntracked ? "opacity-50" : undefined}
                      >
                        {/* Image */}
                        <TableCell>
                          <div className="relative w-10 h-10 rounded-md overflow-hidden bg-muted">
                            {product.images[0] ? (
                              <Image
                                src={product.images[0]}
                                alt={product.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full text-muted-foreground text-[10px]">
                                N/A
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Product name + active state */}
                        <TableCell>
                          <div className="space-y-0.5">
                            <div className="font-medium text-sm">{product.name}</div>
                            {!product.isActive && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                Inactif
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Status badge */}
                        <TableCell>
                          <StockStatusBadge status={status} />
                        </TableCell>

                        {/* Quantity editor */}
                        <TableCell>
                          {!isUntracked ? (
                            <QuantityEditor
                              productId={product._id}
                              quantity={product.stock!.quantity}
                              api={api}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Threshold editor */}
                        <TableCell>
                          {!isUntracked ? (
                            <ThresholdEditor
                              productId={product._id}
                              threshold={product.stock!.lowStockThreshold}
                              api={api}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Auto-disable toggle */}
                        <TableCell>
                          {!isUntracked ? (
                            <div title="Desactive automatiquement le produit quand le stock atteint 0, et le reactive quand le stock remonte.">
                              <Switch
                                checked={product.stock?.autoDisableWhenEmpty ?? false}
                                onCheckedChange={(checked) =>
                                  handleToggleAutoDisable(product._id, checked)
                                }
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Tracking toggle */}
                        <TableCell>
                          <Switch
                            checked={product.stock?.tracked ?? false}
                            onCheckedChange={(checked) =>
                              handleToggleTracking(product._id, checked)
                            }
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

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
  )
}

/** Status summary card */
function StatusCard({
  label,
  count,
  icon,
  active,
  onClick,
  className,
}: {
  label: string
  count: number
  icon: React.ReactNode
  active: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-3 p-3 rounded-lg border text-left transition-all
        ${className}
        ${active ? "ring-2 ring-primary ring-offset-1" : "hover:shadow-sm"}
      `}
    >
      {icon}
      <div>
        <div className="text-lg font-semibold leading-none">{count}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </div>
    </button>
  )
}

/** Stock status badge component */
function StockStatusBadge({ status }: { status: StockStatus }) {
  switch (status) {
    case "in_stock":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs">
          En stock
        </Badge>
      )
    case "low_stock":
      return (
        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-xs">
          Stock faible
        </Badge>
      )
    case "out_of_stock":
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs">
          Rupture
        </Badge>
      )
    case "untracked":
      return (
        <Badge variant="secondary" className="text-xs">
          Non suivi
        </Badge>
      )
  }
}
