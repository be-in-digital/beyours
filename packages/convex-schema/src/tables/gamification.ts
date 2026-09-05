import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Game QR Codes table
 * QR codes placed on restaurant tables
 */
export const gameQRCodesTable = defineTable({
  storeId: v.id("stores"),
  code: v.string(), // Unique QR code value
  tableNumber: v.optional(v.string()),
  location: v.optional(v.string()), // e.g. "Terrace", "Main hall"
  gameType: v.optional(v.union(
    v.literal("wheel"),
    v.literal("scratch_card")
  )),
  isActive: v.boolean(),
  scannedCount: v.number(),
  lastScannedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_code", ["code"])
  .index("by_storeId_isActive", ["storeId", "isActive"])

/**
 * Required Actions table
 * Social actions customers must complete before playing
 */
export const requiredActionsTable = defineTable({
  storeId: v.id("stores"),
  type: v.union(
    v.literal("google_review"),
    v.literal("instagram_follow"),
    v.literal("facebook_like"),
    v.literal("tiktok_follow"),
    v.literal("email_subscribe")
  ),
  name: v.string(),
  description: v.optional(v.string()),
  url: v.optional(v.string()),
  icon: v.optional(v.string()),
  isRequired: v.boolean(),
  sortOrder: v.number(),
  timerSeconds: v.optional(v.number()),
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_isActive", ["storeId", "isActive"])

/**
 * Games table
 * Game configuration with admin-controlled win ratio
 */
export const gamesTable = defineTable({
  storeId: v.id("stores"),
  type: v.union(
    v.literal("wheel"),
    v.literal("scratch_card")
  ),
  name: v.string(),
  description: v.optional(v.string()),
  winRatio: v.number(), // 0-100 (percentage)
  isActive: v.boolean(),
  config: v.optional(v.object({
    wheelSections: v.optional(v.array(v.object({
      label: v.string(),
      color: v.string(),
      prizeId: v.optional(v.id("prizes")),
      isWinning: v.optional(v.boolean()),
      probability: v.optional(v.number()),
    }))),
    scratchCardDesign: v.optional(v.string()),
    backgroundImage: v.optional(v.string()),
    primaryColor: v.optional(v.string()),
    secondaryColor: v.optional(v.string()),
    cooldownHours: v.optional(v.number()),
    // How many prizes this establishment may issue inside one rolling window.
    // Absent means the default in `prizeBudget.ts`, which is ON: the store that
    // never opens this setting is the one the drain was measured against.
    // The stock on each prize is still the hard limit; this is the softer,
    // restaurant-wide bound that stops every prize going in one loop.
    prizeBudget: v.optional(v.object({
      maxPrizes: v.number(),
      windowHours: v.number(),
    })),
    // "sequential" (default) = one action per visit, advancing from one
    // visit to the next. "all" = every required action at once (legacy).
    actionMode: v.optional(v.union(v.literal("all"), v.literal("sequential"))),
    // Referral: a recurring action once the social actions run out.
    referral: v.optional(v.object({
      enabled: v.boolean(),
      friendRewardLabel: v.optional(v.string()),
    })),
  })),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_isActive", ["storeId", "isActive"])

/**
 * Prizes table
 * Rewards that customers can win
 */
export const prizesTable = defineTable({
  storeId: v.id("stores"),
  name: v.string(),
  description: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  type: v.union(
    v.literal("discount_percentage"),
    v.literal("discount_fixed"),
    v.literal("free_product"),
    v.literal("free_menu"),
    v.literal("custom")
  ),
  value: v.optional(v.number()), // Percentage or fixed amount in cents
  productId: v.optional(v.id("products")),
  menuId: v.optional(v.id("menus")),
  validityDays: v.number(), // How many days the prize is valid
  totalAvailable: v.optional(v.number()),
  remainingCount: v.optional(v.number()),
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_storeId_isActive", ["storeId", "isActive"])

/**
 * Game Plays table
 * Tracks each game play with 24h cooldown
 */
export const gamePlaysTable = defineTable({
  storeId: v.id("stores"),
  gameId: v.id("games"),
  qrCodeId: v.optional(v.id("gameQRCodes")),
  playerEmail: v.optional(v.string()),
  playerName: v.optional(v.string()),
  playerFirstName: v.optional(v.string()),
  playerLastName: v.optional(v.string()),
  playerPhone: v.optional(v.string()),
  fingerprint: v.optional(v.string()),
  /**
   * The diner's consent to this play being recorded (RGPD art. 7.1).
   *
   * WHY IT EXISTS: this row stores a device fingerprint, a user agent and —
   * once a winner claims — a name, an email and a phone number. A fingerprint
   * plus a user agent is tracking data, and the table recorded no legal basis
   * for any of it. Art. 7.1 puts the burden on the controller — the
   * restaurant — to DEMONSTRATE that the diner consented, which needs three
   * things: that they did, when, and to which wording.
   *
   * OPTIONAL, AND THAT IS NOT A LOOPHOLE: every row written before this field
   * existed has none, and a stored document missing a required field fails
   * validation on its next write. `gamePlay.play` refuses without it, so no
   * new row can be written without one — see the `CONSENT_REQUIRED` throw
   * there. A row with no consent is a legacy row, and the retention sweep is
   * what carries it away.
   */
  consent: v.optional(v.object({
    /** Server clock at the moment the play was accepted, never the browser's. */
    acceptedAt: v.number(),
    /**
     * Which wording the diner actually saw.
     *
     * The notice will be reworded, and a bare boolean would then claim that
     * every past player agreed to today's text. `GAME_CONSENT_NOTICE_VERSION`
     * in `@be-in-digital/convex-functions/gamePlay` is the current one; the
     * wording itself is in `packages/admin/src/game/consent-copy.ts`.
     */
    noticeVersion: v.string(),
  })),
  completedActions: v.array(v.string()), // Action IDs completed
  referredByCode: v.optional(v.string()), // Referrer code if arrived via referral
  didWin: v.boolean(),
  prizeId: v.optional(v.id("prizes")),
  ipAddress: v.optional(v.string()),
  userAgent: v.optional(v.string()),
  playedAt: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_playerEmail", ["playerEmail"])
  .index("by_storeId_playedAt", ["storeId", "playedAt"])
  .index("by_qrCodeId", ["qrCodeId"])
  .index("by_storeId_fingerprint", ["storeId", "fingerprint"])

/**
 * Prize Issuance table
 *
 * One row per establishment, holding the timestamps of the prizes its games
 * have issued. This is what the prize budget counts, and it is deliberately NOT
 * a `rateLimits` row: that table's window is fixed, opened by the first event
 * and never sliding, which let a 50-a-day budget pay out 100 across a boundary
 * and reset itself whenever an owner changed the window length. Timestamps
 * answer "how many in the last N hours" correctly however the setting moves.
 *
 * The array is pruned to the most recent `maxPrizes` entries on every write, so
 * it is bounded by the owner's own ceiling and never by how long the
 * establishment has been trading.
 */
export const prizeIssuanceTable = defineTable({
  storeId: v.id("stores"),
  /** When each prize was issued, ascending. */
  issuedAt: v.array(v.number()),
  updatedAt: v.number(),
}).index("by_storeId", ["storeId"])

/**
 * Prize Redemptions table
 * Tracks prize redemption with QR codes
 */
export const prizeRedemptionsTable = defineTable({
  storeId: v.id("stores"),
  gamePlayId: v.id("gamePlays"),
  prizeId: v.id("prizes"),
  playerEmail: v.optional(v.string()),
  playerName: v.optional(v.string()),
  playerFirstName: v.optional(v.string()),
  playerLastName: v.optional(v.string()),
  redemptionCode: v.string(), // QR code sent to customer
  status: v.union(
    v.literal("pending"),
    v.literal("claimed"),
    v.literal("redeemed"),
    v.literal("expired"),
    v.literal("cancelled")
  ),
  redeemedAt: v.optional(v.number()),
  redeemedBy: v.optional(v.string()), // Staff member who redeemed (Better Auth user)
  expiresAt: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_storeId", ["storeId"])
  .index("by_redemptionCode", ["redemptionCode"])
  .index("by_playerEmail", ["playerEmail"])
  /**
   * "What is still waiting at the till?" — the badge the staff works from.
   *
   * `expiresAt` is in the index rather than checked afterwards because expired
   * prizes never stop being rows: a store that has run a game for two years has
   * far more dead `pending` redemptions than live ones, and a count that reads
   * them all to discard them all grows with the establishment's whole history.
   * Replaces `by_storeId_status`, whose prefix this is and which no query ever
   * used.
   */
  .index("by_storeId_status_expiresAt", ["storeId", "status", "expiresAt"])
  /**
   * "How many prizes were actually handed over this month?"
   *
   * `redeemedAt` is set in the same patch that sets `status: "redeemed"` — see
   * `redeemByCode`, its only writer — so the two never disagree. Without this
   * the count had to be taken over redemptions *created* in the window, which
   * is a different question wearing the same label.
   */
  .index("by_storeId_status_redeemedAt", ["storeId", "status", "redeemedAt"])
  .index("by_gamePlayId", ["gamePlayId"])

/**
 * Game Referrals table
 * One row per referrer (store + device). Tracks conversions and the bonus
 * plays the referrer earned but hasn't used yet.
 */
export const gameReferralsTable = defineTable({
  storeId: v.id("stores"),
  code: v.string(), // Shareable referral code
  referrerFingerprint: v.string(),
  referrerName: v.optional(v.string()),
  conversions: v.number(), // Friends who played via this code
  pendingBonuses: v.number(), // Bonus plays earned, not yet used
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_code", ["code"])
  .index("by_storeId_referrerFingerprint", ["storeId", "referrerFingerprint"])
  // Retention: a referrer row is a device fingerprint with a counter, and the
  // two fingerprint indexes cannot be walked by age.
  .index("by_storeId_updatedAt", ["storeId", "updatedAt"])
