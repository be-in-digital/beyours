/**
 * TTL sweep for files that were uploaded and never attached to anything.
 *
 * WHY IT EXISTS: `referrals.generateInvoiceUploadUrl` mints a signed upload URL
 * and returns it. The file the client POSTs to that URL exists in storage from
 * that moment on, whether or not `referrals.attachReferralInvoice` is ever
 * called. Nothing in this deployment used to delete a file, ever — so an
 * abandoned upload (a closed tab, a failed attach, a script) was permanent.
 *
 * HOW AN ORPHAN IS IDENTIFIED — established by reading the code, not guessed.
 * There are exactly two places in `apps/site/convex` where a storage file comes
 * into existence, and exactly two fields that hold a reference to one:
 *
 * | Producer                                     | Reference field                             |
 * | -------------------------------------------- | ------------------------------------------- |
 * | `referrals.generateInvoiceUploadUrl` (client POST) | `referrals.invoiceStorageId` (`v.id("_storage")`), written by `attachReferralInvoice` together with `invoiceUploadedAt` |
 * | `affiliateSignature.signAffiliateContract` (`ctx.storage.store`) | `contractSignatures.signedDocumentFileId` (a `v.string()` holding a storage id) |
 *
 * So an orphan is a `_storage` row that is older than the TTL and whose id
 * appears in neither field. That test is only as good as its view of those two
 * tables, which drives the whole shape of this module:
 *
 * **A partial reference set must delete nothing.** A file that is referenced by
 * a row the sweep did not read looks exactly like an orphan. Deleting a live
 * invoice is far worse than leaving an orphan on disk, so the reference scans
 * are read with a cap plus one, and exceeding the cap aborts the run instead of
 * truncating it. Candidates, by contrast, are safe to truncate: sweeping fewer
 * files this run just means sweeping them the next.
 *
 * KNOWN LIMITS, stated rather than hidden:
 *
 * - A file uploaded by hand through the Convex dashboard is referenced by
 *   nothing and will be swept once it passes the TTL. Nothing in the product
 *   creates such a file; if that ever changes, this sweep needs a reference to
 *   check against before it can stay switched on.
 * - `contractSignatures` rows each carry a full contract snapshot (~18 KB
 *   today). Convex caps one transaction's reads at 8 MiB, which puts the hard
 *   ceiling around 450 rows; `SIGNATURE_SCAN_CAP` aborts well before that. Past
 *   that point the fix is an index on the reference field, or moving the
 *   snapshot out of the row — not a bigger cap.
 */

import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { recordSaActivity } from "./saActivity";

/**
 * How long an unreferenced file is left alone.
 *
 * An upload URL is used within seconds and attached within the same click, so
 * anything past a day is abandoned. The margin is deliberately far wider than
 * the flow needs: it also covers the window in
 * `affiliateSignature.signAffiliateContract` between `ctx.storage.store` and
 * the mutation that records the id, which is milliseconds but is not atomic.
 */
export const ORPHAN_TTL_MS = 24 * 60 * 60 * 1000;

/** Oldest files considered per run. Safe to truncate — the rest wait a day. */
export const CANDIDATE_SCAN_CAP = 500;

/** Deletions per run, so one bad day cannot become one long outage. */
export const DELETIONS_PER_RUN = 100;

/**
 * Reference scans. Exceeding either of these ABORTS the run: past the cap the
 * sweep can no longer prove a file is unreferenced.
 */
export const REFERRAL_SCAN_CAP = 5_000;
export const SIGNATURE_SCAN_CAP = 300;

export interface SweepReport {
  /** Storage rows examined. */
  scanned: number;
  /** Of those, older than the TTL. */
  expired: number;
  /** Files actually deleted. */
  deleted: number;
  /** Set when the run refused to delete anything, and why. */
  abortedReason?: string;
}

/**
 * Delete storage files that no row references and that are past the TTL.
 *
 * Scheduled daily from ./crons.ts. Returns a report rather than nothing so the
 * behaviour is assertable in a test and readable in the Convex logs.
 */
export const sweepOrphanUploads = internalMutation({
  args: {},
  handler: async (ctx): Promise<SweepReport> => {
    const cutoff = Date.now() - ORPHAN_TTL_MS;

    // Oldest first: the files most likely to be orphaned, and the order that
    // makes a truncated candidate list drain steadily instead of starving.
    const candidates = await ctx.db.system
      .query("_storage")
      .order("asc")
      .take(CANDIDATE_SCAN_CAP);

    const expired = candidates.filter((file) => file._creationTime < cutoff);
    if (expired.length === 0) {
      // The common case, and the reason the reference scan is below this and
      // not above it: on a quiet day the sweep reads one page and stops.
      return { scanned: candidates.length, expired: 0, deleted: 0 };
    }

    // Build the reference set. Read cap + 1 so an over-full table is detected
    // rather than silently cut off.
    const referrals = await ctx.db.query("referrals").take(REFERRAL_SCAN_CAP + 1);
    if (referrals.length > REFERRAL_SCAN_CAP) {
      const abortedReason = `referrals exceeds ${REFERRAL_SCAN_CAP} rows; cannot prove a file is unreferenced`;
      console.error(`[storageSweep] aborted: ${abortedReason}`);
      return {
        scanned: candidates.length,
        expired: expired.length,
        deleted: 0,
        abortedReason,
      };
    }

    const signatures = await ctx.db
      .query("contractSignatures")
      .take(SIGNATURE_SCAN_CAP + 1);
    if (signatures.length > SIGNATURE_SCAN_CAP) {
      const abortedReason = `contractSignatures exceeds ${SIGNATURE_SCAN_CAP} rows; cannot prove a file is unreferenced`;
      console.error(`[storageSweep] aborted: ${abortedReason}`);
      return {
        scanned: candidates.length,
        expired: expired.length,
        deleted: 0,
        abortedReason,
      };
    }

    const referenced = new Set<string>();
    for (const referral of referrals) {
      if (referral.invoiceStorageId) referenced.add(referral.invoiceStorageId);
    }
    for (const signature of signatures) {
      // `signedDocumentFileId` is declared `v.string()`, not `v.id("_storage")`
      // — it still holds a storage id, and the set is keyed on strings so both
      // reference shapes compare the same way.
      if (signature.signedDocumentFileId) {
        referenced.add(signature.signedDocumentFileId);
      }
    }

    const orphans: Id<"_storage">[] = expired
      .filter((file) => !referenced.has(file._id))
      .slice(0, DELETIONS_PER_RUN)
      .map((file) => file._id);

    for (const storageId of orphans) {
      await ctx.storage.delete(storageId);
    }

    if (orphans.length > 0) {
      console.warn(
        `[storageSweep] deleted ${orphans.length} orphaned upload(s): ${orphans.join(", ")}`,
      );
      // One audit row per run, not per file: a destructive job should leave a
      // trace an operator can find, without becoming a write amplifier itself.
      await recordSaActivity(ctx, {
        kind: "system",
        action: "storage.sweep",
        summary: `${orphans.length} fichier(s) orphelin(s) supprimé(s) après ${ORPHAN_TTL_MS / 3_600_000} h`,
        actorName: "cron",
      });
    }

    return {
      scanned: candidates.length,
      expired: expired.length,
      deleted: orphans.length,
    };
  },
});
