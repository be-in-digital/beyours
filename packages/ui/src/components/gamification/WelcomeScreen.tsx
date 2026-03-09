"use client"

import { motion } from "framer-motion"

export interface WelcomeScreenProps {
  storeName: string
  logoUrl?: string
  primaryColor?: string
  hasActions?: boolean
  onStart: () => void
}

const EMOJIS = ["🎰", "🎲", "🎁", "🎉", "⭐", "🎊", "💎", "🏆", "🎯", "🔥", "✨", "🎀"]

const STEPS_WITH_ACTIONS = [
  { icon: "1", text: "Completez les actions demandees (avis Google, suivre Instagram...)" },
  { icon: "2", text: "Revenez sur cet onglet une fois l'action terminee" },
  { icon: "3", text: "Tournez la roue de la fortune et tentez de gagner !" },
  { icon: "4", text: "Si vous gagnez, remplissez le formulaire pour recevoir votre cadeau" },
]

const STEPS_WITHOUT_ACTIONS = [
  { icon: "1", text: "Tournez la roue de la fortune et tentez votre chance !" },
  { icon: "2", text: "Si vous gagnez, remplissez le formulaire pour recevoir votre cadeau" },
  { icon: "3", text: "Presentez le code QR au restaurant pour recuperer votre prix" },
]

export function WelcomeScreen({
  storeName,
  logoUrl,
  primaryColor = "#000000",
  hasActions = true,
  onStart,
}: WelcomeScreenProps) {
  const [firstName, ...rest] = storeName.split(" ")
  const lastName = rest.join(" ")
  const steps = hasActions ? STEPS_WITH_ACTIONS : STEPS_WITHOUT_ACTIONS

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-between pointer-events-auto overflow-y-auto">
      {/* Background gradient */}
      <div
        className="fixed inset-0"
        style={{
          background: `radial-gradient(ellipse at center, ${primaryColor}dd 0%, ${primaryColor} 40%, #0a0a15 100%)`,
        }}
      >
        {/* Floating emojis */}
        {EMOJIS.map((emoji, i) => {
          const isLeft = i % 2 === 0
          return (
            <motion.div
              key={i}
              className="absolute pointer-events-none"
              style={{
                left: isLeft ? `${5 + (i % 3) * 15}%` : "auto",
                right: !isLeft ? `${5 + (i % 3) * 15}%` : "auto",
                fontSize: i % 3 === 0 ? "3rem" : i % 3 === 1 ? "2.5rem" : "2rem",
              }}
              initial={{ y: -100, opacity: 0.4, rotate: 0 }}
              animate={{
                y: ["0vh", "110vh"],
                opacity: [0.3, 0.6, 0.3],
                rotate: [0, 360],
              }}
              transition={{
                duration: 12 + i * 2,
                repeat: Infinity,
                delay: i * 1.5,
                ease: "linear",
              }}
            >
              {emoji}
            </motion.div>
          )
        })}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full px-6 py-8 md:py-12">
        {/* Logo circle */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
          className="w-40 h-40 md:w-56 md:h-56 bg-white rounded-full flex items-center justify-center shadow-[0_20px_60px_rgba(0,0,0,0.3)] mb-6 md:mb-10 overflow-hidden p-4"
        >
          {logoUrl ? (
            <img src={logoUrl} alt={storeName} className="w-full h-full object-contain" />
          ) : (
            <div className="text-center">
              <h1
                className="text-2xl md:text-3xl font-bold mb-1"
                style={{ color: primaryColor, fontFamily: "Georgia, serif" }}
              >
                {firstName || storeName}
              </h1>
              {lastName && (
                <p className="text-xs md:text-sm text-gray-500 tracking-[0.3em] uppercase">{lastName}</p>
              )}
            </div>
          )}
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="max-w-2xl mb-8 md:mb-10"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)] text-center leading-tight text-balance">
            JOUE ET TENTE DE GAGNER UN CADEAU !
          </h2>
        </motion.div>

        {/* Instructions */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="w-full max-w-md mb-8 md:mb-10"
        >
          <h3 className="text-white/80 text-sm font-semibold uppercase tracking-wider text-center mb-4">
            Comment jouer ?
          </h3>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
                className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3"
              >
                <span
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  {step.icon}
                </span>
                <p className="text-white/90 text-sm leading-relaxed">{step.text}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Play button */}
        <motion.button
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          whileHover={{ scale: 1.08, boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}
          whileTap={{ scale: 0.97 }}
          onClick={onStart}
          style={{ background: primaryColor }}
          className="px-16 py-5 text-white text-2xl font-bold rounded-full shadow-[0_15px_35px_rgba(0,0,0,0.4)] transition-all border-2 border-white/20 cursor-pointer"
        >
          JOUER LA PARTIE
        </motion.button>
      </div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="relative z-10 w-full bg-gradient-to-t from-black/30 to-transparent py-6"
      >
        <div className="flex justify-center gap-16 text-white">
          <button className="text-lg font-semibold underline underline-offset-4 hover:text-white/70 transition-colors cursor-pointer">
            Reglement
          </button>
          <button className="text-lg font-semibold underline underline-offset-4 hover:text-white/70 transition-colors cursor-pointer">
            Contact
          </button>
        </div>
      </motion.footer>
    </div>
  )
}
