import { v } from "convex/values"
import type { ObjectType } from "convex/values"
import type {
  Doc,
  DocId,
  SchemaMutationCtx,
  SchemaQueryCtx,
} from "@be-in-digital/convex-schema/dataModel"
import { assertFieldLengths, consumeRateLimit } from "./rateLimit"
import { DEFAULT_CUSTOMER_RETENTION_DAYS } from "./privacyPolicy"

/**
 * Player-facing gamification flow (public, anonymous players).
 *
 * The outcome of every play is resolved SERVER-SIDE (win roll + prize pick);
 * the client only animates toward the result it receives. The 24h cooldown is
 * enforced per store + device fingerprint, whatever the game and the outcome.
 *
 * WHAT THE COOLDOWN IS NOT: a control. `fingerprint` is a string the browser
 * sends, so a caller who wants another turn sends another string — 40 of them
 * emptied a five-prize stock in one loop, which is what these endpoints were
 * bounded for. The cooldown is fairness between honest devices. The bound on
 * abuse is `consumeRateLimit`, keyed partly on the QR row the SERVER resolved,
 * which no argument can rotate. See `rateLimit.ts` for why no IP is available.
 *
 * Handlers are typed against the shared SchemaDataModel: schema drift breaks
 * this package's type-check, not the consuming apps at runtime.
 */

const DAY_MS = 24 * 60 * 60 * 1000
export const DEFAULT_COOLDOWN_HOURS = 24

/**
 * The consent notice a diner is shown before a play, by version.
 *
 * WHY A VERSION AND NOT A BOOLEAN: art. 7.1 asks the controller to demonstrate
 * that the diner consented, and "they ticked a box" is not that on its own —
 * the notice will be reworded, and a stored `true` would then claim every past
 * player agreed to today's text. The row records which wording was on screen.
 *
 * WHY A LIST AND NOT ONE STRING: a browser holding yesterday's bundle still
 * shows yesterday's notice, truthfully. Refusing it outright would break every
 * open tab on the day the wording changes, and accepting it silently would
 * record the wrong text. Keeping the previous versions here does neither: the
 * play is accepted and the row says exactly what was agreed to. Drop a version
 * from this list to withdraw it — a notice found to be non-compliant should
 * stop being accepted the moment it is replaced.
 *
 * WHY THE TEXT IS NOT HERE: the wording is French customer-facing copy and
 * lives in `packages/admin/src/game/consent-copy.ts`, which owns the version
 * it renders. That split is deliberate — a browser serves the text and the
 * identifier from the SAME bundle, so the version a play sends is the version
 * of the wording that was actually on screen, not whatever this deployment
 * currently believes is current. `consent-copy.test.ts` pins the text to its
 * version, so rewording without bumping fails there; adding the new version
 * here is then what lets it be played.
 */
export const GAME_CONSENT_NOTICE_VERSIONS: readonly string[] = ["fr-2026-09"]

/** Unambiguous alphabet for redemption codes (no O/0/I/1/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

export function generateRedemptionCode(random: () => number = Math.random): string {
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]
  }
  return code
}

/**
 * Server-side win roll. A play can only win if at least one prize is in stock.
 */
export function rollOutcome(params: {
  winRatio: number
  prizeCount: number
  random?: () => number
}): boolean {
  const random = params.random ?? Math.random
  if (params.prizeCount === 0) return false
  const ratio = Math.min(100, Math.max(0, params.winRatio))
  return random() * 100 < ratio
}

/** Equal-weight prize pick among prizes still in stock. */
export function pickPrize<T extends { remainingCount?: number; totalAvailable?: number }>(
  prizes: T[],
  random: () => number = Math.random
): T | null {
  const available = prizes.filter((p) => remainingStock(p) !== 0)
  if (available.length === 0) return null
  return available[Math.floor(random() * available.length)] ?? null
}

/** Remaining stock for a prize: undefined = unlimited, number = units left. */
export function remainingStock(prize: {
  remainingCount?: number
  totalAvailable?: number
}): number | undefined {
  if (prize.remainingCount !== undefined) return prize.remainingCount
  if (prize.totalAvailable !== undefined) return prize.totalAvailable
  return undefined
}

