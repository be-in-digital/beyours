import { OrderDetailPage } from "@beindigital-engine/admin"

export default function Page({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  return <OrderDetailPage params={params} />
}
