/// <reference types="vite/client" />

/**
 * The published retention schedule, and an erasure path that leaves a trace.
 *
 * /confidentialite commits to « Prospects : jusqu'à trois (3) ans à compter du
 * dernier contact » and to a right of erasure. Nothing implemented either:
 * `grep -rn "db.delete" convex/` found a contract-signature reset, two one-off
 * migrations and a demo reset, and `crons.ts` ran three referral jobs and a
 * storage sweep. Honouring an art. 17 request meant an operator deleting rows
 * by hand in the Convex dashboard, unlogged.
 *
 * The other half of this file is enumeration: `whitelist.join` threw a distinct
 * message for an address already on the list, which is a membership oracle on a
 * public, unauthenticated endpoint.
 */

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { drainScheduled } from "./scheduled";
import {
  DELETIONS_PER_RUN,
  ERASURE_SCAN_CAP,
  PROSPECT_RETENTION_MS,
  SCAN_CAP,
} from "../../convex/retention";

const modules = import.meta.glob("../../convex/**/*.ts");

const DAY = 24 * 60 * 60 * 1000;
const expired = () => Date.now() - PROSPECT_RETENTION_MS - DAY;
const recent = () => Date.now() - 30 * DAY;

const LEAD = {
  firstName: "Marc",
  lastName: "Dubois",
  email: "marc@bistrot.fr",
  phone: "+33611111111",
  restaurantName: "Le Bistrot",
  city: "Nantes",
  plan: "essentielle" as const,
};

const ORDER = {
  customerEmail: "marc@bistrot.fr",
  customerFirstName: "Marc",
  customerLastName: "Dubois",
  customerPhone: "+33611111111",
  restaurantName: "Le Bistrot",
  city: "Nantes",
  buyerType: "business" as const,
  plan: "essentielle" as const,
  orderType: "creation" as const,
  amountCents: 350_000,
};

/** An admin session, which `previewErasure` and `eraseDataSubject` require. */
async function seedAdmin(t: ReturnType<typeof convexTest>) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "ops@beyours.fr" }),
  );
  await t.run((ctx) =>
    ctx.db.insert("affiliateUsers", {
      userId,
      firstName: "Ops",
      lastName: "Beyours",
      role: "admin" as const,
      status: "active" as const,
      contractStatus: "active" as const,
      stripeConnectStatus: "not_started" as const,
      createdAt: Date.now(),
    }),
  );
  return userId;
}

