"use client"

import { buildBrandingCss } from "@be-in-digital/ui/branding"

import { useAdminStore } from "../hooks/admin-hooks"

/**
 * The administered establishment's own colours, on the dashboard.
 *
 * WHAT WAS BROKEN. `buildBrandingCss` has always derived the dashboard's
 * tokens. It emits `--sidebar-primary` and its label, `--sidebar-accent` and
 * `--sidebar-ring`, and `--chart-1`, whose comment in
 * `packages/ui/src/lib/branding.ts` says what that one is for in so many words:
 * "so the dashboard's first series follows the brand instead of staying orange
 * under a red one". Nothing ever mounted the stylesheet on an admin page.
 * `StoreTheme` is rendered from `(storefront)/layout.tsx` and
 * `(auth)/layout.tsx`; the admin layout had no counterpart. So an owner who
 * picked `#d32f2f` in Design got a red shop and a dashboard still painted the
 * engine's orange — the deriver was writing sidebar tokens nobody received.
 *
 * NO `scopes`, AND THAT IS THE WHOLE DIFFERENCE FROM THE STOREFRONT. The
 * storefront palette is declared on `.storefront-theme`, a `<div>` in the
 * shell, so `StoreTheme` must name that element or the shell's own declaration
 * wins on the element it sits on — that is #410, and `STOREFRONT_SCOPES` is its
 * fix. The dashboard's tokens, the sidebar block included, are declared on
 * `:root` and `.dark`, which is exactly what `buildBrandingCss` targets by
 * default. Passing a scope here would aim the stylesheet at an element the
 * admin never renders.
 *
 * WHICH ESTABLISHMENT. `useAdminStore`, not the storefront's `useStoreId`: the
 * dashboard follows the establishment being ADMINISTERED, the same one the
 * sidebar already takes its logo and brand name from. Changing store in the
 * selector therefore repaints, and that is the point rather than a side effect
 * — on a multi-store account the colour is what says which restaurant you are
 * editing.
 *
 * WHY NO `initialCss`. The storefront needs a server-resolved starting point
 * because a diner would otherwise watch the engine palette repaint into the
 * establishment's after hydration. The admin renders behind `AuthGuard` and
 * shows nothing until the session resolves, so there is no first paint to
 * protect.
 *
 * `dangerouslySetInnerHTML` is how a stylesheet reaches the DOM; what makes it
 * safe is that `buildBrandingCss` never interpolates a stored string — see the
 * injection note in `packages/ui/src/lib/branding.ts`.
 */
export function AdminTheme() {
  const store = useAdminStore()

  // `null` until the store list lands, and `""` for an establishment that set
  // no colours. Both render nothing rather than a rule that restates the
  // defaults.
  const css = store ? buildBrandingCss(store.branding) : ""
  if (!css) return null

  return <style data-admin-theme="" dangerouslySetInnerHTML={{ __html: css }} />
}
