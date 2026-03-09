"use client"

import { useEffect, useRef } from "react"

export interface SocialActionItem {
  _id: string
  name: string
  type: string
  description?: string
  url?: string
  icon?: string
  timerSeconds: number
}

export interface SocialActionsProps {
  actions: SocialActionItem[]
  completedIds: string[]
  activeTimers: Record<string, number>
  onActionClick: (actionId: string) => void
  onTimerTick: (actionId: string) => void
  primaryColor?: string
}

const ACTION_ICONS: Record<string, string> = {
  google_review: "\u2B50",
  instagram_follow: "\uD83D\uDCF7",
  facebook_like: "\uD83D\uDC4D",
  tiktok_follow: "\uD83C\uDFB5",
  email_subscribe: "\u2709\uFE0F",
}

/**
 * Sequential social actions — shows one action at a time with numbered steps.
 * User completes Action 1 → moves to Action 2 → etc.
 */
export function SocialActions({
  actions,
  completedIds,
  activeTimers,
  onActionClick,
  onTimerTick,
  primaryColor = "#000000",
}: SocialActionsProps) {
  const intervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  // Manage timer intervals
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

  // Find the current action (first non-completed)
  const currentIndex = actions.findIndex((a) => !completedIds.includes(a._id))
  const currentAction = currentIndex >= 0 ? actions[currentIndex] : null
  const totalSteps = actions.length
  const completedCount = completedIds.length

  const handleClick = () => {
    if (!currentAction) return
    if (activeTimers[currentAction._id] !== undefined) return

    if (currentAction.url) {
      window.open(currentAction.url, "_blank", "noopener,noreferrer")
    }

    onActionClick(currentAction._id)
  }

  // All actions completed
  if (!currentAction) return null

  const timerRemaining = activeTimers[currentAction._id]
  const isTimerActive = timerRemaining !== undefined && timerRemaining > 0
  const icon = currentAction.icon || ACTION_ICONS[currentAction.type] || "\u2714\uFE0F"
  const stepNumber = currentIndex + 1

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {actions.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i < completedCount
                ? "w-8"
                : i === currentIndex
                  ? "w-8"
                  : "w-2"
            }`}
            style={{
              backgroundColor:
                i < completedCount
                  ? "#22c55e"
                  : i === currentIndex
                    ? primaryColor
                    : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
      </div>

      <p className="text-sm text-white/60">
        {`\u00C9tape ${stepNumber} sur ${totalSteps}`}
      </p>

      {/* Current action card */}
      <button
        onClick={handleClick}
        disabled={isTimerActive}
        className={`
          relative flex flex-col items-center gap-3 w-full p-6 rounded-2xl transition-all
          ${
            isTimerActive
              ? "bg-white/5 border border-white/20 cursor-wait"
              : "bg-white/10 border border-white/20 hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          }
        `}
      >
        <span className="text-4xl">{icon}</span>

        <p className="font-semibold text-white text-lg text-center">
          {currentAction.name}
        </p>

        {currentAction.description && (
          <p className="text-sm text-white/50 text-center">{currentAction.description}</p>
        )}

        {/* Timer countdown */}
        {isTimerActive && (
          <div className="flex flex-col items-center gap-2 mt-2">
            <div
              className="w-14 h-14 rounded-full border-3 flex items-center justify-center"
              style={{ borderColor: primaryColor }}
            >
              <span className="text-lg font-mono font-bold text-white">{timerRemaining}</span>
            </div>
            <p className="text-xs text-white/40">Validation en cours...</p>
          </div>
        )}

        {/* Progress bar */}
        {isTimerActive && (
          <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl overflow-hidden bg-white/10">
            <div
              className="h-full transition-all duration-1000 ease-linear"
              style={{
                backgroundColor: primaryColor,
                width: `${((currentAction.timerSeconds - timerRemaining) / currentAction.timerSeconds) * 100}%`,
              }}
            />
          </div>
        )}

        {/* Call to action when not timing */}
        {!isTimerActive && (
          <p className="text-xs text-white/40 mt-1">Appuyez pour continuer</p>
        )}
      </button>
    </div>
  )
}
