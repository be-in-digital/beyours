"use client"

import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { useState, useMemo } from "react"
import {
  PlusIcon,
  StoreIcon,
  Trash2,
  ArrowUpDown,
} from "lucide-react"
import {
  Button,
  ButtonGroup,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  SearchInput,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@be-in-digital/ui"
import { AddressAutocomplete, type AddressValue } from "@be-in-digital/ui"
import { LoadingState } from "../../components/loading-state"
import { DeleteConfirmDialog } from "../../components/delete-confirm-dialog"
import { slugify } from "../../lib/formatters"
import { ADMIN_PAGE_SIZE } from "../../lib/constants"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { StoresTable } from "./stores-table"
import { StoresPagination } from "./stores-pagination"

type StoreStatus = "open" | "closed" | "temporarily_unavailable"

interface StoreRecord {
  _id: string
  name: string
  address: {
    street: string
    city: string
    postalCode: string
    country: string
  }
  phone?: string
  status: StoreStatus
  createdAt: number
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

const statusOptions: { value: StoreStatus; label: string }[] = [
  { value: "open", label: "Ouvert" },
  { value: "closed", label: "Fermé" },
  { value: "temporarily_unavailable", label: "Indisponible" },
]

export function StoresPage() {
  const { api } = useAdminApiStore()

  // Create dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [address, setAddress] = useState<AddressValue>({
    street: "",
    city: "",
    postalCode: "",
    country: "France",
  })
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")

  // Filters
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Bulk delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [storeToDelete, setStoreToDelete] = useState<string | null>(null)

  const stores = useQuery(api.stores.list, {})
  const createStore = useMutation(api.stores.create)
  const updateStore = useMutation(api.stores.update)
  const removeStore = useMutation(api.stores.remove)

  // Filtered stores
  const filteredStores = useMemo(() => {
    if (!stores) return []
    const allStores = stores as StoreRecord[]
    let result = [...allStores]

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.address?.city?.toLowerCase().includes(q) ||
          s.address?.street?.toLowerCase().includes(q) ||
          s.phone?.toLowerCase().includes(q)
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter)
    }

    return result
  }, [stores, search, statusFilter])

  // Reset page when filters change
  const totalItems = filteredStores.length
  const totalPages = Math.max(1, Math.ceil(totalItems / ADMIN_PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)

  const paginatedStores = useMemo(() => {
    const start = (safePage - 1) * ADMIN_PAGE_SIZE
    return filteredStores.slice(start, start + ADMIN_PAGE_SIZE)
  }, [filteredStores, safePage])

  // Reset page on filter change
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setCurrentPage(1)
    setSelectedIds(new Set())
  }

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value)
    setCurrentPage(1)
    setSelectedIds(new Set())
  }

  // Actions
  const handleChangeStatus = async (storeId: string, status: StoreStatus) => {
    try {
      await updateStore({ id: storeId, status })
      toast.success("Statut mis à jour")
    } catch (error) {
      toast.error("Échec de la mise à jour du statut")
      console.error(error)
    }
  }

  const handleBulkChangeStatus = async (status: StoreStatus) => {
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          updateStore({ id: id, status })
        )
      )
      toast.success(`${selectedIds.size} établissement(s) mis à jour`)
      setSelectedIds(new Set())
    } catch (error) {
      toast.error("Échec de la mise à jour groupée")
      console.error(error)
    }
  }

  const handleDeleteSingle = (storeId: string) => {
    setStoreToDelete(storeId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    try {
      if (storeToDelete) {
        await removeStore({ id: storeToDelete })
        toast.success("Établissement supprimé")
        setStoreToDelete(null)
      } else {
        await Promise.all(
          Array.from(selectedIds).map((id) =>
            removeStore({ id: id })
          )
        )
        toast.success(`${selectedIds.size} établissement(s) supprimé(s)`)
        setSelectedIds(new Set())
      }
    } catch (error) {
      toast.error("Échec de la suppression")
      console.error(error)
    }
  }

  const handleBulkDelete = () => {
    setStoreToDelete(null)
    setDeleteDialogOpen(true)
  }

  const handleCreateStore = async () => {
    if (!name || !address.street || !address.city || !address.postalCode) {
      toast.error("Veuillez remplir tous les champs obligatoires")
      return
    }

    try {
      const slug = slugify(name)
      await createStore({
        name,
        slug,
        description: description || undefined,
        address: {
          street: address.street,
          city: address.city,
          postalCode: address.postalCode,
          country: address.country,
          latitude: address.latitude,
          longitude: address.longitude,
        },
        phone: phone || undefined,
        email: email || undefined,
        settings: {
          currency: "EUR",
          timezone: "Europe/Paris",
          deliveryEnabled: true,
          pickupEnabled: true,
          dineInEnabled: true,
          minimumOrderAmount: 1000,
          deliveryFee: 300,
          deliveryRadius: 5000,
          taxRate: 10,
        },
      })
      toast.success("Établissement créé avec succès", {
        description: "L'établissement est en brouillon. Configurez ses paramètres puis passez-le en \"Ouvert\" pour l'activer.",
        duration: 8000,
      })
      setIsCreateDialogOpen(false)
      setName("")
      setDescription("")
      setAddress({ street: "", city: "", postalCode: "", country: "France" })
      setPhone("")
      setEmail("")
    } catch (error) {
      toast.error("Échec de la création de l'établissement")
      console.error(error)
    }
  }

  if (stores === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Établissements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez vos établissements
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusIcon className="mr-2 h-4 w-4" />
              Créer un établissement
            </Button>
          </DialogTrigger>
          <DialogContent
            className="max-w-2xl"
            onPointerDownOutside={(e) => {
              const target = e.target as HTMLElement
              if (target.closest(".pac-container")) {
                e.preventDefault()
              }
            }}
            onInteractOutside={(e) => {
              const target = e.target as HTMLElement
              if (target.closest(".pac-container")) {
                e.preventDefault()
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Créer un nouvel établissement</DialogTitle>
              <DialogDescription>
                Ajoutez un nouvel établissement à votre entreprise
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom de l&apos;établissement *</Label>
                  <Input
                    id="name"
                    placeholder="Restaurant principal"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (généré automatiquement)</Label>
                  <Input
                    id="slug"
                    value={slugify(name)}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Description optionnelle"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <AddressAutocomplete
                label="Adresse *"
                value={address}
                onChange={setAddress}
                apiKey={GOOGLE_MAPS_API_KEY}
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    placeholder="+33 1 23 45 67 89"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="contact@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <ButtonGroup>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleCreateStore}>Créer un établissement</Button>
              </ButtonGroup>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {stores.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <StoreIcon />
            </EmptyMedia>
            <EmptyTitle>Aucun établissement</EmptyTitle>
            <EmptyDescription>Créez votre premier établissement pour commencer</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search + filter on the same row */}
            <div className="flex flex-1 items-center gap-3">
              <SearchInput
                placeholder="Rechercher par nom, ville..."
                value={search}
                onValueChange={handleSearchChange}
                className="flex-1 sm:max-w-sm"
              />

              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="w-[160px] shrink-0">
                  <SelectValue placeholder="Tous les statuts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bulk actions */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 sm:ml-auto">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ArrowUpDown className="mr-2 h-4 w-4" />
                      Statut
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {statusOptions.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => handleBulkChangeStatus(opt.value)}
                        className="text-xs"
                      >
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </Button>
              </div>
            )}
          </div>

          {/* Table */}
          <StoresTable
            stores={paginatedStores}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onChangeStatus={handleChangeStatus}
            onDelete={handleDeleteSingle}
          />

          {/* Pagination */}
          <StoresPagination
            currentPage={safePage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={ADMIN_PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title={
          storeToDelete
            ? "Supprimer l'établissement"
            : `Supprimer ${selectedIds.size} établissement(s)`
        }
        description={
          storeToDelete
            ? "Êtes-vous sûr de vouloir supprimer cet établissement ? Cette action est irréversible."
            : `Êtes-vous sûr de vouloir supprimer ${selectedIds.size} établissement(s) ? Cette action est irréversible.`
        }
      />
    </div>
  )
}
