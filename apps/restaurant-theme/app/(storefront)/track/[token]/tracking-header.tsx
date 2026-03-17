"use client"

import { Badge } from "@beindigital-engine/ui/components"

type OrderType = "delivery" | "pickup" | "dine_in"

interface TrackingHeaderProps {
  storeName: string
  orderNumber: string
  orderType: OrderType
}

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  delivery: "Livraison",
  pickup: "À emporter",
  dine_in: "Sur place",
}

export function TrackingHeader({
  storeName,
  orderNumber,
  orderType,
}: TrackingHeaderProps) {
  return (
    <div className="space-y-6">
      <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-md px-4 py-1.5 rounded-full font-black tracking-widest uppercase text-[10px] shadow-lg mx-auto block w-fit">
        {ORDER_TYPE_LABELS[orderType]}
      </Badge>

      <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none italic">
        Suivi <span className="text-orange-500 not-italic">commande</span>
      </h1>

      <div className="space-y-2">
        <p className="text-xl text-white/80 font-medium">
          <span className="font-mono font-bold text-white">{orderNumber}</span>
        </p>
        <p className="text-sm text-white/50 font-medium">{storeName}</p>
      </div>
    </div>
  )
}