describe("sweepExpiredProspects — « trois (3) ans à compter du dernier contact »", () => {
  test("deletes a waitlist prospect three years after its last contact", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert("whitelist", {
        ...LEAD,
        createdAt: expired(),
        lastContactAt: expired(),
      }),
    );

    const report = await t.mutation(
      internal.retention.sweepExpiredProspects,
      {},
    );

    expect(report.whitelist).toBe(1);
    expect(await t.run((ctx) => ctx.db.query("whitelist").collect())).toEqual(
      [],
    );
  });

  test("counts from the last contact, not from the sign-up", async () => {
    // Somebody who signed up four years ago and wrote again last month is a
    // live prospect. Deleting them would be the published sentence read wrong.
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert("whitelist", {
        ...LEAD,
        createdAt: expired(),
        lastContactAt: recent(),
      }),
    );

    const report = await t.mutation(
      internal.retention.sweepExpiredProspects,
      {},
    );

    expect(report.whitelist).toBe(0);
    expect(
      await t.run((ctx) => ctx.db.query("whitelist").collect()),
    ).toHaveLength(1);
  });

  test("falls back to the sign-up date for rows written before lastContactAt", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert("whitelist", { ...LEAD, createdAt: expired() }),
    );

    const report = await t.mutation(
      internal.retention.sweepExpiredProspects,
      {},
    );
    expect(report.whitelist).toBe(1);
  });

  test("keeps a prospect whose three years have not run out", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert("whitelist", { ...LEAD, createdAt: recent() }),
    );
    await t.run((ctx) =>
      ctx.db.insert("contactLeads", {
        name: "Marc Dubois",
        email: "marc@bistrot.fr",
        message: "Rappelez-moi",
        status: "new" as const,
        createdAt: recent(),
      }),
    );

    const report = await t.mutation(
      internal.retention.sweepExpiredProspects,
      {},
    );

    expect(report).toMatchObject({ whitelist: 0, contactLeads: 0 });
  });

  test("deletes an expired contact lead whatever its status", async () => {
    const t = convexTest(schema, modules);
    for (const status of ["new", "contacted", "converted", "archived"] as const) {
      await t.run((ctx) =>
        ctx.db.insert("contactLeads", {
          name: "Marc Dubois",
          email: `${status}@bistrot.fr`,
          message: "Rappelez-moi",
          status,
          createdAt: expired(),
        }),
      );
    }

    const report = await t.mutation(
      internal.retention.sweepExpiredProspects,
      {},
    );

    expect(report.contactLeads).toBe(4);
  });

  test("deletes an abandoned order but never a paid one", async () => {
    // A pending, failed or cancelled order invoiced nothing, so it is prospect
    // data. A paid one is an accounting record kept ten years — the third
    // bullet of the published schedule.
    const t = convexTest(schema, modules);
    for (const status of ["pending", "failed", "cancelled", "paid"] as const) {
      await t.run((ctx) =>
        ctx.db.insert("orders", { ...ORDER, status, createdAt: expired() }),
      );
    }

    const report = await t.mutation(
      internal.retention.sweepExpiredProspects,
      {},
    );

    expect(report.unpaidOrders).toBe(3);
    expect(report.ordersRetained).toBe(1);
    const left = await t.run((ctx) => ctx.db.query("orders").collect());
    expect(left).toHaveLength(1);
    expect(left[0]!.status).toBe("paid");
  });

  test("leaves an audit row when it deletes, and none when it does not", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.retention.sweepExpiredProspects, {});
    expect(await t.run((ctx) => ctx.db.query("saActivity").collect())).toEqual(
      [],
    );

    await t.run((ctx) =>
      ctx.db.insert("whitelist", { ...LEAD, createdAt: expired() }),
    );
    await t.mutation(internal.retention.sweepExpiredProspects, {});

    const activity = await t.run((ctx) =>
      ctx.db.query("saActivity").collect(),
    );
    expect(activity).toHaveLength(1);
    expect(activity[0]!.action).toBe("retention.prospects");
  });

  test("keeps an order that was paid, invoiced, then refunded", async () => {
    // `http.ts` sets a refunded charge or a chargeback to "cancelled" while
    // leaving the payment and the invoice in place. `status !== "paid"` would
    // delete the ten-year accounting record this module says it keeps.
    const t = convexTest(schema, modules);
    const orderId = await t.run((ctx) =>
      ctx.db.insert("orders", {
        ...ORDER,
        status: "cancelled" as const,
        createdAt: expired(),
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("invoices", {
        orderId,
        stripeInvoiceId: "in_refunded",
        stripeCustomerId: "cus_refunded",
        customerEmail: ORDER.customerEmail,
        invoiceNumber: "FA-2023-0001",
        plan: "essentielle" as const,
        amountCents: 350_000,
        status: "paid" as const,
        createdAt: expired(),
      }),
    );

    const report = await t.mutation(
      internal.retention.sweepExpiredProspects,
      {},
    );

    expect(report.unpaidOrders).toBe(0);
    expect(report.ordersRetained).toBe(1);
    expect(await t.run((ctx) => ctx.db.get(orderId))).not.toBeNull();
  });

  test("never strands a row whose orderId the schema says is not optional", async () => {
    // `referrals.orderId`, `payments.orderId` and `subscriptions.orderId` are
    // all `v.id("orders")`. Deleting the order leaves a document whose schema
    // promises one and whose readers get null.
    const t = convexTest(schema, modules);
    const affiliateUserId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "apport@x.fr" });
      return await ctx.db.insert("affiliateUsers", {
        userId,
        role: "affiliate" as const,
        status: "active" as const,
        contractStatus: "active" as const,
        stripeConnectStatus: "active" as const,
        createdAt: expired(),
      });
    });
    const codeId = await t.run((ctx) =>
      ctx.db.insert("referralCodes", {
        affiliateUserId,
        code: "MARC10",
        isCustom: false,
        isActive: true,
        createdAt: expired(),
      }),
    );
    const orderId = await t.run((ctx) =>
      ctx.db.insert("orders", {
        ...ORDER,
        status: "cancelled" as const,
        createdAt: expired(),
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("referrals", {
        referrerId: affiliateUserId,
        referralCodeId: codeId,
        orderId,
        customerEmail: ORDER.customerEmail,
        customerName: "Marc Dubois",
        commissionCents: 50_000,
        discountPercent: 10,
        discountAmountCents: 35_000,
        status: "pending" as const,
        createdAt: expired(),
      }),
    );

    await t.mutation(internal.retention.sweepExpiredProspects, {});

    const referral = await t.run((ctx) =>
      ctx.db.query("referrals").first(),
    );
    expect(referral).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(referral!.orderId))).not.toBeNull();
  });

  test("does not starve behind a page of recently contacted prospects", async () => {
    // The predicate reads `lastContactAt`, so the walk must too. Ordering by
    // `createdAt` let a full page of old rows with fresh contact dates hide
    // every expired row behind them — and the run reported a clean sweep.
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (let i = 0; i < SCAN_CAP; i++) {
        await ctx.db.insert("whitelist", {
          ...LEAD,
          email: `frais${i}@bistrot.fr`,
          createdAt: expired() - i,
          lastContactAt: recent(),
        });
      }
      await ctx.db.insert("whitelist", {
        ...LEAD,
        email: "perdu@bistrot.fr",
        createdAt: expired(),
        lastContactAt: expired(),
      });
    });

    const report = await t.mutation(
      internal.retention.sweepExpiredProspects,
      {},
    );

    expect(report.whitelist).toBe(1);
    const left = await t.run((ctx) => ctx.db.query("whitelist").collect());
    expect(left.some((r) => r.email === "perdu@bistrot.fr")).toBe(false);
    expect(left).toHaveLength(SCAN_CAP);
  });

  test("says so when a full page of expired rows was left unexamined", async () => {
    // Reachable only where an expired row can be RETAINED rather than deleted,
    // because otherwise the per-run deletion cap trips first. A page full of
    // expired paid orders deletes nothing and still hides whatever is behind
    // it — which is exactly the run that must not report a clean sweep.
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (let i = 0; i <= SCAN_CAP; i++) {
        await ctx.db.insert("orders", {
          ...ORDER,
          customerEmail: `p${i}@bistrot.fr`,
          status: "paid" as const,
          createdAt: expired() - i,
        });
      }
    });

    const report = await t.mutation(
      internal.retention.sweepExpiredProspects,
      {},
    );
    expect(report.unpaidOrders).toBe(0);
    expect(report.truncated).toContain("orders");
  });

  test("says when it hit a cap and left a backlog", async () => {
    // Truncating is safe — the rest go tomorrow — but a run that truncates
    // every day is a backlog that never drains, and silence would hide it.
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (let i = 0; i <= DELETIONS_PER_RUN; i++) {
        await ctx.db.insert("whitelist", {
          ...LEAD,
          email: `p${i}@bistrot.fr`,
          createdAt: expired(),
        });
      }
    });

    const report = await t.mutation(
      internal.retention.sweepExpiredProspects,
      {},
    );

    expect(report.whitelist).toBe(DELETIONS_PER_RUN);
    expect(report.truncated).toContain("whitelist");
    const activity = await t.run((ctx) =>
      ctx.db.query("saActivity").collect(),
    );
    expect(activity[0]!.summary).toMatch(/Reliquat/);

    // The leftover is picked up on the next run.
    const second = await t.mutation(
      internal.retention.sweepExpiredProspects,
      {},
    );
    expect(second.whitelist).toBe(1);
    expect(second.truncated).toEqual([]);
  });

  test("an ordinary run reports no backlog", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert("whitelist", { ...LEAD, createdAt: expired() }),
    );
    const report = await t.mutation(
      internal.retention.sweepExpiredProspects,
      {},
    );
    expect(report.truncated).toEqual([]);
  });

  test("the schedule in code is the schedule on the page", () => {
    expect(PROSPECT_RETENTION_MS).toBe(3 * 365 * DAY);
  });
});

