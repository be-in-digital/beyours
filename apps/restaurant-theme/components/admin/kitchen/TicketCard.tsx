"use client"

import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TicketTimer } from "./TicketTimer"
import { Clock, Play, CheckCircle, Package } from "lucide-react"

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
  _id: Id<"kitchenTickets">
  storeId: Id<"stores">
  orderId: Id<"orders">
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
  delivery: "Delivery",
  pickup: "Pickup",
  dine_in: "Dine In",
}

const PRIORITY_CONFIG: Record<Priority, { label: string; variant: "default" | "destructive" | "secondary" }> = {
  normal: { label: "Normal", variant: "secondary" },
  urgent: { label: "Urgent", variant: "default" },
  vip: { label: "VIP", variant: "destructive" },
}

const SOURCE_CONFIG: Record<Source, { label: string; color: string }> = {
  website: { label: "Website", color: "bg-blue-100 text-blue-800" },
  uber_eats: { label: "Uber Eats", color: "bg-green-100 text-green-800" },
  deliveroo: { label: "Deliveroo", color: "bg-cyan-100 text-cyan-800" },
  pos: { label: "POS", color: "bg-purple-100 text-purple-800" },
}

const STATUS_ACTIONS: Record<TicketStatus, { label: string; nextStatus: TicketStatus | null; icon: any }> = {
  pending: { label: "Start", nextStatus: "in_progress", icon: Play },
  in_progress: { label: "Ready", nextStatus: "ready", icon: CheckCircle },
  ready: { label: "Complete", nextStatus: "completed", icon: Package },
  completed: { label: "Completed", nextStatus: null, icon: CheckCircle },
}

export function TicketCard({ ticket }: TicketCardProps) {
  const updateStatusMutation = useMutation(api.kitchenTickets.updateStatus)

  const handleStatusChange = async () => {
    const action = STATUS_ACTIONS[ticket.status]
    if (!action.nextStatus) return

    try {
      await updateStatusMutation({
        id: ticket._id,
        status: action.nextStatus,
      })
      toast.success(`Ticket moved to ${action.nextStatus.replace("_", " ")}`)
    } catch (error) {
      toast.error("Failed to update ticket status")
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
            <CardTitle className="text-lg">#{ticket.orderNumber}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {ORDER_TYPE_LABELS[ticket.orderType]}
              </Badge>
              <Badge
                variant={PRIORITY_CONFIG[ticket.priority].variant}
                className="text-xs"
              >
                {PRIORITY_CONFIG[ticket.priority].label}
              </Badge>
            </div>
          </div>

          {/* Timer */}
          <TicketTimer createdAt={ticket.createdAt} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Source badge */}
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

        {/* Items */}
        <div className="space-y-2">
          {ticket.items.map((item, index) => (
            <div key={index} className="text-sm">
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
                  Note: {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Estimated prep time */}
        {ticket.estimatedPrepTime && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Est. {ticket.estimatedPrepTime} min</span>
          </div>
        )}

        {/* Action button */}
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