export function cooldownMsForGame(game: { config?: { cooldownHours?: number } }): number {
  const hours = game.config?.cooldownHours ?? DEFAULT_COOLDOWN_HOURS
  return hours * 60 * 60 * 1000
}

/**
 * The most `completedActions` a caller may claim, and the longest an id may be.
 * A Convex id is 32 characters; the cap is loose enough not to break a future
 * format and tight enough that the array cannot be used as free storage.
 */
const MAX_COMPLETED_ACTIONS = 32
const MAX_ACTION_ID_LENGTH = 128

/**
 * Keep only the claimed action ids that name a real, active required action of
 * this store, capped in count and length.
 *
 * This is NOT verification. Whether someone actually left a Google review is
 * not observable from a mutation, and the ids are readable from `getSession`,
 * so a caller can always claim the real ones. What it stops is the unbounded
 * write: `completedActions` was persisted verbatim, so one call could store an
 * arbitrarily large array of arbitrarily long strings, and the analytics built
 * on the column counted ids that never existed.
 *
 * Nothing is thrown for an unknown id. Stale ids are normal — a store that
 * reconfigures its actions leaves them behind in older rows, and
 * `selectSequentialProgression` already tolerates them at read time.
 */
async function sanitiseCompletedActions(
  ctx: SchemaQueryCtx,
  storeId: DocId<"stores">,
  claimed: string[]
): Promise<string[]> {
  if (claimed.length === 0) return []
  const actions = await ctx.db
    .query("requiredActions")
    .withIndex("by_storeId_isActive", (q) => q.eq("storeId", storeId).eq("isActive", true))
    .collect()
  const real = new Set(actions.map((a) => a._id as string))
  // Filter BEFORE the cap, never after. Capping first lets a caller push the
  // genuine ids off the end with junk — 32 invented strings followed by the one
  // action the diner really completed stored nothing at all, which loses real
  // progress rather than bounding anything. The cap exists to stop the array
  // being used as storage, and there is no way to store anything through it
  // once only real ids survive: `real` is bounded by the store's own
  // configuration, so `kept` cannot exceed the number of actions it defined.
  const kept: string[] = []
  for (const id of claimed) {
    if (kept.length >= MAX_COMPLETED_ACTIONS) break
    if (id.length > MAX_ACTION_ID_LENGTH) continue
    if (!real.has(id)) continue
    if (kept.includes(id)) continue
    kept.push(id)
  }
  return kept
}

/** Public-safe projection of a prize document. */
function publicPrize(prize: Doc<"prizes">) {
  return {
    id: prize._id,
    name: prize.name,
    description: prize.description,
    imageUrl: prize.imageUrl,
    type: prize.type,
    value: prize.value,
    validityDays: prize.validityDays,
  }
}

async function findLatestPlay(
  ctx: SchemaQueryCtx,
  storeId: DocId<"stores">,
  fingerprint: string
): Promise<Doc<"gamePlays"> | null> {
  const plays = await ctx.db
    .query("gamePlays")
    .withIndex("by_storeId_fingerprint", (q) =>
      q.eq("storeId", storeId).eq("fingerprint", fingerprint)
    )
    .collect()
  if (plays.length === 0) return null
  return plays.reduce((latest, p) => (p.playedAt > latest.playedAt ? p : latest))
}

/**
 * Actions this fingerprint has already completed across past plays, restricted
 * to currently-active actions (stale ids from reconfigured games are ignored).
 * Drives the "one new action per visit" progression without any extra table.
 */
async function completedActionIdsFor(
  ctx: SchemaQueryCtx,
  storeId: DocId<"stores">,
  fingerprint: string
): Promise<string[]> {
  const plays = await ctx.db
    .query("gamePlays")
    .withIndex("by_storeId_fingerprint", (q) =>
      q.eq("storeId", storeId).eq("fingerprint", fingerprint)
    )
    .collect()
  const done = new Set<string>()
  for (const p of plays) {
    for (const id of p.completedActions) done.add(id)
  }
  return [...done]
}

/**
 * Pure: from the ordered active actions and the ones this device has already
 * done (the list may hold stale ids), computes the sequential progression —
 * the current action being the first one not yet completed.
 */
