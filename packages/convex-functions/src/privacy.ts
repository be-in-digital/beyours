import { v } from "convex/values"
import { ORDER_TERMINAL_STATUSES } from "@be-in-digital/convex-schema"
import { hasPermission, type Role } from "@be-in-digital/core"
import {
  ANONYMISED_CUSTOMER_NAME,
  DAY_MS,
  DEFAULT_CUSTOMER_RETENTION_DAYS,
  foldEmail,
  retentionIsArmed,
  retentionWindowMs,
} from "./privacyPolicy"
import { rateLimitKey } from "./rateLimit"
import { denied, getAuthUser, seesEveryStore } from "./auth"
import { profileAllowsPermission } from "./teamAccess"

/**
 * What a restaurant does when a diner exercises their rights.
 *
 * WHY THIS EXISTS: nothing in the engine deleted, exported or anonymised a
 * diner, ever. Across every public function in a deployment, exactly two could
 * remove a person's data — `customerAddresses.removeAddress` and
 * `teamMembers.remove` — and neither is about a diner. `orders`, `gamePlays`
 * and `prizeRedemptions` had no per-subject delete at any layer: no mutation,
 * no screen, no route. The only way to erase one diner was `storeCascade`,
 * which deletes the entire establishment.
 *
 * A French restaurant running this product is the DATA CONTROLLER. It has to
 * answer an access request (art. 15), an erasure request (art. 17) and a
 * portability request (art. 20) within a month, and it must stop keeping a
 * diner's address, phone number and delivery instructions for ever
 * (art. 5.1.e). This module is the mechanism for all of them. The windows and
 * the accounting carve-out are the restaurant's decisions, written down in
 * `tasks/gdpr-diner-data-runbook.md`.
 *
 * ONE TRAVERSAL, THREE MODES. `preview`, `export` and `erase` walk the same
 * tables in the same order through the same code. That is not tidiness: it is
 * the only way to guarantee the export cannot show something the erasure would
 * miss, or the erasure destroy something the export never offered. A second
 * implementation of "where this person is" would drift within one release.
 *
 * THREE RULES IT IS BUILT ON:
 *
 * 1. **Addresses compare folded, never seeked.** `emailSubscribers` folds on
 *    write; `orders.customerInfo.email` and `gamePlays.playerEmail` store what
 *    the diner typed. An index seek on one spelling misses the other and
 *    reports an erasure that did not happen, so every uncertain match here is a
 *    folded comparison over a walk. It costs a scan. It is the only version
 *    that is true.
 * 2. **The report names what was KEPT.** A report listing only deletions tells
 *    the operator the request was honoured in full when it was not, and they
 *    then tell the diner the same thing. Every row left standing is counted,
 *    with its reason, in French, because the operator quotes it in their reply.
 * 3. **A paid order is anonymised, not deleted.** It is the establishment's
 *    accounting record — this engine issues no separate invoice, so the order
 *    IS the pièce justificative — and art. L123-22 of the Code de commerce
 *    wants ten years of them. Art. 17.3.b covers exactly that: erasure yields
 *    where processing is necessary for a legal obligation. The money, the
 *    lines and the VAT stay; the person leaves.
 */

/* ------------------------------------------------------------------ */
/* Shapes                                                              */
/* ------------------------------------------------------------------ */

/** Who is being looked for. At least one handle is required. */
export interface PrivacySubject {
  /** Compared folded, everywhere. */
  email?: string
  /** The device handle an anonymous game play is keyed on. */
  fingerprint?: string
}

/**
 * Every table this module knows holds a diner's personal data.
 *
 * `privacy.test.ts` compares this list against the schema and fails when a
 * table carrying an email, a phone, an address, a fingerprint or a subject id
 * appears without being named here. That check is why the list is a constant
 * rather than prose: an erasure path silently missing a table is the failure
 * this whole feature exists to prevent, and nothing else would catch it.
 */
export const DINER_TABLES = [
  "orders",
  "kitchenTickets",
  "payments",
  "deliveryQuotes",
  "promotionUsages",
  "contactMessages",
  "emailSubscribers",
  "emailEvents",
  "emailAutomationRuns",
  "gamePlays",
  "prizeRedemptions",
  "gameReferrals",
  "favorites",
  "customerAddresses",
  "rateLimits",
  "userProfiles",
  "platformWebhookFailures",
  "emailSegments",
  "cmsHome",
] as const

export type DinerTable = (typeof DINER_TABLES)[number]

/** One table's tally for a run. */
export interface TableTally {
  table: string
  deleted: number
  anonymised: number
}

/** One thing a run deliberately did not do, and why — in French. */
export interface RetainedNote {
  table: string
  /** -1 where the count is not knowable, e.g. an unindexable table. */
  count: number
  reason: string
}

export type PrivacyMode = "preview" | "export" | "erase"

/**
 * Where a run got to, so the next pass resumes instead of restarting.
 *
 * A Convex pagination cursor rather than "the last timestamp I saw", which was
 * the first design and was wrong: two orders can share a `createdAt` to the
 * millisecond — a double-submitted checkout does it routinely — and resuming
 * at `> lastSeen` steps straight over the second one. An erasure that skips a
 * row is the exact failure this module exists to prevent, so the walk pays for
 * a real cursor. `sweepInactive` already carries one between transactions.
 *
 * `userIds` is carried rather than re-derived: it is discovered from the
 * matched orders' `customerId`, and by the time the later steps need it those
 * orders have already had their `customerId` cleared. Re-deriving would come
 * back empty and quietly skip the diner's saved addresses.
 */
export interface PrivacyState {
  step: number
  storeIndex: number
  cursor: string | null
  userIds: string[]
  /** Device handles found on the way, so a later step can act on them. */
  fingerprints: string[]
  tallies: TableTally[]
  retained: RetainedNote[]
}

export interface PrivacyReport {
  storeIds: string[]
  everyStore: boolean
  tallies: TableTally[]
  retained: RetainedNote[]
  /**
   * False when the walk stopped before the end.
   *
   * On an erasure this means "schedule another pass" — never "done". On a
   * preview it means "at least this much", which is what the screen must say:
   * a preview that quietly under-reports is how somebody promises a diner an
   * erasure that will not finish.
   */
  complete: boolean
}

/**
 * Everything the deployment holds about one diner.
 *
 * Art. 20 asks for a "structured, commonly used and machine-readable format".
 * These are the RAW rows, not a prettified summary: a portability export the
 * diner cannot re-import anywhere is not portability, and the operator
 * answering an art. 15 request needs to see what is actually stored rather
 * than a description of it. `_id` and `_creationTime` are kept — they are how
 * the operator finds the row again if the diner disputes the answer.
 */
export interface PrivacyExport extends PrivacyReport {
  generatedAt: number
  subject: PrivacySubject
  records: Array<{ table: string; rows: unknown[] }>
}

/* ------------------------------------------------------------------ */
/* Budgets                                                             */
/* ------------------------------------------------------------------ */

/**
 * Rows one erasure pass will look at.
 *
 * A Convex mutation is one transaction with a bounded read and write budget,
 * and three years of a busy restaurant's orders is far past it. So an erasure
 * is a loop, exactly like `storeCascade`: this many rows examined, then the
 * caller resumes from the state this pass returned. Nothing is truncated and
 * called done — `complete: false` is the signal, and the app wrapper
 * reschedules until it is true.
 *
 * The difference from `storeCascade` matters and is deliberate: a cascade that
 * truncates just deletes the rest on the next pass, but an ERASURE that
 * truncates and reports success leaves the person's data in place while
 * telling them it is gone. Hence `complete`, on every return.
 */
export const ERASURE_SCAN_BUDGET = 400

/**
 * Rows a preview or an export will look at, in one query.
 *
 * Higher than the erasure budget because a query only reads — it has no write
 * budget to spend — and lower than Convex's ceiling so a big establishment
 * gets an answer rather than an error.
 */
export const READ_SCAN_BUDGET = 2_048

/* ------------------------------------------------------------------ */
/* Scope and guard                                                     */
/* ------------------------------------------------------------------ */

