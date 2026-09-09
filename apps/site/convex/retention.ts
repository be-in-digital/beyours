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
import type { Doc, Id } from "./_generated/dataModel";
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
  /** Orders deleted: no money taken, and nothing referencing them. */
  unpaidOrders: number;
  /** Expired orders kept: paid, or still referenced by an accounting row. */
  ordersRetained: number;
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
    ordersRetained: 0,
    truncated: [],
  };
}

/** Record a table whose sweep left work behind, once. */
function note(report: RetentionReport, table: string): void {
  if (!report.truncated.includes(table)) report.truncated.push(table);
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
/**
 * May this expired order be deleted?
 *
 * NOT `status !== "paid"`. `http.ts` sets a refunded charge or a chargeback to
 * `cancelled` while leaving its `payments`, `invoices` and `subscriptions` rows
 * in place — so "not paid" would delete an order that WAS paid and invoiced,
 * which is the ten-year accounting record this module says it keeps. It would
 * also strand the rows pointing at it: `referrals.orderId`, `payments.orderId`
 * and `subscriptions.orderId` are `v.id("orders")`, NOT optional, so a deleted
 * order leaves a document whose schema promises one and whose readers get null.
 *
 * The honest predicate is "nothing references it and it never took money".
 */
async function orderIsErasable(
  ctx: QueryCtx,
  order: Doc<"orders">,
): Promise<boolean> {
  if (order.status === "paid") return false;

  const referencedBy = await Promise.all([
    ctx.db
      .query("payments")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first(),
    ctx.db
      .query("invoices")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first(),
    ctx.db
      .query("subscriptions")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first(),
    ctx.db
      .query("referrals")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .first(),
  ]);
  if (referencedBy.some((row) => row !== null)) return false;

  /* `saDeployments.orderId` is optional and has no index on it; the fleet is
     small and this only runs for an order already past three years. */
  const deployments = await ctx.db.query("saDeployments").take(SCAN_CAP);
  return !deployments.some((d) => d.orderId === order._id);
}

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

    /* Walk the field the predicate reads, oldest first. See the index comment
       in ./schema.ts: walking `by_createdAt` and deleting on `lastContactAt`
       starves, and reports a clean sweep while doing it. */
    const waitlist = await ctx.db
      .query("whitelist")
      .withIndex("by_lastContactAt")
      .order("asc")
      .take(SCAN_CAP);
    for (const row of waitlist) {
      if (lastContactOf(row) >= cutoff) continue;
      if (report.whitelist >= DELETIONS_PER_RUN) {
        note(report, "whitelist");
        break;
      }
      await ctx.db.delete(row._id);
      report.whitelist++;
    }
    /* A full page whose LAST row was still expired means there is more behind
       it that this run never looked at. On an ordered walk that test is exact:
       if the last row is not expired, nothing after it is either. */
    if (
      waitlist.length === SCAN_CAP &&
      lastContactOf(waitlist[waitlist.length - 1]!) < cutoff
    ) {
      note(report, "whitelist");
    }

    const leads = await ctx.db
      .query("contactLeads")
      .withIndex("by_createdAt")
      .order("asc")
      .take(SCAN_CAP);
    for (const row of leads) {
      if (row.createdAt >= cutoff) continue;
      if (report.contactLeads >= DELETIONS_PER_RUN) {
        note(report, "contactLeads");
        break;
      }
      /* Every status, `converted` included. A converted lead's own contact
         details are a copy: the client relationship lives in `orders`, which
         this sweep never touches once it has taken money. */
      await ctx.db.delete(row._id);
      report.contactLeads++;
    }
    if (
      leads.length === SCAN_CAP &&
      leads[leads.length - 1]!.createdAt < cutoff
    ) {
      note(report, "contactLeads");
    }

    /* An order that took no money and that nothing references invoiced nothing,
       so it is a prospect record rather than an accounting one and falls under
       the same sentence. No `by_createdAt` index here: creation order is the
       same order, and the cap bounds the scan either way. */
    const orders = await ctx.db.query("orders").order("asc").take(SCAN_CAP);
    for (const order of orders) {
      if (order.createdAt >= cutoff) continue;
      if (!(await orderIsErasable(ctx, order))) {
        report.ordersRetained++;
        continue;
      }
      if (report.unpaidOrders >= DELETIONS_PER_RUN) {
        note(report, "orders");
        continue;
      }
      await ctx.db.delete(order._id);
      report.unpaidOrders++;
    }
    if (
      orders.length === SCAN_CAP &&
      orders[orders.length - 1]!.createdAt < cutoff
    ) {
      note(report, "orders");
    }

    if (totalDeleted(report) > 0 || report.truncated.length > 0) {
      await recordSaActivity(ctx, {
        kind: "system",
        action: "retention.prospects",
        summary:
          `Conservation : ${report.whitelist} inscription(s) waitlist, ` +
          `${report.contactLeads} demande(s) de contact et ` +
          `${report.unpaidOrders} commande(s) sans suite supprimées ` +
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

/**
 * What an erasure removed, and — line by line — everything it did not.
 *
 * Every table that still holds the address after the erasure is counted here.
 * A report that names only what it deleted tells the operator the request was
 * honoured in full when it was not, and they then tell the data subject the
 * same thing. Anything added to this interface has to be answered for in
 * tasks/gdpr-erasure-runbook.md.
 */
export interface ErasureReport extends RetentionReport {
  /** Invoices left in place under the accounting obligation. */
  invoicesRetained: number;
  /** Affiliate profiles matching the address, left in place. */
  affiliateProfilesRetained: number;
  /** Login accounts. Deleting one is an account closure, not a sweep. */
  usersRetained: number;
  /** Maintenance subscriptions — a live contractual relationship. */
  subscriptionsRetained: number;
  /** Commissions naming this address as the referred customer. */
  referralsRetained: number;
  /** Ops activity rows carrying the address, this erasure's own included. */
  activityRowsRetained: number;
  /** Client deployments — the contractual relationship, not a prospect. */
  deploymentsRetained: number;
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
    usersRetained: 0,
    subscriptionsRetained: 0,
    referralsRetained: 0,
    activityRowsRetained: 0,
    deploymentsRetained: 0,
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
  /* The same predicate the sweep uses, and for the same reasons: a refunded
     order still carries its invoice, and three of the tables pointing at an
     order declare `orderId` non-optional. */
  const erasable: Doc<"orders">[] = [];
  for (const order of orders) {
    if (await orderIsErasable(ctx, order)) erasable.push(order);
  }
  report.unpaidOrders = erasable.length;
  report.ordersRetained = orders.length - erasable.length;

  report.invoicesRetained = assertWithinErasureCap(
    await ctx.db.query("invoices").take(ERASURE_SCAN_CAP + 1),
    "invoices",
  ).filter((row) => foldEmail(row.customerEmail) === email).length;

  report.subscriptionsRetained = assertWithinErasureCap(
    await ctx.db.query("subscriptions").take(ERASURE_SCAN_CAP + 1),
    "subscriptions",
  ).filter((row) => foldEmail(row.customerEmail) === email).length;

  report.referralsRetained = assertWithinErasureCap(
    await ctx.db.query("referrals").take(ERASURE_SCAN_CAP + 1),
    "referrals",
  ).filter((row) => foldEmail(row.customerEmail) === email).length;

  report.activityRowsRetained = assertWithinErasureCap(
    await ctx.db.query("saActivity").take(ERASURE_SCAN_CAP + 1),
    "saActivity",
  ).filter(
    (row) =>
      typeof row.customerEmail === "string" &&
      foldEmail(row.customerEmail) === email,
  ).length;

  report.deploymentsRetained = assertWithinErasureCap(
    await ctx.db.query("saDeployments").take(ERASURE_SCAN_CAP + 1),
    "saDeployments",
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
    /* The login account itself. Closing one is an account deletion — it takes
       the Convex Auth rows with it and can orphan a signed mandate — so it is
       reported for the operator to decide, never deleted here. */
    report.usersRetained++;
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
    unpaidOrderIds: erasable.map((row) => row._id),
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
      `${report.unpaidOrders} commande(s) sans suite supprimées. ` +
      `CONSERVÉS — obligation comptable : ${report.ordersRetained} commande(s), ` +
      `${report.invoicesRetained} facture(s) ; ` +
      `relation contractuelle : ${report.usersRetained} compte(s), ` +
      `${report.affiliateProfilesRetained} profil(s) apporteur, ` +
      `${report.subscriptionsRetained} abonnement(s), ` +
      `${report.referralsRetained} commission(s), ` +
      `${report.deploymentsRetained} déploiement(s) ; ` +
      `journal d'exploitation : ${report.activityRowsRetained} ligne(s). ` +
      `Voir tasks/gdpr-erasure-runbook.md pour les suites à donner.`,
    actorName,
    customerEmail: email,
  });

  return report;
}

/**
 * Preview an erasure. Admin-guarded, read-only.
 */
// @guarded-inline: requireAdmin() — resolves the caller with getAuthUserId
//   and refuses anyone whose affiliateUsers row is not role admin
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
// @guarded-inline: requireAdmin() — resolves the caller with getAuthUserId
//   and refuses anyone whose affiliateUsers row is not role admin
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
