"use client"

import type { EditorBlock } from "../../../stores/email-template-editor-store"

interface BlockPreviewProps {
  block: EditorBlock
  isSelected: boolean
  onClick: () => void
}

const ALIGNMENT_CLASS: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
}

export function BlockPreview({ block, isSelected, onClick }: BlockPreviewProps) {
  const wrapperClass = `relative cursor-pointer rounded border transition-colors ${
    isSelected
      ? "border-primary ring-1 ring-primary"
      : "border-transparent hover:border-border"
  }`

  const renderContent = () => {
    switch (block.type) {
      case "text":
        return (
          <div className={`p-3 text-sm whitespace-pre-wrap ${ALIGNMENT_CLASS[block.alignment ?? "left"]}`}>
            {block.content || <em className="text-muted-foreground">Bloc texte vide...</em>}
          </div>
        )

      case "image":
        return (
          <div className={`p-2 ${ALIGNMENT_CLASS[block.alignment ?? "center"]}`}>
            {block.url ? (
              <img
                src={block.url}
                alt={block.alt ?? ""}
                className="inline-block max-h-48 object-contain rounded"
                style={{ width: block.width ? `${block.width}%` : "auto", maxWidth: "100%" }}
              />
            ) : (
              <div className="h-20 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                Image (URL vide)
              </div>
            )}
          </div>
        )

      case "button":
        return (
          <div className={`p-3 ${ALIGNMENT_CLASS[block.alignment ?? "center"]}`}>
            <span
              className="inline-block px-6 py-2.5 rounded text-sm font-medium"
              style={{
                backgroundColor: block.backgroundColor ?? "#000000",
                color: block.textColor ?? "#ffffff",
              }}
            >
              {block.text || "Bouton"}
            </span>
          </div>
        )

      case "product":
        return (
          <div className="p-3">
            <div
              className={`grid gap-2 ${
                block.layout === "grid" ? "grid-cols-2" : "grid-cols-1"
              }`}
            >
              {(block.productIds.length > 0 ? block.productIds : ["placeholder"]).map((id) => (
                <div key={id} className="flex items-center gap-2 rounded border border-dashed p-2">
                  <div className="h-8 w-8 shrink-0 rounded bg-muted" />
                  <span className="text-xs text-muted-foreground">
                    Produit #{id.slice(0, 6)}...
                  </span>
                </div>
              ))}
            </div>
            {block.productIds.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-1">
                Aucun produit sélectionné
              </p>
            )}
          </div>
        )

      case "divider":
        return (
          <div className="px-4 py-2">
            <hr
              style={{
                borderColor: block.color ?? "#e5e7eb",
                borderTopWidth: block.thickness ?? 1,
              }}
            />
          </div>
        )

      case "spacer":
        return (
          <div
            style={{ height: block.height ?? 24 }}
            className="flex items-center justify-center"
          >
            <span className="text-xs text-muted-foreground/50">
              Espace ({block.height ?? 24}px)
            </span>
          </div>
        )

      case "heading": {
        const sizes = { h1: "text-2xl", h2: "text-xl", h3: "text-lg" } as const
        const sizeClass = sizes[block.level]
        const headingStyle = block.color ? { color: block.color } : undefined
        const content = block.content || <em className="text-muted-foreground font-normal">Titre vide...</em>
        return (
          <div className={`p-3 ${ALIGNMENT_CLASS[block.alignment ?? "left"]}`}>
            {block.level === "h1" && <h1 className={`font-bold ${sizeClass}`} style={headingStyle}>{content}</h1>}
            {block.level === "h2" && <h2 className={`font-bold ${sizeClass}`} style={headingStyle}>{content}</h2>}
            {block.level === "h3" && <h3 className={`font-bold ${sizeClass}`} style={headingStyle}>{content}</h3>}
          </div>
        )
      }

      case "social": {
        const PLATFORM_COLORS: Record<string, string> = {
          facebook: "#1877F2",
          instagram: "#E4405F",
          tiktok: "#000000",
          twitter: "#1DA1F2",
          youtube: "#FF0000",
          website: "#333333",
        }
        return (
          <div className={`p-3 ${ALIGNMENT_CLASS[block.alignment ?? "center"]}`}>
            {block.links.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Aucun réseau social configuré</p>
            ) : (
              <div className="flex flex-wrap gap-3 justify-center">
                {block.links.map((link, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-sm font-medium"
                    style={{ color: PLATFORM_COLORS[link.platform] ?? "#333" }}
                  >
                    {link.platform}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      }

      case "coupon":
        return (
          <div className="p-3">
            <div
              className="rounded-lg border-2 border-dashed p-4 text-center"
              style={{
                backgroundColor: block.backgroundColor ?? "#fff8e1",
                borderColor: block.borderColor ?? "#f9a825",
                color: block.textColor ?? "#333333",
              }}
            >
              {block.description && (
                <p className="text-sm mb-1">{block.description}</p>
              )}
              <p className="text-xl font-bold tracking-widest font-mono">{block.code}</p>
            </div>
          </div>
        )

      case "columns":
        return (
          <div className="p-3">
            <div className={`grid gap-2 ${block.layout === "3" ? "grid-cols-3" : "grid-cols-2"}`}>
              {block.columns.map((col, i) => (
                <div key={i} className="rounded border border-dashed p-2 min-h-[3rem]">
                  {col.blocks.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Colonne {i + 1} (vide)</p>
                  ) : (
                    <div className="space-y-1">
                      {col.blocks.map((child) => (
                        <div key={child.id} className="text-xs text-muted-foreground border-b border-dashed pb-1 last:border-0">
                          {child.type === "text" && (child.content || "Texte vide")}
                          {child.type === "heading" && (child.content || "Titre vide")}
                          {child.type === "image" && (child.url ? "Image" : "Image (vide)")}
                          {child.type === "button" && (child.text || "Bouton")}
                          {child.type === "divider" && "──────"}
                          {child.type === "spacer" && `Espace (${child.height ?? 24}px)`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )

      case "video":
        return (
          <div className={`p-3 ${ALIGNMENT_CLASS[block.alignment ?? "center"]}`}>
            {block.thumbnailUrl ? (
              <div className="relative inline-block">
                <img
                  src={block.thumbnailUrl}
                  alt={block.alt ?? "Vidéo"}
                  className="inline-block max-h-48 object-contain rounded"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-12 w-12 rounded-full bg-black/60 flex items-center justify-center">
                    <span className="text-white text-lg ml-0.5">&#9654;</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-32 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                Vidéo (aucune miniature)
              </div>
            )}
          </div>
        )

      case "hero":
        return (
          <div className="relative overflow-hidden rounded">
            {block.imageUrl ? (
              <div
                className="relative h-40 bg-cover bg-center flex items-center justify-center"
                style={{ backgroundImage: `url(${block.imageUrl})` }}
              >
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: block.overlayColor ?? "rgba(0,0,0,0.4)" }}
                />
                <div className={`relative z-10 p-4 ${ALIGNMENT_CLASS[block.alignment ?? "center"]}`}>
                  <p className="text-lg font-bold" style={{ color: block.textColor ?? "#ffffff" }}>{block.title}</p>
                  {block.subtitle && (
                    <p className="text-sm mt-1" style={{ color: block.textColor ?? "#ffffff" }}>{block.subtitle}</p>
                  )}
                  {block.buttonText && (
                    <span className="inline-block mt-2 px-4 py-1.5 bg-white text-gray-800 text-xs font-medium rounded">
                      {block.buttonText}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-40 bg-muted flex items-center justify-center text-sm text-muted-foreground">
                Hero (aucune image)
              </div>
            )}
          </div>
        )

      case "menu_highlight":
        return (
          <div className="p-3">
            {block.title && (
              <p className="font-bold text-sm mb-2">{block.title}</p>
            )}
            {block.items.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Aucun plat ajouté</p>
            ) : (
              <div className={block.layout === "grid" ? "grid grid-cols-2 gap-2" : "space-y-2"}>
                {block.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border border-dashed p-2">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="h-10 w-10 rounded object-cover shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.name}</p>
                      {item.description && (
                        <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
                      )}
                    </div>
                    <span className="text-xs font-bold shrink-0" style={{ color: block.accentColor ?? "#FF5722" }}>
                      {item.price}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case "countdown": {
        let formattedDate = block.deadlineDate
        try {
          const date = new Date(block.deadlineDate + "T23:59:59")
          formattedDate = date.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        } catch {
          // keep raw
        }
        return (
          <div className="p-3">
            <div
              className="rounded-lg p-4 text-center"
              style={{
                backgroundColor: block.backgroundColor ?? "#1a1a1a",
                color: block.textColor ?? "#ffffff",
              }}
            >
              <p className="text-xs uppercase tracking-widest mb-1">{block.title ?? "Offre limitée"}</p>
              <p className="text-sm font-bold">Valable jusqu&apos;au {formattedDate}</p>
            </div>
          </div>
        )
      }

      case "gallery":
        return (
          <div className="p-3">
            {block.images.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center">Aucune image dans la galerie</p>
            ) : (
              <div className={`grid gap-1.5 ${block.columns === 3 ? "grid-cols-3" : block.columns === 4 ? "grid-cols-4" : "grid-cols-2"}`}>
                {block.images.map((img, i) => (
                  <div key={i} className="aspect-square rounded bg-muted overflow-hidden">
                    {img.url ? (
                      <img src={img.url} alt={img.alt ?? ""} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">Image</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case "location":
        return (
          <div className={`p-3 ${ALIGNMENT_CLASS[block.alignment ?? "center"]}`}>
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{block.address || <em className="text-muted-foreground font-normal">Adresse...</em>}</p>
              {block.city && <p className="text-xs text-muted-foreground">{block.city}</p>}
              {block.phone && <p className="text-xs text-muted-foreground">{block.phone}</p>}
              {block.email && <p className="text-xs text-muted-foreground">{block.email}</p>}
              {block.mapUrl && <p className="text-xs text-primary">Voir sur la carte</p>}
            </div>
          </div>
        )

      case "hours":
        return (
          <div className="p-3">
            {block.title && <p className="font-bold text-sm mb-2">{block.title}</p>}
            {block.rows.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Aucun horaire configuré</p>
            ) : (
              <div className="space-y-1">
                {block.rows.map((row, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="font-medium">{row.day}</span>
                    <span style={{ color: block.accentColor ?? "#FF5722" }}>{row.hours}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case "testimonial":
        return (
          <div className="p-3">
            <div
              className="rounded-lg p-3 border-l-4"
              style={{
                backgroundColor: block.backgroundColor ?? "#f9fafb",
                borderLeftColor: block.textColor ?? "#333333",
              }}
            >
              {block.rating && (
                <p className="text-sm mb-1">
                  {"★".repeat(Math.min(block.rating, 5))}
                  {"☆".repeat(Math.max(0, 5 - block.rating))}
                </p>
              )}
              <p className="text-sm italic" style={{ color: block.textColor ?? "#333333" }}>
                &ldquo;{block.quote}&rdquo;
              </p>
              <p className="text-xs mt-1.5 font-medium" style={{ color: block.textColor ?? "#333333" }}>
                — {block.author}
              </p>
            </div>
          </div>
        )

      case "decorative_divider": {
        const PATTERNS: Record<string, string> = {
          dots: "• • • • • • • • •",
          stars: "✦ ✦ ✦ ✦ ✦",
          wave: "〰〰〰〰〰〰〰",
          diamond: "◆ ◇ ◆ ◇ ◆ ◇ ◆",
        }
        return (
          <div className={`py-2 px-4 ${ALIGNMENT_CLASS[block.alignment ?? "center"]}`}>
            <span className="text-sm tracking-widest" style={{ color: block.color ?? "#d4d4d8" }}>
              {PATTERNS[block.style] ?? PATTERNS.dots}
            </span>
          </div>
        )
      }

      default:
        return null
    }
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

  return (
    <div className={wrapperClass} onClick={onClick}>
      <div className="absolute -top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="rounded bg-muted-foreground/70 px-1 py-px text-[9px] font-medium text-white">
          {BLOCK_TYPE_LABELS[block.type] ?? block.type}
        </span>
      </div>
      {renderContent()}
    </div>
  )
}
