"use client"

import { useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { TourProvider as ReactourProvider, useTour } from "@reactour/tour"
import type { Role } from "@be-in-digital/core"
import { useAdminStoreSelection, type StoreDoc } from "@be-in-digital/restaurant"
import { useAdminAuthStore } from "../../stores/admin-auth-store"
import { useAdminApiStore } from "../../stores/admin-api-store"
import { useOptionalSidebar } from "@be-in-digital/ui"
import { canRoleSeeNavHref } from "../../config/nav-config"
import { resolveStoreSelection } from "../store-selection"
import { hasSeenTour, markTourSeen } from "./tour-storage"
import { tourStepsFor, setTourNavigate } from "./tour-steps"

const AUTO_LAUNCH_DELAY_MS = 1200

/**
 * Whether to open the tour unasked.
 *
 * A predicate rather than a tangle of early returns inside the effect, so the
 * rule can be tested. The first version of this was asserted at by grepping
 * the provider's source for `resolveStoreSelection`, which passes just as
 * happily when the comparison is inverted.
 */
export function shouldOfferTour(state: {
  isAuthenticated: boolean
  isAuthLoading: boolean
  userId: string | null | undefined
  /** `undefined` while `stores.listAll` is still in flight. */
  stores: readonly { _id: string }[] | undefined
  selectedStoreId: string | null
  alreadySeen: boolean
}): boolean {
  if (!state.isAuthenticated || state.isAuthLoading || !state.userId) return false
  if (state.alreadySeen) return false

  // `StoreGuard` replaces the body of every admin page except Établissements,
  // Paramètres and Équipe with "Aucun établissement — Créez votre premier
  // établissement." A brand-new owner has none, and they are precisely who
  // this tour opens for: it used to walk them through twenty screens of empty
  // state while describing charts, tickets and stock levels that were not on
  // screen. `pending` is not `empty` — an undecided list must not launch it
  // either.
  const decision = resolveStoreSelection({
    storeId: state.selectedStoreId,
    stores: state.stores,
  })
  return decision.status !== "empty" && decision.status !== "pending"
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
   * Which establishments THIS ACCOUNT holds.
   *
   * Not "does the deployment have one": `stores.listAll` is wrapped in
   * `authedQuery` + `requireStaff`, and only `super_admin` sees every store —
   * a `client_admin` owner gets the ones on their own `storeIds`. That is the
   * same answer `StoreGuard` acts on, which is what makes the two agree.
   *
   * The skip sentinel is the SECOND argument. `useQuery(x)` with `x` the
   * string `"skip"` does not skip — `convex/react` reads skip from `args[0]`
   * and would turn the string into a function reference and subscribe to it.
   * Convex de-duplicates this subscription with `StoreGuard`'s, so asking here
   * costs nothing extra.
   */
  const api = useAdminApiStore((s) => s.api) as Record<string, Record<string, unknown>> | null
  const storesQuery = api?.stores?.listAll
  const stores = useQuery(
    (storesQuery ?? "skip") as never,
    storesQuery ? {} : "skip"
  ) as StoreDoc[] | undefined
  const selectedStoreId = useAdminStoreSelection((s) => s.storeId)

  const offer = shouldOfferTour({
    isAuthenticated,
    isAuthLoading,
    userId: user?.id,
    stores,
    selectedStoreId,
    alreadySeen: user?.id ? hasSeenTour(user.id) : true,
  })

  useEffect(() => {
    if (!offer) return
    const timeout = setTimeout(() => {
      setCurrentStep(0)
      setIsOpen(true)
    }, AUTO_LAUNCH_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [offer, setIsOpen, setCurrentStep])

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
