"use client"

type OrderType = "delivery" | "pickup" | "dine_in"

interface TrackingHeaderProps {
  storeName: string
  orderNumber: string
  orderType: OrderType
}

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  delivery: "Livraison",
  pickup: "A emporter",
  dine_in: "Sur place",
}

const ORDER_TYPE_COLORS: Record<OrderType, string> = {
  delivery: "bg-blue-100 text-blue-700",
  pickup: "bg-orange-100 text-orange-700",
  dine_in: "bg-green-100 text-green-700",
}

export function TrackingHeader({
  storeName,
  orderNumber,
  orderType,
}: TrackingHeaderProps) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-3">
      <h1 className="text-2xl font-bold text-gray-900 leading-tight">
        {storeName}
      </h1>
      <p className="text-lg text-gray-600 font-medium">
        Commande #{orderNumber}
      </p>
      <span
        className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${ORDER_TYPE_COLORS[orderType]}`}
      >
        {ORDER_TYPE_LABELS[orderType]}
      </span>
    </div>
  )
}
