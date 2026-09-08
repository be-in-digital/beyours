"use client"

import { useQuery, useMutation, usePaginatedQuery } from "convex/react"
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
} from "@be-in-digital/ui"
import { LoadingState } from "../../../components/loading-state"
import { ResolvingStore } from "../../../components/resolving-store"
import { DeleteConfirmDialog } from "../../../components/delete-confirm-dialog"
import { useAdminApiStore } from "../../../stores/admin-api-store"
import { useAdminStoreId } from "../../../hooks/admin-hooks"
import { ADMIN_PAGE_SIZE } from "../../../lib/constants"
import { formatShortDate } from "../../../lib/formatters"
import { SubscriberForm } from "./subscriber-form"
import { SubscriberDetailDialog } from "./subscriber-detail-dialog"
import { CsvImportDialog } from "./csv-import-dialog"
import { convexErrorMessage } from "../../../lib/convex-error"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Subscriber = any

interface SubscriberCounts {
  total: number
  active: number
  pending: number
  unsubscribed: number
  bounced: number
  complained: number
  /** Some status hit the server's scan ceiling: every figure is a floor. */
  truncated: boolean
}

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

/** Whole-list counts, rendered as the floor they are when the server capped them. */
function countLabel(value: number | undefined, truncated: boolean | undefined): string {
  if (value === undefined) return "…"
  return `${value.toLocaleString("fr-FR")}${truncated ? "+" : ""}`
}

/**
 * `usePaginatedQuery` needs a real function reference on its first render and
 * `api` is injected by the admin layout a render later, so the query lives in a
 * child that is not mounted until there is something to query with — the same
 * shape `OrdersPage` uses.
 */
export function EmailSubscribersPage() {
  const api = useAdminApiStore((s) => s.api)
  const storeId = useAdminStoreId()

  if (!storeId || !api) return <ResolvingStore />

  return <SubscribersList api={api} storeId={storeId} />
}

function SubscribersList({
  api,
  storeId,
}: {
  // The Convex API is injected at runtime and has no static type here.
  api: any
  storeId: string
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [detailSubscriber, setDetailSubscriber] = useState<Subscriber | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")

  /**
   * One page of the mailing list, narrowed by status on the server.
   *
   * This screen used to subscribe to every subscriber the establishment had
   * ever had and do the filtering, the counting and the paging in the browser.
   * A mailing list only grows — since #316 every storefront signup, order and
   * game play adds a row — so past Convex's 16,384-document transaction limit
   * the page stopped loading altogether, permanently, exactly when the list had
   * become worth having. Status is an equality the schema indexes, so each
   * filter now reads the page it shows.
   */
  const { results, status, loadMore } = usePaginatedQuery(
    api.emailSubscribers.list,
    statusFilter === "all" ? { storeId } : { storeId, status: statusFilter },
    { initialNumItems: ADMIN_PAGE_SIZE }
  )

  /** The whole-list figures, counted through the index rather than downloaded. */
  const counts = useQuery(api.emailSubscribers.countByStatus, { storeId }) as
    | SubscriberCounts
    | undefined

  const removeMutation = useMutation(api.emailSubscribers.remove)

  const subscribers = results as Subscriber[]

  /**
   * Source and search narrow the rows already loaded, not the whole table.
   *
   * Neither can be answered from an index: no index carries `source`, and a
   * substring match on an address cannot use one at all. « Charger plus »
   * widens what they can see, and the placeholder and the empty state say so —
   * a paginated list that answers "Aucun abonné" is claiming something about
   * the whole list it has not looked at.
   */
  const narrowing = sourceFilter !== "all" || search.trim().length > 0
  const filtered = useMemo(() => {
    let result = subscribers
    if (sourceFilter !== "all") {
      result = result.filter((s: Subscriber) => s.source === sourceFilter)
    }
    const needle = search.trim().toLowerCase()
    if (needle) {
      result = result.filter(
        (s: Subscriber) =>
          s.email.toLowerCase().includes(needle) ||
          (s.firstName && s.firstName.toLowerCase().includes(needle)) ||
          (s.lastName && s.lastName.toLowerCase().includes(needle))
      )
    }
    return result
  }, [subscribers, sourceFilter, search])

  const handleDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      // The removal clears the subscriber's events and automation runs first
      // and only then the subscriber, so a long-standing address can need more
      // than one transaction. Saying « supprimé » on the pass that did not
      // finish leaves the owner looking at a row that is still on the list.
      const result = await removeMutation({ id: deletingId })
      toast.success(
        result?.complete === false
          ? "Suppression en cours — cet abonné a beaucoup d'historique, il disparaîtra de la liste dans un instant"
          : "Abonné supprimé"
      )
      setDeletingId(null)
    } catch (error: unknown) {
      toast.error(convexErrorMessage(error, "Échec de la suppression"))
      console.error(error)
    } finally {
      setIsDeleting(false)
    }
  }

  const moreToLoad = status === "CanLoadMore" || status === "LoadingMore"

  if (status === "LoadingFirstPage") return <LoadingState />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Abonnés</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {countLabel(counts?.active, counts?.truncated)} actif
            {(counts?.active ?? 0) > 1 ? "s" : ""}
            {(counts?.pending ?? 0) > 0 &&
              ` · ${countLabel(counts?.pending, counts?.truncated)} en attente de confirmation`}
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
          placeholder="Rechercher parmi les abonnés chargés (email ou nom)..."
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
              {narrowing
                ? moreToLoad
                  ? "Aucun résultat parmi les abonnés chargés. Cliquez sur « Charger plus » pour chercher plus loin."
                  : "Aucun abonné ne correspond à ces filtres."
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

      {moreToLoad ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={status === "LoadingMore"}
            onClick={() => loadMore(ADMIN_PAGE_SIZE)}
          >
            {status === "LoadingMore" ? "Chargement…" : "Charger plus"}
          </Button>
        </div>
      ) : null}

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
