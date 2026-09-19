"use client"

import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { useState, useMemo } from "react"
import {
  PlusIcon,
  TagIcon,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@be-yours/ui"
import { LoadingState } from "../../components/loading-state"
import { DeleteConfirmDialog } from "../../components/delete-confirm-dialog"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { formatShortDate, formatPrice } from "../../lib/formatters"
import { PromotionForm } from "./promotion-form"
import { ResolvingStore } from "../../components/resolving-store"
import { convexErrorMessage } from "../../lib/convex-error"

type DiscountType = "percentage" | "fixed_amount" | "free_product" | "free_delivery" | "bogo"
type TriggerMode = "coupon" | "auto"

interface Promotion {
  _id: string
  storeId: string
  name: string
  description?: string
  triggerMode: TriggerMode
  couponCode?: string
  discountType: DiscountType
  discountValue?: number
  maxDiscountAmount?: number
  scope: "order" | "product" | "category"
  targetProductIds?: string[]
  targetCategoryIds?: string[]
  minimumOrderAmount?: number
  startDate: number
  endDate: number
  scheduling?: {
    activeDays: number[]
    activeTimeFrom: string
    activeTimeTo: string
  }
  maxTotalUsage?: number
  maxUsagePerCustomer?: number
  usageCount: number
  isActive: boolean
  createdAt: number
  updatedAt: number
}

/**
 * Legacy types are still listed, and still labelled.
 *
 * « Produit offert » and « Offre BOGO » can no longer be created — the order
 * path cannot honour either, so `promotions.create` refuses them and the form
 * no longer offers them (#376). Rows stored before that guard exist, and this
 * table has to render them: hiding them would leave an owner with a promotion
 * they can see the effects of and cannot find. `formatDiscountValue` says, in
 * the value column, that they grant nothing.
 */
const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  percentage: "Pourcentage",
  fixed_amount: "Montant fixe",
  free_product: "Produit offert",
  free_delivery: "Livraison offerte",
  bogo: "BOGO",
}

const DISCOUNT_TYPE_COLORS: Record<DiscountType, string> = {
  percentage: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  fixed_amount: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  free_product: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  free_delivery: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  bogo: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
}

const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]

function getPromotionStatus(promo: Promotion): { label: string; variant: "default" | "secondary" | "destructive" } {
  const now = Date.now()
  if (!promo.isActive) return { label: "Inactive", variant: "secondary" }
  if (now > promo.endDate) return { label: "Expirée", variant: "destructive" }
  if (now < promo.startDate) return { label: "Planifiée", variant: "secondary" }
  return { label: "Active", variant: "default" }
}

function formatDiscountValue(promo: Promotion): string {
  switch (promo.discountType) {
    case "percentage":
      return `${promo.discountValue ?? 0}%`
    case "fixed_amount":
      return formatPrice(promo.discountValue ?? 0)
    case "free_delivery":
      return "Livraison offerte"
    // Neither of these two ever granted a discount: the order path refuses
    // both, and always did. The table used to print « Produit offert » and
    // « BOGO » in the value column, which read as a working campaign.
    case "free_product":
    case "bogo":
      return "Aucune remise appliquée"
    default:
      return "-"
  }
}

function formatScheduling(promo: Promotion): string {
  if (!promo.scheduling) return "-"
  const days = promo.scheduling.activeDays
    .sort((a, b) => a - b)
    .map((d) => DAY_NAMES[d])
    .join(", ")
  return `${days} ${promo.scheduling.activeTimeFrom}-${promo.scheduling.activeTimeTo}`
}

function formatUsage(promo: Promotion): string {
  const max = promo.maxTotalUsage
  return max ? `${promo.usageCount} / ${max}` : `${promo.usageCount} / ∞`
}

