"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@be-in-digital/ui"
import { computeStatRates } from "@be-in-digital/marketing"
import { formatDate } from "../../../lib/formatters"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Campaign = any

interface StatItemProps {
  label: string
  value: string | number
  sub?: string
}

function StatItem({ label, value, sub }: StatItemProps) {
  return (
    <div className="rounded-lg bg-muted p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

interface CampaignStatsDialogProps {
  campaign: Campaign | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CampaignStatsDialog({ campaign, open, onOpenChange }: CampaignStatsDialogProps) {
  if (!campaign) return null

  const stats = campaign.stats ?? {
    sent: 0, delivered: 0, opened: 0, clicked: 0,
    bounced: 0, unsubscribed: 0, converted: 0, revenue: 0,
  }

  const rates = computeStatRates(stats)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Statistiques — {campaign.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div>
              <span className="text-muted-foreground">Objet :</span>{" "}
              <span className="font-medium">{campaign.subject}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Envoyée le :</span>{" "}
              <span className="font-medium">{campaign.sentAt ? formatDate(campaign.sentAt) : "-"}</span>
            </div>
          </div>

          {/* Volume stats */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Volume</p>
            <div className="grid grid-cols-4 gap-3">
              <StatItem label="Envoyés" value={stats.sent.toLocaleString()} />
              <StatItem label="Délivrés" value={stats.delivered.toLocaleString()} />
              <StatItem label="Rebonds" value={stats.bounced.toLocaleString()} />
              <StatItem label="Désabonnements" value={stats.unsubscribed.toLocaleString()} />
            </div>
          </div>

          {/* Engagement stats */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Engagement</p>
            <div className="grid grid-cols-4 gap-3">
              <StatItem
                label="Taux d'ouverture"
                value={`${rates.openRate}%`}
                sub={`${stats.opened.toLocaleString()} ouvertures`}
              />
              <StatItem
                label="Taux de clic"
                value={`${rates.clickRate}%`}
                sub={`${stats.clicked.toLocaleString()} clics`}
              />
              <StatItem
                label="Taux de rebond"
                value={`${rates.bounceRate}%`}
              />
              <StatItem
                label="Taux de désabo."
                value={`${rates.unsubscribeRate}%`}
              />
            </div>
          </div>

          {/*
            Conversion and attributed revenue are NOT tracked.

            Nothing in the product produces either figure: no path writes a
            `converted` email event, and an order carries no record of the
            campaign that led to it — the attribution a "revenu attribué"
            number is made of does not exist in this schema. So these two tiles
            rendered a hard « 0 » and « 0,00 € » beside real send and open
            counts, for every campaign, for ever, and an owner reading them
            concluded their mailing had sold nothing.

            Stated rather than zeroed. When a producer is wired — a click
            carrying the campaign through to checkout, and an order that
            records it — this becomes two figures again.
          */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Conversion</p>
            <div className="grid grid-cols-2 gap-3">
              <StatItem label="Conversions" value="Non suivi" />
              <StatItem label="Revenu attribué" value="Non suivi" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Les commandes ne sont pas encore rattachées à la campagne qui les a
              déclenchées : ces deux indicateurs ne sont pas mesurés.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
