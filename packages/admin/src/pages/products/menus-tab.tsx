"use client"

import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { X, MoreVertical, Edit, Trash2, Eye, EyeOff, UtensilsCrossed, Package, List, FolderOpen } from "lucide-react"
import { toast } from "sonner"
import { useAdminStoreId, useDebounce, useAdminApi } from "../../hooks/admin-hooks"
import { ADMIN_PAGE_SIZE } from "../../lib/constants"
import { formatPrice } from "../../lib/formatters"
import {
  Button,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  ButtonGroup,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@be-in-digital/ui"
import { DeleteConfirmDialog } from "../../components/delete-confirm-dialog"
import { MenuFormDialog } from "./menu-form-dialog"
import { convexErrorMessage } from "../../lib/convex-error"

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

export function MenusTab() {
  const storeId = useAdminStoreId()
  const api = useAdminApi() as any

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMenu, setEditingMenu] = useState<any>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [menuToDelete, setMenuToDelete] = useState<string | null>(null)

  const debouncedSearch = useDebounce(searchQuery, 300)

  const menus = useQuery(
    api?.menus?.list,
    storeId ? { storeId } : "skip"
  )

  const products = useQuery(
    api?.products?.list,
    storeId ? { storeId } : "skip"
  )

  const categories = useQuery(
    api?.categories?.list,
    storeId ? { storeId } : "skip"
  )

  const toggleStatus = useMutation(api?.menus?.toggleStatus)
  const removeMenu = useMutation(api?.menus?.remove)

  // Build lookup maps for display
  const productNameMap = useMemo(() => {
    const map = new Map<string, string>()
    products?.forEach((p: any) => map.set(p._id, p.name))
    return map
  }, [products])

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>()
    categories?.forEach((c: any) => map.set(c._id, c.name))
    return map
  }, [categories])

  // Filter menus
  const filteredMenus = useMemo(() => {
    return menus?.filter((menu: any) => {
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase()
        const matchesSearch =
          menu.name.toLowerCase().includes(q) ||
          menu.description?.toLowerCase().includes(q)
        if (!matchesSearch) return false
      }
      if (statusFilter !== "all") {
        if (menu.isActive !== (statusFilter === "active")) return false
      }
      return true
    })
  }, [menus, debouncedSearch, statusFilter])

  // Pagination
  const totalItems = filteredMenus?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / ADMIN_PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedMenus = useMemo(() => {
    if (!filteredMenus) return []
    const start = (safePage - 1) * ADMIN_PAGE_SIZE
    return filteredMenus.slice(start, start + ADMIN_PAGE_SIZE)
  }, [filteredMenus, safePage])

  const handleFilterChange = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value)
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setCurrentPage(1)
  }

  const handleToggleStatus = async (menuId: string) => {
    try {
      await toggleStatus({ id: menuId })
      toast.success("Statut du menu mis à jour")
    } catch (error) {
      toast.error("Échec de la mise à jour du statut")
      console.error(error)
    }
  }

  const handleDelete = async () => {
    if (!menuToDelete) return
    try {
      await removeMenu({ id: menuToDelete })
      toast.success("Menu supprimé avec succès")
      setDeleteDialogOpen(false)
      setMenuToDelete(null)
    } catch (error) {
      // The refusal names the prize that gives this formule away.
      toast.error(convexErrorMessage(error, "Échec de la suppression du menu"))
      console.error(error)
    }
  }

  const openEdit = (menu: any) => {
    setEditingMenu(menu)
    setDialogOpen(true)
  }

  const openCreate = () => {
    setEditingMenu(null)
    setDialogOpen(true)
  }

  // Listen for external "open-menu-form" event from the header button
  useEffect(() => {
    const handler = () => openCreate()
    window.addEventListener("open-menu-form", handler)
    return () => window.removeEventListener("open-menu-form", handler)
  }, [])

  const activeFilterCount = [statusFilter].filter((f) => f !== "all").length

  const paginationStart = totalItems > 0 ? (safePage - 1) * ADMIN_PAGE_SIZE + 1 : 0
  const paginationEnd = Math.min(safePage * ADMIN_PAGE_SIZE, totalItems)

  return (
    <>
      <div className="space-y-4">
        {/* Filters */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <SearchInput
            placeholder="Rechercher un menu par nom ou description..."
            value={searchQuery}
            onValueChange={(value) => { setSearchQuery(value); setCurrentPage(1) }}
          />

          <div className="flex items-center gap-2">
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

            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs">
                <X className="mr-1 h-3 w-3" />
                Réinitialiser
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        {!menus ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">Chargement des menus...</p>
          </div>
        ) : totalItems === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <UtensilsCrossed />
              </EmptyMedia>
              <EmptyTitle>
                {searchQuery || activeFilterCount > 0 ? "Aucun menu trouvé" : "Aucun menu"}
              </EmptyTitle>
              <EmptyDescription>
                {searchQuery || activeFilterCount > 0
                  ? "Essayez de modifier vos filtres de recherche"
                  : "Créez votre première formule pour proposer des offres combinées"}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                size="sm"
                onClick={searchQuery || activeFilterCount > 0 ? clearFilters : openCreate}
              >
                {searchQuery || activeFilterCount > 0 ? "Réinitialiser les filtres" : "Créer un menu"}
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <div className="border border-border/50 rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Composition</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead>Plateformes</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMenus.map((menu: any) => (
                    <TableRow key={menu._id}>
                      {/* Name + Description */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-medium text-sm">{menu.name}</div>
                          {menu.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {menu.description}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Composition (sections summary) */}
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[300px]">
                          {menu.sections?.slice(0, 3).map((s: any) => {
                            const Icon =
                              s.type === "fixed" ? Package
                                : s.type === "pick_products" ? List
                                  : FolderOpen
                            const label =
                              s.type === "fixed"
                                ? productNameMap.get(s.productId) || s.label
                                : s.type === "pick_category"
                                  ? categoryNameMap.get(s.categoryId) || s.label
                                  : s.label
                            return (
                              <Badge key={s.sectionId} variant="secondary" className="text-[10px] h-5 px-1.5 gap-1">
                                <Icon className="h-2.5 w-2.5" />
                                {label}
                              </Badge>
                            )
                          })}
                          {(menu.sections?.length ?? 0) > 3 && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                              +{menu.sections.length - 3}
                            </Badge>
                          )}
                          {(!menu.sections || menu.sections.length === 0) && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Price */}
                      <TableCell className="font-medium text-sm">
                        {formatPrice(menu.price)}
                      </TableCell>

                      {/* Platforms */}
                      <TableCell>
                        <div className="flex gap-1">
                          {menu.platformVisibility?.uberEats && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-green-100 text-green-800">
                              UE
                            </span>
                          )}
                          {menu.platformVisibility?.deliveroo && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700">
                              DL
                            </span>
                          )}
                          {!menu.platformVisibility?.uberEats && !menu.platformVisibility?.deliveroo && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Badge
                          variant={menu.isActive ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {menu.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Ouvrir le menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => openEdit(menu)}
                              className="text-xs"
                            >
                              <Edit className="mr-2 h-3.5 w-3.5" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleToggleStatus(menu._id)}
                              className="text-xs"
                            >
                              {menu.isActive ? (
                                <>
                                  <EyeOff className="mr-2 h-3.5 w-3.5" />
                                  Désactiver
                                </>
                              ) : (
                                <>
                                  <Eye className="mr-2 h-3.5 w-3.5" />
                                  Activer
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setMenuToDelete(menu._id)
                                setDeleteDialogOpen(true)
                              }}
                              className="text-destructive text-xs"
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {paginationStart}-{paginationEnd} sur {totalItems} menu{totalItems > 1 ? "s" : ""}
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

      {/* Form dialog */}
      <MenuFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        menu={editingMenu}
      />

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Supprimer le menu"
        description="Êtes-vous sûr de vouloir supprimer ce menu ? Cette action est irréversible."
      />
    </>
  )
}
