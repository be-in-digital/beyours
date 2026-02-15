export default async function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  return (
    <div>
      <h1 className="text-3xl font-bold">Edit Product</h1>
      <p className="text-muted-foreground mt-2">
        Product ID: {productId}
      </p>
    </div>
  )
}
