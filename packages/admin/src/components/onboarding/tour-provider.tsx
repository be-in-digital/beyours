"use client"

import { useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { TourProvider as ReactourProvider, useTour } from "@reactour/tour"
import { useAdminAuthStore } from "../../stores/admin-auth-store"
import { useOptionalSidebar } from "@be-in-digital/ui"
import { TOUR_STEPS, setTourNavigate } from "./tour-steps"

const STORAGE_PREFIX = "bid-tour-"
const AUTO_LAUNCH_DELAY_MS = 1200

function hasCompletedTour(userId: string): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${userId}`) === "done"
  } catch {
    return false
  }
}

function markTourCompleted(userId: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, "done")
  } catch {
    // silently ignore
  }
}

/**
 * Inner component that auto-launches the tour, manages sidebar state,
 * and registers the Next.js router for page navigation during the tour.
 */
function TourAutoLauncher() {
  const { setIsOpen, isOpen, currentStep } = useTour()
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

  // Auto-launch on first visit
  useEffect(() => {
    if (!isAuthenticated || isAuthLoading || !user?.id) return

    const timeout = setTimeout(() => {
      if (!hasCompletedTour(user.id)) {
        setIsOpen(true)
      }
    }, AUTO_LAUNCH_DELAY_MS)

    return () => clearTimeout(timeout)
  }, [isAuthenticated, isAuthLoading, user?.id, setIsOpen])

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

  const handleClose = useCallback(() => {
    if (user?.id) {
      markTourCompleted(user.id)
    }
  }, [user?.id])

  return (
    <ReactourProvider
      steps={TOUR_STEPS}
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
