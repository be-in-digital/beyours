"use client"

/**
 * The automations screen (#270).
 *
 * WHAT WAS MISSING. `packages/admin/src/pages/email/` shipped six pages and the
 * sidebar listed the same six. None of them created, edited or deleted an
 * automation. The mutations existed and were permission-guarded — `create`,
 * `update`, `remove`, `activate`, `pause` — and **nothing in the product called
 * any of them**. The only automation query the UI read was `listActive`, filling
 * a dashboard card that said « Aucune automation active » to every owner,
 * permanently, because there was no path to a first one. An owner's only way to
 * build a sequence was a Convex API call.
 *
 * It became the binding constraint with #268: three triggers reach subscribers
 * now — `welcome` on double opt-in, `post_order` on every confirmed order,
 * `inactive` on a daily sweep — and the settings toggles gate them. The engine
 * works and there was no supported way to feed it. Worse, an owner switching
 * « Post-commande » on got a toggle that saved, an engine that dispatched, and
 * no email, because the toggle enabled a sequence that did not exist.
 */

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { toast } from "sonner"
import {
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  PlusIcon,
  Trash2,
  Workflow,
} from "lucide-react"
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@be-yours/ui"
import { LoadingState } from "../../../components/loading-state"
import { DeleteConfirmDialog } from "../../../components/delete-confirm-dialog"
import { useAdminApiStore } from "../../../stores/admin-api-store"
import { useAdminStoreId } from "../../../hooks/admin-hooks"
import { convexErrorMessage } from "../../../lib/convex-error"
import { formatShortDate } from "../../../lib/formatters"
import { AutomationFormDialog } from "./automation-form-dialog"
import {
  AUTOMATION_STATUS_LABELS,
  AUTOMATION_TRIGGER_LABELS,
  DEFAULT_INACTIVE_AFTER_DAYS,
  describeDelay,
  type AutomationDoc,
} from "./automation-vocabulary"

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  paused: "secondary",
  draft: "outline",
}

export function EmailAutomationsPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editing, setEditing] = useState<AutomationDoc | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const automations = useQuery(
    api?.emailAutomations?.list,
    storeId ? { storeId } : "skip"
  ) as AutomationDoc[] | undefined

  const removeMutation = useMutation(api?.emailAutomations?.remove)
  const activateMutation = useMutation(api?.emailAutomations?.activate)
  const pauseMutation = useMutation(api?.emailAutomations?.pause)

  const handleDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      await removeMutation({ id: deletingId })
      toast.success("Automatisation supprimée")
      setDeletingId(null)
    } catch (error: unknown) {
      // The server refuses to delete one that has already mailed somebody, and
      // its sentence says why and offers « pause » instead. Surfacing it beats
      // « Échec de la suppression ».
      toast.error(convexErrorMessage(error, "Échec de la suppression"))
      console.error(error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleActivate = async (id: string) => {
    try {
      await activateMutation({ id })
      toast.success("Automatisation activée")
    } catch (error: unknown) {
      // `activate` re-checks the trigger and the steps, because a draft written
      // through the API before those checks existed can hold an unready trigger
      // or no steps at all.
      toast.error(convexErrorMessage(error, "Échec de l'activation"))
      console.error(error)
    }
  }

  const handlePause = async (id: string) => {
    try {
      await pauseMutation({ id })
      toast.success("Automatisation mise en pause")
    } catch (error: unknown) {
      toast.error(convexErrorMessage(error, "Échec de la mise en pause"))
      console.error(error)
    }
  }

  if (!storeId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Workflow />
          </EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>
            Choisissez un établissement pour voir ses automatisations.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (automations === undefined) return <LoadingState />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Automatisations</h1>
          <p className="text-sm text-muted-foreground">
            Des emails envoyés automatiquement après un événement. Chaque délai se
            compte à partir du déclencheur.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" aria-hidden="true" />
          Nouvelle automatisation
        </Button>
      </div>

      {automations.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Workflow />
            </EmptyMedia>
            <EmptyTitle>Aucune automatisation</EmptyTitle>
            <EmptyDescription>
              Une automatisation envoie une suite d'emails après un événement :
              une inscription, une commande, ou un client qui ne revient plus.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Déclencheur</TableHead>
              <TableHead>Étapes</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Envoyés</TableHead>
              <TableHead>Modifiée</TableHead>
              <TableHead className="w-[52px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {automations.map((automation) => {
              const steps = automation.steps ?? []
              return (
                <TableRow key={automation._id}>
                  <TableCell className="font-medium">{automation.name}</TableCell>
                  <TableCell>
                    {AUTOMATION_TRIGGER_LABELS[
                      automation.trigger as keyof typeof AUTOMATION_TRIGGER_LABELS
                    ] ?? automation.trigger}
                    {automation.trigger === "inactive" && (
                      <span className="block text-xs text-muted-foreground">
                        après {automation.inactiveAfterDays ?? DEFAULT_INACTIVE_AFTER_DAYS}{" "}
                        jours sans commande
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {steps.length}
                    {steps.length > 0 && (
                      // The last step's delay, so the row says how long the
                      // sequence runs rather than only how many emails it holds.
                      <span className="block text-xs text-muted-foreground">
                        dernier {describeDelay(
                          Math.max(...steps.map((step) => step.delayMinutes))
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[automation.status] ?? "outline"}>
                      {AUTOMATION_STATUS_LABELS[automation.status] ?? automation.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {automation.stats?.sent ?? 0}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {automation.updatedAt ? formatShortDate(automation.updatedAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions pour ${automation.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(automation)}>
                          <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                          Modifier
                        </DropdownMenuItem>
                        {automation.status === "active" ? (
                          <DropdownMenuItem onClick={() => handlePause(automation._id)}>
                            <Pause className="mr-2 h-4 w-4" aria-hidden="true" />
                            Mettre en pause
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleActivate(automation._id)}>
                            <Play className="mr-2 h-4 w-4" aria-hidden="true" />
                            Activer
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setDeletingId(automation._id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
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
      )}

      <AutomationFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        automation={null}
      />
      <AutomationFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        automation={editing}
      />

      <DeleteConfirmDialog
        open={deletingId !== null}
        onOpenChange={(open) => !open && setDeletingId(null)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
        title="Supprimer cette automatisation ?"
        description="Les étapes déjà programmées n'arriveront jamais. Si elle a déjà envoyé des emails, la suppression sera refusée — mettez-la en pause."
      />
    </div>
  )
}
