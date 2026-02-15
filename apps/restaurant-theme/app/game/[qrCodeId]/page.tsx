export default async function GamePage({
  params,
}: {
  params: Promise<{ qrCodeId: string }>
}) {
  const { qrCodeId } = await params
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
        <h1 className="text-3xl font-bold text-center mb-4">
          Play & Win!
        </h1>
        <p className="text-center text-muted-foreground mb-6">
          QR Code: {qrCodeId}
        </p>
        <p className="text-sm text-center text-muted-foreground">
          Gamification flow will be implemented here.
        </p>
      </div>
    </div>
  )
}