/**
 * The establishments a data-subject request may reach.
 *
 * DEPLOYMENT-WIDE, WITHIN THE CALLER'S REMIT. The controller is the business,
 * not one of its dining rooms: a diner who ordered at two locations is one
 * data subject, three of the tables involved have no `storeId` at all
 * (`customerAddresses`, `rateLimits`, `userProfiles`), and a per-establishment
 * erasure could not touch them coherently.
 *
 * But not the whole chain for everyone. #94 established that a client admin
 * sees the establishments named on their own profile and no others, and an
 * erasure is a stronger act than a read. A super admin's remit is the chain,
 * so theirs is. The report carries the list, so the answer given to the diner
 * says which establishments were covered instead of implying all of them were.
 */
/** Who the caller is, and what they may reach. */
export interface PrivacyScope {
  storeIds: string[]
  everyStore: boolean
  actor: string
}

export async function requirePrivacyScope(
  ctx: any
): Promise<PrivacyScope> {
  const user = await getAuthUser(ctx)
  const role = user.role as Role

  // A dedicated permission rather than `customers:write` — that one also gates
  // "mark a contact message read", and an owner who granted it to a manager to
  // unblock the inbox must not thereby have granted irreversible erasure.
  //
  // `profileAllowsPermission` runs for consistency with every other guarded
  // path, NOT as a second barrier. It exempts admins by design
  // (`MODULE_EXEMPT_ROLES`), so that an owner cannot be shut out of their own
  // restaurant by a module list — and `customers:manage` is held by admins
  // alone. Taking the "Clients" module off an administrator therefore takes
  // nothing away here, and this comment says so rather than implying a gate
  // that does not bind.
  if (
    !hasPermission(role, "customers:manage") ||
    !profileAllowsPermission({ role, permissions: user.permissions }, "customers:manage")
  ) {
    throw denied(
      "permission_denied",
      "Access denied : répondre à une demande RGPD demande le droit « customers:manage ».",
      { role, permission: "customers:manage" }
    )
  }

  const actor = user.userId ?? "unknown"

  const stores = await ctx.db.query("stores").collect()
  const allStoreIds: string[] = stores.map((store: { _id: unknown }) => String(store._id))

  if (seesEveryStore(role)) {
    return { storeIds: allStoreIds, everyStore: true, actor }
  }

  const storeIds = (user.storeIds ?? []).map(String)
  // `everyStore` is a statement about REACH, not about the role, and the walk's
  // global steps depend on it. Four things a request has to touch belong to the
  // PERSON rather than to an establishment — their saved addresses, their
  // profile, their favourites at another dining room, their limiter counters —
  // and nothing can partition those by store. An owner who administers every
  // establishment the deployment has IS the whole business and may reach them;
  // one who administers two of three may not, because that would let the
  // administrator of one restaurant delete rows belonging to another while the
  // report named only their own.
  const everyStore =
    allStoreIds.length > 0 && allStoreIds.every((id) => storeIds.includes(id))

  return { storeIds, everyStore, actor }
}

/** A subject with nothing to look for finds everyone. Refuse it. */
export function assertSubject(subject: PrivacySubject): {
  email?: string
  fingerprint?: string
} {
  const email = subject.email && subject.email.trim() ? foldEmail(subject.email) : undefined
  const fingerprint =
    subject.fingerprint && subject.fingerprint.trim() ? subject.fingerprint.trim() : undefined
  if (!email && !fingerprint) throw new Error("PRIVACY_SUBJECT_REQUIRED")
  return { email, fingerprint }
}

/* ------------------------------------------------------------------ */
/* Policy — what happens to each row                                   */
/* ------------------------------------------------------------------ */

/** The rate-limit windows whose subject is a person, not a store or a QR code. */
export const PERSON_KEYED_LIMITS = [
  { name: "contactPerEmail", handle: "email" },
  { name: "subscribePerEmail", handle: "email" },
  { name: "gameClaimPerEmail", handle: "email" },
  { name: "gamePlayPerFingerprint", handle: "fingerprint" },
] as const

/**
 * An order still being served is not erasable yet.
 *
 * Art. 17.3.b: erasure yields to processing necessary to perform the contract,
 * and an order in the pass is exactly that — the kitchen is cooking it and a
 * courier may be carrying it to the address this would blank. It is not a
 * theoretical concern: `buildCreateDeliveryRequest` throws
 * `MISSING_DELIVERY_ADDRESS` and `MISSING_CUSTOMER_PHONE`, so anonymising an
 * undispatched order makes the delivery permanently unbookable.
 *
 * `delivered` is NOT terminal in this product (`ORDER_STATUS_TRANSITIONS` still
 * allows `delivered -> completed`), so it waits too. A `refund_pending` order
 * waits for the same reason from the other direction: money is owed back and
 * the operator may still need to reach the person to return it.
 *
 * Always reported, never skipped silently, and the retention sweep takes it
 * once the service that needed it is over.
 */
export function orderIsErasable(order: {
  status: string
  paymentStatus: string
}): boolean {
  if (!(ORDER_TERMINAL_STATUSES as readonly string[]).includes(order.status)) return false
  if (order.paymentStatus === "refund_pending") return false
  return true
}

/**
 * What replaces a diner inside an order that has to stay on the books.
 *
 * Everything that could name, reach or locate the person goes. Everything the
 * accounts need stays: `orderNumber`, the lines, the amounts, the VAT, the
 * dates, `paymentStatus`.
 *
 * Three of these are less obvious than the name and the address, and each is a
 * LIVE POINTER rather than a stored identifier:
 *
 * - `viewToken` opens the order's confirmation page to whoever holds the link,
 *   with no session and no store check. A token outliving its owner is a
 *   credential nobody is watching, still sitting in an inbox.
 * - `uberDirectTrackingUrl` and `uberDirectDeliveryId` resolve to an
 *   Uber-hosted page showing a courier's route to the diner's door.
 * - `externalPlatformData` is a raw platform payload — the diner's name, phone
 *   and address as Deliveroo sent them. Nothing writes it today; it is cleared
 *   unconditionally so that a future writer cannot land underneath an erasure
 *   that never looked at it.
 *
 * `name` becomes a constant rather than disappearing: the schema requires it,
 * and `orders-page.tsx` calls `.toLowerCase()` on it with no guard, so an
 * undefined name crashes the whole orders list rather than blanking one cell.
 */
export function anonymisedOrderPatch(
  order: { items?: Array<Record<string, unknown>> },
  now: number
): Record<string, unknown> {
  return {
    customerInfo: { name: ANONYMISED_CUSTOMER_NAME },
    customerId: undefined,
    deliveryAddress: undefined,
    notes: undefined,
    cancellationReason: undefined,
    viewToken: undefined,
    uberDirectTrackingUrl: undefined,
    uberDirectDeliveryId: undefined,
    externalPlatformData: undefined,
    // A line note is where "allergique aux fruits de mer" and "sonner chez la
    // voisine" are actually typed. The line itself — product, quantity, price —
    // is the accounting content and stays.
    items: (order.items ?? []).map((line) => ({ ...line, notes: undefined })),
    anonymisedAt: now,
    updatedAt: now,
  }
}

/**
 * What goes from a payment kept as the proof the money moved.
 *
 * The row stays: it is the settlement record behind the order. What goes is
 * everything on it that names or reaches the person —
 *
 * - `metadata.receiptUrl` is a live URL to the provider's own copy of the
 *   receipt, which carries the diner's email. Keeping it is keeping a pointer
 *   to the thing you told them you deleted. The charge is still findable by
 *   `externalId`, which is what reconciliation actually uses.
 * - `refundReason` and `refunds[].reason` are unbounded free text a staff
 *   member typed, and what gets typed there is « Mme Dupont s'est plainte du
 *   délai ».
 *
 * `last4` and `brand` STAY, and that is a judgement the user has to confirm:
 * they are the operator's handle in a chargeback, whose scheme windows run to
 * about 540 days, and they identify a card rather than a person. Recorded as
 * an open question in `tasks/gdpr-diner-data-runbook.md`.
 */
export function anonymisedPaymentPatch(
  payment: {
    metadata?: { last4?: string; brand?: string; receiptUrl?: string }
    refunds?: Array<Record<string, unknown>>
  },
  now: number
): Record<string, unknown> {
  return {
    metadata: payment.metadata
      ? { last4: payment.metadata.last4, brand: payment.metadata.brand }
      : undefined,
    refundReason: undefined,
    refunds: payment.refunds?.map((refund) => ({ ...refund, reason: undefined })),
    updatedAt: now,
  }
}

