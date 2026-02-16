import { EditProductContent } from "@/components/admin/products"

export default function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  return <EditProductContent params={params} />
}
