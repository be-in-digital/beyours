import { v } from "convex/values"
import type { ObjectType } from "convex/values"
import type {
  Doc,
  DocId,
  SchemaMutationCtx,
  SchemaQueryCtx,
} from "@be-in-digital/convex-schema/dataModel"

/**
 * Player-facing gamification flow (public, anonymous players).
 *
 * The outcome of every play is resolved SERVER-SIDE (win roll + prize pick);
 * the client only animates toward the result it receives. The 24h cooldown is
 * enforced per store + device fingerprint, whatever the game and the outcome.
 *
 * Handlers are typed against the shared SchemaDataModel: schema drift breaks
 * this package's type-check, not the consuming apps at runtime.
 */

const DAY_MS = 24 * 60 * 60 * 1000
export const DEFAULT_COOLDOWN_HOURS = 24

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
 * Pure : à partir des actions actives ordonnées et des actions déjà réalisées
 * par ce device (peut contenir des ids périmés), calcule la progression
 * séquentielle — l'action courante étant la première non encore faite.
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

    // Progression : en mode "sequential" (défaut), on ne présente qu'UNE action
    // par visite, la suivante non encore réalisée par ce device. Le mode "all"
    // conserve l'ancien comportement (toutes les actions d'un coup).
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

    // Parrainage : filleul (arrivé via ?ref, jamais joué), bonus du parrain
    // (tours gagnés non utilisés), et code partageable du joueur.
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
    // Un tour bonus (parrain) ou un tour offert (filleul) débloque le jeu même
    // si le cooldown court encore.
    if (pendingBonuses > 0 || isFriendWelcome) cooldown = { active: false }

    const referral = {
      enabled: referralCfg?.enabled === true,
      isFriendWelcome,
      friendRewardLabel: referralCfg?.friendRewardLabel,
      pendingBonuses,
      myShareCode: myReferral?.code ?? null,
    }

    return {
      status: "ready" as const,
      qrCodeId: qr._id,
      tableNumber: qr.tableNumber,
      store: { id: store._id, name: store.name },
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
}
export const play = {
  args: playArgs,
  handler: async (ctx: SchemaMutationCtx, args: ObjectType<typeof playArgs>) => {
    const qr = await ctx.db
      .query("gameQRCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first()
    if (!qr || !qr.isActive) throw new Error("GAME_UNAVAILABLE")

    const game = await ctx.db.get(args.gameId)
    if (!game || !game.isActive || game.storeId !== qr.storeId) {
      throw new Error("GAME_UNAVAILABLE")
    }

    const latest = await findLatestPlay(ctx, qr.storeId, args.fingerprint)
    const isFirstPlay = latest === null

    // Parrainage : bonus du parrain (tour offert malgré le cooldown) et
    // détection du filleul (arrivé via ?ref, première partie).
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

    const now = Date.now()
    const playId = await ctx.db.insert("gamePlays", {
      storeId: qr.storeId,
      gameId: game._id,
      qrCodeId: qr._id,
      fingerprint: args.fingerprint,
      completedActions: args.completedActions,
      referredByCode: isFriendWelcome ? args.ref : undefined,
      didWin: didWin && prize !== null,
      prizeId: prize?._id,
      userAgent: args.userAgent,
      playedAt: now,
      createdAt: now,
      updatedAt: now,
    })

    // Tour bonus consommé : on décrémente le crédit du parrain.
    if (consumedBonus && myReferral) {
      await ctx.db.patch(myReferral._id, {
        pendingBonuses: Math.max(0, myReferral.pendingBonuses - 1),
        updatedAt: now,
      })
    }
    // Filleul qui joue pour la première fois : le parrain gagne un tour bonus.
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
    const play = await ctx.db.get(args.playId)
    if (!play || !play.didWin || !play.prizeId) throw new Error("CLAIM_INVALID")

    const existing = await ctx.db
      .query("prizeRedemptions")
      .withIndex("by_gamePlayId", (q) => q.eq("gamePlayId", args.playId))
      .first()
    if (existing) {
      return { code: existing.redemptionCode, expiresAt: existing.expiresAt, alreadyClaimed: true }
    }

    const prize = await ctx.db.get(play.prizeId)
    if (!prize) throw new Error("CLAIM_INVALID")

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
