"use client"

/**
 * Shown by an admin page while it has no establishment id yet.
 *
 * Every page under `StoreGuard` used to carry its own eight-line block here,
 * telling the reader to "sélectionner un établissement" - an instruction they
 * could not act on and did not need to: the guard does not render a page until
 * a store is selected, so the only way to reach this branch is the brief moment
 * before the selection is read back. Fourteen copies of that message have
 * become one spinner.
 *
 * The three routes the guard deliberately lets through without a store -
 * stores, settings, team - keep a real message of their own.
 */
export function ResolvingStore() {
  return (
    <div className="flex items-center justify-center h-[400px]">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
    </div>
  )
}
