"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  StarIcon,
  InstagramIcon,
  ThumbsUpIcon,
  MusicIcon,
  MailIcon,
  CheckIcon,
  ExternalLinkIcon,
  LockIcon,
  UnlockIcon,
} from "lucide-react"
import { gameSounds, haptics, type GameAction, type GameActionType } from "./lib"

/**
 * Pre-game actions screen.
 *
 * - "sequential" mode (product default): ONE action per visit. The customer
 *   performs the action — we open the link, then a dwell countdown runs on
 *   return — then plays. A stepper tracks progress from visit to visit.
 * - "all" mode (legacy): every required action at once.
 *
 * NOTHING HERE VERIFIES ANYTHING, AND THE COPY NO LONGER SAYS IT DOES (#107).
 * This screen used to show the diner « Vérification… 12s » and the owner a field
 * labelled « Durée de vérification (s) ». There is no verification: the product
 * opens a link and counts seconds. It cannot read whether a Google review was
 * left — the Places API exposes reviews of a place, not the identity of the
 * device that left one — and Instagram and Facebook have no follow-check for a
 * visitor with no account link.
 *
 * So the countdown is what it is: a dwell timer, long enough that the tab was
 * actually opened, and the action itself is the diner's own declaration. The
 * words say that now, on both sides. This matters beyond honesty — an owner who
 * believes the platform checks will set a win ratio as if the reviews were
 * guaranteed, and the prize budget is real money.
 */

interface ActionsScreenProps {
  actions: GameAction[]
  onAllDone: (completedIds: string[]) => void
  mode?: "all" | "sequential"
  currentActionId?: string | null
  completedActionIds?: string[]
}

/**
 * `waiting` is the dwell countdown, not a check.
 *
 * It was called `verifying`, which is what leaked into the diner's copy. The name
 * stays honest so the next person rendering it cannot reintroduce the claim.
 */
type QuestStatus = "todo" | "waiting" | "done"

const ACTION_META: Record<GameActionType, { icon: React.ReactNode; label: string }> = {
  google_review: { icon: <StarIcon className="h-5 w-5" />, label: "Avis Google" },
  instagram_follow: { icon: <InstagramIcon className="h-5 w-5" />, label: "Instagram" },
  facebook_like: { icon: <ThumbsUpIcon className="h-5 w-5" />, label: "Facebook" },
  tiktok_follow: { icon: <MusicIcon className="h-5 w-5" />, label: "TikTok" },
  email_subscribe: { icon: <MailIcon className="h-5 w-5" />, label: "Newsletter" },
}

const DEFAULT_TIMER_SECONDS = 8