/**
 * What goes from a diner's own profile row.
 *
 * ANONYMISED, NEVER DELETED. `getAuthUser` throws `denied("no_profile", …)`
 * when a signed-in account has no profile, so deleting this row while the
 * Better Auth account survives locks that account into a permanent "aucun rôle
 * n'est attribué à ce compte" — a soft-lock that reads as a bug to the diner
 * and to whoever they complain to. Closing the account is a separate act, on a
 * component this package cannot see; the report says so.
 */
export function anonymisedProfilePatch(now: number): Record<string, unknown> {
  return { phones: [], avatarUrl: undefined, updatedAt: now }
}

/* ------------------------------------------------------------------ */
/* The traversal                                                       */
/* ------------------------------------------------------------------ */

/**
 * The order the walk visits tables in, and it is not arbitrary.
 *
 * Orders first, because the diner's `customerId` is discovered there and the
 * later steps need it. Then the tables reached only by scanning, then the ones
 * reached by an exact key, then the global ones. A walk interrupted between
 * steps therefore leaves the establishment's own records dealt with first,
 * which is the half an operator is asked about.
 */
const STEP_ORDERS = 0
const STEP_GAME_PLAYS = 1
const STEP_REDEMPTIONS = 2
const STEP_CONTACT_MESSAGES = 3
const STEP_PROMOTION_USAGES = 4
const STEP_EMAIL_SUBSCRIBERS = 5
const STEP_GAME_REFERRALS = 6
const STEP_ACCOUNT_TABLES = 7
const STEP_RATE_LIMITS = 8
const STEP_NOTES = 9
const STEP_DONE = 10

export function initialState(): PrivacyState {
  return {
    step: STEP_ORDERS,
    storeIndex: 0,
    cursor: null,
    userIds: [],
    fingerprints: [],
    tallies: [],
    retained: [],
  }
}

function tally(state: PrivacyState, table: string, kind: "deleted" | "anonymised", n = 1): void {
  if (n === 0) return
  let row = state.tallies.find((t) => t.table === table)
  if (!row) {
    row = { table, deleted: 0, anonymised: 0 }
    state.tallies.push(row)
  }
  row[kind] += n
}

function note(state: PrivacyState, table: string, count: number, reason: string): void {
  const existing = state.retained.find((r) => r.table === table)
  if (existing) {
    if (existing.count >= 0 && count >= 0) existing.count += count
    return
  }
  state.retained.push({ table, count, reason })
}

interface Collected {
  table: string
  rows: unknown[]
}

function collect(into: Collected[], table: string, row: unknown): void {
  let bucket = into.find((b) => b.table === table)
  if (!bucket) {
    bucket = { table, rows: [] }
    into.push(bucket)
  }
  bucket.rows.push(row)
}

/**
 * Walk one diner's data, and do `mode` to it.
 *
 * Returns when the budget runs out or the walk finishes. `complete` says
 * which, and every caller has to look at it: on an erasure it means "schedule
 * another pass", on a preview it means "at least this much".
 */
