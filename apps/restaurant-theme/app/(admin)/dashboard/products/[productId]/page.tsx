import { EditProductPage } from "@beindigital-engine/admin"

export default function Page({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  return <EditProductPage params={params} />
}
