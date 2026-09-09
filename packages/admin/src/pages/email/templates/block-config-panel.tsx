"use client"

import { useCallback } from "react"
import { useQuery, useAction } from "convex/react"
import {
  Button,
  Input,
  Textarea,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@be-in-digital/ui"
import { ImageUploader } from "../../../components/image-uploader"
import type { EditorBlock, ColumnChildBlock } from "../../../stores/email-template-editor-store"
import { useEmailTemplateEditorStore } from "../../../stores/email-template-editor-store"
import { useAdminApiStore } from "../../../stores/admin-api-store"
import { useAdminStoreId } from "../../../hooks/admin-hooks"

type BlockAlignment = "left" | "center" | "right"

export function BlockConfigPanel() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()
  const { blocks, selectedBlockId, updateBlock } = useEmailTemplateEditorStore()

  const block = blocks.find((b) => b.id === selectedBlockId) ?? null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products = useQuery(
    api?.products?.list,
    storeId ? { storeId } : "skip"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any[] | undefined

  // S3 upload via Convex action
  const getPresignedUrl = useAction(api?.storageUpload?.getPresignedUploadUrl ?? "skip" as const)
  const handleRequestUploadUrl = useCallback(
    async (args: { folder: string; contentType: string }) => {
      if (!getPresignedUrl) throw new Error("API non disponible")
      return await getPresignedUrl(args)
    },
    [getPresignedUrl]
  )

  if (!block) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Aucun bloc sélectionné</p>
          <p className="text-xs text-muted-foreground mt-1">
            Cliquez sur un bloc dans la prévisualisation pour le configurer
          </p>
        </div>
      </div>
    )
  }

  const update = (patch: Partial<Omit<EditorBlock, "type" | "id">>) => {
    updateBlock(block.id, patch)
  }

  return (
    <div className="space-y-4 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Configuration : {BLOCK_TYPE_LABELS[block.type] ?? block.type}
      </p>

      {/* Text block */}
      {block.type === "text" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Contenu</Label>
            <Textarea
              value={block.content}
              onChange={(e) => update({ content: e.target.value })}
              placeholder="Tapez votre texte..."
              rows={6}
            />
          </div>
          <AlignmentField value={block.alignment} onChange={(v) => update({ alignment: v })} />
        </div>
      )}

      {/* Image block */}
      {block.type === "image" && (
        <div className="space-y-3">
          <ImageUploader
            value={block.url}
            onChange={(url) => update({ url })}
            onRequestUploadUrl={handleRequestUploadUrl}
            folder="email"
            label="Image"
          />
          <div className="space-y-2">
            <Label>Texte alternatif</Label>
            <Input
              value={block.alt ?? ""}
              onChange={(e) => update({ alt: e.target.value })}
              placeholder="Description de l'image"
            />
          </div>
          <div className="space-y-2">
            <Label>Lien (optionnel)</Label>
            <Input
              value={block.linkUrl ?? ""}
              onChange={(e) => update({ linkUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label>Largeur (%)</Label>
            <Input
              type="number"
              min="10"
              max="100"
              value={block.width ?? 100}
              onChange={(e) => update({ width: Number(e.target.value) })}
            />
          </div>
          <AlignmentField value={block.alignment} onChange={(v) => update({ alignment: v })} />
        </div>
      )}

      {/* Button block */}
      {block.type === "button" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Texte du bouton</Label>
            <Input
              value={block.text}
              onChange={(e) => update({ text: e.target.value })}
              placeholder="Commander maintenant"
            />
          </div>
          <div className="space-y-2">
            <Label>URL de destination</Label>
            <Input
              value={block.url}
              onChange={(e) => update({ url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Couleur du fond</Label>
              <div className="flex gap-2">
                <Input
                  value={block.backgroundColor ?? "#000000"}
                  onChange={(e) => update({ backgroundColor: e.target.value })}
                  className="flex-1"
                />
                <input
                  type="color"
                  value={block.backgroundColor ?? "#000000"}
                  onChange={(e) => update({ backgroundColor: e.target.value })}
                  className="h-10 w-10 cursor-pointer rounded-md border border-input p-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Couleur du texte</Label>
              <div className="flex gap-2">
                <Input
                  value={block.textColor ?? "#ffffff"}
                  onChange={(e) => update({ textColor: e.target.value })}
                  className="flex-1"
                />
                <input
                  type="color"
                  value={block.textColor ?? "#ffffff"}
                  onChange={(e) => update({ textColor: e.target.value })}
                  className="h-10 w-10 cursor-pointer rounded-md border border-input p-1"
                />
              </div>
            </div>
          </div>
          <AlignmentField value={block.alignment} onChange={(v) => update({ alignment: v })} />
        </div>
      )}

      {/* Product block */}
      {block.type === "product" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Mise en page</Label>
            <Select
              value={block.layout ?? "list"}
              onValueChange={(v) => update({ layout: v as "list" | "grid" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">Liste</SelectItem>
                <SelectItem value="grid">Grille (2 colonnes)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Produits sélectionnés ({block.productIds.length})</Label>
            {products === undefined && (
              <p className="text-xs text-muted-foreground">Chargement des produits...</p>
            )}
            {products && products.length === 0 && (
              <p className="text-xs text-muted-foreground">Aucun produit disponible</p>
            )}
            {products && products.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-2">
                {products.map((product: any) => {
                  const isSelected = block.productIds.includes(product._id)
                  return (
                    <label
                      key={product._id}
                      className="flex items-center gap-2 rounded px-2 py-1 cursor-pointer hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          const newIds = isSelected
                            ? block.productIds.filter((id) => id !== product._id)
                            : [...block.productIds, product._id]
                          update({ productIds: newIds })
                        }}
                        className="accent-primary"
                      />
                      <span className="text-sm">{product.name}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Divider block */}
      {block.type === "divider" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="flex gap-2">
              <Input
                value={block.color ?? "#e5e7eb"}
                onChange={(e) => update({ color: e.target.value })}
                className="flex-1"
              />
              <input
                type="color"
                value={block.color ?? "#e5e7eb"}
                onChange={(e) => update({ color: e.target.value })}
                className="h-10 w-10 cursor-pointer rounded-md border border-input p-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Épaisseur (px)</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={block.thickness ?? 1}
              onChange={(e) => update({ thickness: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      {/* Spacer block */}
      {block.type === "spacer" && (
        <div className="space-y-2">
          <Label>Hauteur (px)</Label>
          <Input
            type="number"
            min="4"
            max="200"
            value={block.height ?? 24}
            onChange={(e) => update({ height: Number(e.target.value) })}
          />
        </div>
      )}

      {/* Heading block */}
      {block.type === "heading" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Contenu</Label>
            <Input
              value={block.content}
              onChange={(e) => update({ content: e.target.value })}
              placeholder="Votre titre..."
            />
          </div>
          <div className="space-y-2">
            <Label>Niveau</Label>
            <Select
              value={block.level}
              onValueChange={(v) => update({ level: v as "h1" | "h2" | "h3" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="h1">H1 — Grand titre</SelectItem>
                <SelectItem value="h2">H2 — Sous-titre</SelectItem>
                <SelectItem value="h3">H3 — Section</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="flex gap-2">
              <Input
                value={block.color ?? "#000000"}
                onChange={(e) => update({ color: e.target.value })}
                className="flex-1"
              />
              <input
                type="color"
                value={block.color ?? "#000000"}
                onChange={(e) => update({ color: e.target.value })}
                className="h-10 w-10 cursor-pointer rounded-md border border-input p-1"
              />
            </div>
          </div>
          <AlignmentField value={block.alignment} onChange={(v) => update({ alignment: v })} />
        </div>
      )}

      {/* Social block */}
      {block.type === "social" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Style</Label>
            <Select
              value={block.style ?? "icons"}
              onValueChange={(v) => update({ style: v as "icons" | "text" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="icons">Icônes colorées</SelectItem>
                <SelectItem value="text">Liens texte</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlignmentField value={block.alignment} onChange={(v) => update({ alignment: v })} />
          <div className="space-y-2">
            <Label>Liens ({block.links.length})</Label>
            {block.links.map((link, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input
                  value={link.platform}
                  onChange={(e) => {
                    const newLinks = [...block.links]
                    newLinks[i] = { ...link, platform: e.target.value }
                    update({ links: newLinks })
                  }}
                  placeholder="Plateforme"
                  className="w-24"
                />
                <Input
                  value={link.url}
                  onChange={(e) => {
                    const newLinks = [...block.links]
                    newLinks[i] = { ...link, url: e.target.value }
                    update({ links: newLinks })
                  }}
                  placeholder="https://..."
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newLinks = block.links.filter((_, idx) => idx !== i)
                    update({ links: newLinks })
                  }}
                  className="shrink-0 text-muted-foreground hover:text-destructive text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const newLinks = [...block.links, { platform: "instagram", url: "" }]
                update({ links: newLinks })
              }}
              className="text-xs text-primary-ink hover:underline"
            >
              + Ajouter un lien
            </button>
          </div>
        </div>
      )}

      {/* Coupon block */}
      {block.type === "coupon" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Code promo</Label>
            <Input
              value={block.code}
              onChange={(e) => update({ code: e.target.value })}
              placeholder="PROMO10"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={block.description ?? ""}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="10% de réduction"
            />
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2">
              <Label>Couleur de fond</Label>
              <div className="flex gap-2">
                <Input
                  value={block.backgroundColor ?? "#fff8e1"}
                  onChange={(e) => update({ backgroundColor: e.target.value })}
                  className="flex-1"
                />
                <input
                  type="color"
                  value={block.backgroundColor ?? "#fff8e1"}
                  onChange={(e) => update({ backgroundColor: e.target.value })}
                  className="h-10 w-10 cursor-pointer rounded-md border border-input p-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Couleur du texte</Label>
              <div className="flex gap-2">
                <Input
                  value={block.textColor ?? "#333333"}
                  onChange={(e) => update({ textColor: e.target.value })}
                  className="flex-1"
                />
                <input
                  type="color"
                  value={block.textColor ?? "#333333"}
                  onChange={(e) => update({ textColor: e.target.value })}
                  className="h-10 w-10 cursor-pointer rounded-md border border-input p-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Couleur de bordure</Label>
              <div className="flex gap-2">
                <Input
                  value={block.borderColor ?? "#f9a825"}
                  onChange={(e) => update({ borderColor: e.target.value })}
                  className="flex-1"
                />
                <input
                  type="color"
                  value={block.borderColor ?? "#f9a825"}
                  onChange={(e) => update({ borderColor: e.target.value })}
                  className="h-10 w-10 cursor-pointer rounded-md border border-input p-1"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Columns block */}
      {block.type === "columns" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Disposition</Label>
            <Select
              value={block.layout}
              onValueChange={(v) => {
                const layout = v as "2" | "3"
                const cols = layout === "3"
                  ? [
                      block.columns[0] ?? { blocks: [] },
                      block.columns[1] ?? { blocks: [] },
                      { blocks: [] },
                    ]
                  : block.columns.slice(0, 2).length >= 2
                    ? block.columns.slice(0, 2)
                    : [{ blocks: [] }, { blocks: [] }]
                update({ layout, columns: cols })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 colonnes</SelectItem>
                <SelectItem value="3">3 colonnes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {block.columns.map((col, colIdx) => (
            <div key={colIdx} className="space-y-2 rounded border p-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Colonne {colIdx + 1} ({col.blocks.length} blocs)</Label>
              </div>
              {col.blocks.map((child, childIdx) => (
                <div key={child.id} className="flex items-center gap-1 text-xs bg-muted/50 rounded p-1.5">
                  <span className="flex-1 truncate">{COLUMN_CHILD_LABELS[child.type] ?? child.type}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const newCols = block.columns.map((c, ci) =>
                        ci === colIdx
                          ? { blocks: c.blocks.filter((_, bi) => bi !== childIdx) }
                          : c
                      )
                      update({ columns: newCols })
                    }}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap gap-1">
                {COLUMN_CHILD_TYPES.map((ct) => (
                  <button
                    key={ct.type}
                    type="button"
                    onClick={() => {
                      const newChild = { ...ct.defaults, id: crypto.randomUUID().slice(0, 7) } as ColumnChildBlock
                      const newCols = block.columns.map((c, ci) =>
                        ci === colIdx
                          ? { blocks: [...c.blocks, newChild] }
                          : c
                      )
                      update({ columns: newCols })
                    }}
                    className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-accent transition-colors"
                  >
                    + {ct.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video block */}
      {block.type === "video" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>URL de la vidéo</Label>
            <Input
              value={block.videoUrl}
              onChange={(e) => update({ videoUrl: e.target.value })}
              placeholder="https://youtube.com/watch?v=..."
            />
          </div>
          <ImageUploader
            value={block.thumbnailUrl}
            onChange={(url) => update({ thumbnailUrl: url })}
            onRequestUploadUrl={handleRequestUploadUrl}
            folder="email"
            label="Miniature"
            placeholder="Déposez une miniature ici"
          />
          <div className="space-y-2">
            <Label>Texte alternatif</Label>
            <Input
              value={block.alt ?? ""}
              onChange={(e) => update({ alt: e.target.value })}
              placeholder="Description de la vidéo"
            />
          </div>
          <AlignmentField value={block.alignment} onChange={(v) => update({ alignment: v })} />
        </div>
      )}

      {/* Hero block */}
      {block.type === "hero" && (
        <div className="space-y-3">
          <ImageUploader
            value={block.imageUrl}
            onChange={(url) => update({ imageUrl: url })}
            onRequestUploadUrl={handleRequestUploadUrl}
            folder="email"
            label="Image de fond"
          />
          <div className="space-y-2">
            <Label>Titre</Label>
            <Input
              value={block.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Bienvenue chez nous"
            />
          </div>
          <div className="space-y-2">
            <Label>Sous-titre</Label>
            <Input
              value={block.subtitle ?? ""}
              onChange={(e) => update({ subtitle: e.target.value })}
              placeholder="Découvrez nos spécialités..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Texte du bouton</Label>
              <Input
                value={block.buttonText ?? ""}
                onChange={(e) => update({ buttonText: e.target.value })}
                placeholder="Découvrir"
              />
            </div>
            <div className="space-y-2">
              <Label>URL du bouton</Label>
              <Input
                value={block.buttonUrl ?? ""}
                onChange={(e) => update({ buttonUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Couleur du texte</Label>
            <div className="flex gap-2">
              <Input
                value={block.textColor ?? "#ffffff"}
                onChange={(e) => update({ textColor: e.target.value })}
                className="flex-1"
              />
              <input
                type="color"
                value={block.textColor ?? "#ffffff"}
                onChange={(e) => update({ textColor: e.target.value })}
                className="h-10 w-10 cursor-pointer rounded-md border border-input p-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Overlay</Label>
            <Input
              value={block.overlayColor ?? "rgba(0,0,0,0.4)"}
              onChange={(e) => update({ overlayColor: e.target.value })}
              placeholder="rgba(0,0,0,0.4)"
            />
          </div>
          <AlignmentField value={block.alignment} onChange={(v) => update({ alignment: v })} />
        </div>
      )}

      {/* Menu highlight block */}
      {block.type === "menu_highlight" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Titre de la section</Label>
            <Input
              value={block.title ?? ""}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Nos spécialités"
            />
          </div>
          <div className="space-y-2">
            <Label>Mise en page</Label>
            <Select
              value={block.layout ?? "list"}
              onValueChange={(v) => update({ layout: v as "list" | "grid" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">Liste</SelectItem>
                <SelectItem value="grid">Grille (2 colonnes)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Couleur d&apos;accent</Label>
            <div className="flex gap-2">
              <Input
                value={block.accentColor ?? "#FF5722"}
                onChange={(e) => update({ accentColor: e.target.value })}
                className="flex-1"
              />
              <input
                type="color"
                value={block.accentColor ?? "#FF5722"}
                onChange={(e) => update({ accentColor: e.target.value })}
                className="h-10 w-10 cursor-pointer rounded-md border border-input p-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Plats ({block.items.length})</Label>
            {block.items.map((item, i) => (
              <div key={i} className="space-y-1.5 rounded border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Plat {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const newItems = block.items.filter((_, idx) => idx !== i)
                      update({ items: newItems })
                    }}
                    className="text-muted-foreground hover:text-destructive text-xs"
                  >
                    ✕
                  </button>
                </div>
                <Input
                  value={item.name}
                  onChange={(e) => {
                    const newItems = [...block.items]
                    newItems[i] = { ...item, name: e.target.value }
                    update({ items: newItems })
                  }}
                  placeholder="Nom du plat"
                  className="h-7 text-xs"
                />
                <Input
                  value={item.description ?? ""}
                  onChange={(e) => {
                    const newItems = [...block.items]
                    newItems[i] = { ...item, description: e.target.value }
                    update({ items: newItems })
                  }}
                  placeholder="Description"
                  className="h-7 text-xs"
                />
                <div className="flex gap-2">
                  <Input
                    value={item.price}
                    onChange={(e) => {
                      const newItems = [...block.items]
                      newItems[i] = { ...item, price: e.target.value }
                      update({ items: newItems })
                    }}
                    placeholder="12,90 €"
                    className="h-7 text-xs w-24"
                  />
                  <Input
                    value={item.imageUrl ?? ""}
                    onChange={(e) => {
                      const newItems = [...block.items]
                      newItems[i] = { ...item, imageUrl: e.target.value }
                      update({ items: newItems })
                    }}
                    placeholder="URL image"
                    className="h-7 text-xs flex-1"
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const newItems = [...block.items, { name: "", description: "", price: "", imageUrl: "" }]
                update({ items: newItems })
              }}
              className="w-full text-xs"
            >
              + Ajouter un plat
            </Button>
          </div>
        </div>
      )}

      {/* Gallery block */}
      {block.type === "gallery" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Colonnes</Label>
            <Select
              value={String(block.columns ?? 2)}
              onValueChange={(v) => update({ columns: Number(v) as 2 | 3 | 4 })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 colonnes</SelectItem>
                <SelectItem value="3">3 colonnes</SelectItem>
                <SelectItem value="4">4 colonnes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Espacement (px)</Label>
            <Input
              type="number"
              min="0"
              max="32"
              value={block.gap ?? 8}
              onChange={(e) => update({ gap: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Images ({block.images.length})</Label>
            {block.images.map((img, i) => (
              <div key={i} className="space-y-1.5 rounded border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Image {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const newImages = block.images.filter((_, idx) => idx !== i)
                      update({ images: newImages })
                    }}
                    className="text-muted-foreground hover:text-destructive text-xs"
                  >
                    ✕
                  </button>
                </div>
                <ImageUploader
                  value={img.url}
                  onChange={(url) => {
                    const newImages = [...block.images]
                    newImages[i] = { ...img, url }
                    update({ images: newImages })
                  }}
                  onRequestUploadUrl={handleRequestUploadUrl}
                  folder="email"
                />
                <Input
                  value={img.alt ?? ""}
                  onChange={(e) => {
                    const newImages = [...block.images]
                    newImages[i] = { ...img, alt: e.target.value }
                    update({ images: newImages })
                  }}
                  placeholder="Texte alternatif"
                  className="h-7 text-xs"
                />
                <Input
                  value={img.linkUrl ?? ""}
                  onChange={(e) => {
                    const newImages = [...block.images]
                    newImages[i] = { ...img, linkUrl: e.target.value }
                    update({ images: newImages })
                  }}
                  placeholder="Lien (optionnel)"
                  className="h-7 text-xs"
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const newImages = [...block.images, { url: "", alt: "" }]
                update({ images: newImages })
              }}
              className="w-full text-xs"
            >
              + Ajouter une image
            </Button>
          </div>
        </div>
      )}

      {/* Location block */}
      {block.type === "location" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Adresse</Label>
            <Input
              value={block.address}
              onChange={(e) => update({ address: e.target.value })}
              placeholder="123 Rue de la Paix"
            />
          </div>
          <div className="space-y-2">
            <Label>Ville</Label>
            <Input
              value={block.city ?? ""}
              onChange={(e) => update({ city: e.target.value })}
              placeholder="Paris"
            />
          </div>
          <div className="space-y-2">
            <Label>URL de la carte</Label>
            <Input
              value={block.mapUrl ?? ""}
              onChange={(e) => update({ mapUrl: e.target.value })}
              placeholder="https://maps.google.com/..."
            />
          </div>
          <div className="space-y-2">
            <Label>Téléphone</Label>
            <Input
              value={block.phone ?? ""}
              onChange={(e) => update({ phone: e.target.value })}
              placeholder="+33 1 23 45 67 89"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={block.email ?? ""}
              onChange={(e) => update({ email: e.target.value })}
              placeholder="contact@restaurant.fr"
            />
          </div>
          <AlignmentField value={block.alignment} onChange={(v) => update({ alignment: v })} />
        </div>
      )}

      {/* Hours block */}
      {block.type === "hours" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Titre</Label>
            <Input
              value={block.title ?? ""}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Nos horaires"
            />
          </div>
          <div className="space-y-2">
            <Label>Couleur d&apos;accent</Label>
            <div className="flex gap-2">
              <Input
                value={block.accentColor ?? "#FF5722"}
                onChange={(e) => update({ accentColor: e.target.value })}
                className="flex-1"
              />
              <input
                type="color"
                value={block.accentColor ?? "#FF5722"}
                onChange={(e) => update({ accentColor: e.target.value })}
                className="h-10 w-10 cursor-pointer rounded-md border border-input p-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Horaires ({block.rows.length})</Label>
            {block.rows.map((row, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input
                  value={row.day}
                  onChange={(e) => {
                    const newRows = [...block.rows]
                    newRows[i] = { ...row, day: e.target.value }
                    update({ rows: newRows })
                  }}
                  placeholder="Lundi"
                  className="w-28 h-7 text-xs"
                />
                <Input
                  value={row.hours}
                  onChange={(e) => {
                    const newRows = [...block.rows]
                    newRows[i] = { ...row, hours: e.target.value }
                    update({ rows: newRows })
                  }}
                  placeholder="11h - 22h"
                  className="flex-1 h-7 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newRows = block.rows.filter((_, idx) => idx !== i)
                    update({ rows: newRows })
                  }}
                  className="shrink-0 text-muted-foreground hover:text-destructive text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const newRows = [...block.rows, { day: "", hours: "" }]
                update({ rows: newRows })
              }}
              className="w-full text-xs"
            >
              + Ajouter un créneau
            </Button>
          </div>
        </div>
      )}

      {/* Testimonial block */}
      {block.type === "testimonial" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Citation</Label>
            <Textarea
              value={block.quote}
              onChange={(e) => update({ quote: e.target.value })}
              placeholder="Un excellent restaurant !"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Auteur</Label>
            <Input
              value={block.author}
              onChange={(e) => update({ author: e.target.value })}
              placeholder="Nom du client"
            />
          </div>
          <div className="space-y-2">
            <Label>Note (1-5)</Label>
            <Input
              type="number"
              min="1"
              max="5"
              value={block.rating ?? 5}
              onChange={(e) => update({ rating: Number(e.target.value) })}
            />
          </div>
          <ImageUploader
            value={block.avatarUrl ?? ""}
            onChange={(url) => update({ avatarUrl: url })}
            onRequestUploadUrl={handleRequestUploadUrl}
            folder="email"
            label="Avatar (optionnel)"
            placeholder="Déposez un avatar ici"
          />
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2">
              <Label>Couleur de fond</Label>
              <div className="flex gap-2">
                <Input
                  value={block.backgroundColor ?? "#f9fafb"}
                  onChange={(e) => update({ backgroundColor: e.target.value })}
                  className="flex-1"
                />
                <input
                  type="color"
                  value={block.backgroundColor ?? "#f9fafb"}
                  onChange={(e) => update({ backgroundColor: e.target.value })}
                  className="h-10 w-10 cursor-pointer rounded-md border border-input p-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Couleur du texte</Label>
              <div className="flex gap-2">
                <Input
                  value={block.textColor ?? "#333333"}
                  onChange={(e) => update({ textColor: e.target.value })}
                  className="flex-1"
                />
                <input
                  type="color"
                  value={block.textColor ?? "#333333"}
                  onChange={(e) => update({ textColor: e.target.value })}
                  className="h-10 w-10 cursor-pointer rounded-md border border-input p-1"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decorative divider block */}
      {block.type === "decorative_divider" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Style</Label>
            <Select
              value={block.style}
              onValueChange={(v) => update({ style: v as "dots" | "stars" | "wave" | "diamond" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dots">Points • • •</SelectItem>
                <SelectItem value="stars">Étoiles ✦ ✦ ✦</SelectItem>
                <SelectItem value="wave">Vagues 〰〰〰</SelectItem>
                <SelectItem value="diamond">Losanges ◆ ◇ ◆</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="flex gap-2">
              <Input
                value={block.color ?? "#d4d4d8"}
                onChange={(e) => update({ color: e.target.value })}
                className="flex-1"
              />
              <input
                type="color"
                value={block.color ?? "#d4d4d8"}
                onChange={(e) => update({ color: e.target.value })}
                className="h-10 w-10 cursor-pointer rounded-md border border-input p-1"
              />
            </div>
          </div>
          <AlignmentField value={block.alignment} onChange={(v) => update({ alignment: v })} />
        </div>
      )}

      {/* Countdown block */}
      {block.type === "countdown" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Titre</Label>
            <Input
              value={block.title ?? ""}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Offre limitée"
            />
          </div>
          <div className="space-y-2">
            <Label>Date limite</Label>
            <Input
              type="date"
              value={block.deadlineDate}
              onChange={(e) => update({ deadlineDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Couleur de fond</Label>
            <div className="flex gap-2">
              <Input
                value={block.backgroundColor ?? "#1a1a1a"}
                onChange={(e) => update({ backgroundColor: e.target.value })}
                className="flex-1"
              />
              <input
                type="color"
                value={block.backgroundColor ?? "#1a1a1a"}
                onChange={(e) => update({ backgroundColor: e.target.value })}
                className="h-10 w-10 cursor-pointer rounded-md border border-input p-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Couleur du texte</Label>
            <div className="flex gap-2">
              <Input
                value={block.textColor ?? "#ffffff"}
                onChange={(e) => update({ textColor: e.target.value })}
                className="flex-1"
              />
              <input
                type="color"
                value={block.textColor ?? "#ffffff"}
                onChange={(e) => update({ textColor: e.target.value })}
                className="h-10 w-10 cursor-pointer rounded-md border border-input p-1"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Alignment helper component ───────────────────────────────────────────────

function AlignmentField({
  value,
  onChange,
}: {
  value?: BlockAlignment
  onChange: (v: BlockAlignment) => void
}) {
  return (
    <div className="space-y-2">
      <Label>Alignement</Label>
      <div className="flex gap-2">
        {(["left", "center", "right"] as BlockAlignment[]).map((align) => (
          <button
            key={align}
            type="button"
            onClick={() => onChange(align)}
            className={`flex-1 py-1.5 rounded text-xs border transition-colors ${
              (value ?? "left") === align
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border"
            }`}
          >
            {align === "left" ? "Gauche" : align === "center" ? "Centre" : "Droite"}
          </button>
        ))}
      </div>
    </div>
  )
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  text: "Texte",
  image: "Image",
  button: "Bouton",
  product: "Produit",
  divider: "Séparateur",
  spacer: "Espace",
  heading: "Titre",
  social: "Réseaux sociaux",
  coupon: "Coupon",
  columns: "Colonnes",
  video: "Vidéo",
  hero: "Hero",
  menu_highlight: "Menu vedette",
  countdown: "Compte à rebours",
  gallery: "Galerie",
  location: "Localisation",
  hours: "Horaires",
  testimonial: "Témoignage",
  decorative_divider: "Séparateur décoratif",
}

const COLUMN_CHILD_LABELS: Record<string, string> = {
  text: "Texte",
  image: "Image",
  button: "Bouton",
  heading: "Titre",
  divider: "Séparateur",
  spacer: "Espace",
}

type DistributiveOmitId<T> = T extends ColumnChildBlock ? Omit<T, "id"> : never

const COLUMN_CHILD_TYPES: { type: ColumnChildBlock["type"]; label: string; defaults: DistributiveOmitId<ColumnChildBlock> }[] = [
  { type: "text", label: "Texte", defaults: { type: "text", content: "" } },
  { type: "heading", label: "Titre", defaults: { type: "heading", content: "Titre", level: "h3" } },
  { type: "image", label: "Image", defaults: { type: "image", url: "" } },
  { type: "button", label: "Bouton", defaults: { type: "button", text: "Cliquer", url: "" } },
  { type: "divider", label: "Séparateur", defaults: { type: "divider" } },
  { type: "spacer", label: "Espace", defaults: { type: "spacer", height: 16 } },
]
