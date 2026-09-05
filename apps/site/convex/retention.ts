/**
 * Retention and erasure of personal data.
 *
 * WHY IT EXISTS. /confidentialite publishes a retention schedule — « Prospects :
 * jusqu'à trois (3) ans à compter du dernier contact » — and until this module
 * nothing in the deployment deleted a personal-data row, ever. `grep -rn
 * "db.delete" convex/` found a contract-signature reset, two one-off migrations
 * and a demo reset, and `crons.ts` ran three referral jobs and a storage sweep.
 * A published commitment that no code implements is the gap; honouring an art.
 * 17 erasure request meant an operator deleting rows by hand in the Convex
 * dashboard, leaving no trace that it had happened.
 *
 * WHAT IS IMPLEMENTED HERE, and against which published sentence:
 *
 * | Published (/confidentialite §6)          | Here                                    |
 * | ---------------------------------------- | --------------------------------------- |
 * | « Prospects : … trois (3) ans à compter du dernier contact » | `sweepExpiredProspects`, daily |
 * | « Clients : pendant la durée de la relation contractuelle »  | on request — `eraseDataSubject` |
 * | « Documents comptables et factures : dix (10) ans »          | deliberately NOT swept, see below |
 *
 * WHY THE TEN-YEAR LINE IS NOT A SWEEP. It states a minimum keeping period the
 * law imposes, not a promise to delete on the anniversary. Purging a paid order
 * would also have to take the `payments`, `invoices`, `subscriptions` and
 * `referrals` rows that point at it, in one coupled erasure; nothing in this
 * deployment is within nine years of needing it, and a destructive job that
 * cannot be observed before it first fires is a liability rather than a
 * safeguard. Both paths below therefore KEEP paid orders and invoices, and say
 * so in their report instead of skipping them silently.
 *
 * SHAPE. Every deletion is capped, and a run that deletes something leaves one
 * `saActivity` row saying what — and saying so when it hit a cap and left a
 * backlog. ./storageSweep gives the reason: a cleanup that quietly stopped
 * doing its job is indistinguishable from one that had nothing to clean, and
 * this repository has paid for that pattern before.
 */

import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./admin";
import { recordSaActivity } from "./saActivity";

/** « Prospects : jusqu'à trois (3) ans à compter du dernier contact ». */
export const PROSPECT_RETENTION_MS = 3 * 365 * 24 * 60 * 60 * 1000;

/** Rows examined per table per run. Safe to truncate: the rest wait a day. */
export const SCAN_CAP = 1_000;

/**
 * Rows an erasure may read from one table.
 *
 * Different meaning from `SCAN_CAP` above, and that difference matters. A sweep
 * that truncates just sweeps the rest tomorrow; an ERASURE that truncates
 * reports "done" while leaving the person's data in place. So exceeding this
 * refuses the whole erasure rather than performing a partial one — read cap + 1
 * so an over-full table is detected instead of silently cut off. Reaching it is
 * the signal to move these lookups onto indexes and fold the stored addresses,
 * not to raise the number.
 */
export const ERASURE_SCAN_CAP = 5_000;

export class ErasureScanTooLargeError extends Error {
  constructor(readonly table: string) {
    super(
      `La table « ${table} » dépasse ${ERASURE_SCAN_CAP} lignes : ` +
        `l'effacement ne peut pas garantir d'avoir tout trouvé et a été refusé.`,
    );
    this.name = "ErasureScanTooLargeError";
  }
}

/** Read a whole table for one erasure, refusing rather than truncating. */
function assertWithinErasureCap<T>(rows: T[], table: string): T[] {
  if (rows.length > ERASURE_SCAN_CAP) throw new ErasureScanTooLargeError(table);
  return rows;
}

/** Addresses compare folded and trimmed, wherever they were written. */
function foldEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Deletions per table per run, so one bad day cannot become one long outage. */
export const DELETIONS_PER_RUN = 200;

export interface RetentionReport {
  whitelist: number;
  contactLeads: number;
  /** Orders that never reached `paid`. */
  unpaidOrders: number;
  /** Paid orders left in place under the accounting obligation. */
  paidOrdersRetained: number;
  /**
   * Tables where the run stopped at a cap with expired rows still to go.
   *
   * Truncating is safe — the rest are deleted tomorrow — but a run that
   * truncates EVERY day is a backlog that never drains, and that is the failure
   * this names. Empty on an ordinary run.
   */
  truncated: string[];
}

function emptyReport(): RetentionReport {
  return {
    whitelist: 0,
    contactLeads: 0,
    unpaidOrders: 0,
    paidOrdersRetained: 0,
    truncated: [],
  };
}

function totalDeleted(report: RetentionReport): number {
  return report.whitelist + report.contactLeads + report.unpaidOrders;
}

/** Last time a waitlist prospect made contact. Pre-`lastContactAt` rows have
    only their sign-up date, which is the last contact we can prove. */
