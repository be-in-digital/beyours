"use client"

import { useQuery } from "convex/react"
import { useMemo, useState } from "react"
import { Send, Mail, Users, Filter, Settings2, PlusCircle } from "lucide-react"
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@be-in-digital/ui"
import { LoadingState } from "../../../components/loading-state"
import { useAdminApiStore } from "../../../stores/admin-api-store"
import { useAdminStoreId } from "../../../hooks/admin-hooks"
import { adminRoutes } from "../../../config/admin-routes"
import { formatShortDate } from "../../../lib/formatters"
import { computeStatRates } from "@be-in-digital/marketing"
import { EmailKpiCards } from "./email-kpi-cards"
import { isTriggerAvailable } from "../config/automation-controls"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Campaign = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Automation = any

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  scheduled: "Planifiée",
  sending: "En cours",
  sent: "Envoyée",
  paused: "En pause",
  cancelled: "Annulée",
  failed: "Échouée",
}

const CAMPAIGN_STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  scheduled: "secondary",
  sending: "default",
  sent: "default",
  paused: "secondary",
  cancelled: "destructive",
  failed: "destructive",
}

const AUTOMATION_TRIGGER_LABELS: Record<string, string> = {
  welcome: "Bienvenue",
  birthday: "Anniversaire",
  inactive: "Réengagement",
  post_order: "Post-commande",
  abandoned_cart: "Panier abandonné",
}

const QUICK_ACTIONS = [
  { icon: <PlusCircle className="h-4 w-4" />, label: "Nouvelle campagne", href: adminRoutes.emailCampaigns },
  { icon: <Users className="h-4 w-4" />, label: "Voir les abonnés", href: adminRoutes.emailSubscribers },
  { icon: <Mail className="h-4 w-4" />, label: "Créer un modèle", href: adminRoutes.emailTemplates },
  { icon: <Filter className="h-4 w-4" />, label: "Gérer les segments", href: adminRoutes.emailSegments },
  { icon: <Settings2 className="h-4 w-4" />, label: "Configuration", href: adminRoutes.emailConfig },
]

export function EmailDashboardPage() {
  const { api } = useAdminApiStore()
  const storeId = useAdminStoreId()

  const campaigns = useQuery(
    api?.emailCampaigns?.list,
    storeId ? { storeId } : "skip"
  ) as Campaign[] | undefined

  const automations = useQuery(
    api?.emailAutomations?.listActive,
    storeId ? { storeId } : "skip"
  ) as Automation[] | undefined

  /**
   * The subscriber figures, counted through `by_storeId_status` up to a cap.
   *
   * This used to collect the whole mailing list to call `.length` on it five
   * times, on a live subscription that re-ran on every signup — so the screen
   * stopped loading for good once the list passed Convex's 16,384-document
   * limit. `truncated` says the figures are floors, and the cards render them
   * as « 2 000+ » rather than as totals nobody counted.
   */
  const subscriberCounts = useQuery(
    api?.emailSubscribers?.countByStatus,
    storeId ? { storeId } : "skip"
  ) as
    | {
        total: number
        active: number
        pending: number
        unsubscribed: number
        bounced: number
        complained: number
        truncated: boolean
      }
    | undefined

  const activeSubscriberCount = subscriberCounts?.active

  // Compute stats from last 30 days campaigns
  const stats = useMemo(() => {
    if (!campaigns) return null

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const sentCampaigns = campaigns.filter(
      (c: Campaign) => c.status === "sent" && (c.sentAt ?? 0) >= thirtyDaysAgo
    )

    if (sentCampaigns.length === 0) {
      return { campaignsSent: 0, avgOpenRate: 0, avgClickRate: 0 }
    }

    const totalOpenRate = sentCampaigns.reduce((sum: number, c: Campaign) => {
      const rates = computeStatRates(c.stats)
      return sum + rates.openRate
    }, 0)
    const totalClickRate = sentCampaigns.reduce((sum: number, c: Campaign) => {
      const rates = computeStatRates(c.stats)
      return sum + rates.clickRate
    }, 0)

    return {
      campaignsSent: sentCampaigns.length,
      avgOpenRate: Math.round((totalOpenRate / sentCampaigns.length) * 10) / 10,
      avgClickRate: Math.round((totalClickRate / sentCampaigns.length) * 10) / 10,
    }
  }, [campaigns])

  const recentCampaigns = useMemo(() => {
    if (!campaigns) return []
    return [...campaigns]
      .sort((a: Campaign, b: Campaign) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, 5)
  }, [campaigns])

  if (!storeId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon"><Mail /></EmptyMedia>
          <EmptyTitle>Aucun établissement sélectionné</EmptyTitle>
          <EmptyDescription>
            Sélectionnez un établissement pour voir le tableau de bord email
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (campaigns === undefined || subscriberCounts === undefined) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Email Marketing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vue d&apos;ensemble de vos campagnes et abonnés
        </p>
      </div>

      {/* KPI Cards */}
      {stats && (
        <EmailKpiCards
          activeSubscribers={activeSubscriberCount ?? 0}
          subscribersTruncated={subscriberCounts?.truncated ?? false}
          campaignsSent={stats.campaignsSent}
          avgOpenRate={stats.avgOpenRate}
          avgClickRate={stats.avgClickRate}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent campaigns */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Campagnes récentes</h2>
              <Button variant="ghost" size="sm" asChild>
                <a href={adminRoutes.emailCampaigns}>Toutes les campagnes</a>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentCampaigns.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Send className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Aucune campagne créée</p>
                <Button size="sm" variant="outline" asChild>
                  <a href={adminRoutes.emailCampaigns}>Créer une campagne</a>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentCampaigns.map((campaign: Campaign) => (
                  <div
                    key={campaign._id}
                    className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {campaign.subject}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {campaign.status === "sent" && campaign.stats?.delivered > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {Math.round((campaign.stats.opened / campaign.stats.delivered) * 100)}% ouvert
                        </span>
                      )}
                      <Badge variant={CAMPAIGN_STATUS_VARIANTS[campaign.status] ?? "outline"}>
                        {CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatShortDate(campaign.updatedAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-5">
          {/* Active automations */}
          <Card>
            <CardHeader className="pb-3">
              <h2 className="text-base font-semibold">Automations actives</h2>
            </CardHeader>
            <CardContent>
              {automations === undefined ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : automations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune automation active</p>
              ) : (
                <div className="space-y-2">
                  {automations.map((auto: Automation) => (
                    <div
                      key={auto._id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        {AUTOMATION_TRIGGER_LABELS[auto.trigger] ?? auto.trigger}
                        {/*
                          An automation on an unwired trigger is `active` in the
                          row and inert in fact — `canDispatch` refuses it. The
                          card is titled "Automations actives"; say which ones
                          are not going anywhere.
                        */}
                        {!isTriggerAvailable(auto.trigger) && (
                          <Badge variant="outline" className="text-xs font-normal">
                            Indisponible
                          </Badge>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {auto.stats?.sent ?? 0} envoyés
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-3">
              <h2 className="text-base font-semibold">Actions rapides</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {QUICK_ACTIONS.map((action) => (
                  <a
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    <span className="text-muted-foreground">{action.icon}</span>
                    {action.label}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
