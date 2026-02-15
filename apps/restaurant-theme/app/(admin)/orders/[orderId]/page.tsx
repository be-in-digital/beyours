export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  return (
    <div>
      <h1 className="text-3xl font-bold">Order Details</h1>
      <p className="text-muted-foreground mt-2">
        Order ID: {orderId}
      </p>
    </div>
  )
}
