"use client"

import { useMutation } from "convex/react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@be-in-digital/ui"
import { Button } from "@be-in-digital/ui"
import { Badge } from "@be-in-digital/ui"
import { TicketTimer } from "./ticket-timer"
import { Clock, Play, CheckCircle, Package } from "lucide-react"
import { useAdminApiStore } from "../../stores/admin-api-store"

type TicketStatus = "pending" | "in_progress" | "ready" | "completed"
type OrderType = "delivery" | "pickup" | "dine_in"
type Priority = "normal" | "urgent" | "vip"
type Source = "website" | "uber_eats" | "deliveroo" | "pos"

interface TicketItem {
  productName: string
  quantity: number
  options: string[]
  notes?: string
}

interface Ticket {
  _id: string
  storeId: string
  orderId: string
  orderNumber: string
  orderType: OrderType
  items: TicketItem[]
  station?: string
  assignedTo?: string
  priority: Priority
  source: Source
  status: TicketStatus
  estimatedPrepTime?: number
  printCount: number
  createdAt: number
  updatedAt: number
  startedAt?: number
  completedAt?: number
}

interface TicketCardProps {
  ticket: Ticket
}

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  delivery: "Livraison",
  pickup: "À emporter",
  dine_in: "Sur place",
}

const PRIORITY_CONFIG: Record<Priority, { label: string; variant: "default" | "destructive" | "secondary" }> = {
  normal: { label: "Normal", variant: "secondary" },
  urgent: { label: "Urgent", variant: "default" },
  vip: { label: "VIP", variant: "destructive" },
}

const SOURCE_CONFIG: Record<Source, { label: string; color: string }> = {
  website: { label: "Site web", color: "bg-blue-100 text-blue-800" },
  uber_eats: { label: "Uber Eats", color: "bg-green-100 text-green-800" },
  deliveroo: { label: "Deliveroo", color: "bg-cyan-100 text-cyan-800" },
  pos: { label: "Caisse", color: "bg-purple-100 text-purple-800" },
}

const STATUS_ACTIONS: Record<TicketStatus, { label: string; nextStatus: TicketStatus | null; icon: any }> = {
  pending: { label: "Démarrer", nextStatus: "in_progress", icon: Play },
  in_progress: { label: "Prêt", nextStatus: "ready", icon: CheckCircle },
  ready: { label: "Terminer", nextStatus: "completed", icon: Package },
  completed: { label: "Terminé", nextStatus: null, icon: CheckCircle },
}

export function TicketCard({ ticket }: TicketCardProps) {
  const { api } = useAdminApiStore()
  const updateStatusMutation = useMutation(api.kitchenTickets.updateStatus)

  const handleStatusChange = async () => {
    const action = STATUS_ACTIONS[ticket.status]
    if (!action.nextStatus) return

    try {
      await updateStatusMutation({
        id: ticket._id,
        status: action.nextStatus,
      })
      toast.success(`Ticket déplacé vers ${action.nextStatus.replace("_", " ")}`)
    } catch (error) {
      toast.error("Échec de la mise à jour du statut du ticket")
      console.error(error)
    }
  }

  const action = STATUS_ACTIONS[ticket.status]
  const ActionIcon = action.icon

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">#{ticket.orderNumber}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {ORDER_TYPE_LABELS[ticket.orderType]}
              </Badge>
              {/* The priority badge renders only above "normal". Every writer
                  that runs in production hard-codes `priority: "normal"` —
                  `orders.ts` when it opens a ticket, plus the Uber Eats and the
                  Deliveroo webhooks — so a grey "Normal" sat on every card of
                  every service and told the kitchen nothing, while making the
                  two values that do mean something harder to spot.
                  `getPriorityLevel` in @be-in-digital/restaurant already
                  classifies an order (external platform -> vip, delivery ->
                  urgent) and is unit-tested, but nothing calls it; today the
                  only non-normal tickets come from `seedKitchenOrders`.
                  `PRIORITY_CONFIG` deliberately still covers all three values,
                  so an urgent or VIP ticket stands out the moment any writer
                  produces one. */}
              {ticket.priority !== "normal" && (
                <Badge
                  variant={PRIORITY_CONFIG[ticket.priority].variant}
                  className="text-xs"
                >
                  {PRIORITY_CONFIG[ticket.priority].label}
                </Badge>
              )}
            </div>
          </div>
          <TicketTimer createdAt={ticket.createdAt} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={`text-xs ${SOURCE_CONFIG[ticket.source].color}`}
          >
            {SOURCE_CONFIG[ticket.source].label}
          </Badge>
          {ticket.station && (
            <Badge variant="outline" className="text-xs">
              {ticket.station}
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          {ticket.items.map((item, index) => (
            <div key={index} className="text-xs">
              <div className="font-medium">
                {item.quantity}x {item.productName}
              </div>
              {item.options.length > 0 && (
                <div className="text-xs text-muted-foreground ml-4">
                  {item.options.join(", ")}
                </div>
              )}
              {item.notes && (
                <div className="text-xs text-muted-foreground italic ml-4">
                  Note : {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>

        {ticket.estimatedPrepTime && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Est. {ticket.estimatedPrepTime} min</span>
          </div>
        )}

        {action.nextStatus && (
          <Button
            onClick={handleStatusChange}
            className="w-full"
            size="sm"
          >
            <ActionIcon className="mr-2 h-4 w-4" />
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
