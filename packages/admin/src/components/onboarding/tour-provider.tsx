"use client"

import { useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { TourProvider as ReactourProvider, useTour } from "@reactour/tour"
import type { Role } from "@be-in-digital/core"
import { useAdminStoreSelection, type StoreDoc } from "@be-in-digital/restaurant"
import { useAdminAuthStore } from "../../stores/admin-auth-store"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useOptionalSidebar } from "../../ui/sidebar"
import { canRoleSeeNavHref } from "../../config/nav-config"
import { resolveStoreSelection } from "../store-selection"
import { tourStepsFor, setTourNavigate } from "./tour-steps"

const STORAGE_PREFIX = "bid-tour-"
const AUTO_LAUNCH_DELAY_MS = 1200

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

/**
 * Whether this account has already been offered the tour.
 *
 * `seenInSession` is the fallback for a browser that refuses storage — private
 * mode, or a locked-down kiosk. Without it `hasSeenTour` answered `false` on
 * every throw, and the tour reopened 1.2 s after every page load with a mask
 * that swallows clicks. The module-level set does not survive a reload, but it
 * does hold within a session, which is the difference between "asked once" and
 * "unusable".
 */
const seenInSession = new Set<string>()

function hasSeenTour(userId: string): boolean {
  if (seenInSession.has(userId)) return true
  try {
    return localStorage.getItem(storageKey(userId)) === "done"
  } catch {
    return false
  }
}

function markTourSeen(userId: string): void {
  seenInSession.add(userId)
  try {
    localStorage.setItem(storageKey(userId), "done")
  } catch {
    // A browser that refuses storage still gets the in-memory guard above.
  }
}

/** Forget this account's completion, so the tour can be replayed. */
export function clearTourSeen(userId: string): void {
  seenInSession.delete(userId)
  try {
    localStorage.removeItem(storageKey(userId))
  } catch {
    // silently ignore
  }
}

/**
 * Auto-launches the tour, keeps the sidebar open, and lends the tour the
 * Next.js router so its steps can change page.
 */
function TourAutoLauncher() {
  const { setIsOpen, setCurrentStep, isOpen, currentStep } = useTour()
  const user = useAdminAuthStore((s) => s.user)
  const isAuthenticated = useAdminAuthStore((s) => s.isAuthenticated)
  const isAuthLoading = useAdminAuthStore((s) => s.isLoading)
  // Nullable: this component mounts above the SidebarProvider in the layout
  const sidebar = useOptionalSidebar()
  const router = useRouter()

  // Register Next.js router for step navigation
  useEffect(() => {
    setTourNavigate((path) => router.push(path))
    return () => setTourNavigate(null)
  }, [router])

  /**
   * Does this deployment have an establishment yet?
   *
   * `StoreGuard` replaces the body of every admin page except Établissements,
   * Paramètres and Équipe with "Aucun établissement — Créez votre premier
   * établissement." A brand-new owner has none, and they are precisely who this
   * tour opens for: it used to walk them through twenty screens of empty state
   * while describing charts, tickets and stock levels that were not on screen.
   * So the offer waits until there is something to show.
   */
  const api = useAdminApiStore((s) => s.api) as Record<string, Record<string, unknown>> | null
  // `as never` rather than `as any`: the Convex API is injected at runtime by
  // the layout's effect, so on the first render `api` is null and this is the
  // "skip" sentinel. Convex de-duplicates the subscription with `StoreGuard`'s,
  // so asking here costs nothing extra.
  const stores = useQuery(
    (api?.stores?.listAll ?? "skip") as never
  ) as StoreDoc[] | undefined
  const storeId = useAdminStoreSelection((s) => s.storeId)
  const hasStore = resolveStoreSelection({ storeId, stores }).status !== "empty"
  const storesResolved = stores !== undefined

  // Auto-launch, once, for an account that can actually use the admin.
  useEffect(() => {
    if (!isAuthenticated || isAuthLoading || !user?.id) return
    if (!storesResolved || !hasStore) return

    const userId = user.id
    const timeout = setTimeout(() => {
      if (!hasSeenTour(userId)) {
        setCurrentStep(0)
        setIsOpen(true)
      }
    }, AUTO_LAUNCH_DELAY_MS)

    return () => clearTimeout(timeout)
  }, [isAuthenticated, isAuthLoading, user?.id, storesResolved, hasStore, setIsOpen, setCurrentStep])

  // Keep sidebar open during tour
  useEffect(() => {
    if (isOpen && sidebar && sidebar.state === "collapsed") {
      sidebar.setOpen(true)
    }
  }, [isOpen, currentStep, sidebar])

  return null
}

/**
 * Onboarding tour provider using @reactour/tour.
 * Wraps children with ReactourProvider and handles auto-launch,
 * persistence, and page navigation.
 */
export function OnboardingTourProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const user = useAdminAuthStore((s) => s.user)
  const role = useAdminAuthStore((s) => s.role)

  /**
   * A step spotlights a sidebar entry, and the sidebar hides what the role may
   * not open. A `kitchen` or `delivery` account sees 3 of the 21 entries — and
   * invitations hand out exactly those roles — so the tour is cut to the menu
   * this particular person has.
   */
  const steps = useMemo(
    () => tourStepsFor((href) => canRoleSeeNavHref(role as Role, href)),
    [role]
  )

  const handleClose = useCallback(() => {
    if (user?.id) {
      markTourSeen(user.id)
    }
  }, [user?.id])

  return (
    <ReactourProvider
      steps={steps}
      scrollSmooth
      showBadge
      showDots={false}
      badgeContent={({ totalSteps, currentStep }) =>
        `${currentStep + 1} / ${totalSteps}`
      }
      onClickClose={({ setIsOpen }) => {
        handleClose()
        setIsOpen(false)
      }}
      beforeClose={() => {
        handleClose()
      }}
      styles={{
        popover: (base) => ({
          ...base,
          borderRadius: "12px",
          padding: "20px",
          maxWidth: "360px",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.15)",
        }),
        badge: (base) => ({
          ...base,
          backgroundColor: "hsl(var(--primary))",
          color: "hsl(var(--primary-foreground))",
          fontSize: "11px",
          fontWeight: 600,
        }),
        controls: (base) => ({
          ...base,
          marginTop: "16px",
        }),
        maskWrapper: (base) => ({
          ...base,
          opacity: 0.5,
        }),
      }}
      padding={{ mask: 6, popover: [8, 12] }}
    >
      <TourAutoLauncher />
      {children}
    </ReactourProvider>
  )
}
