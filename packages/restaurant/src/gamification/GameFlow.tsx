"use client"

import { useEffect, useCallback, useState } from "react"
import {
  useGamificationStore,
  type GameStoreData,
  type GameData,
  type WheelSection,
  type GameAction,
  type GameSettings,
  type SpinResult,
  type ClaimResult,
} from "../stores/gamification"
import {
  CombinedGameView,
  ScratchCardGameView,
  ResultScreen,
  ClaimForm,
  CooldownScreen,
  ConfirmationScreen,
  FooterBar,
  type ClaimFormData,
} from "@beindigital-engine/ui/gamification"

// === Types for Convex data injection ===

export interface GamePageData {
  store: GameStoreData
  game: GameData
  sections: WheelSection[]
  actions: GameAction[]
  settings: GameSettings
}

export interface GameFlowProps {
  gameData: GamePageData | null | undefined
  cooldownResult: { canPlay: boolean; nextPlayAt?: number } | undefined
  fingerprint?: string
  onSpin: (args: {
    gameId: string
    storeId: string
    fingerprint: string
    completedActions: string[]
  }) => Promise<SpinResult>
  onClaimPrize: (args: {
    redemptionId: string
    firstName: string
    lastName: string
    email: string
    phone?: string
  }) => Promise<ClaimResult>
  isLoading?: boolean
}

const FINGERPRINT_KEY = "beid_gam_fp"

function getOrCreateFingerprint(): string {
  if (typeof window === "undefined") return ""
  let fp = localStorage.getItem(FINGERPRINT_KEY)
  if (!fp) {
    fp = crypto.randomUUID()
    localStorage.setItem(FINGERPRINT_KEY, fp)
  }
  return fp
}

/**
 * GameFlow — One screen per step.
 *
 * Steps: Loading → Actions (sequential) → Wheel → Spinning → Result → Claim → Confirmation
 *        └→ Cooldown (if already played)
 *        └→ Error
 */