export function ActionsScreen({
  actions,
  onAllDone,
  mode = "all",
  currentActionId = null,
  completedActionIds = [],
}: ActionsScreenProps) {
  const [statuses, setStatuses] = useState<Record<string, QuestStatus>>({})
  const [countdowns, setCountdowns] = useState<Record<string, number>>({})
  const timersRef = useRef<Record<string, number>>({})

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      Object.values(timers).forEach((id) => window.clearInterval(id))
    }
  }, [])

  const startQuest = (action: GameAction) => {
    if (statuses[action.id] === "done" || statuses[action.id] === "waiting") return
    gameSounds.unlock()
    gameSounds.pop()
    haptics.light()
    if (action.url) {
      window.open(action.url, "_blank", "noopener,noreferrer")
    }
    const seconds = action.timerSeconds ?? DEFAULT_TIMER_SECONDS
    setStatuses((prev) => ({ ...prev, [action.id]: "waiting" }))
    setCountdowns((prev) => ({ ...prev, [action.id]: seconds }))

    const intervalId = window.setInterval(() => {
      setCountdowns((prev) => {
        const current = prev[action.id] ?? 0
        if (current <= 1) {
          window.clearInterval(intervalId)
          delete timersRef.current[action.id]
          setStatuses((prevStatuses) => ({ ...prevStatuses, [action.id]: "done" }))
          gameSounds.chime()
          haptics.medium()
          return { ...prev, [action.id]: 0 }
        }
        return { ...prev, [action.id]: current - 1 }
      })
    }, 1000)
    timersRef.current[action.id] = intervalId
  }

  const current = useMemo(
    () =>
      mode === "sequential" && currentActionId
        ? (actions.find((a) => a.id === currentActionId) ?? null)
        : null,
    [mode, currentActionId, actions]
  )

  // ────────────────────────────────────────────────────────────
  // Sequential mode: a single action, with a progress stepper.
  // ────────────────────────────────────────────────────────────
  if (mode === "sequential" && current) {
    const currentStatus = statuses[current.id] ?? "todo"
    const meta = ACTION_META[current.type]
    const remaining = countdowns[current.id] ?? 0
    const total = current.timerSeconds ?? DEFAULT_TIMER_SECONDS
    const canPlay = currentStatus === "done"

    return (
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -40 }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
        className="flex flex-1 flex-col pt-4"
      >
        <div className="mb-5 text-center">
          <h2 className="font-heading text-2xl font-bold">Une action, une partie</h2>
          <p className="mt-1.5 text-sm text-white/55">
            En échange, tentez votre chance tout de suite.
          </p>
        </div>

        {/* Progress stepper (visit after visit) */}
        <div className="mb-7 flex items-center justify-center gap-2">
          {actions.map((a, i) => {
            const done = completedActionIds.includes(a.id) || statuses[a.id] === "done"
            const isCurrent = a.id === current.id
            const chipMeta = ACTION_META[a.type]
            return (
              <div key={a.id} className="flex items-center gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                    isCurrent
                      ? "bg-gradient-to-b from-amber-400 to-orange-500 text-[#3A1D00]"
                      : done
                        ? "bg-emerald-400/20 text-emerald-300"
                        : "bg-white/[0.06] text-white/70"
                  }`}
                  aria-label={chipMeta.label}
                >
                  {done && !isCurrent ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <span className="[&_svg]:h-4 [&_svg]:w-4">{chipMeta.icon}</span>
                  )}
                </div>
                {i < actions.length - 1 && (
                  <span className="h-px w-3 bg-white/10" aria-hidden />
                )}
              </div>
            )
          })}
        </div>

        {/* Single action card */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <motion.button
            type="button"
            onClick={() => startQuest(current)}
            disabled={currentStatus !== "todo"}
            whileTap={currentStatus === "todo" ? { scale: 0.97 } : undefined}
            className={`relative flex w-full flex-col items-center gap-4 overflow-hidden rounded-3xl border p-8 text-center transition-colors ${
              currentStatus === "done"
                ? "border-emerald-400/40 bg-emerald-400/[0.08]"
                : currentStatus === "waiting"
                  ? "border-amber-300/40 bg-amber-300/[0.06]"
                  : "border-white/10 bg-white/[0.05] active:bg-white/[0.09]"
            }`}
          >
            {currentStatus === "waiting" && total > 0 && (
              <motion.div
                className="absolute inset-x-0 bottom-0 h-1 bg-amber-300/40"
                initial={{ width: 0 }}
                animate={{ width: `${((total - remaining) / total) * 100}%` }}
                transition={{ ease: "linear", duration: 1 }}
                aria-hidden
              />
            )}
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-2xl ${
                currentStatus === "done"
                  ? "bg-emerald-400/20 text-emerald-300"
                  : "bg-white/10 text-amber-300"
              }`}
            >
              <AnimatePresence mode="wait" initial={false}>
                {currentStatus === "done" ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0, rotate: -40 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 16 }}
                  >
                    <CheckIcon className="h-7 w-7" />
                  </motion.span>
                ) : (
                  <motion.span key="icon" className="[&_svg]:h-7 [&_svg]:w-7" exit={{ scale: 0 }}>
                    {meta.icon}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div>
              <p className="font-heading text-lg font-bold text-white/90">{current.name}</p>
              <p className="mt-1 text-sm text-white/50">
                {currentStatus === "waiting"
                  ? `Validation… ${remaining}s`
                  : currentStatus === "done"
                    ? "C'est fait, merci !"
                    : (current.description ?? meta.label)}
              </p>
            </div>
            {currentStatus === "todo" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/80">
                {current.url && <ExternalLinkIcon className="h-4 w-4" />}
                Réaliser cette action
              </span>
            )}
          </motion.button>

          {currentStatus === "todo" && (
            <p className="mt-4 max-w-[15rem] text-center text-[11px] leading-relaxed text-white/70">
              On valide à votre retour. Vos données ne sont jamais lues.
            </p>
          )}
        </div>

        <div className="mt-auto pt-6">
          <motion.button
            type="button"
            onClick={() => {
              gameSounds.pop()
              haptics.medium()
              onAllDone([current.id as string])
            }}
            disabled={!canPlay}
            whileTap={canPlay ? { scale: 0.95 } : undefined}
            animate={
              canPlay
                ? { scale: [1, 1.04, 1], transition: { duration: 1.4, repeat: Infinity } }
                : {}
            }
            className={`flex w-full items-center justify-center gap-2 rounded-full py-4 font-heading text-base font-bold uppercase tracking-widest transition-all ${
              canPlay
                ? "bg-gradient-to-b from-amber-400 to-orange-600 text-[#120d1a] shadow-[0_10px_35px_rgba(249,115,22,0.5)]"
                : "cursor-not-allowed bg-white/10 text-white/35"
            }`}
          >
            {canPlay ? (
              <>
                <UnlockIcon className="h-4 w-4" /> Jouer maintenant
              </>
            ) : (
              <>
                <LockIcon className="h-4 w-4" /> Réalisez l&apos;action
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    )
  }

  // ────────────────────────────────────────────────────────────
  // "all" mode (legacy): every required action at once.
  // ────────────────────────────────────────────────────────────
  return <AllActionsView actions={actions} statuses={statuses} countdowns={countdowns} startQuest={startQuest} onAllDone={onAllDone} />
}

/* ── Legacy view (all actions) ── */

