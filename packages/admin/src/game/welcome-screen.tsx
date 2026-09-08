"use client"

import { motion } from "framer-motion"
import { SparklesIcon, Clock3Icon } from "lucide-react"
import { gameSounds, haptics, type GamePrize } from "./lib"
import { prizeEmoji } from "./prize-emoji"
import type { GameConsentNotice } from "./consent-copy"

/**
 * Cinematic lobby: the store's marquee, what's at stake, one glowing CTA.
 */

interface WelcomeScreenProps {
  title: string
  subtitle?: string
  gameType: "wheel" | "scratch_card"
  prizes: GamePrize[]
  hasActions: boolean
  inviteBanner?: string
  bonusCount?: number
  /** The wording the diner must accept before anything is recorded. */
  consent: GameConsentNotice
  consentAccepted: boolean
  onConsentChange: (accepted: boolean) => void
  onStart: () => void
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
} as const

const itemVariants = {
  hidden: { opacity: 0, y: 26 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 180, damping: 20 },
  },
} as const

export function WelcomeScreen({
  title,
  subtitle,
  gameType,
  prizes,
  hasActions,
  inviteBanner,
  bonusCount,
  consent,
  consentAccepted,
  onConsentChange,
  onStart,
}: WelcomeScreenProps) {
  const handleStart = () => {
    // The button is disabled without the tick, but a disabled button is a
    // presentation detail — the refusal that counts is `gamePlay.play`'s, and
    // this guard is what keeps the two agreeing if the styling ever drifts.
    if (!consentAccepted) return
    gameSounds.unlock()
    gameSounds.pop()
    haptics.light()
    onStart()
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-1 flex-col items-center justify-center text-center"
    >
      {(inviteBanner || (bonusCount ?? 0) > 0) && (
        <motion.div
          variants={itemVariants}
          className="mb-5 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-200"
        >
          🎁{" "}
          {inviteBanner ??
            `${bonusCount} tour${(bonusCount ?? 0) > 1 ? "s" : ""} bonus disponible${
              (bonusCount ?? 0) > 1 ? "s" : ""
            }`}
        </motion.div>
      )}

      {/* Marquee emblem */}
      <motion.div variants={itemVariants} className="relative mb-6">
        <motion.div
          className="absolute inset-0 rounded-full bg-amber-400/30 blur-2xl"
          animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-amber-300/60 bg-gradient-to-b from-[#2b2140] to-[#191225] text-5xl shadow-[0_0_45px_rgba(245,165,36,0.35)]">
          {gameType === "wheel" ? "🎡" : "🎟️"}
        </div>
      </motion.div>

      <motion.h1
        variants={itemVariants}
        className="font-heading text-4xl font-bold leading-tight"
      >
        <span className="bg-gradient-to-b from-amber-200 via-amber-400 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(245,165,36,0.35)]">
          {title}
        </span>
      </motion.h1>

      {subtitle && (
        <motion.p variants={itemVariants} className="mt-3 max-w-xs text-sm text-white/60">
          {subtitle}
        </motion.p>
      )}

      {/* Prize showcase */}
      {prizes.length > 0 && (
        <motion.div variants={itemVariants} className="mt-8 w-full">
          <p className="mb-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
            <SparklesIcon className="h-3 w-3 text-amber-300" />
            À gagner ce soir
            <SparklesIcon className="h-3 w-3 text-amber-300" />
          </p>
          <div className="flex justify-center gap-2.5">
            {prizes.slice(0, 3).map((prize, i) => (
              <motion.div
                key={prize.id}
                animate={{ y: [0, -7, 0] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: i * 0.45,
                  ease: "easeInOut",
                }}
                className="flex w-[104px] flex-col items-center rounded-2xl border border-amber-300/20 bg-white/[0.05] px-2.5 py-3.5 backdrop-blur-sm"
              >
                <span className="text-2xl" aria-hidden>
                  {prizeEmoji(prize.type)}
                </span>
                <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-tight text-white/85">
                  {prize.name}
                </p>
              </motion.div>
            ))}
          </div>
          {prizes.length > 3 && (
            <p className="mt-2 text-[11px] text-white/70">
              + {prizes.length - 3} autre{prizes.length - 3 > 1 ? "s" : ""} lot
              {prizes.length - 3 > 1 ? "s" : ""}…
            </p>
          )}
        </motion.div>
      )}

      {/*
        Consent — above the CTA, because it gates it (RGPD art. 7.1).

        Unticked on every mount and never pre-ticked: a box the diner did not
        touch is not consent (art. 4.11 — "freely given, specific, informed and
        unambiguous"), and a pre-ticked one is the textbook example of what
        does not count.
      */}
      <motion.div variants={itemVariants} className="mt-8 w-full max-w-xs text-left">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(event) => onConsentChange(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-amber-400"
            aria-describedby="game-consent-detail"
          />
          <span className="text-[13px] font-medium leading-snug text-white/85">
            {consent.label}
          </span>
        </label>
        <p id="game-consent-detail" className="mt-2 px-1 text-[11px] leading-relaxed text-white/70">
          {consent.detail}
        </p>
      </motion.div>

      {/* CTA */}
      <motion.div variants={itemVariants} className="mt-6 w-full max-w-xs">
        <motion.button
          type="button"
          onClick={handleStart}
          disabled={!consentAccepted}
          whileTap={consentAccepted ? { scale: 0.95 } : undefined}
          className="relative w-full rounded-full bg-gradient-to-b from-amber-400 to-orange-600 py-4 font-heading text-lg font-bold uppercase tracking-widest text-[#120d1a] shadow-[0_10px_35px_rgba(249,115,22,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          C&apos;est parti !
          {consentAccepted && (
            <motion.span
              className="absolute inset-0 rounded-full ring-2 ring-amber-300/70"
              animate={{ opacity: [0.8, 0, 0.8], scale: [1, 1.14, 1] }}
              transition={{ duration: 1.7, repeat: Infinity, ease: "easeOut" }}
              aria-hidden
            />
          )}
        </motion.button>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-white/70">
          <Clock3Icon className="h-3 w-3" />
          1 partie par personne toutes les 24h
          {hasActions ? " · quelques étapes pour débloquer" : ""}
        </p>
      </motion.div>
    </motion.div>
  )
}
