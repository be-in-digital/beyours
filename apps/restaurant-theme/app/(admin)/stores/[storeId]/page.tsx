export default async function StoreSettingsPage({
  params,
}: {
  params: Promise<{ storeId: string }>
}) {
  const { storeId } = await params
  return (
    <div>
      <h1 className="text-3xl font-bold">Store Settings</h1>
      <p className="text-muted-foreground mt-2">
        Store ID: {storeId}
      </p>
    </div>
  )
}
