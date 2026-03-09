/**
 * Gamification Store - Zustand
 *
 * Client-side state management for the gamification flow.
 * Manages the game steps from loading to claim.
 */

import { create } from "zustand"

// === Types ===

export type GameStep =
  | "loading"
  | "cooldown"
  | "welcome"
  | "actions"
  | "wheel"
  | "spinning"
  | "scratch"
  | "scratching"
  | "result"
  | "claim"
  | "confirmation"
  | "error"

export interface GameStoreData {
  _id: string
  name: string
  slug: string
}

export interface GameData {
  _id: string
  name: string
  type: string
  winRatio: number
}

export interface WheelSection {
  label: string
  color: string
  probability: number
  prizeId?: string
  isWinning: boolean
  prizeName?: string
}

export interface GameAction {
  _id: string
  name: string
  type: string
  description?: string
  url?: string
  icon?: string
  timerSeconds: number
}

export interface GameSettings {
  primaryColor: string
  secondaryColor: string
  backgroundImage?: string
  cooldownHours: number
}

export interface SpinResult {
  didWin: boolean
  segmentIndex: number
  prizeName?: string
  redemptionId?: string
}

export interface ClaimResult {
  redemptionCode: string
  prizeName: string
  expiresAt: number
  email: string
}

// === State ===

export interface GamificationState {
  // Flow step
  step: GameStep
  errorMessage: string | null

  // Game data (from server query)
  store: GameStoreData | null
  game: GameData | null
  sections: WheelSection[]
  actions: GameAction[]
  settings: GameSettings

  // Actions sociales
  completedActionIds: string[]
  activeTimers: Record<string, number> // actionId -> remaining seconds

  // Spin result (from server mutation)
  spinResult: SpinResult | null

  // Claim result
  claimResult: ClaimResult | null

  // Cooldown
  nextPlayAt: number | null

  // Fingerprint
  fingerprint: string
}

// === Actions ===

export interface GamificationActions {
  // Initialization
  initGame: (data: {
    store: GameStoreData
    game: GameData
    sections: WheelSection[]
    actions: GameAction[]
    settings: GameSettings
  }) => void

  // Welcome → next step
  startGame: () => void

  // Step transitions
  setStep: (step: GameStep) => void
  setError: (message: string) => void
  setCooldown: (nextPlayAt: number) => void

  // Social actions
  startActionTimer: (actionId: string) => void
  tickActionTimer: (actionId: string) => void
  markActionCompleted: (actionId: string) => void
  allActionsCompleted: () => boolean

  // Spin
  setSpinResult: (result: SpinResult) => void

  // Claim
  setClaimResult: (result: ClaimResult) => void

  // Fingerprint
  setFingerprint: (fp: string) => void

  // Reset
  reset: () => void
}

// === Default values ===

const defaultSettings: GameSettings = {
  primaryColor: "#000000",
  secondaryColor: "#ffffff",
  cooldownHours: 24,
}

const initialState: GamificationState = {
  step: "loading",
  errorMessage: null,
  store: null,
  game: null,
  sections: [],
  actions: [],
  settings: defaultSettings,
  completedActionIds: [],
  activeTimers: {},
  spinResult: null,
  claimResult: null,
  nextPlayAt: null,
  fingerprint: "",
}

// === Store ===

export const useGamificationStore = create<GamificationState & GamificationActions>(
  (set, get) => ({
    ...initialState,

    initGame: ({ store, game, sections, actions, settings }) =>
      set({
        store,
        game,
        sections,
        actions,
        settings,
        step: "welcome",
        errorMessage: null,
      }),

    startGame: () => {
      const { actions, game } = get()
      const gameStep = game?.type === "scratch_card" ? "scratch" : "wheel"
      set({ step: actions.length > 0 ? "actions" : gameStep })
    },

    setStep: (step) => set({ step }),

    setError: (message) => set({ step: "error", errorMessage: message }),

    setCooldown: (nextPlayAt) => set({ step: "cooldown", nextPlayAt }),

    startActionTimer: (actionId) => {
      const action = get().actions.find((a) => a._id === actionId)
      if (!action) return
      set((state) => ({
        activeTimers: {
          ...state.activeTimers,
          [actionId]: action.timerSeconds,
        },
      }))
    },

    tickActionTimer: (actionId) => {
      const current = get().activeTimers[actionId]
      if (current === undefined || current <= 0) return

      const next = current - 1
      if (next <= 0) {
        // Timer done — mark completed
        get().markActionCompleted(actionId)
      } else {
        set((state) => ({
          activeTimers: {
            ...state.activeTimers,
            [actionId]: next,
          },
        }))
      }
    },

    markActionCompleted: (actionId) =>
      set((state) => {
        const newTimers = { ...state.activeTimers }
        delete newTimers[actionId]
        return {
          completedActionIds: [...new Set([...state.completedActionIds, actionId])],
          activeTimers: newTimers,
        }
      }),

    allActionsCompleted: () => {
      const { actions, completedActionIds } = get()
      return actions.every((a) => completedActionIds.includes(a._id))
    },

    setSpinResult: (result) => set({ spinResult: result }),

    setClaimResult: (result) => set({ claimResult: result, step: "confirmation" }),

    setFingerprint: (fp) => set({ fingerprint: fp }),

    reset: () => set(initialState),
  })
)
