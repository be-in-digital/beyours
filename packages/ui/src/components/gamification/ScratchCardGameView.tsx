"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

import { ScratchCard } from "./ScratchCard"
import { WelcomeOverlay } from "./WelcomeOverlay"
import { ActionOverlayCard } from "./ActionOverlayCard"
import { FooterBar } from "./FooterBar"
import type { SocialActionItem } from "./SocialActions"

export interface ScratchCardGameViewProps {
  step: "welcome" | "actions" | "scratch" | "scratching"
  storeName: string
  logoUrl?: string
  primaryColor: string
  secondaryColor: string
  backgroundImage?: string
  prizeText: string
  didWin: boolean
  // Welcome
  hasActions: boolean
  onStart: () => void
  // Actions
  actions: SocialActionItem[]
  completedIds: string[]
  activeTimers: Record<string, number>
  onActionClick: (actionId: string) => void
  onTimerTick: (actionId: string) => void
  // Scratch
  onReveal: () => void
}

export function ScratchCardGameView({
  step,
  storeName,
  logoUrl,
  primaryColor,
  secondaryColor,
  backgroundImage,
  prizeText,
  didWin,
  hasActions,
  onStart,
  actions,
  completedIds,
  activeTimers,
  onActionClick,
  onTimerTick,
  onReveal,
}: ScratchCardGameViewProps) {
  const [cardSize, setCardSize] = useState(400)
  const intervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({})
  const [showRevealButton, setShowRevealButton] = useState(false)
  const scratchStartRef = useRef<number | null>(null)

  // Compute card size based on viewport
  useEffect(() => {
    function computeSize() {
      if (typeof window === "undefined") return
      setCardSize(Math.min(500, window.innerWidth - 32))
    }
    computeSize()
    window.addEventListener("resize", computeSize)
    return () => window.removeEventListener("resize", computeSize)
  }, [])

  // Timer intervals for actions
  useEffect(() => {
    const activeActionIds = Object.keys(activeTimers).filter(
      (id) => (activeTimers[id] ?? 0) > 0
    )

    for (const actionId of activeActionIds) {
      if (!intervalsRef.current[actionId]) {
        intervalsRef.current[actionId] = setInterval(() => {
          onTimerTick(actionId)
        }, 1000)
      }
    }

    for (const actionId of Object.keys(intervalsRef.current)) {
      if (!activeActionIds.includes(actionId)) {
        clearInterval(intervalsRef.current[actionId])
        delete intervalsRef.current[actionId]
      }
    }

    return () => {
      for (const id of Object.keys(intervalsRef.current)) {
        clearInterval(intervalsRef.current[id])
      }
      intervalsRef.current = {}
    }
  }, [activeTimers, onTimerTick])

  // Show "Reveal" button after 5s of scratching (safety fallback)
  useEffect(() => {
    if (step === "scratching") {
      scratchStartRef.current = Date.now()
      const timer = setTimeout(() => setShowRevealButton(true), 5000)
      return () => clearTimeout(timer)
    } else {
      setShowRevealButton(false)
      scratchStartRef.current = null
    }
  }, [step])

  // Current action
  const currentActionIndex = actions.findIndex((a) => !completedIds.includes(a._id))
  const currentAction = currentActionIndex >= 0 ? actions[currentActionIndex] : null

  const handleCurrentActionClick = useCallback(() => {
    if (!currentAction) return
    if (activeTimers[currentAction._id] !== undefined) return

    if (currentAction.url) {
      window.open(currentAction.url, "_blank", "noopener,noreferrer")
    }
    onActionClick(currentAction._id)
  }, [currentAction, activeTimers, onActionClick])

  const isOverlayActive = step === "welcome" || step === "actions"
  // "scratch" = spin in progress (loading), "scratching" = card interactive
  const isCardInteractive = step === "scratching"
  const isSpinLoading = step === "scratch"

  return (
    <div
      className="relative min-h-screen overflow-hidden flex flex-col"
      style={{
        background: backgroundImage
          ? `url(${backgroundImage}) center/cover no-repeat`
          : `radial-gradient(ellipse at center, ${secondaryColor}22 0%, #0a0a0a 70%)`,
        touchAction: isCardInteractive ? "none" : "auto",
      }}
    >
      {/* Dark overlay for background image readability */}
      {backgroundImage && (
        <div className="absolute inset-0 bg-black/60 z-0" />
      )}

      {/* Header */}
      <div className="relative z-30 pt-safe-area text-center pt-4 pb-2">
        <h1 className="text-lg font-bold text-white/80">{storeName}</h1>
      </div>

      {/* Card zone — always rendered, CSS transitions */}
      <div className="relative z-10 flex-1 flex items-center justify-center">
        <div
          className="transition-all duration-700 ease-out"
          style={{
            transform: isOverlayActive ? "scale(0.6)" : "scale(1)",
            opacity: isOverlayActive ? 0.5 : 1,
            filter: isOverlayActive ? "blur(2px)" : "none",
            touchAction: isCardInteractive ? "none" : "auto",
          }}
        >
          <ScratchCard
            prizeText={prizeText}
            didWin={didWin}
            onReveal={onReveal}
            size={cardSize}
            primaryColor={primaryColor}
            storeName={storeName}
            interactive={isCardInteractive}
          />
        </div>

        {/* Scrim overlay when not interactive */}
        {isOverlayActive && (
          <div className="absolute inset-0 bg-black/30 transition-opacity duration-500 pointer-events-none" />
        )}
      </div>

      {/* Overlay zone — absolute bottom */}
      <div className="relative z-20 px-4 pb-6">
        <AnimatePresence mode="wait">
          {/* Welcome overlay */}
          {step === "welcome" && (
            <motion.div key="welcome">
              <WelcomeOverlay
                storeName={storeName}
                logoUrl={logoUrl}
                hasActions={hasActions}
                primaryColor={primaryColor}
                onStart={onStart}
              />
            </motion.div>
          )}

          {/* Actions overlay */}
          {step === "actions" && currentAction && (
            <motion.div key={`action-${currentAction._id}`}>
              <ActionOverlayCard
                action={currentAction}
                stepNumber={currentActionIndex + 1}
                totalSteps={actions.length}
                completedCount={completedIds.length}
                timerRemaining={activeTimers[currentAction._id]}
                isTimerActive={
                  activeTimers[currentAction._id] !== undefined &&
                  (activeTimers[currentAction._id] ?? 0) > 0
                }
                primaryColor={primaryColor}
                onActionClick={handleCurrentActionClick}
              />
            </motion.div>
          )}

          {/* Spin loading — brief moment while the result is being determined */}
          {isSpinLoading && (
            <motion.div
              key="spin-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <div
                className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: `${primaryColor} transparent ${primaryColor} ${primaryColor}` }}
              />
              <p className="text-white/60 text-sm">Préparation du ticket...</p>
            </motion.div>
          )}

          {/* Scratching — instructions + reveal button */}
          {step === "scratching" && (
            <motion.div
              key="scratching"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <p className="text-white/60 text-sm">Grattez le ticket pour découvrir votre prix !</p>

              {showRevealButton && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onReveal}
                  className="py-2 px-6 rounded-xl text-white/70 text-sm border border-white/20 transition-all cursor-pointer hover:bg-white/10"
                >
                  Révéler
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer — always at bottom */}
      <FooterBar storeName={storeName} primaryColor={primaryColor} />
    </div>
  )
}