export function selectSequentialProgression(
  orderedActionIds: string[],
  completedIds: Iterable<string>
): { completedActionIds: string[]; currentActionId: string | null; allDone: boolean } {
  const active = new Set(orderedActionIds)
  const done = new Set<string>()
  for (const id of completedIds) if (active.has(id)) done.add(id)
  const currentActionId = orderedActionIds.find((id) => !done.has(id)) ?? null
  return {
    completedActionIds: orderedActionIds.filter((id) => done.has(id)),
    currentActionId,
    allDone: currentActionId === null,
  }
}

async function loadActiveGameForQr(
  ctx: SchemaQueryCtx,
  qr: Doc<"gameQRCodes">
): Promise<Doc<"games"> | null> {
  const games = await ctx.db
    .query("games")
    .withIndex("by_storeId_isActive", (q) => q.eq("storeId", qr.storeId).eq("isActive", true))
    .collect()
  if (games.length === 0) return null
  if (qr.gameType) {
    const preferred = games.find((g) => g.type === qr.gameType)
    if (preferred) return preferred
  }
  return games[0] ?? null
}

async function loadAvailablePrizes(
  ctx: SchemaQueryCtx,
  storeId: DocId<"stores">
): Promise<Doc<"prizes">[]> {
  const prizes = await ctx.db
    .query("prizes")
    .withIndex("by_storeId_isActive", (q) => q.eq("storeId", storeId).eq("isActive", true))
    .collect()
  return prizes.filter((p) => remainingStock(p) !== 0)
}

async function findRedemptionByCode(
  ctx: SchemaQueryCtx,
  code: string
): Promise<Doc<"prizeRedemptions"> | null> {
  return await ctx.db
    .query("prizeRedemptions")
    .withIndex("by_redemptionCode", (q) => q.eq("redemptionCode", code))
    .first()
}

async function findReferralByCode(
  ctx: SchemaQueryCtx,
  code: string
): Promise<Doc<"gameReferrals"> | null> {
  return await ctx.db
    .query("gameReferrals")
    .withIndex("by_code", (q) => q.eq("code", code))
    .first()
}

async function findReferralByFingerprint(
  ctx: SchemaQueryCtx,
  storeId: DocId<"stores">,
  fingerprint: string
): Promise<Doc<"gameReferrals"> | null> {
  return await ctx.db
    .query("gameReferrals")
    .withIndex("by_storeId_referrerFingerprint", (q) =>
      q.eq("storeId", storeId).eq("referrerFingerprint", fingerprint)
    )
    .first()
}

function isAwaitingRedemption(redemption: Doc<"prizeRedemptions">): boolean {
  return redemption.status === "pending" || redemption.status === "claimed"
}

/**
 * Everything the player UI needs to boot, in one round-trip.
 * `fingerprint` lets the server report the cooldown state up front.
 */
