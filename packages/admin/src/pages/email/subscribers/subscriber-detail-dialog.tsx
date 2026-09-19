"use client"

import { useQuery } from "convex/react"
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  StatusTimeline,
  type TimelineItem,
} from "@be-yours/ui"
import { useAdminApiStore } from "../../../stores/admin-api-store"
import { formatDate } from "../../../lib/formatters"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Subscriber = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmailEvent = any

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  active: "Actif",
  unsubscribed: "Désabonné",
  bounced: "Rebond",
  complained: "Plainte",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  active: "default",
  unsubscribed: "secondary",
  bounced: "destructive",
  complained: "destructive",
}

const EVENT_LABELS: Record<string, string> = {
  sent: "Email envoyé",
  delivered: "Email délivré",
  opened: "Email ouvert",
  clicked: "Lien cliqué",
  bounced: "Rebond",
  unsubscribed: "Désabonnement",
  complained: "Plainte spam",
  converted: "Conversion",
}

interface SubscriberDetailDialogProps {
  subscriber: Subscriber | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SubscriberDetailDialog({
  subscriber,
  open,
  onOpenChange,
}: SubscriberDetailDialogProps) {
  const { api } = useAdminApiStore()

  const events = useQuery(
    api?.emailEvents?.listBySubscriber,
    open && subscriber?._id ? { subscriberId: subscriber._id } : "skip"
  ) as EmailEvent[] | undefined

  if (!subscriber) return null

  const displayName =
    [subscriber.firstName, subscriber.lastName].filter(Boolean).join(" ") ||
    subscriber.email

  const timelineItems: TimelineItem[] = (events ?? []).slice(0, 20).map(
    (event: EmailEvent) => ({
      id: event._id,
      status: EVENT_LABELS[event.type] ?? event.type,
      timestamp: formatDate(event.occurredAt),
      description: event.metadata?.linkUrl
        ? `Lien : ${event.metadata.linkUrl}`
        : event.metadata?.orderId
        ? `Commande : ${event.metadata.orderId}`
        : undefined,
    })
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{displayName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
              <p className="font-medium">{subscriber.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Statut</p>
              <div>
                <Badge variant={STATUS_VARIANTS[subscriber.status] ?? "secondary"}>
                  {STATUS_LABELS[subscriber.status] ?? subscriber.status}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Source</p>
              <p className="font-medium capitalize">{subscriber.source}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Inscrit le</p>
              <p className="font-medium">{formatDate(subscriber.createdAt)}</p>
            </div>
          </div>

          <hr className="border-border" />

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Commandes</p>
              <p className="text-lg font-semibold">{subscriber.metadata?.totalOrders ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Dépenses totales</p>
              <p className="text-lg font-semibold">
                {((subscriber.metadata?.totalSpent ?? 0) / 100).toFixed(2)} &euro;
              </p>
            </div>
          </div>

          {/* Tags */}
          {subscriber.tags && subscriber.tags.length > 0 && (
            <>
              <hr className="border-border" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {subscriber.tags.map((tag: string) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          <hr className="border-border" />

          {/* Activity timeline */}
          <div>
            <p className="text-sm font-medium mb-4">Activité récente</p>
            {events === undefined ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : timelineItems.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Aucune activité enregistrée
              </p>
            ) : (
              <StatusTimeline items={timelineItems} />
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
