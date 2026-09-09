"use client"

import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, Loader2, X } from "lucide-react"
import { Button } from "@be-in-digital/ui"

const LOADING_STATES = [
  { text: "Amelioration de l'image" },
  { text: "Analyse par l'IA (Vision GPT-4o)" },
  { text: "Enrichissement des descriptions" },
  { text: "Génération des images produits" },
  { text: "Categorisation automatique" },
  { text: "Finalisation des suggestions" },
]

interface AnalysisLoadingProps {
  className?: string
  /** Called when the user clicks the cancel button */
  onCancel?: () => void
}

export function AnalysisLoading({ className, onCancel }: AnalysisLoadingProps) {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) =>
        prev < LOADING_STATES.length - 1 ? prev + 1 : prev
      )
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className={className}>
      {/* Overlay backdrop */}
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <div className="relative mx-4 flex w-full max-w-md flex-col items-center gap-6">
            {/* Steps list */}
            <div className="w-full space-y-3">
              {LOADING_STATES.map((state, index) => {
                const isCompleted = index < currentStep
                const isActive = index === currentStep
                const isPending = index > currentStep

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    {/* Step indicator */}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                      {isCompleted ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary"
                        >
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </motion.div>
                      ) : isActive ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-muted-foreground/30">
                          <span className="text-xs text-muted-foreground">
                            {index + 1}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Step text */}
                    <span
                      className={`text-sm transition-colors duration-300 ${
                        isCompleted
                          ? "font-medium text-primary"
                          : isActive
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                      }`}
                    >
                      {state.text}
                    </span>

                    {/* Active indicator line */}
                    {isActive && (
                      <motion.div
                        layoutId="active-pill"
                        className="ml-auto h-1.5 w-1.5 rounded-full bg-primary"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    )}
                  </motion.div>
                )
              })}
            </div>

            {/* Progress bar */}
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: "0%" }}
                animate={{
                  width: `${((currentStep + 1) / LOADING_STATES.length) * 100}%`,
                }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
            </div>

            {/* Hint text */}
            <p className="text-center text-xs text-muted-foreground">
              Cela peut prendre 30 a 60 secondes selon le nombre de produits...
            </p>

            {/* Cancel button */}
            {onCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="gap-2"
              >
                <X className="h-3.5 w-3.5" />
                Annuler
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
