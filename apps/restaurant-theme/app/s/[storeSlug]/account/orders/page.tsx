import type { Metadata } from "next"
import { OrderHistoryClient } from "./OrderHistoryClient"

export const metadata: Metadata = {
  title: "Order History",
  robots: { index: false, follow: false },
}

export default function OrderHistoryPage() {
  return <OrderHistoryClient />
}
