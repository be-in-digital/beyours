import type { FunctionReference } from "convex/server"
import type { DocId } from "@be-yours/convex-schema/dataModel"

/**
 * The boundary between this flow and the app that renders it.
 *
 * The admin screens read their Convex API from `useAdminApiStore`, which the
 * `(admin)` layout fills on mount. The player route is a sibling of that
 * layout, not a child: a customer scanning a table QR code never mounts it, so
 * the store is empty there. These props are the injection point instead.
 *
 * They are typed rather than `any` on purpose. An untyped API reference is how
 * a function that exists in one app and not the other reaches a client's site
 * as a 500 — the failure #256 shipped. Naming each function with its real
 * argument shape makes that a compile error in both apps.
 *
 * Argument shapes are transcribed from the validators in
 * `@be-yours/convex-functions/gamePlay`.
 */
export interface GamePlayApi {
  getSession: FunctionReference<
    "query",
    "public",
    { code: string; fingerprint?: string; ref?: string },
    unknown
  >
  recordScan: FunctionReference<"mutation", "public", { code: string }, unknown>
  play: FunctionReference<
    "mutation",
    "public",
    {
      code: string
      gameId: DocId<"games">
      fingerprint: string
      completedActions: string[]
      ref?: string
      userAgent?: string
      /** Which consent notice was on screen. No version, no play. */
      consentNoticeVersion?: string
    },
    unknown
  >
  ensureReferralCode: FunctionReference<
    "mutation",
    "public",
    { code: string; fingerprint: string },
    { code: string }
  >
  claim: FunctionReference<
    "mutation",
    "public",
    {
      playId: DocId<"gamePlays">
      firstName: string
      lastName: string
      email: string
      phone?: string
    },
    { code: string; expiresAt: number; alreadyClaimed: boolean }
  >
}

/** What the staff-facing ticket page calls. */
export interface PrizeTicketApi {
  getRedemptionByCode: FunctionReference<"query", "public", { code: string }, unknown>
  canRedeem: FunctionReference<"query", "public", { code: string }, boolean>
  redeemByCode: FunctionReference<
    "mutation",
    "public",
    { code: string; redeemedBy?: string },
    unknown
  >
}

/**
 * CMS-editable copy, already resolved by the app.
 *
 * `useCmsPage` stays in the app: it is 162 lines bound to the app's generated
 * API and its own store selection, and moving it here would buy six strings at
 * the cost of re-injecting all of that. `null` means "not set" — the same
 * contract `CmsFieldAccessor.text` has, so the adapter is a pass-through and
 * the flow owns its own French defaults.
 */
export interface GameCopy {
  heroTitle: string | null
  heroSubtitle: string | null
  winTitle: string | null
  winDescription: string | null
  loseTitle: string | null
  loseDescription: string | null
}

export interface GamePlayerFlowProps {
  /** The QR code scanned at the table — the `[qrCodeId]` route segment. */
  qrCode: string
  api: GamePlayApi
  /** Omitted entirely when the app has no CMS: every field falls back. */
  copy?: Partial<GameCopy>
}

export interface PrizeTicketProps {
  /** The redemption code, already upper-cased by the app. */
  code: string
  api: PrizeTicketApi
}
