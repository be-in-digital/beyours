"use client"

export interface ConfirmationScreenProps {
  prizeName: string
  redemptionCode: string
  email: string
  expiresAt: number
  primaryColor?: string
}

function formatExpiryDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

/**
 * Confirmation screen shown after successfully claiming a prize.
 * Displays the redemption code and instructs the player to check their email.
 */
export function ConfirmationScreen({
  prizeName,
  redemptionCode,
  email,
  expiresAt,
  primaryColor = "#000000",
}: ConfirmationScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-6 p-8 max-w-sm mx-auto">
      <div className="text-6xl">{"\u2709\uFE0F"}</div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          C'est envoyé !
        </h2>
        <p className="text-white/70">
          Vérifiez votre boîte mail à <strong className="text-white">{email}</strong>
        </p>
      </div>

      <div className="w-full p-4 rounded-xl bg-white/10 border border-white/20">
        <p className="text-white/60 text-xs uppercase tracking-wider mb-2">
          Votre code
        </p>
        <p
          className="text-3xl font-mono font-bold tracking-widest px-4 py-2 rounded-lg inline-block"
          style={{ backgroundColor: primaryColor, color: "#ffffff" }}
        >
          {redemptionCode}
        </p>
      </div>

      <div className="w-full p-4 rounded-xl bg-white/5 border border-white/10">
        <p className="text-white font-medium mb-1">{prizeName}</p>
        <p className="text-white/50 text-sm">
          Valide jusqu'au {formatExpiryDate(expiresAt)}
        </p>
        <p className="text-white/50 text-sm mt-2">
          Présentez ce code au restaurant pour récupérer votre prix.
        </p>
      </div>
    </div>
  )
}
