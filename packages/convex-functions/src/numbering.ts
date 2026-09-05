/**
 * The numbers the product hands out.
 *
 * WHY THIS EXISTS: `generateOrderNumber` was three lines of `Math.random()`.
 *
 * ```ts
 * const random = Math.random().toString(36).substring(2, 8).toUpperCase()
 * return `ORD-${year}-${random}`   // the schema comment promised "ORD-2026-0001"
 * ```
 *
 * Three call sites wrote that straight into the database — no uniqueness check,
 * no per-store sequence, no retry on collision — and the schema documented a
 * sequential format the code did not produce. For orders that is untidy. For
 * invoices it is a legal breach: art. 242 nonies A of Annexe II CGI requires a
 * French business to issue an unbroken, chronological, sequential series, and
 * every French restaurant on this product would have inherited a random one.
 *
 * ## The guarantee, and exactly what it rests on
 *
 * Convex mutations are serializable. Conflicts are detected at commit against
 * the transaction's READ SET, which records the index INTERVAL that was
 * queried — including when the query returned nothing. Two mutations that read
 * the same counter through `by_key` therefore conflict; the loser is retried
 * from scratch, on a fresh transaction, and reads the winner's value. Two
 * mutations reading different keys never conflict at all.
 *
 * Gaplessness rests on ONE property: the number is allocated in the SAME
 * mutation as the document that uses it. A mutation that allocates and then
 * throws commits nothing — the entire write set is discarded — so the number
 * goes to the next caller rather than being burned. Three things break that,
 * and they are the only three:
 *
 *   1. allocating in one mutation and inserting in another (`ctx.scheduler`
 *      schedules a SEPARATE commit; so does `runMutation` from an action);
 *   2. catching an error between the allocation and the insert;
 *   3. handing the number to an action to "finish" — render a PDF, send a mail.
 *      All of that must happen after the commit, keyed off the persisted row.
 *
 * `convex-test` cannot prove any of this: its `TransactionManager` forces
 * sequential execution and implements no OCC, so `Promise.all` over two
 * mutations runs them one after the other and passes whatever is written. The
 * tests here cover the format and the arithmetic; the concurrency argument is
 * the paragraph above, and the production check is `npx convex insights` —
 * `occRetried` on `numberSequences` is expected and benign, `occFailedPermanently`
 * means a read set needs shrinking.
 *
 * @module numbering
 */

/** The series a number belongs to. */
export type SequenceKind = "order" | "invoice" | "credit_note"

/**
 * The fiscal year, on the establishment's clock.
 *
 * `new Date().getFullYear()` in a Convex isolate is UTC. Between 23:00 and
 * midnight UTC on 31 December, Paris is already in the new year, and an invoice
 * numbered `FA-2026-…` dated 01/01/2027 contradicts itself. Same reasoning, and
 * same `Intl` idiom, as `timeWindow.restaurantClock`.
 *
 * Never hoist this to module scope. Convex evaluates module top level once, in
 * the import phase, against a pinned timestamp — a module-level
 * `const YEAR = new Date().getFullYear()` freezes at deploy time and never
 * rolls over at all.
 */
export function fiscalYear(now: number, timezone?: string): number {
  const date = new Date(now)

  if (timezone) {
    try {
      const year = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
      }).format(date)
      const parsed = Number(year)
      if (Number.isFinite(parsed)) return parsed
    } catch {
      // A settings row holding a typo must not stop the restaurant taking
      // orders. UTC is the honest fallback.
    }
  }

  return date.getUTCFullYear()
}

/** `"order:2026:stores|abc"` — one series per establishment per year. */
export function orderSequenceKey(storeId: string, year: number): string {
  return `order:${year}:${storeId}`
}

