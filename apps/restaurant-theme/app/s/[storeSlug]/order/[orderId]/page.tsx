import type { Metadata } from "next"
import { OrderTrackingClient } from "./OrderTrackingClient"

export const metadata: Metadata = {
  title: "Order Tracking",
  robots: { index: false, follow: false },
}

export default function OrderTrackingPage() {
  return <OrderTrackingClient />
}
