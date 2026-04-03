"use client"

import { useState, useEffect } from "react"
import { useMutation } from "convex/react"
import { toast } from "sonner"
import {
  Type,
  ImageIcon,
  MousePointerClick,
  ShoppingBag,
  Minus,
  Square,
  Undo2,
  ArrowLeft,
  GripVertical,
  Heading,
  Share2,
  Ticket,
  Columns,
  Play,
  Eye,
  Pencil,
  LayoutTemplate,
  UtensilsCrossed,
  CalendarClock,
  Copy,
  Plus,
  Images,
  MapPin,
  Clock,
  Quote,
  Sparkles,
} from "lucide-react"
import {
  Button,
  Input,
  Label,
  Separator,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@be-in-digital/ui"
import { useEmailTemplateEditorStore } from "../../../stores/email-template-editor-store"
import type { EditorBlock } from "../../../stores/email-template-editor-store"
import { useAdminApiStore } from "../../../stores/admin-api-store"
import { useAdminStoreId } from "../../../hooks/admin-hooks"
import { BlockPreview } from "./block-preview"
import { BlockConfigPanel } from "./block-config-panel"
import { renderTemplateToEmailHtml } from "@be-in-digital/marketing"
import type { EmailBranding, EmailBlock } from "@be-in-digital/marketing"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Template = any

interface TemplateEditorProps {
  template: Template
  onBack: () => void
}

function generateId() {
  return crypto.randomUUID().slice(0, 7)
}

type OmitId<T> = T extends EditorBlock ? Omit<T, "id"> : never

const BLOCK_PALETTE: Array<{
  type: EditorBlock["type"]
  label: string
  icon: React.ReactNode
  defaultData: OmitId<EditorBlock>
}> = [
  {
    type: "text",
    label: "Texte",
    icon: <Type className="h-4 w-4" />,
    defaultData: { type: "text", content: "", alignment: "left" },
  },
  {
    type: "image",
    label: "Image",
    icon: <ImageIcon className="h-4 w-4" />,
    defaultData: { type: "image", url: "", alt: "" },
  },
  {
    type: "button",
    label: "Bouton",
    icon: <MousePointerClick className="h-4 w-4" />,
    defaultData: { type: "button", text: "Cliquez ici", url: "", backgroundColor: "#000000", textColor: "#ffffff", alignment: "center" },
  },
  {
    type: "product",
    label: "Produit",
    icon: <ShoppingBag className="h-4 w-4" />,
    defaultData: { type: "product", productIds: [], layout: "list" },
  },
  {
    type: "divider",
    label: "Séparateur",
    icon: <Minus className="h-4 w-4" />,
    defaultData: { type: "divider", color: "#e5e7eb", thickness: 1 },
  },
  {
    type: "spacer",
    label: "Espace",
    icon: <Square className="h-4 w-4" />,
    defaultData: { type: "spacer", height: 24 },
  },
  {
    type: "heading",
    label: "Titre",
    icon: <Heading className="h-4 w-4" />,
    defaultData: { type: "heading", content: "Titre", level: "h2", alignment: "left" },
  },
  {
    type: "social",
    label: "Réseaux sociaux",
    icon: <Share2 className="h-4 w-4" />,
    defaultData: { type: "social", links: [], alignment: "center", style: "icons" },
  },
  {
    type: "coupon",
    label: "Coupon",
    icon: <Ticket className="h-4 w-4" />,
    defaultData: { type: "coupon", code: "PROMO10", description: "10% de réduction", backgroundColor: "#fff8e1", textColor: "#333333", borderColor: "#f9a825" },
  },
  {
    type: "columns",
    label: "Colonnes",
    icon: <Columns className="h-4 w-4" />,
    defaultData: { type: "columns", columns: [{ blocks: [] }, { blocks: [] }], layout: "2" },
  },
  {
    type: "video",
    label: "Vidéo",
    icon: <Play className="h-4 w-4" />,
    defaultData: { type: "video", thumbnailUrl: "", videoUrl: "", alt: "", alignment: "center" },
  },
  {
    type: "hero",
    label: "Hero",
    icon: <LayoutTemplate className="h-4 w-4" />,
    defaultData: { type: "hero", imageUrl: "", title: "Bienvenue", subtitle: "", buttonText: "Découvrir", buttonUrl: "", overlayColor: "rgba(0,0,0,0.4)", textColor: "#ffffff", alignment: "center" },
  },
  {
    type: "menu_highlight",
    label: "Menu vedette",
    icon: <UtensilsCrossed className="h-4 w-4" />,
    defaultData: { type: "menu_highlight", title: "Nos spécialités", items: [{ name: "Plat exemple", description: "Description", price: "12,90 €" }], layout: "list", accentColor: "#FF5722" },
  },
  {
    type: "countdown",
    label: "Compte à rebours",
    icon: <CalendarClock className="h-4 w-4" />,
    defaultData: { type: "countdown", deadlineDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] ?? "", title: "Offre limitée", backgroundColor: "#1a1a1a", textColor: "#ffffff" },
  },
  {
    type: "gallery",
    label: "Galerie",
    icon: <Images className="h-4 w-4" />,
    defaultData: { type: "gallery", images: [], columns: 2, gap: 8 },
  },
  {
    type: "location",
    label: "Localisation",
    icon: <MapPin className="h-4 w-4" />,
    defaultData: { type: "location", address: "", city: "", alignment: "center" },
  },
  {
    type: "hours",
    label: "Horaires",
    icon: <Clock className="h-4 w-4" />,
    defaultData: { type: "hours", title: "Nos horaires", rows: [{ day: "Lundi - Vendredi", hours: "11h00 - 22h00" }, { day: "Samedi - Dimanche", hours: "10h00 - 23h00" }], accentColor: "#FF5722" },
  },
  {
    type: "testimonial",
    label: "Témoignage",
    icon: <Quote className="h-4 w-4" />,
    defaultData: { type: "testimonial", quote: "Un excellent restaurant !", author: "Client satisfait", rating: 5, backgroundColor: "#f9fafb", textColor: "#333333" },
  },
  {
    type: "decorative_divider",
    label: "Séparateur décoratif",
    icon: <Sparkles className="h-4 w-4" />,
    defaultData: { type: "decorative_divider", style: "dots", color: "#d4d4d8", alignment: "center" },
  },
]

