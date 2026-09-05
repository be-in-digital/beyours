"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery } from "convex/react"
import { AnimatePresence, motion } from "framer-motion"
import type { GamePlayerFlowProps } from "./api-contract"
import { resolveGameCopy } from "./game-copy"
import {
  ParticleEngine,
  buildWheelSegments,
  getDeviceFingerprint,
  pickTargetSegment,
  type GamePhase,
  type GameSession,
  type PlayResult,
} from "./lib"
import { GameShell } from "./game-shell"
import { WelcomeScreen } from "./welcome-screen"
import { ActionsScreen } from "./actions-screen"
import { ReferralScreen } from "./referral-screen"
import { WheelGame } from "./wheel-game"
import { ScratchGame } from "./scratch-game"
import { ResultScreen } from "./result-screen"
import { ClaimForm, type ClaimValues } from "./claim-form"
import { RewardTicket } from "./reward-ticket"
import { CooldownScreen } from "./cooldown-screen"

/**
 * Player flow state machine:
 * loading → welcome → (actions) → game → result → claim → reward
 * with cooldown / unavailable exits. Outcomes come from the server.
 */

export function GamePlayerFlow({ qrCode, api, copy }: GamePlayerFlowProps) {
  const code = qrCode

  // Runs on the client's first render; SSR gets "server" (query stays skipped
  // until hydration re-renders with the real id — output is the loading screen
  // either way).
  const [fingerprint] = useState<string>(() => getDeviceFingerprint())
  const [ref] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined
    return new URLSearchParams(window.location.search).get("ref") ?? undefined
  })

  const session = useQuery(
    api.getSession,
    fingerprint !== "server" ? { code, fingerprint, ref } : "skip"
  ) as
    | GameSession
    | { status: "not_found" }
    | { status: "no_game"; store: { name: string } }
    | undefined

  const recordScan = useMutation(api.recordScan)
  const playMutation = useMutation(api.play)
  const claimMutation = useMutation(api.claim)
  const ensureReferralCode = useMutation(api.ensureReferralCode)

  const [phase, setPhase] = useState<GamePhase>("loading")
  const [playResult, setPlayResult] = useState<PlayResult | null>(null)
  const [completedActions, setCompletedActions] = useState<string[]>([])
  const [reward, setReward] = useState<{ code: string; expiresAt: number; email: string } | null>(
    null
  )
  const [cooldownAt, setCooldownAt] = useState<number | null>(null)
  const [engine, setEngine] = useState<ParticleEngine | null>(null)
  const scannedRef = useRef(false)
  const playingRef = useRef(false)

  const ready = session !== undefined && session.status === "ready"
  const gameSession = ready ? (session as GameSession) : null

  // The hero subtitle differs between a wheel and a scratch card, so the copy
  // cannot be resolved until the session says which game this is.
  const text = useMemo(
    () => resolveGameCopy(copy, gameSession?.game.type ?? "wheel"),
    [copy, gameSession?.game.type]
  )

  // Count the scan once per mount
  useEffect(() => {
    if (!scannedRef.current && code) {
      scannedRef.current = true
      void recordScan({ code }).catch(() => undefined)
    }
  }, [code, recordScan])

  // The initial phase is derived from the session; explicit transitions
  // (user actions, play errors) take over via setPhase.
  const effectivePhase: GamePhase = useMemo(() => {
    if (phase !== "loading") return phase
    if (session === undefined) return "loading"
    if (session.status !== "ready") return "unavailable"
    if (session.cooldown.active && session.cooldown.nextPlayAt) return "cooldown"
    return "welcome"
  }, [phase, session])

  const effectiveCooldownAt =
    cooldownAt ?? (gameSession?.cooldown.active ? (gameSession.cooldown.nextPlayAt ?? null) : null)

  const wheelSegments = useMemo(
    () =>
      gameSession
        ? buildWheelSegments(gameSession.prizes, gameSession.game.config?.wheelSections)
        : [],
    [gameSession]
  )

  // "One action per visit" progression: the action currently due (sequential
  // mode), or null once everything is done. "all" mode keeps the old flow.
  const currentAction = useMemo(() => {
    if (!gameSession) return null
    const prog = gameSession.progression
    if (prog.mode === "sequential") {
      if (!prog.currentActionId) return null
      return gameSession.actions.find((a) => a.id === prog.currentActionId) ?? null
    }
    return null
  }, [gameSession])

  const hasActionToDo = useMemo(() => {
    if (!gameSession) return false
    const prog = gameSession.progression
    if (prog.mode === "sequential") return prog.currentActionId !== null
    return gameSession.actions.length > 0
  }, [gameSession])

  const isFriendWelcome = gameSession?.referral.isFriendWelcome ?? false
  const referralEnabled = gameSession?.referral.enabled ?? false
  const bonusAvailable = (gameSession?.referral.pendingBonuses ?? 0) > 0

  // After the welcome screen: referred friend → straight to the game (free
  // spin); referrer bonus spin → straight to the game; social action pending →
  // actions; social actions exhausted + referral enabled → referral (share to
  // play again).
  const afterWelcome: GamePhase = useMemo(() => {
    if (!gameSession) return "game"
    if (isFriendWelcome) return "game"
    if (bonusAvailable) return "game"
    if (hasActionToDo) return "actions"
    if (referralEnabled) return "referral"
    return "game"
  }, [gameSession, isFriendWelcome, bonusAvailable, hasActionToDo, referralEnabled])

  // ------------------------------------------------------------------
  // Play resolution (shared by both games)
  // ------------------------------------------------------------------
  const resolvePlay = useCallback(async (): Promise<PlayResult | null> => {
    if (!gameSession || !fingerprint || playingRef.current) return null
    playingRef.current = true
    try {
      const result = (await playMutation({
        code,
        gameId: gameSession.game.id,
        fingerprint,
        completedActions,
        ref,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      })) as PlayResult
      setPlayResult(result)
      return result
    } catch (error) {
      playingRef.current = false
      const message = error instanceof Error ? error.message : ""
      const cooldownMatch = message.match(/COOLDOWN_ACTIVE:(\d+)/)
      if (cooldownMatch) {
        setCooldownAt(Number(cooldownMatch[1]))
        setPhase("cooldown")
      }
      // The server now applies the required-actions rule too, so a session that
      // went stale between load and spin — the owner activated an action while
      // the page was open — comes back here instead of leaving a dead wheel.
      // Sending the player to the actions screen shows them the one thing left
      // to do; `getSession` is live, so it already carries the new action.
      if (message.includes("ACTIONS_INCOMPLETE")) {
        setCompletedActions([])
        setPhase("actions")
      }
      return null
    }
  }, [gameSession, fingerprint, playMutation, code, completedActions, ref])

  const handleWheelSpin = useCallback(async (): Promise<number | null> => {
    const result = await resolvePlay()
    if (!result) return null
    return pickTargetSegment(wheelSegments, result.didWin, result.prize?.id ?? null)
  }, [resolvePlay, wheelSegments])

  const handleScratchStart = useCallback(async (): Promise<boolean | null> => {
    const result = await resolvePlay()
    if (!result) return null
    return result.didWin
  }, [resolvePlay])

  const showResult = useCallback(() => {
    setPhase("result")
  }, [])

  // Celebration when the result screen lands on a win
  useEffect(() => {
    if (effectivePhase === "result" && playResult?.didWin && engine) {
      engine.cannons()
      engine.rain(2600)
      const encore = window.setTimeout(() => engine.cannons(), 900)
      return () => window.clearTimeout(encore)
    }
    return undefined
  }, [effectivePhase, playResult?.didWin, engine])

  // ------------------------------------------------------------------
  // Claim
  // ------------------------------------------------------------------
  const handleClaim = useCallback(
    async (values: ClaimValues) => {
      if (!playResult) return
      const response = (await claimMutation({
        playId: playResult.playId,
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone || undefined,
      })) as { code: string; expiresAt: number }
      setReward({ code: response.code, expiresAt: response.expiresAt, email: values.email })
      setPhase("reward")
    },
    [claimMutation, playResult]
  )

  // ------------------------------------------------------------------
  // Screens
  // ------------------------------------------------------------------
  const storeName = gameSession?.store.name ?? (session?.status === "no_game" ? session.store.name : undefined)

  return (
    <GameShell
      storeName={storeName}
      tableNumber={gameSession?.tableNumber}
      onEngineReady={setEngine}
    >
      <AnimatePresence mode="wait">
        {effectivePhase === "loading" && (
          <motion.div
            key="loading"
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-1 flex-col items-center justify-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
              className="text-5xl"
              aria-hidden
            >
              🎡
            </motion.div>
            <p className="mt-4 text-sm text-white/45">Préparation du jeu…</p>
          </motion.div>
        )}

        {effectivePhase === "unavailable" && (
          <motion.div
            key="unavailable"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-1 flex-col items-center justify-center text-center"
          >
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-4xl">
              😴
            </div>
            <h1 className="font-heading text-2xl font-bold text-white/90">
              Le jeu fait une pause
            </h1>
            <p className="mt-2 max-w-xs text-sm text-white/50">
              {session?.status === "no_game"
                ? "Aucun jeu n'est actif pour le moment. Revenez bientôt !"
                : "Ce QR code n'est plus actif. Demandez au personnel !"}
            </p>
            <Link
              href="/"
              className="mt-8 rounded-full border border-white/15 bg-white/[0.06] px-8 py-3 text-sm font-semibold text-white/80"
            >
              Voir la carte
            </Link>
          </motion.div>
        )}

        {effectivePhase === "welcome" && gameSession && (
          <motion.div key="welcome" className="flex flex-1 flex-col" exit={{ opacity: 0, x: -40 }}>
            <WelcomeScreen
              title={text.heroTitle}
              subtitle={text.heroSubtitle}
              gameType={gameSession.game.type}
              prizes={gameSession.prizes}
              hasActions={afterWelcome !== "game"}
              inviteBanner={
                isFriendWelcome
                  ? `Un ami vous offre ${gameSession.referral.friendRewardLabel ?? "un tour"} !`
                  : undefined
              }
              bonusCount={gameSession.referral.pendingBonuses}
              onStart={() => setPhase(afterWelcome)}
            />
          </motion.div>
        )}

        {effectivePhase === "actions" && gameSession && (
          <motion.div key="actions" className="flex flex-1 flex-col" exit={{ opacity: 0, x: -40 }}>
            <ActionsScreen
              actions={gameSession.actions}
              mode={gameSession.progression.mode}
              currentActionId={
                gameSession.progression.mode === "sequential"
                  ? gameSession.progression.currentActionId
                  : null
              }
              completedActionIds={
                gameSession.progression.mode === "sequential"
                  ? gameSession.progression.completedActionIds
                  : []
              }
              onAllDone={(ids) => {
                setCompletedActions(ids)
                setPhase("game")
              }}
            />
          </motion.div>
        )}

        {effectivePhase === "referral" && gameSession && (
          <motion.div key="referral" className="flex flex-1 flex-col" exit={{ opacity: 0, x: -40 }}>
            <ReferralScreen
              qrCode={code}
              initialShareCode={gameSession.referral.myShareCode}
              friendRewardLabel={gameSession.referral.friendRewardLabel}
              mintShareCode={async () => {
                const res = await ensureReferralCode({ code, fingerprint })
                return res.code
              }}
              onDone={() => {
                setCompletedActions([])
                setPhase("game")
              }}
            />
          </motion.div>
        )}

        {effectivePhase === "game" && gameSession && (
          <motion.div
            key="game"
            className="flex flex-1 flex-col items-center justify-center"
            exit={{ opacity: 0, scale: 0.96 }}
          >
            <div className="mb-6 text-center">
              <h2 className="font-heading text-2xl font-bold">
                {gameSession.game.type === "wheel" ? "Tout se joue maintenant" : "Moment de vérité"}
              </h2>
              <p className="mt-1 text-sm text-white/50">
                {gameSession.game.name}
              </p>
            </div>
            {gameSession.game.type === "wheel" ? (
              <WheelGame
                segments={wheelSegments}
                onSpin={handleWheelSpin}
                onLanded={showResult}
              />
            ) : (
              <ScratchGame
                onScratchStart={handleScratchStart}
                onRevealed={showResult}
                particles={engine}
                prizeName={playResult?.prize?.name}
              />
            )}
          </motion.div>
        )}

        {effectivePhase === "result" && playResult && (
          <motion.div key="result" className="flex flex-1 flex-col" exit={{ opacity: 0 }}>
            <ResultScreen
              didWin={playResult.didWin}
              prize={playResult.prize}
              winTitle={text.winTitle}
              winDescription={text.winDescription}
              loseTitle={text.loseTitle}
              loseDescription={text.loseDescription}
              onClaim={() => setPhase("claim")}
              onFinishLose={() => {
                setCooldownAt(playResult.nextPlayAt)
                setPhase("cooldown")
              }}
            />
          </motion.div>
        )}

        {effectivePhase === "claim" && playResult && (
          <motion.div key="claim" className="flex flex-1 flex-col" exit={{ opacity: 0, x: -40 }}>
            <ClaimForm prize={playResult.prize} onSubmit={handleClaim} />
          </motion.div>
        )}

        {effectivePhase === "reward" && reward && (
          <motion.div key="reward" className="flex flex-1 flex-col" exit={{ opacity: 0 }}>
            <RewardTicket
              code={reward.code}
              expiresAt={reward.expiresAt}
              prize={playResult?.prize ?? null}
              storeName={gameSession?.store.name}
              email={reward.email}
            />
          </motion.div>
        )}

        {effectivePhase === "cooldown" && effectiveCooldownAt && (
          <motion.div key="cooldown" className="flex flex-1 flex-col" exit={{ opacity: 0 }}>
            <CooldownScreen
              nextPlayAt={effectiveCooldownAt}
              onExpired={() => {
                setCooldownAt(null)
                setPhase("welcome")
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </GameShell>
  )
}
