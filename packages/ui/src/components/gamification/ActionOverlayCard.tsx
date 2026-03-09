"use client"

import { motion, AnimatePresence } from "framer-motion"
import type { SocialActionItem } from "./SocialActions"

export interface ActionOverlayCardProps {
  action: SocialActionItem
  stepNumber: number
  totalSteps: number
  completedCount: number
  timerRemaining?: number
  isTimerActive: boolean
  primaryColor: string
  onActionClick: () => void
}

const ACTION_ICONS: Record<string, string> = {
  google_review: "\u2B50",
  instagram_follow: "\uD83D\uDCF7",
  facebook_like: "\uD83D\uDC4D",
  tiktok_follow: "\uD83C\uDFB5",
  email_subscribe: "\u2709\uFE0F",
}

const ACTION_CTA: Record<string, string> = {
  google_review: "Notez sur Google",
  instagram_follow: "Suivre sur Instagram",
  facebook_like: "Liker sur Facebook",
  tiktok_follow: "Suivre sur TikTok",
  email_subscribe: "S'abonner",
}

const ACTION_STEPS: Record<string, string[]> = {
  google_review: [
    "Appuyez sur le bouton ci-dessous",
    "Laissez un avis sur Google",
    "Revenez ici pour valider",
  ],
  instagram_follow: [
    "Appuyez sur le bouton ci-dessous",
    "Suivez notre compte Instagram",
    "Revenez ici pour valider",
  ],
  facebook_like: [
    "Appuyez sur le bouton ci-dessous",
    "Aimez notre page Facebook",
    "Revenez ici pour valider",
  ],
  tiktok_follow: [
    "Appuyez sur le bouton ci-dessous",
    "Suivez notre compte TikTok",
    "Revenez ici pour valider",
  ],
  email_subscribe: [
    "Appuyez sur le bouton ci-dessous",
    "Inscrivez-vous a notre newsletter",
    "Revenez ici pour valider",
  ],
}

const DEFAULT_STEPS = [
  "Appuyez sur le bouton ci-dessous",
  "Completez l'action demandee",
  "Revenez ici pour valider",
]

export function ActionOverlayCard({
  action,
  stepNumber,
  totalSteps,
  completedCount,
  timerRemaining,
  isTimerActive,
  primaryColor,
  onActionClick,
}: ActionOverlayCardProps) {
  const icon = action.icon || ACTION_ICONS[action.type] || "\u2714\uFE0F"
  const cta = ACTION_CTA[action.type] || action.name
  const steps = ACTION_STEPS[action.type] || DEFAULT_STEPS

  const timerTotal = action.timerSeconds
  const timerProgress = isTimerActive && timerRemaining !== undefined
    ? (timerTotal - timerRemaining) / timerTotal
    : 0

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -40, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 250, duration: 0.4 }}
      className="w-full max-w-sm mx-auto"
    >
      <div className="bg-black/70 backdrop-blur-md rounded-3xl border border-white/10 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i < completedCount
                  ? "w-8"
                  : i === stepNumber - 1
                    ? "w-8"
                    : "w-2"
              }`}
              style={{
                backgroundColor:
                  i < completedCount
                    ? "#22c55e"
                    : i === stepNumber - 1
                      ? primaryColor
                      : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>

        <p className="text-xs text-white/50 text-center mb-4">
          {`\u00C9tape ${stepNumber} sur ${totalSteps}`}
        </p>

        {/* Action icon */}
        <div className="flex justify-center mb-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
            style={{ backgroundColor: `${primaryColor}30` }}
          >
            {icon}
          </div>
        </div>

        {/* Action name */}
        <h3 className="text-lg font-bold text-white text-center mb-4">
          {action.name}
        </h3>

        {/* Contextual steps */}
        <div className="mb-5">
          <p className="text-xs text-white/50 uppercase tracking-wider text-center mb-3">
            Suivez les etapes :
          </p>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: `${primaryColor}80` }}
                >
                  {i + 1}
                </span>
                <p className="text-white/70 text-sm">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Timer circle */}
        <AnimatePresence>
          {isTimerActive && timerRemaining !== undefined && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex flex-col items-center gap-2 mb-5"
            >
              <div className="relative w-16 h-16">
                {/* Background circle */}
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="none"
                    stroke={primaryColor}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - timerProgress)}`}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-mono font-bold text-white">{timerRemaining}</span>
                </div>
              </div>
              <p className="text-xs text-white/40">Validation en cours...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA Button */}
        {!isTimerActive && (
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={onActionClick}
            className="w-full py-3.5 text-white text-base font-bold rounded-2xl transition-all cursor-pointer border-2 border-white/20"
            style={{
              backgroundColor: primaryColor,
              boxShadow: `0 0 25px ${primaryColor}40`,
            }}
          >
            {cta}
          </motion.button>
        )}

        {/* Bottom progress bar */}
        <div className="mt-4 h-1 rounded-full overflow-hidden bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              backgroundColor: "#22c55e",
              width: `${(completedCount / totalSteps) * 100}%`,
            }}
          />
        </div>
      </div>
    </motion.div>
  )
}
