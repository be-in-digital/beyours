"use client"

import type { StoreBranding } from "@be-yours/convex-schema"
import { buildBrandingCss } from "@be-yours/ui/branding"

import { cn } from "../../lib/utils"

/**
 * What the diner will see, shown next to the controls that decide it.
 *
 * The Design screen used to be three colour inputs and a save button, with no
 * way to tell what any of it did — and for as long as nothing read
 * `stores.branding` back, the honest answer was "nothing". Now that
 * `StoreTheme` paints the storefront with these values, the same derivation
 * renders here, scoped to this box: same function, same tokens, so the preview
 * cannot drift from the page it is previewing.
 *
 * The scope is what makes it a preview rather than a repaint. `:root` would
 * retint the whole administration while an owner is still choosing; the
 * attribute selector keeps it inside this card, in dark mode as in light.
 */
const SELECTOR = "[data-branding-preview]"

export function BrandingPreview({
  branding,
  className,
}: {
  branding: StoreBranding
  className?: string
}) {
  const css = buildBrandingCss(branding, {
    selector: SELECTOR,
    darkSelector: `.dark ${SELECTOR}`,
  })

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground">
        Aperçu — ce que voit un client
      </p>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <div
        data-branding-preview=""
        className="overflow-hidden rounded-xl border border-border/50 bg-background"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/50 bg-secondary px-4 py-3">
          <span className="font-heading text-sm font-semibold text-secondary-foreground">
            Votre établissement
          </span>
          <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground">
            Ouvert
          </span>
        </div>
        <div className="space-y-3 p-4">
          <p className="font-heading text-lg font-semibold text-foreground">
            Menu du jour
          </p>
          {/*
            `font-sans` is load-bearing, not decoration. The body font is set on
            `<body>`, so scoping `--brand-font-body` to this card changes nothing
            by inheritance — the preview claimed to show the body font and showed
            the administration's. The utility resolves
            `var(--brand-font-body, …)`, which the scoped variable does answer.
          */}
          <p className="font-sans text-sm text-muted-foreground">
            Le texte courant de votre carte s&apos;affiche dans la police du corps.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-sans inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              Commander
            </span>
            <span className="font-sans inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground">
              Voir la carte
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
