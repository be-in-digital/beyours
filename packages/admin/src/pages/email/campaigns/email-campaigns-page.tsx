"use client"

import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { useState, useMemo } from "react"
import {
  PlusIcon,
  Send,
  MoreHorizontal,
  BarChart2,
  Trash2,
  PauseCircle,
  XCircle,
} from "lucide-react"
import {
  Button,
  Badge,
  SearchInput,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@beindigital-engine/ui"
import { LoadingState } from "../../../components/loading-state"
import { DeleteConfirmDialog } from "../../../components/delete-confirm-dialog"
import { useAdminApiStore } from "../../../stores/admin-api-store"
import { useAdminStoreId } from "../../../hooks/admin-hooks"
import { formatShortDate } from "../../../lib/formatters"
import { CampaignWizardDialog } from "./campaign-wizard-dialog"
import { CampaignStatsDialog } from "./campaign-stats-dialog"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Campaign = any

type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "paused" | "cancelled"

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Brouillon",
  scheduled: "Planifiée",
  sending: "En cours",
  sent: "Envoyée",
  paused: "En pause",
  cancelled: "Annulée",
}

const STATUS_VARIANTS: Record<CampaignStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  scheduled: "secondary",
  sending: "default",
  sent: "default",
  paused: "secondary",
  cancelled: "destructive",
}

export function EmailCampaignsPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [statsCampaign, setStatsCampaign] = useState<Campaign | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const campaigns = useQuery(
    api?.emailCampaigns?.list,
    storeId ? { storeId } : "skip"
  ) as Campaign[] | undefined

  const removeMutation = useMutation(api?.emailCampaigns?.remove)
  const pauseMutation = useMutation(api?.emailCampaigns?.pause)
  const cancelMutation = useMutation(api?.emailCampaigns?.cancel)

  const filtered = useMemo(() => {
    if (!campaigns) return []
    let result = campaigns
    if (statusFilter !== "all") {
      result = result.filter((c: Campaign) => c.status === statusFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (c: Campaign) =>
          c.name.toLowerCase().includes(q) ||
          c.subject.toLowerCase().includes(q)
      )
    }
    return result
  }, [campaigns, statusFilter, search])

  const handleDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      await removeMutation({ id: deletingId })
      toast.success("Campagne supprimée")
      setDeletingId(null)
    } catch (error: unknown) {
      toast.error("Échec de la suppression")
    } finally {
      setIsDeleting(false)
    }
  }

  const handlePause = async (id: string) => {
    try {
      await pauseMutation({ id })
      toast.success("Campagne mise en pause")
    } catch (error: unknown) {
      toast.error("Échec de la mise en pause")
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await cancelMutation({ id })
      toast.success("Campagne annulée")
    } catch (error: unknown) {
      toast.error("Échec de l'annulation")
    }
  }

  if (!storeId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Send /></EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>Sélectionnez un établissement pour gérer vos campagnes</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (campaigns === undefined) return <LoadingState />

  const sentCount = campaigns.filter((c: Campaign) => c.status === "sent").length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campagnes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {campaigns.length} campagne{campaigns.length > 1 ? "s" : ""}
            {sentCount > 0 && ` · ${sentCount} envoyée${sentCount > 1 ? "s" : ""}`}
          </p>
        </div>
        <Button size="sm" onClick={() => setIsWizardOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Nouvelle campagne
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          placeholder="Rechercher une campagne..."
          value={search}
          onValueChange={setSearch}
          className="flex-1 sm:max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Send /></EmptyMedia>
            <EmptyTitle>Aucune campagne</EmptyTitle>
            <EmptyDescription>
              {search || statusFilter !== "all"
                ? "Aucune campagne pour ces filtres"
                : "Créez votre première campagne email"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Objet</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Envoyés</TableHead>
                <TableHead>Ouverture</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((campaign: Campaign) => {
                const openRate = campaign.stats?.delivered > 0
                  ? Math.round((campaign.stats.opened / campaign.stats.delivered) * 100 * 10) / 10
                  : null

                return (
                  <TableRow key={campaign._id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {campaign.subject}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[campaign.status as CampaignStatus] ?? "outline"}>
                        {STATUS_LABELS[campaign.status as CampaignStatus] ?? campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {campaign.stats?.sent > 0
                        ? campaign.stats.sent.toLocaleString()
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {openRate !== null
                        ? <span className={openRate >= 20 ? "text-green-600 font-medium" : ""}>{openRate}%</span>
                        : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {campaign.sentAt
                        ? formatShortDate(campaign.sentAt)
                        : campaign.scheduledAt
                        ? `Planif. ${formatShortDate(campaign.scheduledAt)}`
                        : formatShortDate(campaign.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {campaign.status === "sent" && (
                            <DropdownMenuItem onClick={() => setStatsCampaign(campaign)}>
                              <BarChart2 className="mr-2 h-4 w-4" />
                              Voir les stats
                            </DropdownMenuItem>
                          )}
                          {campaign.status === "sending" && (
                            <DropdownMenuItem onClick={() => handlePause(campaign._id)}>
                              <PauseCircle className="mr-2 h-4 w-4" />
                              Mettre en pause
                            </DropdownMenuItem>
                          )}
                          {["draft", "scheduled", "paused"].includes(campaign.status) && (
                            <DropdownMenuItem onClick={() => handleCancel(campaign._id)}>
                              <XCircle className="mr-2 h-4 w-4" />
                              Annuler
                            </DropdownMenuItem>
                          )}
                          {["draft", "cancelled"].includes(campaign.status) && (
                            <DropdownMenuItem
                              onClick={() => setDeletingId(campaign._id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Wizard */}
      <CampaignWizardDialog open={isWizardOpen} onOpenChange={setIsWizardOpen} />

      {/* Stats dialog */}
      <CampaignStatsDialog
        campaign={statsCampaign}
        open={!!statsCampaign}
        onOpenChange={(open) => !open && setStatsCampaign(null)}
      />

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        onConfirm={handleDelete}
        title="Supprimer cette campagne ?"
        description="Cette action est irréversible."
        isDeleting={isDeleting}
      />
    </div>
  )
}