export async function privacyPass(
  ctx: any,
  params: {
    subject: { email?: string; fingerprint?: string }
    storeIds: string[]
    /**
     * Whether the caller reaches every establishment in the deployment.
     *
     * Gates the steps that CANNOT be scoped to a store — a diner's saved
     * addresses, their profile, their limiter counters. Without it, an
     * administrator of one restaurant would delete rows belonging to another
     * while the report named only their own.
     */
    everyStore: boolean
    mode: PrivacyMode
    budget: number
    now: number
    state?: PrivacyState
  }
): Promise<{ state: PrivacyState; complete: boolean; records: Collected[] }> {
  const { subject, storeIds, everyStore, mode, now } = params
  const state = params.state ?? initialState()
  const records: Collected[] = []
  const write = mode === "erase"
  let budget = params.budget

  const matchesEmail = (value: string | undefined): boolean =>
    Boolean(subject.email && value && foldEmail(value) === subject.email)

  /**
   * Every device handle this request may act on.
   *
   * Starts as whatever the operator typed, and grows as the walk finds plays
   * belonging to the address. WHY: a real art. 17 letter carries an e-mail
   * address, never a browser fingerprint — so an erasure by address alone
   * skipped `gameReferrals` entirely and left the diner's name and device on a
   * referral row. The play is the join between the two, and the walk visits it
   * before the referral step.
   */
  const fingerprints = new Set<string>(state.fingerprints)
  if (subject.fingerprint) fingerprints.add(subject.fingerprint)

  /** One page of a store-scoped index, or null when this store is exhausted. */

  async function page(table: string, index: string, storeId: string): Promise<any> {
    const numItems = Math.min(budget, 128)
    return await ctx.db
      .query(table)
      .withIndex(index, (q: any) => q.eq("storeId", storeId))
      .paginate({ cursor: state.cursor, numItems })
  }

  /** Advance past the current store, or past the current step. */
  function advance(): void {
    state.cursor = null
    state.storeIndex += 1
    if (state.storeIndex >= storeIds.length) {
      state.storeIndex = 0
      state.step += 1
    }
  }

  while (state.step < STEP_DONE && budget > 0) {
    /* ---------------- store-scoped steps ---------------- */
    if (state.step <= STEP_GAME_REFERRALS) {
      if (storeIds.length === 0) {
        state.step = STEP_ACCOUNT_TABLES
        continue
      }
      const storeId = storeIds[state.storeIndex]!

      if (state.step === STEP_ORDERS) {
        if (!subject.email) {
          // Nothing here is reachable by a device fingerprint: an order records
          // no such thing. Say so once rather than walking the whole table to
          // find nothing.
          note(state, "orders", -1, "Non atteignable sans adresse e-mail : une commande n'enregistre pas d'empreinte d'appareil.")
          state.step = STEP_GAME_PLAYS
          state.storeIndex = 0
          state.cursor = null
          continue
        }
        const result = await page("orders", "by_storeId_createdAt", storeId)
        budget -= result.page.length
        for (const order of result.page) {
          if (!matchesEmail(order.customerInfo?.email)) continue
          if (mode === "export") {
            collect(records, "orders", order)
          }
          if (!orderIsErasable(order)) {
            note(
              state,
              "orders",
              1,
              "Commande encore en cours ou remboursement à effectuer : conservée le temps du service (art. 17.3.b), puis reprise par la purge automatique."
            )
            continue
          }
          if (order.anonymisedAt) continue
          // The rows that hang off this order, reached by index rather than
          // scanned. Each is a copy of the same person, written by the order
          // itself, and each is the copy an erasure silently misses.
          budget -= await eraseOrderDependents(ctx, order, {
            mode,
            now,
            state,
            records,
            write,
          })
          if (write) await ctx.db.patch(order._id, anonymisedOrderPatch(order, now))
          tally(state, "orders", "anonymised")
          if (order.customerId && !state.userIds.includes(String(order.customerId))) {
            state.userIds.push(String(order.customerId))
          }
        }
        if (result.isDone) advance()
        else state.cursor = result.continueCursor
        continue
      }

      if (state.step === STEP_GAME_PLAYS) {
        const result = await page("gamePlays", "by_storeId_playedAt", storeId)
        budget -= result.page.length
        for (const play of result.page) {
          const hit =
            matchesEmail(play.playerEmail) ||
            Boolean(subject.fingerprint && play.fingerprint === subject.fingerprint)
          if (!hit) continue
          if (mode === "export") collect(records, "gamePlays", play)
          // The join that lets an e-mail request reach the referral rows.
          if (play.fingerprint) fingerprints.add(String(play.fingerprint))
          // Redemptions FIRST: `prizeRedemptions.gamePlayId` is a
          // non-optional `v.id("gamePlays")`, so deleting the play first
          // leaves a document whose schema promises one and whose readers get
          // null. Same trap `orders` is anonymised to avoid.
          const redemptions = await ctx.db
            .query("prizeRedemptions")
            .withIndex("by_gamePlayId", (q: any) => q.eq("gamePlayId", play._id))
            .collect()
          budget -= redemptions.length
          for (const redemption of redemptions) {
            if (mode === "export") collect(records, "prizeRedemptions", redemption)
            if (redemption.status === "pending" || redemption.status === "claimed") {
              note(
                state,
                "prizeRedemptions",
                0,
                "Un lot gagné et non encore retiré a été supprimé avec la demande : le code envoyé au client ne fonctionnera plus."
              )
            }
            if (write) await ctx.db.delete(redemption._id)
            tally(state, "prizeRedemptions", "deleted")
          }
          if (write) await ctx.db.delete(play._id)
          tally(state, "gamePlays", "deleted")
        }
        if (result.isDone) advance()
        else state.cursor = result.continueCursor
        continue
      }

      if (state.step === STEP_REDEMPTIONS) {
        // The redemptions the play step could not reach.
        //
        // It finds them through `by_gamePlayId`, which is right while the play
        // exists — but the retention sweep deletes plays, and a redemption
        // outlives its play by design when the prize is still valid. Such a row
        // keeps `playerEmail`, `playerName` and the redemption code with
        // nothing pointing at it, and the erasure walked past it.
        if (!subject.email) {
          state.step = STEP_CONTACT_MESSAGES
          state.storeIndex = 0
          state.cursor = null
          continue
        }
        const result = await page("prizeRedemptions", "by_storeId", storeId)
        budget -= result.page.length
        for (const redemption of result.page) {
          if (!matchesEmail(redemption.playerEmail)) continue
          if (mode === "export") collect(records, "prizeRedemptions", redemption)
          if (redemption.status === "pending" || redemption.status === "claimed") {
            note(
              state,
              "prizeRedemptions",
              0,
              "Un lot gagné et non encore retiré a été supprimé avec la demande : le code envoyé au client ne fonctionnera plus."
            )
          }
          if (write) await ctx.db.delete(redemption._id)
          tally(state, "prizeRedemptions", "deleted")
        }
        if (result.isDone) advance()
        else state.cursor = result.continueCursor
        continue
      }

      if (state.step === STEP_CONTACT_MESSAGES) {
        if (!subject.email) {
          state.step = STEP_PROMOTION_USAGES
          state.storeIndex = 0
          state.cursor = null
          continue
        }
        const result = await page("contactMessages", "by_storeId_createdAt", storeId)
        budget -= result.page.length
        for (const message of result.page) {
          if (!matchesEmail(message.email)) continue
          if (mode === "export") collect(records, "contactMessages", message)
          if (write) await ctx.db.delete(message._id)
          tally(state, "contactMessages", "deleted")
        }
        if (result.isDone) advance()
        else state.cursor = result.continueCursor
        continue
      }

      if (state.step === STEP_PROMOTION_USAGES) {
        if (!subject.email) {
          state.step = STEP_EMAIL_SUBSCRIBERS
          state.storeIndex = 0
          state.cursor = null
          continue
        }
        const result = await page("promotionUsages", "by_storeId_usedAt", storeId)
        budget -= result.page.length
        for (const usage of result.page) {
          if (!matchesEmail(usage.customerEmail)) continue
          if (mode === "export") collect(records, "promotionUsages", usage)
          if (write) await ctx.db.delete(usage._id)
          tally(state, "promotionUsages", "deleted")
          // Deleting the row is what erasure means, and it has a consequence
          // the operator has to be able to explain: the row existed to enforce
          // "one use per customer", so the offer becomes usable again.
          note(
            state,
            "promotionUsages",
            0,
            "L'historique d'utilisation des promotions a été supprimé : une offre limitée à une fois par client redevient utilisable par cette adresse."
          )
        }
        if (result.isDone) advance()
        else state.cursor = result.continueCursor
        continue
      }

      if (state.step === STEP_EMAIL_SUBSCRIBERS) {
        if (!subject.email) {
          state.step = STEP_GAME_REFERRALS
          state.storeIndex = 0
          state.cursor = null
          continue
        }
        // A WALK, NOT A SEEK — and the first version of this got it wrong.
        //
        // `by_storeId_email` looks exact because `subscribe` folds its address
        // on write. The CSV import did not: it lower-cased without trimming,
        // so a spreadsheet column with a trailing space wrote
        // « marie@x.fr » with the space still on it. A seek on the folded value
        // walked straight past that row and the erasure reported success.
        // (The import is fixed too, but rows written before the fix are
        // exactly the ones a request will arrive about.)
        const result = await page("emailSubscribers", "by_storeId", storeId)
        budget -= result.page.length
        for (const subscriber of result.page) {
          if (!matchesEmail(subscriber.email)) continue
          if (mode === "export") collect(records, "emailSubscribers", subscriber)
          budget -= await eraseSubscriberDependents(ctx, subscriber._id, {
            mode,
            state,
            records,
            write,
          })
          if (write) await ctx.db.delete(subscriber._id)
          tally(state, "emailSubscribers", "deleted")
        }
        if (result.isDone) advance()
        else state.cursor = result.continueCursor
        continue
      }

      if (state.step === STEP_GAME_REFERRALS) {
        // Every handle the walk knows about — the one the operator typed, plus
        // any found on this person's plays. An erasure by e-mail alone used to
        // skip this step silently and leave the diner's name and device on a
        // referral row; the play is the join, and it has already been walked.
        if (fingerprints.size === 0) {
          note(
            state,
            "gameReferrals",
            -1,
            "Parrainages du jeu : rattachés à un appareil. Aucun appareil n'a pu être relié à cette demande."
          )
          state.step = STEP_ACCOUNT_TABLES
          state.storeIndex = 0
          state.cursor = null
          continue
        }
        const referrals: Array<{ _id: unknown; pendingBonuses: number }> = []
        for (const handle of fingerprints) {
          const rows = await ctx.db
            .query("gameReferrals")
            .withIndex("by_storeId_referrerFingerprint", (q: any) =>
              q.eq("storeId", storeId).eq("referrerFingerprint", handle)
            )
            .collect()
          referrals.push(...rows)
        }
        budget -= Math.max(1, referrals.length)
        for (const referral of referrals) {
          if (mode === "export") collect(records, "gameReferrals", referral)
          // Cannot be anonymised in place: `referrerFingerprint` is required
          // and IS the row's key, so blanking it would collide every referrer
          // in the establishment onto one row.
          if (write) await ctx.db.delete(referral._id)
          tally(state, "gameReferrals", "deleted")
          if (referral.pendingBonuses > 0) {
            note(
              state,
              "gameReferrals",
              0,
              "Des tours bonus de parrainage non utilisés ont été supprimés avec la demande."
            )
          }
        }
        advance()
        continue
      }
    }

    /* ---------------- global steps ---------------- */
    if (state.step === STEP_ACCOUNT_TABLES) {
      // WHY THIS IS GATED ON REACH. These rows belong to the PERSON, not to an
      // establishment: `customerAddresses` and `userProfiles` have no
      // `storeId` at all, and a `favorites` row can sit at a dining room this
      // caller does not administer. Acting on them from a partial scope is how
      // the administrator of one restaurant deletes a row belonging to another
      // while the report names only their own.
      if (!everyStore) {
        note(
          state,
          "customerAddresses",
          -1,
          "Adresses enregistrées, favoris et profil client : rattachés à la personne, pas à un établissement. Cette demande ne couvre pas tous les établissements du compte — faites-la relancer par un administrateur qui les gère tous."
        )
        state.step = STEP_RATE_LIMITS
        state.cursor = null
        continue
      }
      // Reachable only through a signed-in order: `favorites` and
      // `customerAddresses` are keyed by the Better Auth subject and hold no
      // address of their own. A diner who saved a delivery address but never
      // ordered cannot be found by e-mail at all — said plainly below rather
      // than left as a silent zero.
      if (state.userIds.length === 0) {
        note(
          state,
          "customerAddresses",
          -1,
          "Adresses enregistrées et favoris : rattachés à un compte, retrouvés uniquement via une commande passée en étant connecté. Aucun compte n'a pu être relié à cette demande."
        )
        state.step = STEP_RATE_LIMITS
        continue
      }
      for (const userId of state.userIds) {
        for (const table of ["favorites", "customerAddresses"] as const) {
          const rows = await ctx.db
            .query(table)
            .withIndex("by_userId", (q: any) => q.eq("userId", userId))
            .collect()
          budget -= Math.max(1, rows.length)
          for (const row of rows) {
            if (mode === "export") collect(records, table, row)
            if (write) await ctx.db.delete(row._id)
            tally(state, table, "deleted")
          }
        }
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q: any) => q.eq("userId", userId))
          .first()
        budget -= 1
        if (profile) {
          if (mode === "export") collect(records, "userProfiles", profile)
          if (write) await ctx.db.patch(profile._id, anonymisedProfilePatch(now))
          tally(state, "userProfiles", "anonymised")
        }
      }
      state.step = STEP_RATE_LIMITS
      continue
    }

    if (state.step === STEP_RATE_LIMITS) {
      // Exactly reconstructible, so no scan: every person-keyed rule folds its
      // subject, and `rateLimitKey` is imported rather than reimplemented so
      // the two cannot drift.
      for (const limit of PERSON_KEYED_LIMITS) {
        const value = limit.handle === "email" ? subject.email : subject.fingerprint
        if (!value) continue
        const row = await ctx.db
          .query("rateLimits")
          .withIndex("by_key", (q: any) => q.eq("key", rateLimitKey(limit.name, value)))
          .first()
        budget -= 1
        if (!row) continue
        if (mode === "export") collect(records, "rateLimits", row)
        if (write) await ctx.db.delete(row._id)
        tally(state, "rateLimits", "deleted")
      }
      state.step = STEP_NOTES
      continue
    }

    if (state.step === STEP_NOTES) {
      // What this module cannot reach, stated so the operator's reply to the
      // diner is true rather than confident. Each of these is a manual step in
      // `tasks/gdpr-diner-data-runbook.md`.
      note(
        state,
        "betterAuth",
        -1,
        "Compte client (identifiant, mot de passe, sessions et adresses IP de connexion) : géré par le composant d'authentification, hors de portée de cette purge. Sa fermeture est une étape manuelle."
      )
      note(
        state,
        "platformWebhookFailures",
        -1,
        "File d'attente des webhooks Uber Eats / Deliveroo : contient des commandes brutes non indexables par personne. Effacée par la purge programmée, pas par cette demande."
      )
      note(
        state,
        "cmsHome",
        -1,
        "Témoignages publiés sur la page d'accueil : contenu éditorial saisi par l'établissement. À vérifier et retirer à la main si cette personne y est citée."
      )
      note(
        state,
        "emailSegments",
        -1,
        "Segments d'emailing : une règle de segment peut nommer une adresse. C'est un réglage de l'établissement, à corriger à la main."
      )
      state.step = STEP_DONE
      continue
    }

    // Unknown step: stop rather than loop.
    state.step = STEP_DONE
  }

  state.fingerprints = [...fingerprints]
  return { state, complete: state.step >= STEP_DONE, records }
}

