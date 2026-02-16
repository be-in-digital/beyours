import { OrderDetailContent } from "@/components/admin/orders"

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  return <OrderDetailContent params={params} />
}