export function GameFlow({
  gameData,
  cooldownResult,
  fingerprint: fingerprintProp,
  onSpin,
  onClaimPrize,
  isLoading,
}: GameFlowProps) {
  const store = useGamificationStore()
  const [isSpinning, setIsSpinning] = useState(false)
  const [isClaimSubmitting, setIsClaimSubmitting] = useState(false)

  // Initialize fingerprint — use prop if provided, otherwise generate from localStorage
  useEffect(() => {
    store.setFingerprint(fingerprintProp || getOrCreateFingerprint())
  }, [fingerprintProp])
  // Initialize game when data arrives
  useEffect(() => {
    if (!gameData) return
    if (store.step === "loading") {
      store.initGame(gameData)
    }
  }, [gameData])
  // Handle cooldown check — only on initial load, not during active gameplay
  useEffect(() => {
    if (!cooldownResult) return
    const current = useGamificationStore.getState()
    // Only apply cooldown if still in loading/welcome phase
    // Once the game is in progress, ignore reactive cooldown updates
    if (current.step !== "loading" && current.step !== "welcome") return
    if (!cooldownResult.canPlay && cooldownResult.nextPlayAt) {
      current.setCooldown(cooldownResult.nextPlayAt)
    }
  }, [cooldownResult])
  // Handle error states
  useEffect(() => {
    if (gameData === null && !isLoading) {
      store.setError("Jeu introuvable ou inactif.")
    }
  }, [gameData, isLoading])
  // Auto-transition: actions → game step when all completed
  useEffect(() => {
    if (store.step === "actions" && store.allActionsCompleted()) {
      const current = useGamificationStore.getState()
      const gameStep = current.game?.type === "scratch_card" ? "scratch" : "wheel"
      current.setStep(gameStep)
    }
  }, [store.completedActionIds])
  // Auto-spin for scratch card: when step becomes "scratch", call spin immediately
  // and transition to "scratching" (no intermediate button needed)
  useEffect(() => {
    if (store.step !== "scratch") return
    const current = useGamificationStore.getState()
    if (!current.game || current.game.type !== "scratch_card") return
    if (!current.store) return

    let cancelled = false
    ;(async () => {
      try {
        const result = await onSpin({
          gameId: current.game!._id,
          storeId: current.store!._id,
          fingerprint: current.fingerprint,
          completedActions: current.completedActionIds,
        })
        if (cancelled) return
        const latest = useGamificationStore.getState()
        latest.setSpinResult(result)
        latest.setStep("scratching")
      } catch (error: unknown) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : "Erreur lors du tirage"
        useGamificationStore.getState().setError(message)
      }
    })()

    return () => { cancelled = true }
  }, [store.step, onSpin])
  // === Handlers ===

  const handleActionClick = useCallback(
    (actionId: string) => {
      store.startActionTimer(actionId)
    },
    []  )

  const handleTimerTick = useCallback(
    (actionId: string) => {
      store.tickActionTimer(actionId)
    },
    []  )

  const handleSpin = useCallback(async () => {
    // Use getState() to avoid stale closure — critical for fingerprint & completedActions
    const current = useGamificationStore.getState()
    if (!current.game || !current.store || isSpinning) return

    current.setStep("spinning")
    setIsSpinning(true)

    try {
      const result = await onSpin({
        gameId: current.game._id,
        storeId: current.store._id,
        fingerprint: current.fingerprint,
        completedActions: current.completedActionIds,
      })
      current.setSpinResult(result)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erreur lors du spin"
      current.setError(message)
      setIsSpinning(false)
    }
  }, [onSpin, isSpinning])
  const handleSpinComplete = useCallback(() => {
    setIsSpinning(false)
    const current = useGamificationStore.getState()
    if (current.spinResult) {
      current.setStep("result")
    }
  }, [])

  const handleClaim = useCallback(() => {
    store.setStep("claim")
  }, [])
  const handleClaimSubmit = useCallback(
    async (data: ClaimFormData) => {
      const current = useGamificationStore.getState()
      if (!current.spinResult?.redemptionId || isClaimSubmitting) return

      setIsClaimSubmitting(true)
      try {
        const result = await onClaimPrize({
          redemptionId: current.spinResult.redemptionId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
        })
        current.setClaimResult(result)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erreur lors de la réclamation"
        current.setError(message)
      } finally {
        setIsClaimSubmitting(false)
      }
    },
    [onClaimPrize, isClaimSubmitting]
  )

  const handleStartGame = useCallback(() => {
    store.startGame()
  }, [])
  const handleScratchReveal = useCallback(() => {
    const current = useGamificationStore.getState()
    if (current.spinResult) {
      current.setStep("result")
    }
  }, [])

  const handleClose = useCallback(() => {
    // User can close the page
  }, [])

  // === Render — One screen per step ===

  const { step, settings } = store
  const { primaryColor, secondaryColor, backgroundImage } = settings

  const containerStyle: React.CSSProperties = {
    background: backgroundImage
      ? `url(${backgroundImage}) center/cover no-repeat`
      : `radial-gradient(ellipse at center, ${secondaryColor}22 0%, #0a0a0a 70%)`,
  }

  // Wrapper for screens that use containerStyle with optional background image
  const bgOverlay = backgroundImage ? (
    <div className="absolute inset-0 bg-black/60 z-0" />
  ) : null

  // --- LOADING ---
  if (step === "loading" || isLoading) {
    return (
      <div className="relative flex items-center justify-center min-h-screen bg-black overflow-hidden">
        {/* Animated grid background */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Pulsing glow behind loader */}
        <div
          className="absolute w-40 h-40 rounded-full blur-3xl animate-pulse"
          style={{ backgroundColor: `${primaryColor}30` }}
        />

        <div className="relative z-10 flex flex-col items-center gap-6">
          {/* Gaming-style loader: rotating ring + inner dot */}
          <div className="relative w-16 h-16">
            {/* Outer ring */}
            <div
              className="absolute inset-0 rounded-full border-[3px] border-transparent animate-spin"
              style={{
                borderTopColor: primaryColor,
                borderRightColor: `${primaryColor}40`,
                animationDuration: "0.8s",
              }}
            />
            {/* Inner ring (counter-rotate) */}
            <div
              className="absolute inset-2 rounded-full border-[2px] border-transparent"
              style={{
                borderBottomColor: `${primaryColor}80`,
                borderLeftColor: `${primaryColor}20`,
                animation: "spin 1.2s linear infinite reverse",
              }}
            />
            {/* Center dot */}
            <div
              className="absolute inset-0 flex items-center justify-center"
            >
              <div
                className="w-2.5 h-2.5 rounded-full animate-pulse"
                style={{ backgroundColor: primaryColor }}
              />
            </div>
          </div>

          {/* Loading text with typing dots */}
          <div className="flex items-center gap-1">
            <p className="text-white/50 text-sm font-medium tracking-wide uppercase">
              Chargement
            </p>
            <span className="flex gap-0.5 mt-0.5">
              <span className="w-1 h-1 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          </div>
        </div>
      </div>
    )
  }

  // --- ERROR ---
  if (step === "error") {
    return (
      <div className="relative flex items-center justify-center min-h-screen" style={containerStyle}>
        {bgOverlay}
        <div className="relative z-10 text-center p-8">
          <div className="text-5xl mb-4">{"\u26A0\uFE0F"}</div>
          <h2 className="text-xl font-bold text-white mb-2">Oups !</h2>
          <p className="text-white/70">{store.errorMessage}</p>
        </div>
      </div>
    )
  }

  // --- COOLDOWN ---
  if (step === "cooldown" && store.nextPlayAt) {
    return (
      <div className="relative min-h-screen" style={containerStyle}>
        {bgOverlay}
        <div className="relative z-10">
          <CooldownScreen
            nextPlayAt={store.nextPlayAt}
            storeName={store.store?.name ?? ""}
            primaryColor={primaryColor}
          />
        </div>
      </div>
    )
  }

  // --- SCRATCH CARD VIEW (welcome / actions / scratch / scratching) ---
  if (
    (step === "welcome" || step === "actions" || step === "scratch" || step === "scratching") &&
    store.game?.type === "scratch_card"
  ) {
    return (
      <ScratchCardGameView
        step={step as "welcome" | "actions" | "scratch" | "scratching"}
        storeName={store.store?.name ?? ""}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        backgroundImage={backgroundImage}
        prizeText={store.spinResult?.prizeName ?? (store.spinResult?.didWin === false ? "Pas de chance..." : "")}
        didWin={store.spinResult?.didWin ?? false}
        hasActions={store.actions.length > 0}
        onStart={handleStartGame}
        actions={store.actions}
        completedIds={store.completedActionIds}
        activeTimers={store.activeTimers}
        onActionClick={handleActionClick}
        onTimerTick={handleTimerTick}
        onReveal={handleScratchReveal}
      />
    )
  }

  // --- COMBINED VIEW (welcome / actions / wheel / spinning) ---
  if (step === "welcome" || step === "actions" || step === "wheel" || step === "spinning") {
    return (
      <CombinedGameView
        step={step}
        storeName={store.store?.name ?? ""}
        segments={store.sections.map((s) => ({ label: s.prizeName || s.label, color: s.color }))}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        backgroundImage={backgroundImage}
        hasActions={store.actions.length > 0}
        onStart={handleStartGame}
        actions={store.actions}
        completedIds={store.completedActionIds}
        activeTimers={store.activeTimers}
        onActionClick={handleActionClick}
        onTimerTick={handleTimerTick}
        onSpin={handleSpin}
        isSpinning={isSpinning}
        targetIndex={store.spinResult?.segmentIndex ?? null}
        didWin={store.spinResult?.didWin}
        onSpinComplete={handleSpinComplete}
      />
    )
  }

  // Shared footer for standalone screens
  const footer = <FooterBar storeName={store.store?.name ?? ""} primaryColor={primaryColor} />

  // --- RESULT ---
  if (step === "result" && store.spinResult) {
    return (
      <div className="relative flex flex-col min-h-screen" style={containerStyle}>
        {bgOverlay}
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <ResultScreen
            didWin={store.spinResult.didWin}
            prizeName={store.spinResult.prizeName}
            onClaim={handleClaim}
            onClose={handleClose}
            primaryColor={primaryColor}
          />
        </div>
        {footer}
      </div>
    )
  }

  // --- CLAIM FORM ---
  if (step === "claim" && store.spinResult) {
    return (
      <div className="relative flex flex-col min-h-screen" style={containerStyle}>
        {bgOverlay}
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <ClaimForm
            prizeName={store.spinResult.prizeName ?? "Prix"}
            onSubmit={handleClaimSubmit}
            isSubmitting={isClaimSubmitting}
            primaryColor={primaryColor}
          />
        </div>
        {footer}
      </div>
    )
  }

  // --- CONFIRMATION ---
  if (step === "confirmation" && store.claimResult) {
    return (
      <div className="relative flex flex-col min-h-screen" style={containerStyle}>
        {bgOverlay}
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <ConfirmationScreen
            prizeName={store.claimResult.prizeName}
            redemptionCode={store.claimResult.redemptionCode}
            email={store.claimResult.email}
            expiresAt={store.claimResult.expiresAt}
            primaryColor={primaryColor}
          />
        </div>
        {footer}
      </div>
    )
  }

  // Fallback
  return null
}
