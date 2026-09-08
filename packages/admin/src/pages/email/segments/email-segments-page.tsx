"use client"

import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { useState } from "react"
import { PlusIcon, Filter, MoreHorizontal, Pencil, Trash2, Copy, Users } from "lucide-react"
import {
  Button,
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
import { DeleteConfirmDialog } from "../../../components/delete-confirm-dialog"
import { useAdminApiStore } from "../../../stores/admin-api-store"
import { useAdminStoreId } from "../../../hooks/admin-hooks"
import { convexErrorMessage } from "../../../lib/convex-error"
import { formatShortDate } from "../../../lib/formatters"
import { SegmentFormDialog } from "./segment-form-dialog"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Segment = any

const OPERATOR_LABELS: Record<string, string> = {
  and: "ET",
  or: "OU",
}

export function EmailSegmentsPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const segments = useQuery(
    api?.emailSegments?.list,
    storeId ? { storeId } : "skip"
  ) as Segment[] | undefined

  const removeMutation = useMutation(api?.emailSegments?.remove)
  const duplicateMutation = useMutation(api?.emailSegments?.duplicate)

  const handleDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      await removeMutation({ id: deletingId })
      toast.success("Segment supprimé")
      setDeletingId(null)
    } catch (error: unknown) {
      // Same as the models list: the names of the campaigns still filtering on
      // this segment are what makes the refusal actionable.
      toast.error(convexErrorMessage(error, "Échec de la suppression"))
      console.error(error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateMutation({ id })
      toast.success("Segment dupliqué")
    } catch (error: unknown) {
      toast.error("Échec de la duplication")
    }
  }

  if (!storeId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Filter /></EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>Sélectionnez un établissement pour gérer vos segments</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (segments === undefined) return <LoadingState />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Segments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Groupes d&apos;abonnés filtrés par règles pour cibler vos campagnes
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Nouveau segment
        </Button>
      </div>

      {/* Table */}
      {segments.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Filter /></EmptyMedia>
            <EmptyTitle>Aucun segment</EmptyTitle>
            <EmptyDescription>
              Créez votre premier segment pour cibler précisément vos abonnés
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Règles</TableHead>
                <TableHead>Opérateur</TableHead>
                <TableHead>Abonnés</TableHead>
                <TableHead>Mis à jour</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {segments.map((segment: Segment) => (
                <TableRow key={segment._id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{segment.name}</p>
                      {segment.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{segment.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {segment.rules?.length ?? 0} règle{(segment.rules?.length ?? 0) > 1 ? "s" : ""}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                      {OPERATOR_LABELS[segment.ruleOperator] ?? segment.ruleOperator}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{segment.subscriberCount ?? 0}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatShortDate(segment.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingSegment(segment)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(segment._id)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Dupliquer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeletingId(segment._id)}
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

      {/* Create dialog */}
      <SegmentFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      {/* Edit dialog */}
      <SegmentFormDialog
        segment={editingSegment}
        open={!!editingSegment}
        onOpenChange={(open) => !open && setEditingSegment(null)}
      />

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        onConfirm={handleDelete}
        title="Supprimer ce segment ?"
        description="Cette action est irréversible. Les campagnes utilisant ce segment ne seront pas affectées."
        isDeleting={isDeleting}
      />
    </div>
  )
}