function lastContactOf(row: {
  createdAt: number;
  lastContactAt?: number;
}): number {
  return row.lastContactAt ?? row.createdAt;
}

/* ------------------------------------------------------------------ */
/* Scheduled sweep                                                      */
/* ------------------------------------------------------------------ */

/**
 * Delete prospects whose three years have run out.
 *
 * Scheduled daily from ./crons.ts. Returns a report rather than nothing so the
 * behaviour is assertable in a test and readable in the Convex logs.
 */
export const sweepExpiredProspects = internalMutation({
  args: {},
  handler: async (ctx): Promise<RetentionReport> => {
    const cutoff = Date.now() - PROSPECT_RETENTION_MS;
    const report = emptyReport();

    // Oldest first, so a truncated page drains steadily instead of starving.
    const waitlist = await ctx.db
      .query("whitelist")
      .withIndex("by_createdAt")
      .order("asc")
      .take(SCAN_CAP);
    for (const row of waitlist) {
      if (lastContactOf(row) >= cutoff) continue;
      if (report.whitelist >= DELETIONS_PER_RUN) {
        report.truncated.push("whitelist");
        break;
      }
      await ctx.db.delete(row._id);
      report.whitelist++;
    }

    const leads = await ctx.db
      .query("contactLeads")
      .withIndex("by_createdAt")
      .order("asc")
      .take(SCAN_CAP);
    for (const row of leads) {
      if (row.createdAt >= cutoff) continue;
      if (report.contactLeads >= DELETIONS_PER_RUN) {
        report.truncated.push("contactLeads");
        break;
      }
      /* Every status, `converted` included. A converted lead's own contact
         details are a copy: the client relationship lives in `orders`, which
         this sweep never touches once it is paid. */
      await ctx.db.delete(row._id);
      report.contactLeads++;
    }

    /* An order that never reached `paid` invoiced nothing, so it is a prospect
       record rather than an accounting one and falls under the same sentence.
       No `by_createdAt` index here: creation order is the same order, and the
       cap makes the scan bounded either way. */
    const orders = await ctx.db.query("orders").order("asc").take(SCAN_CAP);
    for (const order of orders) {
      if (order.createdAt >= cutoff) continue;
      if (order.status === "paid") {
        report.paidOrdersRetained++;
        continue;
      }
      if (report.unpaidOrders >= DELETIONS_PER_RUN) {
        if (!report.truncated.includes("orders")) report.truncated.push("orders");
        continue;
      }
      await ctx.db.delete(order._id);
      report.unpaidOrders++;
    }

    if (totalDeleted(report) > 0) {
      await recordSaActivity(ctx, {
        kind: "system",
        action: "retention.prospects",
        summary:
          `Conservation : ${report.whitelist} inscription(s) waitlist, ` +
          `${report.contactLeads} demande(s) de contact et ` +
          `${report.unpaidOrders} commande(s) non payée(s) supprimées ` +
          `après 3 ans sans contact.` +
          (report.truncated.length > 0
            ? ` Reliquat à traiter demain : ${report.truncated.join(", ")}.`
            : ""),
        actorName: "cron",
      });
    }

    return report;
  },
});

/* ------------------------------------------------------------------ */
/* Erasure on request (RGPD art. 17)                                    */
/* ------------------------------------------------------------------ */

export interface ErasureReport extends RetentionReport {
  /** Invoices left in place under the accounting obligation. */
  invoicesRetained: number;
  /** Affiliate profiles matching the address, left in place. */
  affiliateProfilesRetained: number;
}

/**
 * What an erasure would remove, and what it would have to keep.
 *
 * Erasure is irreversible and an address is easy to mistype, so the operator
 * gets to look first. Same reads as `erase`, no writes.
 */
interface ErasureTargets {
  report: ErasureReport;
  whitelistIds: Id<"whitelist">[];
  contactLeadIds: Id<"contactLeads">[];
  unpaidOrderIds: Id<"orders">[];
}

/**
 * Everything this address touches, folded.
 *
 * NOT an index lookup, deliberately. `whitelist.join` folds the address it
 * stores but `createCheckoutSession` does not, and rows predate both — so an
 * index seek on the folded value would quietly miss « Marc@Bistrot.FR » and
 * report an erasure that did not happen. A capped scan compares folded and
 * refuses when it cannot see the whole table.
 */
