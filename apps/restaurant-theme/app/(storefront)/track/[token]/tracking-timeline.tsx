"use client"

type TicketStatus = "pending" | "in_progress" | "ready" | "completed"

interface TrackingTimelineProps {
  status: TicketStatus
}

const STEPS: { key: TicketStatus; label: string }[] = [
  { key: "pending", label: "Commande recue" },
  { key: "in_progress", label: "En preparation" },
  { key: "ready", label: "Prete" },
  { key: "completed", label: "Terminee" },
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
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="space-y-0">
        {STEPS.map((step, index) => {
          const isDone = index <= currentIndex
          const isCurrent = index === currentIndex

          return (
            <div key={step.key} className="flex items-start gap-3">
              {/* Dot + line */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    isDone
                      ? "bg-green-500 border-green-500"
                      : "bg-white border-gray-300"
                  } ${isCurrent ? "ring-4 ring-green-100" : ""}`}
                />
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-0.5 h-8 ${
                      index < currentIndex ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>

              {/* Label */}
              <div className="pb-6">
                <p
                  className={`text-sm font-medium ${
                    isDone ? "text-gray-900" : "text-gray-400"
                  } ${isCurrent ? "font-bold" : ""}`}
                >
                  {step.label}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
