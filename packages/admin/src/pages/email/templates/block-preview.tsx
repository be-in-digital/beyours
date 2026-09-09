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
  /*
    The canvas is the EMAIL's, not the admin's, and it is white in both colour
    schemes.

    It used to paint nothing, so every block rendered straight on
    `--background` — near-black in dark mode. That is not what a recipient
    sees: an email client draws these blocks on its own white ground, and the
    colours the blocks carry are chosen for that. The preview was therefore
    wrong exactly where it matters, and measurably so: the social-link labels
    fall back to `#333`, which reads 1.60:1 on the dark admin page and 12.6:1
    on the white one they will actually land on.

    `text-zinc-*` rather than `text-muted-foreground` for the placeholders
    below, for the same reason: a token that inverts with the admin's theme
    cannot be read on a surface that does not.
  */
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
            {block.content || <em className="text-zinc-600">Bloc texte vide...</em>}
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
              <div className="h-20 rounded bg-zinc-100 flex items-center justify-center text-xs text-zinc-600">
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
                  <div className="h-8 w-8 shrink-0 rounded bg-zinc-100" />
                  <span className="text-xs text-zinc-600">
                    Produit #{id.slice(0, 6)}...
                  </span>
                </div>
              ))}
            </div>
            {block.productIds.length === 0 && (
              <p className="text-xs text-zinc-600 text-center mt-1">
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
            <span className="text-xs text-zinc-600">
              Espace ({block.height ?? 24}px)
            </span>
          </div>
        )

      case "heading": {
        const sizes = { h1: "text-2xl", h2: "text-xl", h3: "text-lg" } as const
        const sizeClass = sizes[block.level]
        const headingStyle = block.color ? { color: block.color } : undefined
        const content = block.content || <em className="text-zinc-600 font-normal">Titre vide...</em>
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
              <p className="text-xs text-zinc-600 italic">Aucun réseau social configuré</p>
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
                    <p className="text-xs text-zinc-600 text-center py-2">Colonne {i + 1} (vide)</p>
                  ) : (
                    <div className="space-y-1">
                      {col.blocks.map((child) => (
                        <div key={child.id} className="text-xs text-zinc-600 border-b border-dashed pb-1 last:border-0">
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
              <div className="h-32 rounded bg-zinc-100 flex items-center justify-center text-xs text-zinc-600">
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
                {/* The overlay WRAPS the text it darkens rather than sitting
                    beside it. Rendered identically — `absolute inset-0` with a
                    flex centre — and now the relationship is in the markup: the
                    white title is on the overlay, which is the only thing that
                    makes it readable over a photograph, and neither a reader
                    nor the contrast sweep had any way to see that from two
                    siblings. */}
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  /* 0.6, not 0.4. The scrim is the only thing between a white
                     title and whatever photograph an owner uploads, and at 40 %
                     over a light image it composites to about `#999` — 2.85:1,
                     which is the "looked fine on my test picture" default. At
                     60 % it is `#666` and the title reads 5.74:1 on the
                     brightest image there is. Measured against white because
                     white is the worst case: any darker photo only helps. */
                  style={{ backgroundColor: block.overlayColor ?? "rgba(0,0,0,0.6)" }}
                >
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
              </div>
            ) : (
              <div className="h-40 bg-zinc-100 flex items-center justify-center text-sm text-zinc-600">
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
              <p className="text-xs text-zinc-600 italic">Aucun plat ajouté</p>
            ) : (
              <div className={block.layout === "grid" ? "grid grid-cols-2 gap-2" : "space-y-2"}>
                {block.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border border-dashed p-2">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="h-10 w-10 rounded object-cover shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-zinc-100 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.name}</p>
                      {item.description && (
                        <p className="text-[10px] text-zinc-600 truncate">{item.description}</p>
                      )}
                    </div>
                    <span className="text-xs font-bold shrink-0" style={{ color: block.accentColor ?? "#C2410C" }}>
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
              <p className="text-xs text-zinc-600 italic text-center">Aucune image dans la galerie</p>
            ) : (
              <div className={`grid gap-1.5 ${block.columns === 3 ? "grid-cols-3" : block.columns === 4 ? "grid-cols-4" : "grid-cols-2"}`}>
                {block.images.map((img, i) => (
                  <div key={i} className="aspect-square rounded bg-zinc-100 overflow-hidden">
                    {img.url ? (
                      <img src={img.url} alt={img.alt ?? ""} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-600">Image</div>
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
              <p className="text-sm font-medium">{block.address || <em className="text-zinc-600 font-normal">Adresse...</em>}</p>
              {block.city && <p className="text-xs text-zinc-600">{block.city}</p>}
              {block.phone && <p className="text-xs text-zinc-600">{block.phone}</p>}
              {block.email && <p className="text-xs text-zinc-600">{block.email}</p>}
              {/* An email's link colour, not the admin's: `text-primary` lifts to a
                  light orange in dark mode and this canvas stays white, so the
                  token read 2.58:1 here. */}
              {block.mapUrl && <p className="text-xs text-blue-700 underline">Voir sur la carte</p>}
            </div>
          </div>
        )

      case "hours":
        return (
          <div className="p-3">
            {block.title && <p className="font-bold text-sm mb-2">{block.title}</p>}
            {block.rows.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">Aucun horaire configuré</p>
            ) : (
              <div className="space-y-1">
                {block.rows.map((row, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="font-medium">{row.day}</span>
                    <span style={{ color: block.accentColor ?? "#C2410C" }}>{row.hours}</span>
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
            <span className="text-sm tracking-widest" style={{ color: block.color ?? "#71717B" }}>
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
        <span className="rounded bg-zinc-600 px-1 py-px text-[9px] font-medium text-white">
          {BLOCK_TYPE_LABELS[block.type] ?? block.type}
        </span>
      </div>
      {/* The email's own ground, on its own element and as a plain literal.
          The selection border above has to follow the admin's theme; this must
          not — and a colour reached through a `const` is a colour the contrast
          sweep cannot follow out of the tree. */}
      <div className="bg-white rounded">{renderContent()}</div>
    </div>
  )
}
