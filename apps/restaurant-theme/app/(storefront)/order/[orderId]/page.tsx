export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Order Tracking</h1>
      <p className="text-muted-foreground mt-2">
        Order ID: {orderId}
      </p>
    </div>
  )
}