const DEFAULT_PREVIEW_BRANDING: EmailBranding = {
  primaryColor: "#1a1a1a",
  secondaryColor: "#f5f5f5",
  senderName: "Mon Restaurant",
  unsubscribeUrl: "#",
  unsubscribeText: "Se désabonner",
  footerText: "Aperçu — ceci est un rendu de test",
}

export function TemplateEditor({ template, onBack }: TemplateEditorProps) {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()
  const updateMutation = useMutation(api?.emailTemplates?.update)

  const {
    blocks,
    selectedBlockId,
    subject,
    previewText,
    isDirty,
    history,
    load,
    addBlock,
    removeBlock,
    moveBlock,
    duplicateBlock,
    insertBlockAfter,
    selectBlock,
    clearSelection,
    setSubject,
    setPreviewText,
    undo,
  } = useEmailTemplateEditorStore()

  const [isSaving, setIsSaving] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [previewMode, setPreviewMode] = useState<"editor" | "html">("editor")

  // Load template data into store on mount
  useEffect(() => {
    load({
      blocks: template.blocks ?? [],
      subject: template.subject ?? "",
      previewText: template.previewText ?? "",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template._id])

  const handleAddBlock = (palette: typeof BLOCK_PALETTE[0]) => {
    const block = { ...palette.defaultData, id: generateId() } as EditorBlock
    addBlock(block)
    selectBlock(block.id)
  }

  const handleSave = async () => {
    if (!storeId) return
    setIsSaving(true)
    try {
      await updateMutation({
        id: template._id,
        blocks,
        subject,
        previewText: previewText || undefined,
      })
      toast.success("Modèle sauvegardé")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur inconnue"
      toast.error(`Échec de la sauvegarde : ${message}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Drag-and-drop reorder
  const handleDragStart = (index: number) => setDraggedIndex(index)
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }
  const handleDrop = (toIndex: number) => {
    if (draggedIndex !== null && draggedIndex !== toIndex) {
      moveBlock(draggedIndex, toIndex)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Top toolbar */}
      <div className="flex items-center gap-3 border-b px-4 py-2.5 bg-background">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Retour
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex-1 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Label htmlFor="subject" className="whitespace-nowrap text-xs text-muted-foreground">
              Objet :
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet de l'email..."
              className="h-8 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Label htmlFor="preview-text" className="whitespace-nowrap text-xs text-muted-foreground">
              Aperçu :
            </Label>
            <Input
              id="preview-text"
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              placeholder="Texte d'aperçu..."
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={previewMode === "editor" ? "outline" : "default"}
            size="sm"
            onClick={() => setPreviewMode(previewMode === "editor" ? "html" : "editor")}
            title={previewMode === "editor" ? "Aperçu HTML" : "Retour éditeur"}
          >
            {previewMode === "editor" ? (
              <>
                <Eye className="mr-1 h-4 w-4" />
                Aperçu
              </>
            ) : (
              <>
                <Pencil className="mr-1 h-4 w-4" />
                Éditeur
              </>
            )}
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={history.length === 0}
            title="Annuler (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          {isDirty && (
            <span className="text-xs text-muted-foreground">Modifications non sauvegardées</span>
          )}
          <Button size="sm" onClick={handleSave} disabled={isSaving || !isDirty}>
            {isSaving ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: block palette */}
        <aside className="w-48 shrink-0 border-r overflow-y-auto bg-muted/30">
          <div className="p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Blocs
            </p>
            <div className="space-y-1.5">
              {BLOCK_PALETTE.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleAddBlock(item)}
                  className="flex w-full items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-accent hover:border-primary/50 transition-colors"
                >
                  <span className="min-w-[20px] text-muted-foreground">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Center panel: email preview / canvas */}
        <main
          className="flex-1 overflow-y-auto bg-muted/20 p-6"
          onClick={(e) => {
            if (previewMode === "editor" && e.target === e.currentTarget) clearSelection()
          }}
        >
          {previewMode === "html" ? (
            <div className="mx-auto max-w-xl">
              <iframe
                title="Aperçu email HTML"
                srcDoc={renderTemplateToEmailHtml(
                  blocks as EmailBlock[],
                  DEFAULT_PREVIEW_BRANDING
                )}
                className="w-full rounded-lg border shadow-sm bg-white"
                style={{ height: "calc(100vh - 10rem)", border: "none" }}
              />
            </div>
          ) : (
            <div className="mx-auto max-w-xl bg-background rounded-lg shadow-sm border min-h-64">
              {blocks.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-center text-sm text-muted-foreground">
                  <div>
                    <p className="font-medium">Aucun bloc</p>
                    <p className="text-xs mt-1">Cliquez sur un bloc dans le panneau gauche pour l&apos;ajouter</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-0 p-3 group">
                  {blocks.map((block, index) => (
                    <div key={block.id}>
                      <div
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={() => handleDrop(index)}
                        className={`relative flex items-start gap-1 group/block transition-all ${
                          dragOverIndex === index ? "border-t-2 border-primary" : ""
                        }`}
                      >
                        {/* Drag handle */}
                        <div className="mt-2 cursor-grab opacity-0 group-hover/block:opacity-50 shrink-0">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <BlockPreview
                            block={block}
                            isSelected={block.id === selectedBlockId}
                            onClick={() => selectBlock(block.id)}
                          />
                        </div>
                        {/* Action buttons */}
                        <div className="mt-1.5 shrink-0 flex flex-col gap-0.5 opacity-0 group-hover/block:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => duplicateBlock(block.id)}
                            className="rounded p-px text-muted-foreground hover:text-primary"
                            title="Dupliquer"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeBlock(block.id)}
                            className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                            title="Supprimer"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Add block button at the end */}
                  <div className="flex justify-center pt-3 pb-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-1.5 rounded-full border border-dashed border-muted-foreground/40 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Ajouter un bloc
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-52 p-2" align="center">
                        <div className="space-y-0.5 max-h-64 overflow-y-auto">
                          {BLOCK_PALETTE.map((item) => (
                            <button
                              key={item.type}
                              type="button"
                              onClick={() => handleAddBlock(item)}
                              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent transition-colors"
                            >
                              <span className="text-muted-foreground">{item.icon}</span>
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Right panel: config */}
        <aside className="w-64 shrink-0 border-l overflow-y-auto bg-background">
          <BlockConfigPanel />
        </aside>
      </div>
    </div>
  )
}