describe("eraseDataSubject — RGPD art. 17", () => {
  async function seedSubject(t: ReturnType<typeof convexTest>) {
    await t.run((ctx) =>
      ctx.db.insert("whitelist", { ...LEAD, createdAt: recent() }),
    );
    await t.run((ctx) =>
      ctx.db.insert("contactLeads", {
        name: "Marc Dubois",
        email: "marc@bistrot.fr",
        message: "Rappelez-moi",
        status: "new" as const,
        createdAt: recent(),
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("orders", {
        ...ORDER,
        status: "cancelled" as const,
        createdAt: recent(),
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("orders", {
        ...ORDER,
        status: "paid" as const,
        createdAt: recent(),
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("invoices", {
        stripeInvoiceId: "in_123",
        stripeCustomerId: "cus_123",
        customerEmail: "marc@bistrot.fr",
        plan: "essentielle" as const,
        amountCents: 350_000,
        status: "paid" as const,
        createdAt: recent(),
      }),
    );
  }

  test("erases the prospect record and reports what the law makes it keep", async () => {
    const t = convexTest(schema, modules);
    const adminUserId = await seedAdmin(t);
    await seedSubject(t);

    const report = await t
      .withIdentity({ subject: adminUserId })
      .mutation(api.retention.eraseDataSubject, { email: "marc@bistrot.fr" });

    expect(report).toMatchObject({
      whitelist: 1,
      contactLeads: 1,
      unpaidOrders: 1,
      ordersRetained: 1,
      invoicesRetained: 1,
    });

    expect(await t.run((ctx) => ctx.db.query("whitelist").collect())).toEqual(
      [],
    );
    expect(
      await t.run((ctx) => ctx.db.query("contactLeads").collect()),
    ).toEqual([]);
    const orders = await t.run((ctx) => ctx.db.query("orders").collect());
    expect(orders).toHaveLength(1);
    expect(orders[0]!.status).toBe("paid");
    expect(
      await t.run((ctx) => ctx.db.query("invoices").collect()),
    ).toHaveLength(1);
  });

  test("matches the address however it was typed, in every table", async () => {
    // `whitelist.join` folds what it stores; `createCheckoutSession` does not,
    // and rows predate both. An index seek on the folded address would miss
    // « Marc@Bistrot.FR » and report an erasure that did not happen.
    const t = convexTest(schema, modules);
    const adminUserId = await seedAdmin(t);
    await t.run((ctx) =>
      ctx.db.insert("whitelist", {
        ...LEAD,
        email: "Marc@Bistrot.FR",
        createdAt: recent(),
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("contactLeads", {
        name: "Marc Dubois",
        email: "MARC@bistrot.fr",
        message: "Rappelez-moi",
        status: "new" as const,
        createdAt: recent(),
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("orders", {
        ...ORDER,
        customerEmail: "Marc@Bistrot.fr",
        status: "pending" as const,
        createdAt: recent(),
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("invoices", {
        stripeInvoiceId: "in_mixed",
        stripeCustomerId: "cus_mixed",
        customerEmail: "MARC@BISTROT.FR",
        plan: "essentielle" as const,
        amountCents: 350_000,
        status: "paid" as const,
        createdAt: recent(),
      }),
    );

    const report = await t
      .withIdentity({ subject: adminUserId })
      .mutation(api.retention.eraseDataSubject, {
        email: "  MARC@bistrot.fr ",
      });

    expect(report).toMatchObject({
      whitelist: 1,
      contactLeads: 1,
      unpaidOrders: 1,
      invoicesRetained: 1,
    });
    expect(await t.run((ctx) => ctx.db.query("whitelist").collect())).toEqual(
      [],
    );
    expect(
      await t.run((ctx) => ctx.db.query("contactLeads").collect()),
    ).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("orders").collect())).toEqual([]);
  });

  test("erases nothing for an address that is merely a prefix or suffix", async () => {
    const t = convexTest(schema, modules);
    const adminUserId = await seedAdmin(t);
    await t.run((ctx) =>
      ctx.db.insert("whitelist", {
        ...LEAD,
        email: "marc@bistrot.fr.example.com",
        createdAt: recent(),
      }),
    );

    const report = await t
      .withIdentity({ subject: adminUserId })
      .mutation(api.retention.eraseDataSubject, { email: "marc@bistrot.fr" });

    expect(report.whitelist).toBe(0);
    expect(
      await t.run((ctx) => ctx.db.query("whitelist").collect()),
    ).toHaveLength(1);
  });

  test("leaves an audit row naming who ran it and what it kept", async () => {
    const t = convexTest(schema, modules);
    const adminUserId = await seedAdmin(t);
    await seedSubject(t);

    await t
      .withIdentity({ subject: adminUserId })
      .mutation(api.retention.eraseDataSubject, { email: "marc@bistrot.fr" });

    const activity = await t.run((ctx) =>
      ctx.db.query("saActivity").collect(),
    );
    expect(activity).toHaveLength(1);
    expect(activity[0]!.action).toBe("privacy.erasure");
    expect(activity[0]!.actorName).toBe("Ops Beyours");
    expect(activity[0]!.customerEmail).toBe("marc@bistrot.fr");
    expect(activity[0]!.summary).toMatch(/facture/);
  });

  test("previews without deleting", async () => {
    const t = convexTest(schema, modules);
    const adminUserId = await seedAdmin(t);
    await seedSubject(t);

    const preview = await t
      .withIdentity({ subject: adminUserId })
      .query(api.retention.previewErasure, { email: "marc@bistrot.fr" });

    expect(preview).toMatchObject({ whitelist: 1, contactLeads: 1 });
    expect(
      await t.run((ctx) => ctx.db.query("whitelist").collect()),
    ).toHaveLength(1);
  });

  test("does not erase an affiliate's own account, and says so", async () => {
    // An affiliate is a counterparty to a signed mandate, not a prospect.
    const t = convexTest(schema, modules);
    const adminUserId = await seedAdmin(t);
    const affiliateUserId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "marc@bistrot.fr" }),
    );
    await t.run((ctx) =>
      ctx.db.insert("affiliateUsers", {
        userId: affiliateUserId,
        role: "affiliate" as const,
        status: "active" as const,
        contractStatus: "active" as const,
        stripeConnectStatus: "active" as const,
        createdAt: recent(),
      }),
    );

    const report = await t
      .withIdentity({ subject: adminUserId })
      .mutation(api.retention.eraseDataSubject, { email: "marc@bistrot.fr" });

    expect(report.affiliateProfilesRetained).toBe(1);
    expect(
      await t.run((ctx) => ctx.db.query("affiliateUsers").collect()),
    ).toHaveLength(2);
  });

  test("refuses an anonymous caller and a non-admin", async () => {
    const t = convexTest(schema, modules);
    await seedSubject(t);
    const outsiderId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "curieux@example.fr" }),
    );
    await t.run((ctx) =>
      ctx.db.insert("affiliateUsers", {
        userId: outsiderId,
        role: "affiliate" as const,
        status: "active" as const,
        contractStatus: "active" as const,
        stripeConnectStatus: "not_started" as const,
        createdAt: Date.now(),
      }),
    );

    await expect(
      t.mutation(api.retention.eraseDataSubject, { email: "marc@bistrot.fr" }),
    ).rejects.toThrow(/authentifi/i);
    await expect(
      t
        .withIdentity({ subject: outsiderId })
        .mutation(api.retention.eraseDataSubject, {
          email: "marc@bistrot.fr",
        }),
    ).rejects.toThrow(/autoris/i);
    await expect(
      t.query(api.retention.previewErasure, { email: "marc@bistrot.fr" }),
    ).rejects.toThrow(/authentifi/i);

    // Nothing was deleted by any of those attempts.
    expect(
      await t.run((ctx) => ctx.db.query("whitelist").collect()),
    ).toHaveLength(1);
  });

  test("refuses rather than half-erasing a table it cannot read whole", async () => {
    // A sweep that truncates sweeps the rest tomorrow. An erasure that
    // truncates reports « done » while the data is still there.
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      for (let i = 0; i <= ERASURE_SCAN_CAP; i++) {
        await ctx.db.insert("whitelist", {
          ...LEAD,
          email: `p${i}@bistrot.fr`,
          createdAt: recent(),
        });
      }
    });

    await expect(
      t.mutation(internal.retention.eraseDataSubjectFromDashboard, {
        email: "p0@bistrot.fr",
        operatorName: "Yanis",
      }),
    ).rejects.toThrow(/whitelist/);

    // And it refused BEFORE deleting anything.
    expect(
      await t.run((ctx) => ctx.db.query("whitelist").collect()),
    ).toHaveLength(ERASURE_SCAN_CAP + 1);
  });

  test("the dashboard twin does the same thing and names the operator", async () => {
    const t = convexTest(schema, modules);
    await seedSubject(t);

    const report = await t.mutation(
      internal.retention.eraseDataSubjectFromDashboard,
      { email: "marc@bistrot.fr", operatorName: "Yanis" },
    );

    expect(report.whitelist).toBe(1);
    const activity = await t.run((ctx) =>
      ctx.db.query("saActivity").collect(),
    );
    expect(activity[0]!.actorName).toBe("Yanis (dashboard)");
  });
});

describe("whitelist.join — no membership oracle", () => {
  test("answers identically for a known and an unknown address", async () => {
    const t = convexTest(schema, modules);

    await expect(t.mutation(api.whitelist.join, LEAD)).resolves.toBeNull();
    await expect(
      t.mutation(api.whitelist.join, { ...LEAD, firstName: "Marco" }),
    ).resolves.toBeNull();
    await expect(
      t.mutation(api.whitelist.join, { ...LEAD, email: "inconnu@bistrot.fr" }),
    ).resolves.toBeNull();
  });

  test("a repeat join adds no row and changes none", async () => {
    // Accepted and dropped, whatever case the address was typed in.
    const t = convexTest(schema, modules);
    await t.mutation(api.whitelist.join, LEAD);
    const before = await t.run((ctx) => ctx.db.query("whitelist").collect());

    await t.mutation(api.whitelist.join, {
      ...LEAD,
      email: "MARC@Bistrot.fr",
      city: "Rennes",
    });

    const after = await t.run((ctx) => ctx.db.query("whitelist").collect());
    expect(after).toHaveLength(1);
    expect(after[0]!._id).toBe(before[0]!._id);
    expect(after[0]!.city).toBe("Nantes");
    expect(after[0]!.email).toBe("marc@bistrot.fr");
  });

  test("a stranger cannot overwrite a prospect's record", async () => {
    // Nothing here is authenticated and no address is verified, so a caller who
    // guesses an address is not its owner. Patching the row on a repeat join
    // handed them a write over somebody else's name, phone and restaurant.
    const t = convexTest(schema, modules);
    const rowId = await t.run((ctx) =>
      ctx.db.insert("whitelist", { ...LEAD, createdAt: recent() }),
    );

    await t.mutation(api.whitelist.join, {
      ...LEAD,
      firstName: "Attaquant",
      lastName: "Anonyme",
      phone: "+33600000000",
      restaurantName: "Vandalisé",
      city: "Nulle Part",
      message: "pwned",
    });

    const row = await t.run((ctx) => ctx.db.get(rowId));
    expect(row!.firstName).toBe("Marc");
    expect(row!.lastName).toBe("Dubois");
    expect(row!.phone).toBe("+33611111111");
    expect(row!.restaurantName).toBe("Le Bistrot");
    expect(row!.city).toBe("Nantes");
  });

  test("a stranger cannot postpone a prospect's deletion", async () => {
    // The sweep counts three years from `lastContactAt`. If an anonymous join
    // advanced it, anyone could keep a record alive for ever, one call at a
    // time — a published retention promise defeated from outside.
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert("whitelist", {
        ...LEAD,
        createdAt: expired(),
        lastContactAt: expired(),
      }),
    );

    await t.mutation(api.whitelist.join, LEAD);
    const report = await t.mutation(
      internal.retention.sweepExpiredProspects,
      {},
    );

    expect(report.whitelist).toBe(1);
    expect(await t.run((ctx) => ctx.db.query("whitelist").collect())).toEqual(
      [],
    );
  });

  test("does not spend the contact form's window", async () => {
    // These shared `contactSiteWide`, so forty anonymous waitlist joins locked
    // every visitor out of the only way to reach the company for an hour.
    const t = convexTest(schema, modules);
    // The whole waitlist budget, spent.
    for (let i = 0; i < 40; i++) {
      await t.mutation(api.whitelist.join, {
        ...LEAD,
        email: `p${i}@bistrot.fr`,
      });
    }
    await expect(
      t.mutation(api.whitelist.join, { ...LEAD, email: "p40@bistrot.fr" }),
    ).rejects.toThrow(/Trop de requêtes/);

    await expect(
      t.mutation(api.contactLeads.submit, {
        name: "Marc Dubois",
        email: "marc@bistrot.fr",
        message: "Rappelez-moi",
      }),
    ).resolves.not.toThrow();
    // The submit schedules confirmation email; let it settle before teardown.
    await drainScheduled(t);
  });

  test("bounds a loop on its own windows", async () => {
    const t = convexTest(schema, modules);
    for (let i = 0; i < 3; i++) {
      await t.mutation(api.whitelist.join, {
        ...LEAD,
        email: "boucle@bistrot.fr",
      });
    }
    await expect(
      t.mutation(api.whitelist.join, { ...LEAD, email: "boucle@bistrot.fr" }),
    ).rejects.toThrow(/Trop de requêtes/);
  });

  test("caps the fields a caller can push into the table", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.whitelist.join, { ...LEAD, message: "x".repeat(5_001) }),
    ).rejects.toThrow(/dépasse/);
    expect(await t.run((ctx) => ctx.db.query("whitelist").collect())).toEqual(
      [],
    );
  });
});
