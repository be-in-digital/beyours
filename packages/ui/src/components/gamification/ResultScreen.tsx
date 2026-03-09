"use client"

export interface ResultScreenProps {
  didWin: boolean
  prizeName?: string
  onClaim: () => void
  onClose: () => void
  primaryColor?: string
}

/**
 * Result screen displayed after the wheel stops spinning.
 * Shows win/lose state with appropriate messaging.
 */
export function ResultScreen({
  didWin,
  prizeName,
  onClaim,
  onClose,
  primaryColor = "#000000",
}: ResultScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-6 p-6 max-w-sm mx-auto">
      {didWin ? (
        <>
          <div className="text-6xl animate-bounce">
            {"\uD83C\uDF89"}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Félicitations !
            </h2>
            <p className="text-white/80 text-lg">
              Vous avez gagné :
            </p>
            <p
              className="text-xl font-bold mt-2 px-4 py-2 rounded-lg inline-block"
              style={{ backgroundColor: primaryColor, color: "#ffffff" }}
            >
              {prizeName}
            </p>
          </div>
          <button
            onClick={onClaim}
            className="w-full py-3 px-6 rounded-xl font-semibold text-white transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: primaryColor }}
          >
            Récupérer mon prix
          </button>
        </>
      ) : (
        <>
          <div className="text-6xl">
            {"\uD83D\uDE14"}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Pas cette fois...
            </h2>
            <p className="text-white/70">
              Revenez demain pour retenter votre chance !
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-3 px-6 rounded-xl font-semibold text-white bg-white/20 hover:bg-white/30 transition-transform hover:scale-105 active:scale-95"
          >
            Fermer
          </button>
        </>
      )}
    </div>
  )
}