export function PromotionsPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  // Dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Tab state
  const [activeTab, setActiveTab] = useState<string>("coupon")

  // Filters
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Data
  const promotions = useQuery(
    api?.promotions?.list,
    storeId ? { storeId } : "skip"
  ) as Promotion[] | undefined

  const toggleStatusMutation = useMutation(api?.promotions?.toggleStatus)
  const removeMutation = useMutation(api?.promotions?.remove)

  // Filter promotions by tab, search, and status
  const filteredPromotions = useMemo(() => {
    if (!promotions) return []

    let result = promotions.filter((p) => p.triggerMode === activeTab)

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.couponCode && p.couponCode.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      const now = Date.now()
      result = result.filter((p) => {
        switch (statusFilter) {
          case "active":
            return p.isActive && now >= p.startDate && now <= p.endDate
          case "inactive":
            return !p.isActive
          case "expired":
            return now > p.endDate
          case "scheduled":
            return p.isActive && now < p.startDate
          default:
            return true
        }
      })
    }

    return result
  }, [promotions, activeTab, search, statusFilter])

  const handleToggleStatus = async (id: string) => {
    try {
      await toggleStatusMutation({ id })
      toast.success("Statut mis à jour")
    } catch (error: unknown) {
      toast.error("Échec de la mise à jour du statut")
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      await removeMutation({ id: deletingId })
      toast.success("Promotion supprimée")
      setDeletingId(null)
    } catch (error: unknown) {
      // The refusal names the orders this coupon discounted and says to
      // deactivate it instead.
      toast.error(convexErrorMessage(error, "Échec de la suppression"))
      console.error(error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!storeId) return <ResolvingStore />

  if (promotions === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Promotions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez vos codes promo et offres automatiques
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusIcon className="mr-2 h-4 w-4" />
              Créer une promotion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>Nouvelle promotion</DialogTitle>
              <DialogDescription>
                Créez un code promo ou une offre automatique
              </DialogDescription>
            </DialogHeader>
            <PromotionForm
              onSuccess={() => setIsCreateOpen(false)}
              onCancel={() => setIsCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="coupon">Codes promo</TabsTrigger>
          <TabsTrigger value="auto">Offres automatiques</TabsTrigger>
        </TabsList>

        {/* Toolbar (shared between tabs) */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3">
            <SearchInput
              placeholder="Rechercher une promotion..."
              value={search}
              onValueChange={setSearch}
              className="flex-1 sm:max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] shrink-0">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="expired">Expirée</SelectItem>
                <SelectItem value="scheduled">Planifiée</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="coupon" className="space-y-4 mt-0">
          <PromotionTable
            promotions={filteredPromotions}
            showCouponCode
            onToggleStatus={handleToggleStatus}
            onEdit={setEditingPromotion}
            onDelete={setDeletingId}
          />
        </TabsContent>

        <TabsContent value="auto" className="space-y-4 mt-0">
          <PromotionTable
            promotions={filteredPromotions}
            showCouponCode={false}
            onToggleStatus={handleToggleStatus}
            onEdit={setEditingPromotion}
            onDelete={setDeletingId}
          />
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog
        open={!!editingPromotion}
        onOpenChange={(open) => !open && setEditingPromotion(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Modifier la promotion</DialogTitle>
            <DialogDescription>
              Mettez à jour les paramètres de cette promotion
            </DialogDescription>
          </DialogHeader>
          {editingPromotion && (
            <PromotionForm
              promotion={editingPromotion}
              onSuccess={() => setEditingPromotion(null)}
              onCancel={() => setEditingPromotion(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        onConfirm={handleDelete}
        title="Supprimer cette promotion ?"
        description="Cette action est irréversible. La promotion et tout son historique d'utilisation seront définitivement supprimés."
        isDeleting={isDeleting}
      />
    </div>
  )
}

// === Promotion Table Component ===

interface PromotionTableProps {
  promotions: Promotion[]
  showCouponCode: boolean
  onToggleStatus: (id: string) => void
  onEdit: (promo: Promotion) => void
  onDelete: (id: string) => void
}

function PromotionTable({
  promotions,
  showCouponCode,
  onToggleStatus,
  onEdit,
  onDelete,
}: PromotionTableProps) {
  if (promotions.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TagIcon />
          </EmptyMedia>
          <EmptyTitle>Aucune promotion</EmptyTitle>
          <EmptyDescription>
            {showCouponCode
              ? "Créez votre premier code promo"
              : "Créez votre première offre automatique"}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            {showCouponCode && <TableHead>Code</TableHead>}
            <TableHead>Type</TableHead>
            <TableHead>Valeur</TableHead>
            <TableHead>Période</TableHead>
            <TableHead>Horaires</TableHead>
            <TableHead>Utilisation</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {promotions.map((promo) => {
            const status = getPromotionStatus(promo)
            return (
              <TableRow key={promo._id}>
                <TableCell className="font-medium">{promo.name}</TableCell>
                {showCouponCode && (
                  <TableCell>
                    {promo.couponCode ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {promo.couponCode}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      DISCOUNT_TYPE_COLORS[promo.discountType]
                    }`}
                  >
                    {DISCOUNT_TYPE_LABELS[promo.discountType]}
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  {formatDiscountValue(promo)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatShortDate(promo.startDate)} - {formatShortDate(promo.endDate)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatScheduling(promo)}
                </TableCell>
                <TableCell className="text-sm">
                  {formatUsage(promo)}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={promo.isActive}
                    onCheckedChange={() => onToggleStatus(promo._id)}
                    aria-label={`Toggle ${promo.name}`}
                  />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(promo)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(promo._id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