/**
 * `"invoice:2026"` — one series for the whole deployment per year.
 *
 * Company-wide rather than per establishment, and that is a decision worth
 * being able to point at. There is no company entity in the schema — no
 * `legalEntities` table, no `ownerId` on `stores`, no SIREN anywhere — and
 * `CLAUDE.md` says one Convex instance per client, so today the DEPLOYMENT is
 * the company. A per-establishment series would also need a stable
 * discriminator, and none exists: `_id` is reassigned by `system.importBackup`,
 * `slug` and `name` are editable.
 *
 * The DGFiP does allow *séries distinctes* per établissement. If a client's
 * establishments turn out to be separate legal entities — separate SIRENs, a
 * franchise, an SCI per site — then one company-wide series spanning two
 * taxpayers is actively wrong, and this becomes a series per entity. The
 * schema cannot tell which situation applies, so the assumption is recorded
 * here rather than guessed at silently: **one legal entity per deployment.**
 * `invoices.storeId` gives per-establishment reporting without making the
 * numbering carry it.
 */
export function invoiceSequenceKey(year: number): string {
  return `invoice:${year}`
}

/** `"credit_note:2026"` — avoirs get their own continuous series. */
export function creditNoteSequenceKey(year: number): string {
  return `credit_note:${year}`
}

/**
 * `ORD-2026-00412`.
 *
 * FIVE digits, and the width is load-bearing. The numbers already in the
 * database carry a 6-character random suffix from `[0-9A-Z]`, and an all-digit
 * one is not exotic — `(10/36)^6` is about 1 in 2 176, so a store with a few
 * thousand historical orders very likely has one. A 5-digit counter cannot
 * collide with a 6-character suffix by length alone, which is what makes the
 * two formats provably disjoint without rewriting a single historical number.
 *
 * Past 99 999 orders in one store in one year the counter widens to 6 digits
 * and the disjointness argument lapses — bounded to that one migration year,
 * because every legacy number carries it, and guarded anyway by the collision
 * check in `allocateOrderNumber`.
 */
export function formatOrderNumber(year: number, value: number): string {
  return `ORD-${year}-${String(value).padStart(5, "0")}`
}

/**
 * `FA-2026-000287`.
 *
 * `FA` for *facture* — legible to a French accountant in a way `INV` is not.
 * What is legally load-bearing is the CONTINUITY of the sequence, its
 * CHRONOLOGY, and the year: the counter restarts annually, which is permitted
 * only because the year keeps the number as a whole unique. The prefix, the
 * padding and the separators are readability, not law — but they must not
 * change mid-year.
 */
export function formatInvoiceNumber(year: number, value: number): string {
  return `FA-${year}-${String(value).padStart(6, "0")}`
}

/** `AV-2026-000014` — *avoir*, the credit note that reverses a sale. */
export function formatCreditNoteNumber(year: number, value: number): string {
  return `AV-${year}-${String(value).padStart(6, "0")}`
}

/** One number, and the instant it counts as issued. */
export interface Allocation {
  value: number
  year: number
  issuedAt: number
}

/**
 * Take the next number in a series.
 *
 * Must be called inside the mutation that writes the document consuming it. See
 * the module comment for what that buys and what breaks it.
 */
export async function allocate(
  ctx: any,
  params: {
    key: string
    kind: SequenceKind
    scope: string
    year: number
    now: number
  }
): Promise<Allocation> {
  const { key, kind, scope, year, now } = params

  // `by_key` and nothing else. A `.collect()` with a JS filter would also be
  // correct, and would put the whole table in the read set — making every
  // series conflict with every other one.
  const existing = await ctx.db
    .query("numberSequences")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    // `.unique()`, not `.first()`. Two rows for one key means numbers already
    // issued are about to be issued again; `.first()` would pick one silently
    // and `.unique()` throws. For a fiscal counter, an outage is cheaper than a
    // duplicate.
    .unique()

  if (!existing) {
    await ctx.db.insert("numberSequences", {
      key,
      kind,
      scope,
      year,
      next: 2,
      lastIssuedAt: now,
      updatedAt: now,
    })
    return { value: 1, year, issuedAt: now }
  }

  // Chronology as an invariant rather than an assumption about clocks: each
  // retry of a mutation samples its own `Date.now()`, so without this an
  // invoice can be dated before the one numbered ahead of it.
  const issuedAt = Math.max(now, existing.lastIssuedAt)

  // Read the number BEFORE the patch, and hand back the captured value.
  // Returning `existing.next` after patching reads whatever the patch left
  // behind if the runtime ever hands back a live reference rather than a copy
  // of the document — and every allocation would then skip a number, which in
  // the invoice series is precisely the gap that must not exist. Convex returns
  // a copy today; the series should not depend on that.
  const value: number = existing.next

  await ctx.db.patch(existing._id, {
    next: value + 1,
    lastIssuedAt: issuedAt,
    updatedAt: now,
  })

  return { value, year, issuedAt }
}

