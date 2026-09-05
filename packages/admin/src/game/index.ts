/**
 * The gamification player flow — the customer half of the feature whose admin
 * half already lives in `../pages/games`.
 *
 * It is deliberately NOT re-exported from the package root. `lib/sounds.ts`
 * ends in a module-scope `new GameAudioEngine()`, and eleven `"use client"`
 * screens hang off this barrel; pulling them into `@be-in-digital/admin`
 * proper would drag the audio and particle engines into every dashboard
 * bundle. Import from `@be-in-digital/admin/game`.
 *
 * The flow reaches its backend through props rather than the admin API store —
 * see `api-contract.ts` for why.
 */

export { GamePlayerFlow } from "./player-flow"
export { PrizeTicket } from "./prize-ticket"

/**
 * The lobby, on its own.
 *
 * Exported because it is the screen that carries the consent gate, and that
 * gate has to be provable: `packages/admin` has no jsdom, so the only place
 * this can be rendered under test is an app. Each app's
 * `__tests__/game-consent-gate` suite is that test.
 */
export { WelcomeScreen } from "./welcome-screen"

export type {
  GamePlayApi,
  PrizeTicketApi,
  GameCopy,
  GamePlayerFlowProps,
  PrizeTicketProps,
} from "./api-contract"

export { resolveGameCopy } from "./game-copy"
export type { ResolvedGameCopy, GameKind } from "./game-copy"

export { prizeEmoji } from "./prize-emoji"

export {
  gameConsentNotice,
  formatRetention,
  GAME_CONSENT_NOTICE_VERSION,
} from "./consent-copy"
export type { GameConsentNotice } from "./consent-copy"

export type {
  GamePrize,
  GameAction,
  GameActionType,
  GameConfig,
  GameSession,
  GamePhase,
  PlayResult,
  WheelSectionConfig,
  ActionProgression,
  ReferralState,
} from "./lib"
