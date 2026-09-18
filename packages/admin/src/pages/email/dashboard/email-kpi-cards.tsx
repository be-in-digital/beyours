"use client"

import { Users, Send, MousePointerClick, TrendingUp } from "lucide-react"
import { StatCard } from "@be-yours/ui"

/**
 * `pendingSubscribers` used to be a prop here and was never rendered: it fed a
 * `trend={pending > 0 ? undefined : undefined}`, both branches of which are
 * nothing. The Abonnés screen is where an owner reads the pending figure, and
 * it says it there.
 */
interface EmailKpiCardsProps {
  activeSubscribers: number
  campaignsSent: number
  avgOpenRate: number
  avgClickRate: number
  /**
   * The subscriber count hit the server's scan ceiling, so it is a floor.
   *
   * `countByStatus` walks `by_storeId_status` up to a cap rather than
   * collecting the mailing list — Convex has no count, and the collect is what
   * used to take this screen down once the list grew. Where the cap is reached
   * the card shows « 2 000+ » instead of presenting a floor as a total.
   */
  subscribersTruncated?: boolean
}

export function EmailKpiCards({
  activeSubscribers,
  campaignsSent,
  avgOpenRate,
  avgClickRate,
  subscribersTruncated = false,
}: EmailKpiCardsProps) {
  const suffix = subscribersTruncated ? "+" : ""
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Abonnés actifs"
        value={`${activeSubscribers.toLocaleString("fr-FR")}${suffix}`}
        icon={<Users className="h-5 w-5" />}
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