/** How far past a taken number the allocator will walk before giving up. */
const MAX_ORDER_NUMBER_PROBES = 50

/**
 * The next order number for an establishment.
 *
 * Order numbers are per store and per year: short, and what the counter and the
 * kitchen actually say out loud. They are NOT a fiscal series — art. 242 nonies
 * A governs the *facture* — so a cancelled or abandoned order consuming a
 * number is a curiosity rather than a breach, and the number is allocated at
 * creation, when the diner first sees it on screen.
 *
 * The collision check is not the uniqueness mechanism — the counter is. It
 * exists for the migration year, where a legacy random number could in
 * principle land on a value the counter is about to hand out. It is a point
 * lookup on `by_orderNumber`, so it only conflicts with a concurrent write of
 * that exact number, which is the conflict worth having; and the number it
 * skips leaves a gap in a series where gaps do not matter.
 */
export async function allocateOrderNumber(
  ctx: any,
  storeId: string,
  options: { now?: number; timezone?: string } = {}
): Promise<string> {
  const now = options.now ?? Date.now()
  const year = fiscalYear(now, options.timezone)

  for (let probe = 0; probe < MAX_ORDER_NUMBER_PROBES; probe++) {
    const { value } = await allocate(ctx, {
      key: orderSequenceKey(storeId, year),
      kind: "order",
      scope: storeId,
      year,
      now,
    })
    const candidate = formatOrderNumber(year, value)

    const taken = await ctx.db
      .query("orders")
      .withIndex("by_orderNumber", (q: any) => q.eq("orderNumber", candidate))
      .first()
    if (!taken) return candidate
  }

  // Fifty consecutive collisions is not a coincidence — it is a counter that
  // has been reset behind the data. Refusing is the only safe answer: the
  // alternative is issuing a number that already identifies another order.
  throw new Error(
    `Impossible d'attribuer un numéro de commande unique pour l'établissement ${storeId}.`
  )
}

/**
 * The next invoice number for the deployment.
 *
 * Allocated when the sale becomes definitive — never at order creation — so the
 * series is gapless by construction: an invoice is issued once, for a completed
 * sale, and is never deleted. A sale reversed afterwards produces an *avoir*,
 * itself numbered, never an edit and never a deletion.
 *
 * The consequence to state plainly in any UI showing both: `ORD-2026-00412` and
 * `FA-2026-000287` do not correspond, and neither can be derived from the
 * other. The invoice carries the order number as a reference instead.
 */
export async function allocateInvoiceNumber(
  ctx: any,
  options: { now?: number; timezone?: string } = {}
): Promise<{ invoiceNumber: string; issuedAt: number; year: number }> {
  const now = options.now ?? Date.now()
  const year = fiscalYear(now, options.timezone)

  const { value, issuedAt } = await allocate(ctx, {
    key: invoiceSequenceKey(year),
    kind: "invoice",
    scope: "company",
    year,
    now,
  })

  return { invoiceNumber: formatInvoiceNumber(year, value), issuedAt, year }
}

/** The next credit-note number for the deployment. */
export async function allocateCreditNoteNumber(
  ctx: any,
  options: { now?: number; timezone?: string } = {}
): Promise<{ creditNoteNumber: string; issuedAt: number; year: number }> {
  const now = options.now ?? Date.now()
  const year = fiscalYear(now, options.timezone)

  const { value, issuedAt } = await allocate(ctx, {
    key: creditNoteSequenceKey(year),
    kind: "credit_note",
    scope: "company",
    year,
    now,
  })

  return {
    creditNoteNumber: formatCreditNoteNumber(year, value),
    issuedAt,
    year,
  }
}
