"use client"

import { CircleHelp } from "lucide-react"
import { useTour } from "@reactour/tour"
import { SidebarMenuButton } from "../../ui/sidebar"
import { useAdminAuthStore } from "../../stores/admin-auth-store"
import { clearTourSeen } from "./tour-provider"

/**
 * Button in sidebar footer to replay the onboarding tour.
 */
export function ReplayTourButton() {
  const { setIsOpen, setCurrentStep } = useTour()
  const user = useAdminAuthStore((s) => s.user)

  const handleReplay = () => {
    // This account's flag, and only this one. It used to loop over every
    // `bid-tour-*` key in localStorage under a comment claiming otherwise, so
    // one person replaying the tour on the back-office tablet re-armed the
    // auto-launch for every colleague who had ever signed in on it.
    if (user?.id) clearTourSeen(user.id)

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
