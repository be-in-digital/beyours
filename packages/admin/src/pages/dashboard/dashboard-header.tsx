"use client"

import { useAdminAuthStore } from "../../stores/admin-auth-store"
import { useStoreStore } from "@beindigital-engine/restaurant"

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Bonjour"
  if (hour < 18) return "Bon après-midi"
  return "Bonsoir"
}

function getFormattedDate(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date())
}

export function DashboardHeader() {
  const user = useAdminAuthStore((s) => s.user)
  const currentStore = useStoreStore((s) => s.currentStore)

  const firstName = user?.name?.split(" ")[0] ?? ""

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">
        {getGreeting()}
        {firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="text-muted-foreground mt-0.5 text-sm">
        {getFormattedDate()}
        {currentStore?.name && (
          <span className="text-foreground/50"> · {currentStore.name}</span>
        )}
      </p>
    </div>
  )
}
