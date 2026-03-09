/**
 * Gamification Store Tests
 */

import { describe, it, expect, beforeEach } from "vitest"
import { useGamificationStore } from "../stores/gamification"
import type {
  GameStoreData,
  GameData,
  WheelSection,
  GameAction,
  GameSettings,
} from "../stores/gamification"

const mockStore: GameStoreData = {
  _id: "store_1",
  name: "Mon Restaurant",
  slug: "mon-restaurant",
}

const mockGame: GameData = {
  _id: "game_1",
  name: "Roue de la Fortune",
  type: "wheel",
  winRatio: 30,
}

const mockSections: WheelSection[] = [
  { label: "Café Offert", color: "#4CAF50", probability: 15, isWinning: true, prizeId: "prize_1" },
  { label: "Perdu", color: "#F44336", probability: 70, isWinning: false },
  { label: "-10%", color: "#2196F3", probability: 15, isWinning: true, prizeId: "prize_2" },
]

const mockActions: GameAction[] = [
  { _id: "action_1", name: "Avis Google", type: "google_review", url: "https://google.com", timerSeconds: 10 },
  { _id: "action_2", name: "Suivre Instagram", type: "instagram_follow", url: "https://instagram.com", timerSeconds: 5 },
]

const mockSettings: GameSettings = {
  primaryColor: "#000000",
  secondaryColor: "#ffffff",
  cooldownHours: 24,
}

