import { StoreDetailContent } from "@/components/admin/stores"

export default function StoreSettingsPage({
  params,
}: {
  params: Promise<{ storeId: string }>
}) {
  return <StoreDetailContent params={params} />
}