/**
 * The rows one order wrote about the same person somewhere else.
 *
 * Returns how much budget it spent. Each of these is a denormalised copy the
 * order itself created, and each is the copy an erasure built on `orders`
 * alone leaves behind.
 */
async function eraseOrderDependents(
  ctx: any,

  order: any,
  opts: {
    mode: PrivacyMode
    now: number
    state: PrivacyState
    records: Collected[]
    write: boolean
  }
): Promise<number> {
  let spent = 0

  // Kitchen tickets: DELETED, not anonymised. A ticket is a production
  // instruction, not an accounting record — it carries no price and no VAT and
  // could not serve as a pièce justificative — the engine already deletes them
  // wholesale at thirty days, and `allergens` is art. 9 health data with no
  // retention justification at all. `trackingToken` is required by the schema
  // and is a bearer credential, so there is nothing to anonymise it down to.
  const tickets = await ctx.db
    .query("kitchenTickets")
    .withIndex("by_orderId", (q: any) => q.eq("orderId", order._id))
    .collect()
  spent += tickets.length
  for (const ticket of tickets) {
    if (opts.mode === "export") collect(opts.records, "kitchenTickets", ticket)
    if (opts.write) await ctx.db.delete(ticket._id)
    tally(opts.state, "kitchenTickets", "deleted")
  }

  const payments = await ctx.db
    .query("payments")
    .withIndex("by_orderId", (q: any) => q.eq("orderId", order._id))
    .collect()
  spent += payments.length
  for (const payment of payments) {
    if (opts.mode === "export") collect(opts.records, "payments", payment)
    if (opts.write) await ctx.db.patch(payment._id, anonymisedPaymentPatch(payment, opts.now))
    tally(opts.state, "payments", "anonymised")
  }

  // The delivery quote holds the latitude and longitude of the diner's front
  // door. It is reachable — the order kept the estimate id — and it is not an
  // accounting record: the fee that mattered was copied onto the order itself.
  if (order.uberDirectEstimateId) {
    const quotes = await ctx.db
      .query("deliveryQuotes")
      .withIndex("by_estimateId", (q: any) => q.eq("estimateId", order.uberDirectEstimateId))
      .collect()
    spent += quotes.length
    for (const quote of quotes) {
      if (opts.mode === "export") collect(opts.records, "deliveryQuotes", quote)
      if (opts.write) await ctx.db.delete(quote._id)
      tally(opts.state, "deliveryQuotes", "deleted")
    }
  }

  return spent
}

/**
 * The rows that point at a subscriber, cleared before the subscriber is.
 *
 * `emailAutomationRuns.subscriberId` and `emailEvents.subscriberId` are both
 * NON-OPTIONAL `v.id("emailSubscribers")`. Deleting the subscriber first
 * leaves documents whose schema promises a row that no longer resolves —
 * `v.id()` validates how an id is encoded, never that it points at anything.
 */
async function eraseSubscriberDependents(
  ctx: any,
  subscriberId: unknown,
  opts: { mode: PrivacyMode; state: PrivacyState; records: Collected[]; write: boolean }
): Promise<number> {
  let spent = 0
  for (const table of ["emailAutomationRuns", "emailEvents"] as const) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_subscriberId", (q: any) => q.eq("subscriberId", subscriberId))
      .collect()
    spent += rows.length
    for (const row of rows) {
      if (opts.mode === "export") collect(opts.records, table, row)
      if (opts.write) await ctx.db.delete(row._id)
      tally(opts.state, table, "deleted")
    }
  }
  return spent
}

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

/** The longest an audit `details` string may get. */
const MAX_AUDIT_DETAILS = 4000

/**
 * Write down that a request was answered, and how.
 *
 * THE SUBJECT IS KEPT ON PURPOSE. This row is the establishment's proof that
 * it did what the diner asked — art. 5.2 puts the burden of showing that on
 * the controller — and it has to be findable when the person, or the CNIL,
 * asks whether the request was honoured. It carries the folded address or the
 * fingerprint and the counts, and nothing else about them: no name, no phone,
 * no order.
 *
 * `targetStoreId` is deliberately left unset. The schema's own comment says an
 * unset value means "system-wide", which a request spanning every
 * establishment in the caller's remit is.
 */
