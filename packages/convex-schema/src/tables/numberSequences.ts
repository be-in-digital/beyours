import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * Number sequences
 *
 * One counter per series. Everything the product numbers — orders today,
 * invoices and credit notes next — draws from here.
 *
 * WHY THIS EXISTS: `generateOrderNumber` was
 * `Math.random().toString(36).substring(2, 8)`. It produced `ORD-2026-K3X9QA`
 * while the schema's own comment promised `ORD-2026-0001`, it was written to
 * the database with no uniqueness check, no per-store sequence and no retry on
 * collision, and a random suffix cannot satisfy the unbroken sequential series
 * that art. 242 nonies A of Annexe II CGI requires of a French business's
 * invoices.
 *
 * ## Why a table rather than a field on `stores`
 *
 * `stores` is in the backup allow-list and is deleted and re-inserted with new
 * `_id`s on restore (`system.importBackup`). A counter that a restore can reset
 * is not a counter. `numberSequences` is deliberately left OUT of the backup
 * table list for the same reason — see the comment there before adding it.
 *
 * ## Why this is gapless under concurrency
 *
 * Convex mutations are serializable, and conflicts are detected at commit
 * against the transaction's READ SET — which records the index *interval* that
 * was queried, whether or not a document came back. So:
 *
 *  - two mutations that read `by_key` at the same point interval and both patch
 *    the counter conflict; the loser is retried from scratch (4 retries, 100 ms
 *    to 2 s backoff) and reads the winner's value;
 *  - two mutations that read *different* keys never conflict, so one
 *    establishment's orders do not serialise against another's;
 *  - the first allocation for a key, where both readers find nothing, is closed
 *    by the same mechanism: the empty read still takes a dependency on the
 *    interval, so the winner's insert conflicts the loser out. This is why the
 *    read MUST go through `by_key` and must not be a table scan or a lookup of
 *    a hardcoded id.
 *
 * And gaplessness holds because the number is allocated in the SAME mutation as
 * the document that consumes it: a mutation that allocates and then throws
 * commits nothing at all, so the number is handed to the next caller instead of
 * being burned. Allocating in one mutation and inserting in another — through
 * `ctx.scheduler`, or from an action — would break that, and is the one thing
 * never to do here.
 */
export const numberSequencesTable = defineTable({
  /**
   * The series. `"order:2026:<storeId>"`, `"invoice:2026"`,
   * `"credit_note:2026"` — built by `numbering.ts`, never by hand.
   */
  key: v.string(),
  kind: v.union(
    v.literal("order"),
    v.literal("invoice"),
    v.literal("credit_note")
  ),
  /** `"company"` for a deployment-wide series, otherwise the store's id. */
  scope: v.string(),
  /** The fiscal year the series belongs to, in the establishment's timezone. */
  year: v.number(),
  /** The value the NEXT allocation returns. Starts at 1. */
  next: v.number(),
  /**
   * The issue time of the last number handed out, clamped to be monotonic.
   *
   * "Chronological" means number N+1 is not dated before N. Numbers come out in
   * commit order, but each retry of a mutation samples its own clock, so
   * chronology is made a property of the data rather than an assumption about
   * server clocks.
   */
  lastIssuedAt: v.number(),
  updatedAt: v.number(),
})
  // A point lookup, so two different series never conflict with each other.
  .index("by_key", ["key"])
  .index("by_kind_year", ["kind", "year"])
