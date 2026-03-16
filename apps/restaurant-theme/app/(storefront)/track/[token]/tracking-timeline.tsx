"use client"

import { Check } from "lucide-react"

type TicketStatus = "pending" | "in_progress" | "ready" | "completed"

interface TrackingTimelineProps {
  status: TicketStatus
}

const STEPS: { key: TicketStatus; label: string }[] = [
  { key: "pending", label: "Commande reçue" },
  { key: "in_progress", label: "En préparation" },
  { key: "ready", label: "Prête" },
  { key: "completed", label: "Terminée" },
]

const STATUS_INDEX: Record<TicketStatus, number> = {
  pending: 0,
  in_progress: 1,
  ready: 2,
  completed: 3,
}

export function TrackingTimeline({ status }: TrackingTimelineProps) {
  const currentIndex = STATUS_INDEX[status]

  return (
    <div className="rounded-[2rem] bg-white border border-zinc-100 p-8 shadow-2xl shadow-black/[0.04]">
      <h2 className="text-lg font-black uppercase tracking-tighter mb-8">Progression</h2>

      <div className="space-y-0">
        {STEPS.map((step, index) => {
          const isDone = index <= currentIndex
          const isCurrent = index === currentIndex
          const isLast = index === STEPS.length - 1

          return (
            <div key={step.key} className="flex items-start gap-4">
              {/* Dot + line */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 transition-all duration-500 ${
                    isDone
                      ? "bg-[#0D5C3F] text-white"
                      : "bg-zinc-100 text-zinc-300"
                  } ${isCurrent ? "ring-4 ring-emerald-100 scale-110" : ""}`}
                >
                  {isDone ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-current" />
                  )}
                </div>
                {!isLast && (
                  <div
                    className={`w-0.5 h-10 transition-colors duration-500 ${
                      index < currentIndex ? "bg-[#0D5C3F]" : "bg-zinc-100"
                    }`}
                  />
                )}
              </div>

              {/* Label */}
              <div className="pt-1.5 pb-6">
                <p
                  className={`text-sm transition-colors duration-300 ${
                    isDone ? "text-zinc-900 font-black" : "text-zinc-300 font-medium"
                  }`}
                >
                  {step.label}
                </p>
                {isCurrent && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#F97316] mt-1">
                    En cours
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
