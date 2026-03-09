"use client"

import { motion } from "framer-motion"

export interface WelcomeOverlayProps {
  storeName: string
  logoUrl?: string
  hasActions: boolean
  primaryColor: string
  onStart: () => void
}

const STEPS_WITH_ACTIONS = [
  { num: "1", text: "Completez les actions demandees" },
  { num: "2", text: "Revenez sur cet onglet apres chaque action" },
  { num: "3", text: "Tournez la roue et tentez de gagner !" },
]

const STEPS_WITHOUT_ACTIONS = [
  { num: "1", text: "Tournez la roue de la fortune" },
  { num: "2", text: "Si vous gagnez, remplissez le formulaire" },
  { num: "3", text: "Presentez le code QR au restaurant" },
]

export function WelcomeOverlay({
  storeName,
  logoUrl,
  hasActions,
  primaryColor,
  onStart,
}: WelcomeOverlayProps) {
  const [firstName, ...rest] = storeName.split(" ")
  const lastName = rest.join(" ")
  const steps = hasActions ? STEPS_WITH_ACTIONS : STEPS_WITHOUT_ACTIONS

  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200, duration: 0.6 }}
      className="w-full max-w-sm mx-auto"
    >
      <div className="bg-black/70 backdrop-blur-md rounded-3xl border border-white/10 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        {/* Logo / Store name */}
        <div className="flex justify-center mb-5">
          {logoUrl ? (
            <div className="w-20 h-20 rounded-full bg-white overflow-hidden p-2 shadow-lg">
              <img src={logoUrl} alt={storeName} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg p-2">
              <div className="text-center">
                <p
                  className="text-base font-bold leading-tight"
                  style={{ color: primaryColor, fontFamily: "Georgia, serif" }}
                >
                  {firstName || storeName}
                </p>
                {lastName && (
                  <p className="text-[9px] text-gray-500 tracking-[0.2em] uppercase">{lastName}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-white text-center mb-5 leading-tight">
          JOUE ET TENTE DE GAGNER UN CADEAU !
        </h2>

        {/* Steps */}
        <div className="space-y-2.5 mb-6">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ x: -15, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.3 }}
              className="flex items-center gap-3"
            >
              <span
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {step.num}
              </span>
              <p className="text-white/80 text-sm">{step.text}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA Button */}
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={onStart}
          className="w-full py-4 text-white text-lg font-bold rounded-2xl transition-all cursor-pointer border-2 border-white/20"
          style={{
            backgroundColor: primaryColor,
            boxShadow: `0 0 30px ${primaryColor}50`,
          }}
        >
          JOUER LA PARTIE
        </motion.button>
      </div>

    </motion.div>
  )
}
