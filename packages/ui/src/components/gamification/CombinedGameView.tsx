"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

import { FortuneWheel } from "./FortuneWheel"
import { WelcomeOverlay } from "./WelcomeOverlay"
import { ActionOverlayCard } from "./ActionOverlayCard"
import { FooterBar } from "./FooterBar"
import type { SocialActionItem } from "./SocialActions"

export interface CombinedGameViewProps {
  step: "welcome" | "actions" | "wheel" | "spinning"
  storeName: string
  logoUrl?: string
  segments: { label: string; color: string }[]
  primaryColor: string
  secondaryColor: string
  backgroundImage?: string
  // Welcome
  hasActions: boolean
  onStart: () => void
  // Actions
  actions: SocialActionItem[]
  completedIds: string[]
  activeTimers: Record<string, number>
  onActionClick: (actionId: string) => void
  onTimerTick: (actionId: string) => void
  // Wheel/Spinning
  onSpin: () => void
  isSpinning: boolean
  targetIndex: number | null
  didWin?: boolean
  onSpinComplete: () => void
}

export function CombinedGameView({
  step,
  storeName,
  logoUrl,
  segments,
  primaryColor,
  secondaryColor,
  backgroundImage,
  hasActions,
  onStart,
  actions,
  completedIds,
  activeTimers,
  onActionClick,
  onTimerTick,
  onSpin,
  isSpinning,
  targetIndex,
  didWin,
  onSpinComplete,
}: CombinedGameViewProps) {
  const [wheelSize, setWheelSize] = useState(400)
  const wheelContainerRef = useRef<HTMLDivElement>(null)
  const intervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  const isOverlayActive = step === "welcome" || step === "actions"
  const isWheelInteractive = step === "wheel" || step === "spinning"

  // Compute wheel size from actual container dimensions
  useEffect(() => {
    function computeSize() {
      if (isOverlayActive) {
        // Background — use viewport estimate
        const vw = window.innerWidth - 32
        const vh = window.innerHeight * 0.5
        setWheelSize(Math.min(500, vw, vh))
        return
      }
      // Interactive — measure actual container, subtract CTA height (~60px)
      const el = wheelContainerRef.current
      if (el) {
        const rect = el.getBoundingClientRect()
        const s = Math.min(rect.width + 20, rect.height - 60)
        if (s > 0) {
          setWheelSize(s)
          return
        }
      }
      // Fallback
      setWheelSize(Math.min(window.innerWidth + 20, window.innerHeight - 60))
    }
    computeSize()
    window.addEventListener("resize", computeSize)
    return () => window.removeEventListener("resize", computeSize)
  }, [step, isOverlayActive])

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

  // Current action (for actions step)
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

  return (
    <div
      className="relative h-screen overflow-hidden flex flex-col"
      style={{
        background: backgroundImage
          ? `url(${backgroundImage}) center/cover no-repeat`
          : `radial-gradient(ellipse at center, ${secondaryColor}22 0%, #0a0a0a 70%)`,
      }}
    >
      {/* Dark overlay for background image readability */}
      {backgroundImage && (
        <div className="absolute inset-0 bg-black/60 z-0" />
      )}

      {isOverlayActive ? (
        <>
          {/* Wheel — absolute behind overlay content */}
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div
              className="transition-all duration-700 ease-out"
              style={{
                transform: "scale(0.65)",
                opacity: 0.4,
                filter: "blur(3px)",
              }}
            >
              <FortuneWheel
                segments={segments}
                targetIndex={null}
                spinning={false}
                onSpinComplete={onSpinComplete}
                size={wheelSize}
                primaryColor={primaryColor}
                didWin={didWin}
              />
            </div>
          </div>

          {/* Overlay content — centered vertically */}
          <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-4">
            <AnimatePresence mode="wait">
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
            </AnimatePresence>
          </div>
        </>
      ) : (
        <>
          {/* Wheel + CTA grouped together, centered */}
          <div ref={wheelContainerRef} className="relative z-10 flex-1 flex flex-col items-center justify-center min-h-0 gap-2">
            <FortuneWheel
              segments={segments}
              targetIndex={isWheelInteractive ? targetIndex : null}
              spinning={step === "spinning" && isSpinning}
              onSpinComplete={onSpinComplete}
              size={wheelSize}
              primaryColor={primaryColor}
              didWin={didWin}
            />

            <div className="px-4">
            <AnimatePresence mode="wait">
              {step === "wheel" && (
                <motion.div
                  key="wheel-cta"
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="flex flex-col items-center gap-3"
                >
                  <p className="text-white/60 text-sm">Tentez votre chance !</p>
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onSpin}
                    className="py-4 px-12 rounded-2xl font-bold text-white text-lg transition-all cursor-pointer border-2 border-white/20"
                    style={{
                      backgroundColor: primaryColor,
                      boxShadow: `0 0 30px ${primaryColor}60`,
                    }}
                  >
                    Jouer la partie
                  </motion.button>
                </motion.div>
              )}

              {step === "spinning" && (
                <motion.div
                  key="spinning"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <p className="text-white/60 text-sm">Bonne chance !</p>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          </div>
        </>
      )}

      {/* Footer — always at bottom */}
      <FooterBar storeName={storeName} primaryColor={primaryColor} />
    </div>
  )
}
