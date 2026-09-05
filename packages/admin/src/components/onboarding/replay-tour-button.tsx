"use client"

import { CircleHelp } from "lucide-react"
import { useTour } from "@reactour/tour"
import { SidebarMenuButton } from "@be-in-digital/ui"

const STORAGE_PREFIX = "bid-tour-"

/**
 * Button in sidebar footer to replay the onboarding tour.
 */
export function ReplayTourButton() {
  const { setIsOpen, setCurrentStep } = useTour()

  const handleReplay = () => {
    // Clear completion for current user
    try {
      const keys = Object.keys(localStorage)
      for (const key of keys) {
        if (key.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(key)
        }
      }
    } catch {
      // ignore
    }

    setCurrentStep(0)
    setIsOpen(true)
  }

  return (
    <SidebarMenuButton
      onClick={handleReplay}
      tooltip="Revoir la visite"
      className="text-muted-foreground hover:text-foreground"
    >
      <CircleHelp className="size-4" />
      <span>Revoir la visite</span>
    </SidebarMenuButton>
  )
}
