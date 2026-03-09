"use client"

import { Users, Send, MousePointerClick, TrendingUp } from "lucide-react"
import { StatCard } from "@beindigital-engine/ui"

interface EmailKpiCardsProps {
  activeSubscribers: number
  pendingSubscribers: number
  campaignsSent: number
  avgOpenRate: number
  avgClickRate: number
}

export function EmailKpiCards({
  activeSubscribers,
  pendingSubscribers,
  campaignsSent,
  avgOpenRate,
  avgClickRate,
}: EmailKpiCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Abonnés actifs"
        value={activeSubscribers.toLocaleString()}
        icon={<Users className="h-5 w-5" />}
        trend={
          pendingSubscribers > 0
            ? undefined
            : undefined
        }
      />
      <StatCard
        label="Campagnes envoyées (30j)"
        value={campaignsSent.toLocaleString()}
        icon={<Send className="h-5 w-5" />}
      />
      <StatCard
        label="Taux d'ouverture moyen"
        value={`${avgOpenRate}%`}
        icon={<TrendingUp className="h-5 w-5" />}
      />
      <StatCard
        label="Taux de clic moyen"
        value={`${avgClickRate}%`}
        icon={<MousePointerClick className="h-5 w-5" />}
      />
    </div>
  )
}
