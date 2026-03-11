export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Product Details</h1>
      <p className="text-muted-foreground mt-2">
        Product ID: {productId}
      </p>
    </div>
  )
}