function AllActionsView({
  actions,
  statuses,
  countdowns,
  startQuest,
  onAllDone,
}: {
  actions: GameAction[]
  statuses: Record<string, QuestStatus>
  countdowns: Record<string, number>
  startQuest: (action: GameAction) => void
  onAllDone: (completedIds: string[]) => void
}) {
  const doneCount = useMemo(
    () => actions.filter((a) => statuses[a.id] === "done").length,
    [actions, statuses]
  )
  const requiredActions = useMemo(() => actions.filter((a) => a.isRequired), [actions])
  const allRequiredDone = useMemo(
    () =>
      requiredActions.length === 0 ||
      requiredActions.every((a) => statuses[a.id] === "done"),
    [requiredActions, statuses]
  )

  const handleUnlock = () => {
    gameSounds.pop()
    haptics.medium()
    onAllDone(actions.filter((a) => statuses[a.id] === "done").map((a) => a.id as string))
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: "spring", stiffness: 200, damping: 24 }}
      className="flex flex-1 flex-col pt-4"
    >
      <div className="mb-6 text-center">
        <h2 className="font-heading text-2xl font-bold">Débloquez votre partie</h2>
        <p className="mt-1.5 text-sm text-white/55">
          {requiredActions.length > 0
            ? "Un petit coup de pouce et la chance est à vous"
            : "Un dernier geste avant de jouer"}
        </p>
        <div className="mx-auto mt-4 h-2 w-48 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
            animate={{ width: `${actions.length > 0 ? (doneCount / actions.length) * 100 : 100}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
        <p className="mt-1.5 text-[11px] font-medium text-amber-300/80">
          {doneCount}/{actions.length} étape{actions.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {actions.map((action, index) => {
          const status = statuses[action.id] ?? "todo"
          const meta = ACTION_META[action.type]
          const remaining = countdowns[action.id] ?? 0
          const total = action.timerSeconds ?? DEFAULT_TIMER_SECONDS
          return (
            <motion.button
              key={action.id}
              type="button"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.09, type: "spring", stiffness: 200, damping: 22 }}
              onClick={() => startQuest(action)}
              disabled={status !== "todo"}
              className={`group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border p-4 text-left transition-colors ${
                status === "done"
                  ? "border-emerald-400/40 bg-emerald-400/[0.08]"
                  : status === "waiting"
                    ? "border-amber-300/40 bg-amber-300/[0.06]"
                    : "border-white/10 bg-white/[0.05] active:bg-white/[0.09]"
              }`}
            >
              {status === "waiting" && total > 0 && (
                <motion.div
                  className="absolute inset-y-0 left-0 bg-amber-300/10"
                  initial={{ width: 0 }}
                  animate={{ width: `${((total - remaining) / total) * 100}%` }}
                  transition={{ ease: "linear", duration: 1 }}
                  aria-hidden
                />
              )}
              <div
                className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  status === "done"
                    ? "bg-emerald-400/20 text-emerald-300"
                    : "bg-white/10 text-amber-300"
                }`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {status === "done" ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0, rotate: -40 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 420, damping: 16 }}
                    >
                      <CheckIcon className="h-5 w-5" />
                    </motion.span>
                  ) : (
                    <motion.span key="icon" initial={{ scale: 1 }} exit={{ scale: 0 }}>
                      {meta.icon}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div className="relative min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white/90">{action.name}</p>
                <p className="mt-0.5 truncate text-xs text-white/70">
                  {status === "waiting"
                    ? `Encore ${remaining} s…`
                    : status === "done"
                      ? "C'est fait, merci !"
                      : (action.description ?? meta.label)}
                </p>
              </div>
              <div className="relative shrink-0 text-white/70">
                {status === "todo" &&
                  (action.url ? (
                    <ExternalLinkIcon className="h-4 w-4" />
                  ) : (
                    <span className="text-[10px] font-semibold uppercase tracking-wide">Go</span>
                  ))}
                {status === "waiting" && (
                  <span className="font-mono text-sm font-bold text-amber-300">{remaining}</span>
                )}
                {!action.isRequired && status === "todo" && (
                  <span className="absolute -top-2 right-0 text-[9px] text-white/70">bonus</span>
                )}
              </div>
            </motion.button>
          )
        })}
      </div>

      <div className="mt-auto pt-8">
        <motion.button
          type="button"
          onClick={handleUnlock}
          disabled={!allRequiredDone}
          whileTap={allRequiredDone ? { scale: 0.95 } : undefined}
          animate={
            allRequiredDone
              ? { scale: [1, 1.04, 1], transition: { duration: 1.4, repeat: Infinity } }
              : {}
          }
          className={`flex w-full items-center justify-center gap-2 rounded-full py-4 font-heading text-base font-bold uppercase tracking-widest transition-all ${
            allRequiredDone
              ? "bg-gradient-to-b from-amber-400 to-orange-600 text-[#120d1a] shadow-[0_10px_35px_rgba(249,115,22,0.5)]"
              : "cursor-not-allowed bg-white/10 text-white/35"
          }`}
        >
          {allRequiredDone ? (
            <>
              <UnlockIcon className="h-4 w-4" /> Jouer maintenant
            </>
          ) : (
            <>
              <LockIcon className="h-4 w-4" /> Terminez les étapes
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  )
}
