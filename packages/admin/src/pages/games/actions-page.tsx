"use client"

import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { useState } from "react"
import { ZapIcon, PlusIcon, MoreVertical, Edit, Trash2, GripVertical } from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@beindigital-engine/ui"
import { LoadingState } from "../../components/loading-state"
import { DeleteConfirmDialog } from "../../components/delete-confirm-dialog"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useAdminStoreId } from "../../hooks/admin-hooks"
import { ActionFormDialog } from "./action-form-dialog"

type ActionType = "google_review" | "instagram_follow" | "facebook_like" | "tiktok_follow" | "email_subscribe"

interface RequiredAction {
  _id: string
  type: ActionType
  name: string
  description?: string
  url?: string
  icon?: string
  isRequired: boolean
  sortOrder: number
  timerSeconds: number
  isActive: boolean
}

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  google_review: "Avis Google",
  instagram_follow: "Follow Instagram",
  facebook_like: "Like Facebook",
  tiktok_follow: "Follow TikTok",
  email_subscribe: "Inscription email",
}

function SortableRow({
  action,
  onEdit,
  onDelete,
}: {
  action: RequiredAction
  onEdit: (action: RequiredAction) => void
  onDelete: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: action._id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-[40px]">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell>
        <div className="space-y-0.5">
          <div className="font-medium text-sm">{action.name}</div>
          {action.url && (
            <div className="text-xs text-muted-foreground truncate max-w-[200px]">{action.url}</div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">{ACTION_TYPE_LABELS[action.type]}</Badge>
      </TableCell>
      <TableCell className="font-medium text-sm tabular-nums">{action.timerSeconds}s</TableCell>
      <TableCell>
        <Badge variant={action.isRequired ? "default" : "secondary"} className="text-xs">
          {action.isRequired ? "Oui" : "Non"}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={action.isActive ? "default" : "secondary"} className="text-xs">
          {action.isActive ? "Actif" : "Inactif"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEdit(action)} className="text-xs">
              <Edit className="mr-2 h-3.5 w-3.5" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(action._id)} className="text-destructive text-xs">
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

export function ActionsPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAction, setEditingAction] = useState<RequiredAction | undefined>(undefined)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Actions are global (restaurant-level)
  const actions = useQuery(api.requiredActions.list, {}) as RequiredAction[] | undefined

  const createAction = useMutation(api.requiredActions.create)
  const updateAction = useMutation(api.requiredActions.update)
  const removeAction = useMutation(api.requiredActions.remove)

  const sortedActions = actions ? [...actions].sort((a, b) => a.sortOrder - b.sortOrder) : undefined

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !sortedActions) return

    const oldIndex = sortedActions.findIndex((a) => a._id === active.id)
    const newIndex = sortedActions.findIndex((a) => a._id === over.id)

    const reordered = arrayMove(sortedActions, oldIndex, newIndex)

    // Persist new sort orders
    const updates = reordered.map((action, index) => ({
      id: action._id,
      sortOrder: index,
    }))

    try {
      await Promise.all(updates.map((u) => updateAction(u)))
    } catch (error: unknown) {
      toast.error("Échec de la mise à jour de l'ordre")
      console.error(error)
    }
  }

  const handleSubmit = async (data: {
    type: ActionType
    name: string
    description?: string
    url?: string
    isRequired: boolean
    sortOrder: number
    timerSeconds: number
    isActive: boolean
  }) => {
    if (editingAction) {
      try {
        await updateAction({ id: editingAction._id, ...data })
        toast.success("Action mise à jour")
      } catch (error: unknown) {
        toast.error("Échec de la mise à jour")
        console.error(error)
        throw error
      }
    } else {
      try {
        await createAction({ ...data })
        toast.success("Action créée avec succès")
      } catch (error: unknown) {
        toast.error("Échec de la création")
        console.error(error)
        throw error
      }
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      await removeAction({ id })
      toast.success("Action supprimée")
    } catch (error: unknown) {
      toast.error("Échec de la suppression")
      console.error(error)
    } finally {
      setIsDeleting(false)
      setDeletingId(null)
    }
  }

  const openCreate = () => {
    setEditingAction(undefined)
    setIsFormOpen(true)
  }

  const openEdit = (action: RequiredAction) => {
    setEditingAction(action)
    setIsFormOpen(true)
  }

  if (!storeId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ZapIcon />
          </EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>Veuillez sélectionner un établissement pour gérer les actions</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (sortedActions === undefined) {
    return <LoadingState />
  }

  const nextSortOrder = sortedActions.length > 0 ? Math.max(...sortedActions.map((a) => a.sortOrder)) + 1 : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Actions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Actions sociales requises avant de jouer
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Ajouter une action
        </Button>
      </div>

      {sortedActions.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ZapIcon />
            </EmptyMedia>
            <EmptyTitle>Aucune action</EmptyTitle>
            <EmptyDescription>Ajoutez des actions sociales que les clients doivent compléter avant de jouer</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="border border-border/50 rounded-lg">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Timer</TableHead>
                  <TableHead>Obligatoire</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <SortableContext items={sortedActions.map((a) => a._id)} strategy={verticalListSortingStrategy}>
                <TableBody>
                  {sortedActions.map((action) => (
                    <SortableRow
                      key={action._id}
                      action={action}
                      onEdit={openEdit}
                      onDelete={setDeletingId}
                    />
                  ))}
                </TableBody>
              </SortableContext>
            </Table>
          </DndContext>
        </div>
      )}

      <ActionFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        action={editingAction}
        onSubmit={handleSubmit}
        nextSortOrder={nextSortOrder}
      />

      <DeleteConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        onConfirm={() => deletingId && handleDelete(deletingId)}
        title="Supprimer cette action ?"
        description="Cette action est irréversible. L'action sociale ne sera plus requise pour jouer."
        isDeleting={isDeleting}
      />
    </div>
  )
}