async function planErasure(
  ctx: QueryCtx,
  rawEmail: string,
): Promise<ErasureTargets> {
  const email = foldEmail(rawEmail);
  const report: ErasureReport = {
    ...emptyReport(),
    invoicesRetained: 0,
    affiliateProfilesRetained: 0,
  };

  const waitlist = assertWithinErasureCap(
    await ctx.db.query("whitelist").take(ERASURE_SCAN_CAP + 1),
    "whitelist",
  ).filter((row) => foldEmail(row.email) === email);
  report.whitelist = waitlist.length;

  const leads = assertWithinErasureCap(
    await ctx.db.query("contactLeads").take(ERASURE_SCAN_CAP + 1),
    "contactLeads",
  ).filter((row) => foldEmail(row.email) === email);
  report.contactLeads = leads.length;

  const orders = assertWithinErasureCap(
    await ctx.db.query("orders").take(ERASURE_SCAN_CAP + 1),
    "orders",
  ).filter((row) => foldEmail(row.customerEmail) === email);
  const unpaid = orders.filter((o) => o.status !== "paid");
  report.unpaidOrders = unpaid.length;
  report.paidOrdersRetained = orders.length - unpaid.length;

  report.invoicesRetained = assertWithinErasureCap(
    await ctx.db.query("invoices").take(ERASURE_SCAN_CAP + 1),
    "invoices",
  ).filter((row) => foldEmail(row.customerEmail) === email).length;

  /* An affiliate is a counterparty to a signed mandate, not a prospect: the
     contract, its commissions and the invoices behind them are the company's
     evidence of a commercial relationship. Erasing one is a decision about a
     contract, not a sweep, so it is reported and left alone. */
  const users = assertWithinErasureCap(
    await ctx.db.query("users").take(ERASURE_SCAN_CAP + 1),
    "users",
  );
  for (const user of users) {
    const address = (user as { email?: unknown }).email;
    if (typeof address !== "string" || foldEmail(address) !== email) continue;
    const affiliate = await ctx.db
      .query("affiliateUsers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (affiliate) report.affiliateProfilesRetained++;
  }

  return {
    report,
    whitelistIds: waitlist.map((row) => row._id),
    contactLeadIds: leads.map((row) => row._id),
    unpaidOrderIds: unpaid.map((row) => row._id),
  };
}

async function eraseDataSubjectFor(
  ctx: MutationCtx,
  rawEmail: string,
  actorName: string,
): Promise<ErasureReport> {
  const email = foldEmail(rawEmail);
  /* One pass decides what goes, and the deletions below act on exactly that
     list — so the report and the erasure can never disagree, and a table that
     grew past the cap refuses here before anything is deleted. */
  const { report, whitelistIds, contactLeadIds, unpaidOrderIds } =
    await planErasure(ctx, email);

  for (const id of whitelistIds) await ctx.db.delete(id);
  for (const id of contactLeadIds) await ctx.db.delete(id);
  for (const id of unpaidOrderIds) await ctx.db.delete(id);

  /* The address is kept in the audit row on purpose: this row IS the company's
     proof that the request was honoured, and it has to be findable when the
     person — or the CNIL — asks whether it was. It carries nothing else about
     them. */
  await recordSaActivity(ctx, {
    kind: "system",
    action: "privacy.erasure",
    summary:
      `Effacement RGPD (art. 17) : ${report.whitelist} inscription(s) waitlist, ` +
      `${report.contactLeads} demande(s) de contact, ` +
      `${report.unpaidOrders} commande(s) non payée(s) supprimées. ` +
      `Conservés au titre de l'obligation comptable : ` +
      `${report.paidOrdersRetained} commande(s) payée(s), ` +
      `${report.invoicesRetained} facture(s). ` +
      `Profil(s) apporteur non supprimé(s) : ${report.affiliateProfilesRetained}.`,
    actorName,
    customerEmail: email,
  });

  return report;
}

/**
 * Preview an erasure. Admin-guarded, read-only.
 */
export const previewErasure = query({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<ErasureReport> => {
    await requireAdmin(ctx);
    return (await planErasure(ctx, args.email)).report;
  },
});

/**
 * Honour an art. 17 erasure request. Admin-guarded, and logged.
 *
 * Public so the ops console can call it with an admin session. The dashboard
 * twin below exists because that is where an operator works today.
 */
export const eraseDataSubject = mutation({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<ErasureReport> => {
    const admin = await requireAdmin(ctx);
    const actor =
      [admin.firstName, admin.lastName].filter(Boolean).join(" ") || "admin";
    return await eraseDataSubjectFor(ctx, args.email, actor);
  },
});

/**
 * The same erasure, runnable from the Convex dashboard.
 *
 * `requireAdmin` needs a session, and a dashboard run has none — so an
 * `internalMutation` is what an operator can actually invoke, exactly as
 * `admin.promoteToAdmin` and `admin.resetAffiliateContract` already are.
 * Deployment access is the authorisation, and the `saActivity` row records who
 * said they ran it. See tasks/gdpr-erasure-runbook.md.
 */
export const eraseDataSubjectFromDashboard = internalMutation({
  args: { email: v.string(), operatorName: v.string() },
  handler: async (ctx, args): Promise<ErasureReport> => {
    return await eraseDataSubjectFor(
      ctx,
      args.email,
      `${args.operatorName} (dashboard)`,
    );
  },
});