const getSessionArgs = {
  code: v.string(),
  fingerprint: v.optional(v.string()),
  ref: v.optional(v.string()),
}
export const getSession = {
  args: getSessionArgs,
  handler: async (ctx: SchemaQueryCtx, args: ObjectType<typeof getSessionArgs>) => {
    const qr = await ctx.db
      .query("gameQRCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first()
    if (!qr || !qr.isActive) return { status: "not_found" as const }

    const store = await ctx.db.get(qr.storeId)
    if (!store) return { status: "not_found" as const }

    const game = await loadActiveGameForQr(ctx, qr)
    if (!game) return { status: "no_game" as const, store: { name: store.name } }

    const actions = await ctx.db
      .query("requiredActions")
      .withIndex("by_storeId_isActive", (q) =>
        q.eq("storeId", qr.storeId).eq("isActive", true)
      )
      .collect()
    actions.sort((a, b) => a.sortOrder - b.sortOrder)

    const prizes = await loadAvailablePrizes(ctx, qr.storeId)

    // Progression: in "sequential" mode (the default) only ONE action is shown
    // per visit, the next one this device has not done yet. "all" mode keeps
    // the old behavior (every action at once).
    const actionMode: "all" | "sequential" = game.config?.actionMode ?? "sequential"
    let progression:
      | { mode: "all" }
      | {
          mode: "sequential"
          completedActionIds: string[]
          currentActionId: string | null
          allDone: boolean
        } = { mode: "all" }
    if (actionMode === "sequential") {
      const rawDone = args.fingerprint
        ? await completedActionIdsFor(ctx, qr.storeId, args.fingerprint)
        : []
      progression = {
        mode: "sequential",
        ...selectSequentialProgression(
          actions.map((a) => a._id as string),
          rawDone
        ),
      }
    }

    let cooldown: { active: boolean; nextPlayAt?: number } = { active: false }
    if (args.fingerprint) {
      const latest = await findLatestPlay(ctx, qr.storeId, args.fingerprint)
      if (latest) {
        const nextPlayAt = latest.playedAt + cooldownMsForGame(game)
        if (nextPlayAt > Date.now()) cooldown = { active: true, nextPlayAt }
      }
    }

    // Referral: friend (arrived via ?ref, never played), referrer bonuses
    // (plays earned but unused), and the player's shareable code.
    const referralCfg = game.config?.referral
    let isFriendWelcome = false
    if (args.ref && args.fingerprint) {
      const refRow = await findReferralByCode(ctx, args.ref)
      if (
        refRow &&
        refRow.storeId === qr.storeId &&
        refRow.referrerFingerprint !== args.fingerprint
      ) {
        const latest = await findLatestPlay(ctx, qr.storeId, args.fingerprint)
        if (latest === null) isFriendWelcome = true
      }
    }
    const myReferral = args.fingerprint
      ? await findReferralByFingerprint(ctx, qr.storeId, args.fingerprint)
      : null
    const pendingBonuses = myReferral?.pendingBonuses ?? 0
    // A bonus play (referrer) or a free play (friend) unlocks the game even
    // while the cooldown is still running.
    if (pendingBonuses > 0 || isFriendWelcome) cooldown = { active: false }

    const referral = {
      enabled: referralCfg?.enabled === true,
      isFriendWelcome,
      friendRewardLabel: referralCfg?.friendRewardLabel,
      pendingBonuses,
      myShareCode: myReferral?.code ?? null,
    }

    // How long the restaurant keeps what this play writes. Sent with the
    // session because the notice has to say it: "we keep your data" with no
    // period is not the informed consent art. 13.2.a asks for, and only the
    // server knows what this deployment is configured to.
    const settings = await ctx.db.query("globalSettings").first()
    const retentionDays =
      settings?.dataRetention?.customerDataDays ?? DEFAULT_CUSTOMER_RETENTION_DAYS

    return {
      status: "ready" as const,
      qrCodeId: qr._id,
      tableNumber: qr.tableNumber,
      store: { id: store._id, name: store.name },
      privacy: { retentionDays },
      game: {
        id: game._id,
        type: game.type,
        name: game.name,
        description: game.description,
        config: game.config,
      },
      actions: actions.map((a) => ({
        id: a._id,
        type: a.type,
        name: a.name,
        description: a.description,
        url: a.url,
        icon: a.icon,
        isRequired: a.isRequired,
        timerSeconds: a.timerSeconds,
      })),
      prizes: prizes.map(publicPrize),
      progression,
      referral,
      cooldown,
    }
  },
}

/** Count a scan on the QR code (fire-and-forget from the client). */
const recordScanArgs = { code: v.string() }
export const recordScan = {
  args: recordScanArgs,
  handler: async (ctx: SchemaMutationCtx, args: ObjectType<typeof recordScanArgs>) => {
    const qr = await ctx.db
      .query("gameQRCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first()
    if (!qr) return
    // Keyed on the row the server resolved, not on `args.code`: a caller can
    // send any string, but only a real code reaches this line.
    await consumeRateLimit(ctx, "gameScanPerQr", qr._id)
    await ctx.db.patch(qr._id, {
      scannedCount: (qr.scannedCount ?? 0) + 1,
      lastScannedAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
}

/**
 * Resolve one play. Throws COOLDOWN_ACTIVE / GAME_UNAVAILABLE on invalid state.
 * Returns the outcome the client must animate toward.
 */
const playArgs = {
  code: v.string(),
  gameId: v.id("games"),
  fingerprint: v.string(),
  completedActions: v.array(v.string()),
  ref: v.optional(v.string()),
  userAgent: v.optional(v.string()),
  /**
   * Which consent notice the diner ticked, by version.
   *
   * OPTIONAL IN THE VALIDATOR, REQUIRED BY THE HANDLER. A missing argument is
   * a caller that never showed the notice — a stale bundle, a script — and
   * the honest answer to both is the same refusal. Making it required here
   * would give that caller a validator error instead, which the flow cannot
   * turn into a sentence a diner can act on.
   */
  consentNoticeVersion: v.optional(v.string()),
}
export const play = {
  args: playArgs,
  handler: async (ctx: SchemaMutationCtx, args: ObjectType<typeof playArgs>) => {
    // No consent, no play — and no row either.
    //
    // This runs before the limiter on purpose. A refusal here throws, so the
    // transaction rolls back and nothing is written; putting it after would
    // spend a rate-limit slot on a caller we are about to turn away, which is
    // the shape `claim` was already bitten by. It is also the cheapest check
    // in the handler: it reads nothing.
    //
    // The play stores a device fingerprint and a user agent, and a claim adds
    // a name, an email and a phone number to the same row. That is the
    // processing the diner is agreeing to; without the agreement the
    // restaurant has no legal basis for any of it (RGPD art. 6.1.a, 7.1).
    if (
      !args.consentNoticeVersion ||
      !GAME_CONSENT_NOTICE_VERSIONS.includes(args.consentNoticeVersion)
    ) {
      throw new Error("CONSENT_REQUIRED")
    }

    // Dodged by sending a new fingerprint; the two windows after the lookup
    // are not. It does NOT meter code-probing, though its position suggests it
    // might: an unknown code throws, the transaction rolls back, and the row
    // this wrote goes with it. Enumeration through a mutation that throws
    // cannot be metered at all — measured at 500 probes, 0 limiter rows.
    await consumeRateLimit(ctx, "gamePlayPerFingerprint", args.fingerprint)

    const qr = await ctx.db
      .query("gameQRCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first()
    if (!qr || !qr.isActive) throw new Error("GAME_UNAVAILABLE")

    const game = await ctx.db.get(args.gameId)
    if (!game || !game.isActive || game.storeId !== qr.storeId) {
      throw new Error("GAME_UNAVAILABLE")
    }

    // The bound that holds when the fingerprint rotates. Both keys come from
    // rows this handler resolved, so no argument can move them: reaching
    // another QR window means finding another code physically on a table, and
    // the store window bounds however many of those an attacker collects.
    await consumeRateLimit(ctx, "gamePlayPerQr", qr._id)
    await consumeRateLimit(ctx, "gamePlayPerStore", qr.storeId)

    const latest = await findLatestPlay(ctx, qr.storeId, args.fingerprint)
    const isFirstPlay = latest === null

    // Referral: referrer bonus (a free play despite the cooldown) and
    // friend detection (arrived via ?ref, first play).
    const myReferral = await findReferralByFingerprint(ctx, qr.storeId, args.fingerprint)
    const hasBonus = (myReferral?.pendingBonuses ?? 0) > 0
    let refRow: Doc<"gameReferrals"> | null = null
    if (args.ref) {
      const r = await findReferralByCode(ctx, args.ref)
      if (r && r.storeId === qr.storeId && r.referrerFingerprint !== args.fingerprint) {
        refRow = r
      }
    }
    const isFriendWelcome = refRow !== null && isFirstPlay

    let consumedBonus = false
    if (latest) {
      const nextPlayAt = latest.playedAt + cooldownMsForGame(game)
      if (nextPlayAt > Date.now()) {
        if (hasBonus) {
          consumedBonus = true
        } else {
          throw new Error(`COOLDOWN_ACTIVE:${nextPlayAt}`)
        }
      }
    }

    const prizes = await loadAvailablePrizes(ctx, qr.storeId)
    const didWin = rollOutcome({ winRatio: game.winRatio, prizeCount: prizes.length })
    const prize = didWin ? pickPrize(prizes) : null

    if (prize && prize.remainingCount !== undefined) {
      await ctx.db.patch(prize._id, {
        remainingCount: prize.remainingCount - 1,
        updatedAt: Date.now(),
      })
    } else if (prize && prize.remainingCount === undefined && prize.totalAvailable !== undefined) {
      await ctx.db.patch(prize._id, {
        remainingCount: prize.totalAvailable - 1,
        updatedAt: Date.now(),
      })
    }

    const completedActions = await sanitiseCompletedActions(
      ctx,
      qr.storeId,
      args.completedActions
    )

    const now = Date.now()
    const playId = await ctx.db.insert("gamePlays", {
      storeId: qr.storeId,
      gameId: game._id,
      qrCodeId: qr._id,
      fingerprint: args.fingerprint,
      consent: { acceptedAt: now, noticeVersion: args.consentNoticeVersion },
      completedActions,
      referredByCode: isFriendWelcome ? args.ref : undefined,
      didWin: didWin && prize !== null,
      prizeId: prize?._id,
      userAgent: args.userAgent,
      playedAt: now,
      createdAt: now,
      updatedAt: now,
    })

    // Bonus play consumed: decrement the referrer's credit.
    if (consumedBonus && myReferral) {
      await ctx.db.patch(myReferral._id, {
        pendingBonuses: Math.max(0, myReferral.pendingBonuses - 1),
        updatedAt: now,
      })
    }
    // Friend playing for the first time: the referrer earns a bonus play.
    if (isFriendWelcome && refRow) {
      await ctx.db.patch(refRow._id, {
        conversions: refRow.conversions + 1,
        pendingBonuses: refRow.pendingBonuses + 1,
        updatedAt: now,
      })
    }

    return {
      playId,
      didWin: didWin && prize !== null,
      prize: prize ? publicPrize(prize) : null,
      nextPlayAt: now + cooldownMsForGame(game),
    }
  },
}

/**
 * Mint (or fetch) the player's shareable referral code. Called when the player
 * reaches the referral stage. Idempotent per store + device.
 */
const ensureReferralCodeArgs = { code: v.string(), fingerprint: v.string() }
export const ensureReferralCode = {
  args: ensureReferralCodeArgs,
  handler: async (
    ctx: SchemaMutationCtx,
    args: ObjectType<typeof ensureReferralCodeArgs>
  ) => {
    const qr = await ctx.db
      .query("gameQRCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first()
    if (!qr || !qr.isActive) throw new Error("GAME_UNAVAILABLE")

    const existing = await findReferralByFingerprint(ctx, qr.storeId, args.fingerprint)
    if (existing) return { code: existing.code }

    // Past the idempotent return, for the reason spelled out in `claim`: this
    // endpoint is called again on every visit by the same device, and metering
    // that free path let one browser tab spend the whole store's window and
    // refuse a referral code to every diner after it.
    await consumeRateLimit(ctx, "gameReferralPerStore", qr.storeId)

    let code = generateRedemptionCode()
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await findReferralByCode(ctx, code)
      if (!clash) break
      code = generateRedemptionCode()
    }

    const now = Date.now()
    await ctx.db.insert("gameReferrals", {
      storeId: qr.storeId,
      code,
      referrerFingerprint: args.fingerprint,
      conversions: 0,
      pendingBonuses: 0,
      createdAt: now,
      updatedAt: now,
    })
    return { code }
  },
}

/**
 * Winner claims their prize: stores contact info, creates the redemption
 * with a unique code, and returns it so the client can show the ticket.
 */
const claimArgs = {
  playId: v.id("gamePlays"),
  firstName: v.string(),
  lastName: v.string(),
  email: v.string(),
  phone: v.optional(v.string()),
}
export const claim = {
  args: claimArgs,
  handler: async (ctx: SchemaMutationCtx, args: ObjectType<typeof claimArgs>) => {
    // A claim mails a prize code to an address the caller chose, which makes
    // this the one endpoint here that can be used as a relay.
    assertFieldLengths({
      name: `${args.firstName} ${args.lastName}`,
      email: args.email,
      phone: args.phone,
    })

    const play = await ctx.db.get(args.playId)
    if (!play || !play.didWin || !play.prizeId) throw new Error("CLAIM_INVALID")

    // A claim is where a play stops being anonymous: it writes a name, an
    // e-mail and a phone number onto this row. Doing that to a play that
    // recorded no consent would be collecting identified personal data with no
    // legal basis at all — and it is reachable, because every row written
    // before `consent` existed has none. The play refuses without consent; so
    // does the claim, for the same reason.
    if (!play.consent) throw new Error("CONSENT_REQUIRED")

    const existing = await ctx.db
      .query("prizeRedemptions")
      .withIndex("by_gamePlayId", (q) => q.eq("gamePlayId", args.playId))
      .first()
    if (existing) {
      return { code: existing.redemptionCode, expiresAt: existing.expiresAt, alreadyClaimed: true }
    }

    const prize = await ctx.db.get(play.prizeId)
    if (!prize) throw new Error("CLAIM_INVALID")

    // Consumed HERE, past every path that leaves without writing.
    //
    // A Convex mutation is a transaction: when a handler throws, the limiter
    // row it wrote is rolled back with everything else, so placing a limiter
    // before a check that THROWS buys nothing and costs nothing. A path that
    // RETURNS is the opposite — it commits, so a slot spent there is spent for
    // real. The repeat claim above is exactly that path: it writes no
    // redemption and sends no mail, and when it was metered, sixty replays of
    // one already-claimed `playId` with sixty invented addresses emptied the
    // restaurant's window and told the next genuine winner, standing at the
    // counter, to come back in an hour. The limiter became the attack.
    await consumeRateLimit(ctx, "gameClaimPerEmail", args.email)
    await consumeRateLimit(ctx, "gameClaimPerStore", play.storeId)

    let code = generateRedemptionCode()
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await findRedemptionByCode(ctx, code)
      if (!clash) break
      code = generateRedemptionCode()
    }

    const now = Date.now()
    const fullName = `${args.firstName} ${args.lastName}`.trim()
    const expiresAt = now + prize.validityDays * DAY_MS

    await ctx.db.insert("prizeRedemptions", {
      storeId: play.storeId,
      gamePlayId: play._id,
      prizeId: prize._id,
      playerEmail: args.email,
      playerName: fullName,
      playerFirstName: args.firstName,
      playerLastName: args.lastName,
      redemptionCode: code,
      status: "pending",
      expiresAt,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.patch(play._id, {
      playerEmail: args.email,
      playerName: fullName,
      playerFirstName: args.firstName,
      playerLastName: args.lastName,
      playerPhone: args.phone,
      updatedAt: now,
    })

    return { code, expiresAt, alreadyClaimed: false }
  },
}

/** Public ticket lookup: the page behind the QR code on the reward ticket. */
const getRedemptionByCodeArgs = { code: v.string() }
export const getRedemptionByCode = {
  args: getRedemptionByCodeArgs,
  handler: async (
    ctx: SchemaQueryCtx,
    args: ObjectType<typeof getRedemptionByCodeArgs>
  ) => {
    const redemption = await findRedemptionByCode(ctx, args.code)
    if (!redemption) return null

    const [prize, store] = await Promise.all([
      ctx.db.get(redemption.prizeId),
      ctx.db.get(redemption.storeId),
    ])

    const expired = isAwaitingRedemption(redemption) && redemption.expiresAt < Date.now()

    return {
      code: redemption.redemptionCode,
      status: expired ? ("expired" as const) : redemption.status,
      playerFirstName: redemption.playerFirstName,
      expiresAt: redemption.expiresAt,
      redeemedAt: redemption.redeemedAt,
      storeId: redemption.storeId,
      store: store ? { name: store.name } : null,
      prize: prize ? publicPrize(prize) : null,
    }
  },
}

/** Staff marks a redemption as used. Auth is enforced by the app wrapper. */
const redeemByCodeArgs = { code: v.string(), redeemedBy: v.optional(v.string()) }
export const redeemByCode = {
  args: redeemByCodeArgs,
  handler: async (ctx: SchemaMutationCtx, args: ObjectType<typeof redeemByCodeArgs>) => {
    const redemption = await findRedemptionByCode(ctx, args.code)
    if (!redemption) throw new Error("REDEMPTION_NOT_FOUND")
    if (redemption.status === "redeemed") throw new Error("ALREADY_REDEEMED")
    if (redemption.status === "cancelled") throw new Error("REDEMPTION_CANCELLED")
    if (redemption.expiresAt < Date.now()) throw new Error("REDEMPTION_EXPIRED")

    const now = Date.now()
    await ctx.db.patch(redemption._id, {
      status: "redeemed",
      redeemedAt: now,
      redeemedBy: args.redeemedBy,
      updatedAt: now,
    })
    return { storeId: redemption.storeId }
  },
}

/** Admin: recent plays for the history tab. */
const listPlaysArgs = { storeId: v.id("stores"), limit: v.optional(v.number()) }
export const listPlays = {
  args: listPlaysArgs,
  handler: async (ctx: SchemaQueryCtx, args: ObjectType<typeof listPlaysArgs>) => {
    const plays = await ctx.db
      .query("gamePlays")
      .withIndex("by_storeId_playedAt", (q) => q.eq("storeId", args.storeId))
      .order("desc")
      .take(args.limit ?? 50)

    const prizeById = await loadPrizesById(
      ctx,
      plays.flatMap((p) => (p.prizeId ? [p.prizeId] : []))
    )

    return plays.map((p) => ({
      id: p._id,
      didWin: p.didWin,
      playerName: p.playerName,
      playerEmail: p.playerEmail,
      prizeName: p.prizeId ? prizeById.get(p.prizeId)?.name : undefined,
      playedAt: p.playedAt,
    }))
  },
}

/** Admin: redemptions list with prize names, most recent first. */
const listRedemptionsArgs = { storeId: v.id("stores"), limit: v.optional(v.number()) }
export const listRedemptions = {
  args: listRedemptionsArgs,
  handler: async (ctx: SchemaQueryCtx, args: ObjectType<typeof listRedemptionsArgs>) => {
    const redemptions = await ctx.db
      .query("prizeRedemptions")
      .withIndex("by_storeId", (q) => q.eq("storeId", args.storeId))
      .order("desc")
      .take(args.limit ?? 100)

    const prizeById = await loadPrizesById(
      ctx,
      redemptions.map((r) => r.prizeId)
    )

    const now = Date.now()
    return redemptions.map((r) => ({
      id: r._id,
      code: r.redemptionCode,
      status: isAwaitingRedemption(r) && r.expiresAt < now ? ("expired" as const) : r.status,
      playerName: r.playerName,
      playerEmail: r.playerEmail,
      prizeName: prizeById.get(r.prizeId)?.name,
      expiresAt: r.expiresAt,
      redeemedAt: r.redeemedAt,
      redeemedBy: r.redeemedBy,
      createdAt: r.createdAt,
    }))
  },
}

/** Admin: aggregate gamification stats for the winners dashboard. */
const getStatsArgs = { storeId: v.id("stores") }
export const getStats = {
  args: getStatsArgs,
  handler: async (ctx: SchemaQueryCtx, args: ObjectType<typeof getStatsArgs>) => {
    const plays = await ctx.db
      .query("gamePlays")
      .withIndex("by_storeId", (q) => q.eq("storeId", args.storeId))
      .collect()
    const redemptions = await ctx.db
      .query("prizeRedemptions")
      .withIndex("by_storeId", (q) => q.eq("storeId", args.storeId))
      .collect()

    const wins = plays.filter((p) => p.didWin).length
    return {
      totalPlays: plays.length,
      totalWins: wins,
      winRate: plays.length > 0 ? Math.round((wins / plays.length) * 100) : 0,
      totalRedeemed: redemptions.filter((r) => r.status === "redeemed").length,
      pendingRedemptions: redemptions.filter(
        (r) => isAwaitingRedemption(r) && r.expiresAt >= Date.now()
      ).length,
    }
  },
}

/** Batch-load prizes, deduplicated, keyed by id. */
async function loadPrizesById(
  ctx: SchemaQueryCtx,
  ids: DocId<"prizes">[]
): Promise<Map<DocId<"prizes">, Doc<"prizes">>> {
  const prizeById = new Map<DocId<"prizes">, Doc<"prizes">>()
  for (const id of new Set(ids)) {
    const prize = await ctx.db.get(id)
    if (prize) prizeById.set(id, prize)
  }
  return prizeById
}
