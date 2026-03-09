"use client"

import { useCmsPage } from "@/lib/cms"
import { getPageDefinition } from "@beindigital-engine/cms"

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim()
}

interface PreviewClientProps {
  pageSlug: string
}

export function PreviewClient({ pageSlug }: PreviewClientProps) {
  const { isLoading, block } = useCmsPage(pageSlug, { mode: "preview" })
  const pageDef = getPageDefinition(pageSlug)

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Chargement preview...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Preview banner */}
      <div className="sticky top-0 z-50 bg-yellow-400 text-yellow-900 text-center py-2 text-sm font-medium shadow-sm">
        Mode preview — {pageDef?.label ?? pageSlug}
        {" "}
        <a
          href={`/content/pages/${pageSlug}`}
          className="underline hover:no-underline ml-2"
        >
          Retour a l&apos;editeur
        </a>
      </div>

      {/* Render blocks as preview */}
      <div className="max-w-2xl mx-auto p-8 space-y-8">
        {pageDef ? (
          Object.entries(pageDef.blocks).map(([blockKey, blockDef]) => {
            const b = block(blockKey)
            return (
              <div key={blockKey} className="space-y-4">
                <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider border-b pb-1">
                  {blockDef.label}
                </h2>
                <div className="space-y-3">
                  {Object.entries(blockDef.fields).map(
                    ([fieldKey, fieldDef]) => {
                      const f = b.field(fieldKey)
                      return (
                        <div key={fieldKey} className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            {fieldDef.label}
                          </p>
                          {fieldDef.type === "image" && f.mediaUrl ? (
                            <img
                              src={f.mediaUrl}
                              alt={f.altText ?? fieldDef.label}
                              className="max-h-48 rounded-md border object-contain"
                            />
                          ) : fieldDef.type === "video" && f.embedUrl ? (
                            <p className="text-sm text-blue-600 underline">
                              {f.embedUrl}
                            </p>
                          ) : f.text ? (
                            <p className="text-sm whitespace-pre-wrap">
                              {fieldDef.type === "richtext"
                                ? stripHtml(f.text)
                                : f.text}
                            </p>
                          ) : (
                            <p className="text-sm italic text-muted-foreground">
                              (valeur par defaut du code)
                            </p>
                          )}
                        </div>
                      )
                    },
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <p className="text-center text-muted-foreground">
            Page &quot;{pageSlug}&quot; non trouvee dans le registry.
          </p>
        )}
      </div>
    </div>
  )
}
