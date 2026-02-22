"use client"

import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { useState, useMemo } from "react"
import {
  PlusIcon,
  Users,
  MoreHorizontal,
  Eye,
  Trash2,
  Upload,
} from "lucide-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
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
import { SubscriberForm } from "./subscriber-form"
import { SubscriberDetailDialog } from "./subscriber-detail-dialog"
import { CsvImportDialog } from "./csv-import-dialog"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Subscriber = any

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  active: "Actif",
  unsubscribed: "Désabonné",
  bounced: "Rebond",
  complained: "Plainte",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  active: "default",
  unsubscribed: "secondary",
  bounced: "destructive",
  complained: "destructive",
}

const SOURCE_LABELS: Record<string, string> = {
  order: "Commande",
  import: "Import CSV",
  storefront_form: "Formulaire",
  gamification: "Jeu",
  api: "API",
  manual: "Manuel",
}

export function EmailSubscribersPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [detailSubscriber, setDetailSubscriber] = useState<Subscriber | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")

  const subscribers = useQuery(
    api?.emailSubscribers?.list,
    storeId ? { storeId } : "skip"
  ) as Subscriber[] | undefined

  const removeMutation = useMutation(api?.emailSubscribers?.remove)

  const filtered = useMemo(() => {
    if (!subscribers) return []
    let result = subscribers

    if (statusFilter !== "all") {
      result = result.filter((s: Subscriber) => s.status === statusFilter)
    }
    if (sourceFilter !== "all") {
      result = result.filter((s: Subscriber) => s.source === sourceFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (s: Subscriber) =>
          s.email.toLowerCase().includes(q) ||
          (s.firstName && s.firstName.toLowerCase().includes(q)) ||
          (s.lastName && s.lastName.toLowerCase().includes(q))
      )
    }
    return result
  }, [subscribers, statusFilter, sourceFilter, search])

  const handleDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      await removeMutation({ id: deletingId })
      toast.success("Abonné supprimé")
      setDeletingId(null)
    } catch (error: unknown) {
      toast.error("Échec de la suppression")
    } finally {
      setIsDeleting(false)
    }
  }

  if (!storeId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Users /></EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>Sélectionnez un établissement pour gérer vos abonnés</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (subscribers === undefined) return <LoadingState />

  const activeCount = subscribers.filter((s: Subscriber) => s.status === "active").length
  const pendingCount = subscribers.filter((s: Subscriber) => s.status === "pending").length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Abonnés</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeCount} actif{activeCount > 1 ? "s" : ""}
            {pendingCount > 0 && ` · ${pendingCount} en attente de confirmation`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importer CSV
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <PlusIcon className="mr-2 h-4 w-4" />
                Ajouter un abonné
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter un abonné</DialogTitle>
                <DialogDescription>
                  Un email de confirmation sera envoyé automatiquement (double opt-in RGPD)
                </DialogDescription>
              </DialogHeader>
              <SubscriberForm
                onSuccess={() => setIsCreateOpen(false)}
                onCancel={() => setIsCreateOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          placeholder="Rechercher un abonné..."
          value={search}
          onValueChange={setSearch}
          className="flex-1 sm:max-w-sm"
        />
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Actif</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="unsubscribed">Désabonné</SelectItem>
              <SelectItem value="bounced">Rebond</SelectItem>
              <SelectItem value="complained">Plainte</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Toutes les sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les sources</SelectItem>
              <SelectItem value="order">Commande</SelectItem>
              <SelectItem value="import">Import CSV</SelectItem>
              <SelectItem value="storefront_form">Formulaire</SelectItem>
              <SelectItem value="gamification">Jeu</SelectItem>
              <SelectItem value="manual">Manuel</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Users /></EmptyMedia>
            <EmptyTitle>Aucun abonné</EmptyTitle>
            <EmptyDescription>
              {search || statusFilter !== "all" || sourceFilter !== "all"
                ? "Aucun résultat pour ces filtres"
                : "Importez votre liste ou ajoutez votre premier abonné"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Inscrit le</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((subscriber: Subscriber) => (
                <TableRow key={subscriber._id}>
                  <TableCell className="font-medium">{subscriber.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[subscriber.firstName, subscriber.lastName].filter(Boolean).join(" ") || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[subscriber.status] ?? "secondary"}>
                      {STATUS_LABELS[subscriber.status] ?? subscriber.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {SOURCE_LABELS[subscriber.source] ?? subscriber.source}
                  </TableCell>
                  <TableCell>
                    {subscriber.tags && subscriber.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {subscriber.tags.slice(0, 2).map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {subscriber.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{subscriber.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatShortDate(subscriber.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailSubscriber(subscriber)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Voir le profil
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeletingId(subscriber._id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
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
      )}

      {/* Subscriber detail dialog */}
      <SubscriberDetailDialog
        subscriber={detailSubscriber}
        open={!!detailSubscriber}
        onOpenChange={(open) => !open && setDetailSubscriber(null)}
      />

      {/* CSV import dialog */}
      <CsvImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
      />

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        onConfirm={handleDelete}
        title="Supprimer cet abonné ?"
        description="Cette action est irréversible. L'abonné et tout son historique d'activité seront supprimés définitivement."
        isDeleting={isDeleting}
      />
    </div>
  )
}
