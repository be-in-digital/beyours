"use client"

import { useQuery, useMutation } from "convex/react"
import { toast } from "sonner"
import { useState } from "react"
import {
  PlusIcon,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
} from "lucide-react"
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  ButtonGroup,
  Input,
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
import { LoadingState } from "../../../components/loading-state"
import { DeleteConfirmDialog } from "../../../components/delete-confirm-dialog"
import { useAdminApiStore } from "../../../stores/admin-api-store"
import { useAdminStoreId } from "../../../hooks/admin-hooks"
import { formatShortDate } from "../../../lib/formatters"
import { TemplateEditor } from "./template-editor"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Template = any

type TemplateCategory = "marketing" | "transactional" | "automation"

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  marketing: "Marketing",
  transactional: "Transactionnel",
  automation: "Automation",
}

const CATEGORY_VARIANTS: Record<TemplateCategory, "default" | "secondary" | "outline"> = {
  marketing: "default",
  transactional: "secondary",
  automation: "outline",
}

interface CreateTemplateFormProps {
  onSuccess: (template: Template) => void
  onCancel: () => void
}

function CreateTemplateForm({ onSuccess, onCancel }: CreateTemplateFormProps) {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()
  const createMutation = useMutation(api?.emailTemplates?.create)

  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [category, setCategory] = useState<TemplateCategory>("marketing")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!storeId || !name.trim() || !subject.trim()) {
      toast.error("Le nom et l'objet sont requis")
      return
    }
    setIsSubmitting(true)
    try {
      const template = await createMutation({
        storeId,
        name: name.trim(),
        subject: subject.trim(),
        category,
        blocks: [],
      })
      // Pass newly created template ID to open editor
      onSuccess({ _id: template, name: name.trim(), subject: subject.trim(), category, blocks: [] })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(`Échec : ${message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tmpl-name">Nom du modèle *</Label>
        <Input
          id="tmpl-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex : Newsletter mensuelle"
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tmpl-subject">Objet de l&apos;email *</Label>
        <Input
          id="tmpl-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="ex : Vos offres du mois 🎉"
        />
      </div>
      <div className="space-y-2">
        <Label>Catégorie</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="marketing">Marketing</SelectItem>
            <SelectItem value="transactional">Transactionnel</SelectItem>
            <SelectItem value="automation">Automation</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <ButtonGroup>
          <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Création..." : "Créer et éditer"}
          </Button>
        </ButtonGroup>
      </DialogFooter>
    </div>
  )
}

export function EmailTemplatesPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  const templates = useQuery(
    api?.emailTemplates?.list,
    storeId ? { storeId } : "skip"
  ) as Template[] | undefined

  const removeMutation = useMutation(api?.emailTemplates?.remove)
  const duplicateMutation = useMutation(api?.emailTemplates?.duplicate)

  const filtered = (templates ?? []).filter((t: Template) =>
    categoryFilter === "all" || t.category === categoryFilter
  )

  const handleDelete = async () => {
    if (!deletingId) return
    setIsDeleting(true)
    try {
      await removeMutation({ id: deletingId })
      toast.success("Modèle supprimé")
      setDeletingId(null)
    } catch (error: unknown) {
      toast.error("Échec de la suppression")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateMutation({ id })
      toast.success("Modèle dupliqué")
    } catch (error: unknown) {
      toast.error("Échec de la duplication")
    }
  }

  // Show editor if a template is selected for editing
  if (editingTemplate) {
    return (
      <TemplateEditor
        template={editingTemplate}
        onBack={() => setEditingTemplate(null)}
      />
    )
  }

  if (!storeId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><LayoutTemplate /></EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>Sélectionnez un établissement pour gérer vos modèles</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (templates === undefined) return <LoadingState variant="cards" />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Modèles d&apos;email</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {templates.length} modèle{templates.length > 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Nouveau modèle
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2">
        {(["all", "marketing", "transactional", "automation"] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              categoryFilter === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:border-primary/50"
            }`}
          >
            {cat === "all" ? "Tous" : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><LayoutTemplate /></EmptyMedia>
            <EmptyTitle>Aucun modèle</EmptyTitle>
            <EmptyDescription>
              {categoryFilter !== "all"
                ? `Aucun modèle dans la catégorie "${CATEGORY_LABELS[categoryFilter as TemplateCategory]}"`
                : "Créez votre premier modèle d'email"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template: Template) => (
            <div
              key={template._id}
              className="group relative rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => setEditingTemplate(template)}
            >
              {/* Category badge */}
              <div className="mb-3 flex items-start justify-between">
                <Badge variant={CATEGORY_VARIANTS[template.category as TemplateCategory] ?? "outline"}>
                  {CATEGORY_LABELS[template.category as TemplateCategory] ?? template.category}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingTemplate(template) }}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Éditer
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(template._id) }}>
                      <Copy className="mr-2 h-4 w-4" />
                      Dupliquer
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); setDeletingId(template._id) }}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Template info */}
              <h3 className="font-semibold text-sm leading-tight">{template.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 truncate">{template.subject}</p>

              {/* Footer */}
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{template.blocks?.length ?? 0} bloc{(template.blocks?.length ?? 0) > 1 ? "s" : ""}</span>
                <span>Modifié {formatShortDate(template.updatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau modèle d&apos;email</DialogTitle>
            <DialogDescription>
              Définissez le nom et l&apos;objet, puis editez les blocs de contenu
            </DialogDescription>
          </DialogHeader>
          <CreateTemplateForm
            onSuccess={(template) => {
              setIsCreateOpen(false)
              setEditingTemplate(template)
            }}
            onCancel={() => setIsCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        onConfirm={handleDelete}
        title="Supprimer ce modèle ?"
        description="Cette action est irréversible. Les campagnes utilisant ce modèle ne seront pas affectées."
        isDeleting={isDeleting}
      />
    </div>
  )
}