export async function recordPrivacyAudit(
  ctx: any,
  entry: {
    action: "privacy_export" | "privacy_erasure" | "privacy_retention_sweep"
    actor: string
    subject?: { email?: string; fingerprint?: string }
    report: PrivacyReport
    now: number
  }
): Promise<void> {
  const touched = entry.report.tallies
    .map((t) => `${t.table}: ${t.deleted} supprimé(s), ${t.anonymised} anonymisé(s)`)
    .join(" · ")
  const subject = entry.subject
    ? `sujet=${entry.subject.email ?? entry.subject.fingerprint ?? "?"}`
    : "sujet=—"
  const details = [
    subject,
    `établissements=${entry.report.storeIds.length}${entry.report.everyStore ? " (tous)" : ""}`,
    entry.report.complete ? "terminé" : "INCOMPLET — une passe supplémentaire est nécessaire",
    touched || "aucune ligne touchée",
    entry.report.retained.length > 0
      ? `conservé : ${entry.report.retained.map((r) => r.table).join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join(" | ")

  await ctx.db.insert("systemAuditLog", {
    action: entry.action,
    performedBy: entry.actor,
    performedAt: entry.now,
    details: details.slice(0, MAX_AUDIT_DETAILS),
    result: "success" as const,
  })
}

/* ------------------------------------------------------------------ */
/* Public entry points                                                 */
/* ------------------------------------------------------------------ */

const subjectArgs = {
  email: v.optional(v.string()),
  fingerprint: v.optional(v.string()),
}

const stateValidator = v.object({
  step: v.number(),
  storeIndex: v.number(),
  cursor: v.union(v.string(), v.null()),
  userIds: v.array(v.string()),
  fingerprints: v.array(v.string()),
  tallies: v.array(
    v.object({ table: v.string(), deleted: v.number(), anonymised: v.number() })
  ),
  retained: v.array(
    v.object({ table: v.string(), count: v.number(), reason: v.string() })
  ),
})

function reportFrom(
  state: PrivacyState,
  scope: { storeIds: string[]; everyStore: boolean },
  complete: boolean
): PrivacyReport {
  return {
    storeIds: scope.storeIds,
    everyStore: scope.everyStore,
    tallies: state.tallies,
    retained: state.retained,
    complete,
  }
}

/**
 * What an erasure would do, without doing any of it.
 *
 * Erasure is irreversible and an address is easy to mistype, so the operator
 * gets to look first — the same reasoning, and the same shape, as the
 * commercial site's `previewErasure`. Read-only: same walk, `mode: "preview"`,
 * no writes anywhere.
 *
 * `complete: false` here means "at least this much", and the screen has to say
 * so. A preview that quietly under-reports is how somebody promises a diner an
 * erasure that will not finish.
 */
export const previewErasure = {
  args: subjectArgs,
  handler: async (
    ctx: any,
    args: { email?: string; fingerprint?: string },
    scope: PrivacyScope
  ): Promise<PrivacyReport> => {
    const subject = assertSubject(args)
    const { state, complete } = await privacyPass(ctx, {
      subject,
      storeIds: scope.storeIds,
      everyStore: scope.everyStore,
      mode: "preview",
      budget: READ_SCAN_BUDGET,
      now: Date.now(),
    })
    return reportFrom(state, scope, complete)
  },
}

/**
 * Everything the deployment holds about one diner (art. 15 and art. 20).
 *
 * The same walk as the erasure, in `export` mode, which is the point: the
 * export cannot show a table the erasure would miss, and the erasure cannot
 * destroy something the export never offered. A second implementation of
 * "where this person is" would drift inside one release.
 */
export const exportDataSubject = {
  args: subjectArgs,
  handler: async (
    ctx: any,
    args: { email?: string; fingerprint?: string },
    scope: PrivacyScope
  ): Promise<PrivacyExport> => {
    const subject = assertSubject(args)
    const now = Date.now()
    const { state, complete, records } = await privacyPass(ctx, {
      subject,
      storeIds: scope.storeIds,
      everyStore: scope.everyStore,
      mode: "export",
      budget: READ_SCAN_BUDGET,
      now,
    })
    return {
      ...reportFrom(state, scope, complete),
      generatedAt: now,
      subject,
      records,
    }
  },
}

/**
 * One pass of an erasure (art. 17).
 *
 * Returns the state to resume from and whether it finished. The app wrapper
 * reschedules itself while `complete` is false — the package has no `internal`
 * reference to schedule against, the same split `stores.remove` uses for the
 * store cascade.
 *
 * An audit row is written for every pass that changed something, not only the
 * last one. A pass that deleted rows and then stopped has really deleted them,
 * and a trail that stayed silent until the end would show nothing at all for
 * an erasure that was interrupted.
 */
export const eraseDataSubject = {
  /**
   * NO `state` ARGUMENT HERE, AND THAT IS THE POINT.
   *
   * It used to take one, so that the screen could drive the passes itself. A
   * caller could then hand back `{ step: 9, tallies: [...] }`: the walk exited
   * immediately, `complete` came back true, and this wrote a `privacy_erasure`
   * line saying an erasure had finished — with the caller's own invented
   * numbers, while the diner's rows sat untouched. That audit row is the
   * establishment's art. 5.2 proof to the CNIL; a forgeable one is worse than
   * none at all.
   *
   * Continuation is `continueErasure`, which is internal and reachable only
   * from the scheduler.
   */
  args: subjectArgs,
  handler: async (
    ctx: any,
    args: { email?: string; fingerprint?: string },
    scope: PrivacyScope
  ): Promise<ErasePassResult> => {
    const subject = assertSubject(args)
    return await erasePassWithScope(ctx, {
      subject,
      scope,
      actor: scope.actor,
    })
  },
}

export interface ErasePassResult {
  report: PrivacyReport
  state: PrivacyState
  complete: boolean
  /** Carried so a continuation pass knows what the first one was allowed to reach. */
  storeIds: string[]
  everyStore: boolean
  actor: string
}

/**
 * The continuation of an erasure, for the scheduler.
 *
 * INTERNAL, AND UNAUTHENTICATED BY NECESSITY. A scheduled job runs with no
 * identity, so `requirePrivacyScope` cannot run here — it would refuse itself. The
 * scope the first pass computed is carried instead, which is why this must
 * stay internal: it takes the establishments to act on as an argument, and a
 * public function that did that would let any caller name any establishment.
 *
 * Each app's `tests/convex/scheduled-paths` suite asserts that everything the
 * scheduler reaches is internal; this is one of the functions that rule exists
 * for.
 */
export const continueErasure = {
  args: {
    ...subjectArgs,
    storeIds: v.array(v.id("stores")),
    everyStore: v.boolean(),
    actor: v.string(),
    state: stateValidator,
  },
  handler: async (
    ctx: any,
    args: {
      email?: string
      fingerprint?: string
      storeIds: string[]
      everyStore: boolean
      actor: string
      state: PrivacyState
    }
  ): Promise<ErasePassResult> => {
    const subject = assertSubject(args)
    return await erasePassWithScope(ctx, {
      subject,
      scope: { storeIds: args.storeIds.map(String), everyStore: args.everyStore },
      actor: args.actor,
      state: args.state,
    })
  },
}

async function erasePassWithScope(
  ctx: any,
  params: {
    subject: { email?: string; fingerprint?: string }
    scope: { storeIds: string[]; everyStore: boolean }
    actor: string
    state?: PrivacyState
  }
): Promise<ErasePassResult> {
  const now = Date.now()
  const before = params.state?.tallies?.length ?? 0

  const { state, complete } = await privacyPass(ctx, {
    subject: params.subject,
    storeIds: params.scope.storeIds,
    everyStore: params.scope.everyStore,
    mode: "erase",
    budget: ERASURE_SCAN_BUDGET,
    now,
    state: params.state,
  })

  const report = reportFrom(state, params.scope, complete)
  if (complete || state.tallies.length > before) {
    await recordPrivacyAudit(ctx, {
      action: "privacy_erasure",
      actor: params.actor,
      subject: params.subject,
      report,
      now,
    })
  }

  return {
    report,
    state,
    complete,
    storeIds: params.scope.storeIds,
    everyStore: params.scope.everyStore,
    actor: params.actor,
  }
}

/**
 * Set how long this deployment keeps a diner's personal data.
 *
 * Guarded on `customers:manage` rather than `settings:write`: the window is
 * the controller's legal position, not a display preference, and the profile
 * that may answer a data-subject request is the one that may decide how long
 * the data lives.
 */
export const setRetention = {
  args: {
    customerDataDays: v.number(),
    enabled: v.boolean(),
  },
  handler: async (
    ctx: any,
    args: { customerDataDays: number; enabled: boolean },
    scope: PrivacyScope
  ): Promise<{ customerDataDays: number; enabled: boolean }> => {
    // A window of a month is already aggressive for a restaurant and ten years
    // is the accounting ceiling; outside that range the number is a typo, and
    // a typo here deletes a business's customer history tonight.
    if (
      !Number.isFinite(args.customerDataDays) ||
      args.customerDataDays < 30 ||
      args.customerDataDays > 3650
    ) {
      throw new Error("RETENTION_WINDOW_OUT_OF_RANGE")
    }
    const now = Date.now()
    const settings = await ctx.db.query("globalSettings").first()
    const dataRetention = {
      customerDataDays: Math.round(args.customerDataDays),
      enabled: args.enabled,
      updatedAt: now,
      updatedBy: scope.actor,
    }
    if (!settings) throw new Error("GLOBAL_SETTINGS_MISSING")
    await ctx.db.patch(settings._id, { dataRetention, updatedAt: now })
    return { customerDataDays: dataRetention.customerDataDays, enabled: dataRetention.enabled }
  },
}

/** The current window, for the settings screen and the consent notice. */
export const getRetention = {
  args: {},
  handler: async (
    ctx: any
  ): Promise<{ customerDataDays: number; enabled: boolean; isDefault: boolean }> => {
    const settings = await ctx.db.query("globalSettings").first()
    const stored = settings?.dataRetention
    return {
      customerDataDays: stored?.customerDataDays ?? DEFAULT_CUSTOMER_RETENTION_DAYS,
      enabled: stored?.enabled !== false,
      isDefault: !stored,
    }
  },
}


/* ------------------------------------------------------------------ */
/* Retention sweep                                                     */
/* ------------------------------------------------------------------ */

/** Rows the nightly sweep will look at in one run. */
export const RETENTION_SCAN_BUDGET = 400

/** Windows that are the row's own lifetime, not the customer-data window. */
const QUOTE_GRACE_MS = DAY_MS
const RATE_LIMIT_GRACE_MS = DAY_MS
const WEBHOOK_BODY_RETENTION_MS = 90 * DAY_MS

/**
 * Where a sweep got to, so the next run resumes instead of restarting.
 *
 * WHY THIS EXISTS AND IS NOT OPTIONAL. The first version had no cursor: each
 * run took the oldest N rows of a table and skipped the ones that were not
 * ready. That starves, and silently. An establishment whose orders are all
 * already anonymised hands the sweep the same N anonymised rows every night for
 * ever and it never reaches the ones behind them; a mailing list whose oldest
 * subscribers are still active does the same. The job reports a clean run and
 * does nothing, which is exactly the shape of a cleanup that stopped working
 * and cannot be told from one that had nothing to do.
 *
 * A cursor makes progress monotonic whatever a row's verdict: skipped or not,
 * the walk moves past it.
 */
export interface RetentionState {
  step: number
  storeIndex: number
  cursor: string | null
}

const R_ORDERS = 0
const R_GAME_PLAYS = 1
const R_CONTACT_MESSAGES = 2
const R_PROMOTION_USAGES = 3
const R_GAME_REFERRALS = 4
const R_EMAIL_SUBSCRIBERS = 5
const R_KITCHEN_TICKETS = 6
const R_CUSTOMER_ADDRESSES = 7
const R_RATE_LIMITS = 8
const R_DELIVERY_QUOTES = 9
const R_WEBHOOK_FAILURES = 10
const R_DONE = 11

/** The ticket statuses the sweep walks, in `storeIndex` order at its step. */
const TICKET_STATUSES = [
  "pending",
  "in_progress",
  "ready",
  "completed",
  "cancelled",
] as const

/**
 * When a subscriber was last in touch.
 *
 * The CNIL's three years run from the LAST CONTACT, not from sign-up, and this
 * is the one table where that is computable: consent, the last order and the
 * last thing they did with an e-mail are all reachable in three indexed reads.
 * Everywhere else the clock is the row's own age, which is why the runbook
 * publishes two sentences rather than one — a promise the code cannot keep is
 * worse than a narrower promise it can.
 */
async function subscriberLastContact(
  ctx: any,
  subscriber: any
): Promise<number> {
  const lastEvent = await ctx.db
    .query("emailEvents")
    .withIndex("by_subscriberId", (q: any) => q.eq("subscriberId", subscriber._id))
    .order("desc")
    .first()
  return Math.max(
    subscriber.consentAt ?? 0,
    subscriber.doubleOptInAt ?? 0,
    subscriber.unsubscribedAt ?? 0,
    subscriber.metadata?.lastOrderAt ?? 0,
    lastEvent?.occurredAt ?? 0,
    subscriber.createdAt ?? 0
  )
}

export interface RetentionSweepReport {
  /** False when the establishment has paused the sweep deliberately. */
  armed: boolean
  windowDays: number
  cutoff: number
  tallies: TableTally[]
  /** True when the budget ran out with work still to do. */
  hasMore: boolean
  /** Where to resume. Absent once the walk is finished. */
  state?: RetentionState
}

export function initialRetentionState(): RetentionState {
  return { step: R_ORDERS, storeIndex: 0, cursor: null }
}

/**
 * Carry away what has outlived the window (art. 5.1.e).
 *
 * DELETES OR ANONYMISES by the same rules a data-subject request does, because
 * they are the same rules. An order past the window is anonymised, not deleted:
 * it is still the accounting record. A game play past the window is deleted; it
 * never was one.
 *
 * BOUNDED AND RESUMABLE. One run examines `RETENTION_SCAN_BUDGET` rows and says
 * where it stopped; the app wrapper reschedules a minute later while `hasMore`
 * is true, exactly as the kitchen-ticket purge does.
 *
 * DISARMED MEANS REPORTING, NOT SLEEPING. `enabled: false` is a deliberate
 * pause — a litigation hold, a migration — and the run still returns what it
 * WOULD have done, so an establishment can see the backlog it is accruing.
 */
export const sweepExpiredCustomerData = {
  args: {
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
    state: v.optional(
      v.object({
        step: v.number(),
        storeIndex: v.number(),
        cursor: v.union(v.string(), v.null()),
      })
    ),
  },
  handler: async (
    ctx: any,
    args: { now?: number; limit?: number; state?: RetentionState }
  ): Promise<RetentionSweepReport> => {
    const now = args.now ?? Date.now()
    const settings = await ctx.db.query("globalSettings").first()
    const windowMs = retentionWindowMs(settings)
    const armed = retentionIsArmed(settings)
    const cutoff = now - windowMs
    const write = armed

    const tallyState = initialState()
    const state = args.state ?? initialRetentionState()
    // The argument can only LOWER the ceiling, never raise it: a caller able to
    // widen the budget could widen it past the transaction's own limits and
    // turn a nightly job into a nightly failure.
    //
    // And never below one. A budget of zero skipped the loop entirely, left the
    // state exactly where it was, and still returned `hasMore` — so the wrapper
    // re-fired every sixty seconds for ever, making no progress and writing no
    // audit line to say so. A run that cannot do anything must still move.
    let budget = Math.max(
      1,
      Math.min(args.limit ?? RETENTION_SCAN_BUDGET, RETENTION_SCAN_BUDGET)
    )

    const stores = await ctx.db.query("stores").collect()
    const storeIds: string[] = stores.map((store: { _id: unknown }) => String(store._id))

    /** One page of a store-scoped index, oldest first. */
    async function pageByStore(
      table: string,
      index: string,
      field: string,
      storeId: string,
      bound: number
    ): Promise<any> {
      return await ctx.db
        .query(table)
        .withIndex(index, (q: any) => q.eq("storeId", storeId).lt(field, bound))
        .order("asc")
        .paginate({ cursor: state.cursor, numItems: Math.min(budget, 64) })
    }

    /** One page of a deployment-wide index, oldest first. */
    async function pageGlobal(
      table: string,
      index: string,
      field: string,
      bound: number
    ): Promise<any> {
      return await ctx.db
        .query(table)
        .withIndex(index, (q: any) => q.lt(field, bound))
        .order("asc")
        .paginate({ cursor: state.cursor, numItems: Math.min(budget, 64) })
    }

    /** Finish this store, or this step. */
    function advanceStore(): void {
      state.cursor = null
      state.storeIndex += 1
      if (state.storeIndex >= storeIds.length) {
        state.storeIndex = 0
        state.step += 1
      }
    }

    function advanceStep(): void {
      state.cursor = null
      state.storeIndex = 0
      state.step += 1
    }

    /** Continue inside the current page set, or move on. */
    function settle(result: { isDone: boolean; continueCursor: string }, perStore: boolean): void {
      if (result.isDone) {
        if (perStore) advanceStore()
        else advanceStep()
      } else {
        state.cursor = result.continueCursor
      }
    }

    while (state.step < R_DONE && budget > 0) {
      // Every store-scoped step is a no-op on a deployment with no
      // establishments, which is a fresh one before its first store is created.
      if (state.step <= R_EMAIL_SUBSCRIBERS && storeIds.length === 0) {
        state.step = R_KITCHEN_TICKETS
        state.storeIndex = 0
        state.cursor = null
        continue
      }
      const storeId = storeIds[state.storeIndex] ?? ""

      if (state.step === R_ORDERS) {
        const result = await pageByStore(
          "orders",
          "by_storeId_createdAt",
          "createdAt",
          storeId,
          cutoff
        )
        budget -= result.page.length
        for (const order of result.page) {
          // Already done, or not ready. The cursor moves past either way —
          // that is the whole reason it exists.
          if (order.anonymisedAt) continue
          if (!orderIsErasable(order)) continue
          budget -= await eraseOrderDependents(ctx, order, {
            mode: write ? "erase" : "preview",
            now,
            state: tallyState,
            records: [],
            write,
          })
          if (write) await ctx.db.patch(order._id, anonymisedOrderPatch(order, now))
          tally(tallyState, "orders", "anonymised")
        }
        settle(result, true)
        continue
      }

      if (state.step === R_GAME_PLAYS) {
        const result = await pageByStore(
          "gamePlays",
          "by_storeId_playedAt",
          "playedAt",
          storeId,
          cutoff
        )
        budget -= result.page.length
        for (const play of result.page) {
          // Redemptions first: `prizeRedemptions.gamePlayId` is a non-optional
          // id, so a redemption surviving its play is a document whose schema
          // promises one and whose readers get null.
          const redemptions = await ctx.db
            .query("prizeRedemptions")
            .withIndex("by_gamePlayId", (q: any) => q.eq("gamePlayId", play._id))
            .collect()
          budget -= redemptions.length
          for (const redemption of redemptions) {
            if (write) await ctx.db.delete(redemption._id)
            tally(tallyState, "prizeRedemptions", "deleted")
          }
          if (write) await ctx.db.delete(play._id)
          tally(tallyState, "gamePlays", "deleted")
        }
        settle(result, true)
        continue
      }

      if (state.step === R_CONTACT_MESSAGES) {
        const result = await pageByStore(
          "contactMessages",
          "by_storeId_createdAt",
          "createdAt",
          storeId,
          cutoff
        )
        budget -= result.page.length
        for (const message of result.page) {
          if (write) await ctx.db.delete(message._id)
          tally(tallyState, "contactMessages", "deleted")
        }
        settle(result, true)
        continue
      }

      if (state.step === R_PROMOTION_USAGES) {
        const result = await pageByStore(
          "promotionUsages",
          "by_storeId_usedAt",
          "usedAt",
          storeId,
          cutoff
        )
        budget -= result.page.length
        for (const usage of result.page) {
          if (write) await ctx.db.delete(usage._id)
          tally(tallyState, "promotionUsages", "deleted")
        }
        settle(result, true)
        continue
      }

      if (state.step === R_GAME_REFERRALS) {
        const result = await pageByStore(
          "gameReferrals",
          "by_storeId_updatedAt",
          "updatedAt",
          storeId,
          cutoff
        )
        budget -= result.page.length
        for (const referral of result.page) {
          // Never one still holding a bonus somebody earned: deleting that
          // takes a free turn away from a player who is still using the game.
          // It waits for them to spend it, or for an erasure request.
          if (referral.pendingBonuses > 0) continue
          if (write) await ctx.db.delete(referral._id)
          tally(tallyState, "gameReferrals", "deleted")
        }
        settle(result, true)
        continue
      }

      if (state.step === R_EMAIL_SUBSCRIBERS) {
        // The one table whose clock is a computed last contact rather than the
        // row's own age, so the whole list is walked and each row asked.
        const result = await ctx.db
          .query("emailSubscribers")
          .withIndex("by_storeId", (q: any) => q.eq("storeId", storeId))
          .paginate({ cursor: state.cursor, numItems: Math.min(budget, 32) })
        budget -= result.page.length
        for (const subscriber of result.page) {
          const lastContact = await subscriberLastContact(ctx, subscriber)
          budget -= 1
          if (lastContact >= cutoff) continue
          budget -= await eraseSubscriberDependents(ctx, subscriber._id, {
            mode: write ? "erase" : "preview",
            state: tallyState,
            records: [],
            write,
          })
          if (write) await ctx.db.delete(subscriber._id)
          tally(tallyState, "emailSubscribers", "deleted")
        }
        settle(result, true)
        continue
      }

      if (state.step === R_KITCHEN_TICKETS) {
        // Past the customer-data window, whatever the status. The 30-day purge
        // deliberately never touches a ticket still on the pass, so one
        // abandoned at `pending` three years ago still carries a name, a phone
        // number and a list of allergens — art. 9 health data with no
        // retention basis at all. This is the sweep that reaches it.
        const status = TICKET_STATUSES[state.storeIndex]
        if (!status) {
          advanceStep()
          continue
        }
        const result = await ctx.db
          .query("kitchenTickets")
          .withIndex("by_status_createdAt", (q: any) =>
            q.eq("status", status).lt("createdAt", cutoff)
          )
          .order("asc")
          .paginate({ cursor: state.cursor, numItems: Math.min(budget, 64) })
        budget -= result.page.length
        for (const ticket of result.page) {
          if (write) await ctx.db.delete(ticket._id)
          tally(tallyState, "kitchenTickets", "deleted")
        }
        if (result.isDone) {
          state.cursor = null
          state.storeIndex += 1
          if (state.storeIndex >= TICKET_STATUSES.length) advanceStep()
        } else {
          state.cursor = result.continueCursor
        }
        continue
      }

      if (state.step === R_CUSTOMER_ADDRESSES) {
        const result = await pageGlobal(
          "customerAddresses",
          "by_updatedAt",
          "updatedAt",
          cutoff
        )
        budget -= result.page.length
        for (const address of result.page) {
          // `updatedAt` is when the ADDRESS was last edited, not when its owner
          // was last a customer — and nobody edits an address they are happy
          // with. Someone who has ordered to the same flat every month for four
          // years has a four-year-old row and a last order from last week, and
          // deleting it would empty the address book of an active customer in
          // the name of protecting them.
          //
          // The clock that matters is their last order, which is one indexed
          // read away.
          const lastOrder = await ctx.db
            .query("orders")
            .withIndex("by_customerId", (q: any) => q.eq("customerId", address.userId))
            .order("desc")
            .first()
          budget -= 1
          if (lastOrder && lastOrder.createdAt >= cutoff) continue
          if (write) await ctx.db.delete(address._id)
          tally(tallyState, "customerAddresses", "deleted")
        }
        settle(result, false)
        continue
      }

      if (state.step === R_RATE_LIMITS) {
        // A limiter row is a one-hour counter that nothing ever deleted: a
        // deployment kept one permanent row per address that ever used the
        // contact form. A day's grace is far past the longest window in use, so
        // anything older is spent by definition — this one does not wait for
        // the customer-data window, because there is no purpose left to serve
        // after the hour.
        const result = await pageGlobal(
          "rateLimits",
          "by_windowStart",
          "windowStart",
          now - RATE_LIMIT_GRACE_MS
        )
        budget -= result.page.length
        for (const row of result.page) {
          if (write) await ctx.db.delete(row._id)
          tally(tallyState, "rateLimits", "deleted")
        }
        settle(result, false)
        continue
      }

      if (state.step === R_DELIVERY_QUOTES) {
        // An unconsumed quote is attached to no order and therefore reachable
        // by no data-subject request — a pair of coordinates naming somebody's
        // front door, with nothing to find it by. Uber's own expiry is minutes;
        // a day past it the row is litter.
        const result = await pageGlobal(
          "deliveryQuotes",
          "by_expiresAt",
          "expiresAt",
          now - QUOTE_GRACE_MS
        )
        budget -= result.page.length
        for (const quote of result.page) {
          if (write) await ctx.db.delete(quote._id)
          tally(tallyState, "deliveryQuotes", "deleted")
        }
        settle(result, false)
        continue
      }

      if (state.step === R_WEBHOOK_FAILURES) {
        // The dead-letter body, not the row. A failed platform delivery is an
        // operational record worth keeping — an operator needs to know it
        // happened — but its verbatim payload is the diner's name, phone and
        // address as the platform sent them, and the replay window it exists
        // for closes in hours.
        const result = await pageGlobal(
          "platformWebhookFailures",
          "by_receivedAt",
          "receivedAt",
          now - WEBHOOK_BODY_RETENTION_MS
        )
        budget -= result.page.length
        for (const failure of result.page) {
          if (!failure.rawBody) continue
          if (write) await ctx.db.patch(failure._id, { rawBody: undefined })
          tally(tallyState, "platformWebhookFailures", "anonymised")
        }
        settle(result, false)
        continue
      }

      // Unknown step: stop rather than loop.
      state.step = R_DONE
    }

    const hasMore = state.step < R_DONE
    const report: RetentionSweepReport = {
      armed,
      windowDays: Math.round(windowMs / DAY_MS),
      cutoff,
      tallies: tallyState.tallies,
      hasMore,
      ...(hasMore ? { state } : {}),
    }

    // A run that changed nothing writes nothing: an audit trail whose every
    // line says "0" is one nobody reads, and this job runs every night.
    if (tallyState.tallies.length > 0) {
      await recordPrivacyAudit(ctx, {
        action: "privacy_retention_sweep",
        actor: "cron",
        report: {
          storeIds,
          everyStore: true,
          tallies: tallyState.tallies,
          retained: armed
            ? []
            : [
                {
                  table: "*",
                  count: -1,
                  reason:
                    "Purge en pause (dataRetention.enabled = false) : rien n'a été supprimé, ces chiffres sont ce qui aurait été fait.",
                },
              ],
          complete: !hasMore,
        },
        now,
      })
    }

    return report
  },
}