describe("Gamification Store", () => {
  beforeEach(() => {
    useGamificationStore.getState().reset()
  })

  describe("initGame", () => {
    it("should initialize game data and set step to welcome", () => {
      useGamificationStore.getState().initGame({
        store: mockStore,
        game: mockGame,
        sections: mockSections,
        actions: mockActions,
        settings: mockSettings,
      })

      const state = useGamificationStore.getState()
      expect(state.step).toBe("welcome")
      expect(state.store).toEqual(mockStore)
      expect(state.game).toEqual(mockGame)
      expect(state.sections).toEqual(mockSections)
      expect(state.actions).toEqual(mockActions)
      expect(state.settings).toEqual(mockSettings)
    })
  })

  describe("startGame", () => {
    it("should transition from welcome to actions when actions exist", () => {
      useGamificationStore.getState().initGame({
        store: mockStore,
        game: mockGame,
        sections: mockSections,
        actions: mockActions,
        settings: mockSettings,
      })

      useGamificationStore.getState().startGame()
      expect(useGamificationStore.getState().step).toBe("actions")
    })

    it("should transition from welcome to wheel when no actions", () => {
      useGamificationStore.getState().initGame({
        store: mockStore,
        game: mockGame,
        sections: mockSections,
        actions: [],
        settings: mockSettings,
      })

      useGamificationStore.getState().startGame()
      expect(useGamificationStore.getState().step).toBe("wheel")
    })

    it("should transition to scratch for scratch_card game with no actions", () => {
      const scratchGame: GameData = { ...mockGame, type: "scratch_card" }
      useGamificationStore.getState().initGame({
        store: mockStore,
        game: scratchGame,
        sections: [],
        actions: [],
        settings: mockSettings,
      })

      useGamificationStore.getState().startGame()
      expect(useGamificationStore.getState().step).toBe("scratch")
    })

    it("should transition to actions for scratch_card game with actions", () => {
      const scratchGame: GameData = { ...mockGame, type: "scratch_card" }
      useGamificationStore.getState().initGame({
        store: mockStore,
        game: scratchGame,
        sections: [],
        actions: mockActions,
        settings: mockSettings,
      })

      useGamificationStore.getState().startGame()
      expect(useGamificationStore.getState().step).toBe("actions")
    })
  })

  describe("step transitions", () => {
    it("should transition steps correctly", () => {
      const { setStep } = useGamificationStore.getState()

      setStep("actions")
      expect(useGamificationStore.getState().step).toBe("actions")

      setStep("spinning")
      expect(useGamificationStore.getState().step).toBe("spinning")

      setStep("result")
      expect(useGamificationStore.getState().step).toBe("result")
    })

    it("should set error state", () => {
      useGamificationStore.getState().setError("Game not found")

      const state = useGamificationStore.getState()
      expect(state.step).toBe("error")
      expect(state.errorMessage).toBe("Game not found")
    })

    it("should set cooldown state", () => {
      const nextPlayAt = Date.now() + 86400000
      useGamificationStore.getState().setCooldown(nextPlayAt)

      const state = useGamificationStore.getState()
      expect(state.step).toBe("cooldown")
      expect(state.nextPlayAt).toBe(nextPlayAt)
    })
  })

  describe("social actions", () => {
    beforeEach(() => {
      useGamificationStore.getState().initGame({
        store: mockStore,
        game: mockGame,
        sections: mockSections,
        actions: mockActions,
        settings: mockSettings,
      })
    })

    it("should start action timer", () => {
      useGamificationStore.getState().startActionTimer("action_1")

      const state = useGamificationStore.getState()
      expect(state.activeTimers["action_1"]).toBe(10)
    })

    it("should tick action timer", () => {
      useGamificationStore.getState().startActionTimer("action_1")
      useGamificationStore.getState().tickActionTimer("action_1")

      const state = useGamificationStore.getState()
      expect(state.activeTimers["action_1"]).toBe(9)
    })

    it("should auto-complete action when timer reaches 0", () => {
      useGamificationStore.getState().startActionTimer("action_2") // timerSeconds: 5

      // Tick 5 times
      for (let i = 0; i < 5; i++) {
        useGamificationStore.getState().tickActionTimer("action_2")
      }

      const state = useGamificationStore.getState()
      expect(state.completedActionIds).toContain("action_2")
      expect(state.activeTimers["action_2"]).toBeUndefined()
    })

    it("should mark action as completed", () => {
      useGamificationStore.getState().markActionCompleted("action_1")

      const state = useGamificationStore.getState()
      expect(state.completedActionIds).toContain("action_1")
    })

    it("should not duplicate completed action ids", () => {
      useGamificationStore.getState().markActionCompleted("action_1")
      useGamificationStore.getState().markActionCompleted("action_1")

      const state = useGamificationStore.getState()
      expect(state.completedActionIds.filter((id) => id === "action_1")).toHaveLength(1)
    })

    it("should report all actions completed", () => {
      useGamificationStore.getState().markActionCompleted("action_1")
      expect(useGamificationStore.getState().allActionsCompleted()).toBe(false)

      useGamificationStore.getState().markActionCompleted("action_2")
      expect(useGamificationStore.getState().allActionsCompleted()).toBe(true)
    })
  })

  describe("spin result", () => {
    it("should set spin result", () => {
      const result = {
        didWin: true,
        segmentIndex: 0,
        prizeName: "Café Offert",
        redemptionId: "redemption_1",
      }

      useGamificationStore.getState().setSpinResult(result)

      const state = useGamificationStore.getState()
      expect(state.spinResult).toEqual(result)
    })

    it("should handle losing result", () => {
      const result = {
        didWin: false,
        segmentIndex: 1,
      }

      useGamificationStore.getState().setSpinResult(result)

      const state = useGamificationStore.getState()
      expect(state.spinResult?.didWin).toBe(false)
      expect(state.spinResult?.prizeName).toBeUndefined()
    })
  })

  describe("claim result", () => {
    it("should set claim result and transition to confirmation", () => {
      const result = {
        redemptionCode: "WIN-ABC123",
        prizeName: "Café Offert",
        expiresAt: Date.now() + 86400000,
        email: "test@example.com",
      }

      useGamificationStore.getState().setClaimResult(result)

      const state = useGamificationStore.getState()
      expect(state.claimResult).toEqual(result)
      expect(state.step).toBe("confirmation")
    })
  })

  describe("fingerprint", () => {
    it("should set fingerprint", () => {
      useGamificationStore.getState().setFingerprint("fp_123")

      expect(useGamificationStore.getState().fingerprint).toBe("fp_123")
    })
  })

  describe("reset", () => {
    it("should reset all state to initial values", () => {
      // Set some state
      useGamificationStore.getState().initGame({
        store: mockStore,
        game: mockGame,
        sections: mockSections,
        actions: mockActions,
        settings: mockSettings,
      })
      useGamificationStore.getState().markActionCompleted("action_1")
      useGamificationStore.getState().setFingerprint("fp_123")

      // Reset
      useGamificationStore.getState().reset()

      const state = useGamificationStore.getState()
      expect(state.step).toBe("loading")
      expect(state.store).toBeNull()
      expect(state.game).toBeNull()
      expect(state.sections).toEqual([])
      expect(state.actions).toEqual([])
      expect(state.completedActionIds).toEqual([])
      expect(state.spinResult).toBeNull()
      expect(state.claimResult).toBeNull()
      expect(state.fingerprint).toBe("")
    })
  })
})
