/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe, afterEach, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import { RATE_LIMITS } from "../../convex/rateLimit";
import { ORPHAN_TTL_MS, SIGNATURE_SCAN_CAP } from "../../convex/storageSweep";

const modules = import.meta.glob("../../convex/**/*.ts");

/**
 * Minting an invoice upload URL, and collecting the files nobody attached.
 *
 * Before this: `generateInvoiceUploadUrl` asked only for a session — strictly
 * less than `attachReferralInvoice`, the half of the same operation that
 * follows it — so any signed-in account could mint storage without limit, and
 * nothing in the deployment ever deleted a file.
 */

type Harness = ReturnType<typeof convexTest>;

async function seedAffiliate(
  t: Harness,
  email: string,
  status: "active" | "suspended" = "active",
) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { email }));
  const affiliateUserId = await t.run((ctx) =>
    ctx.db.insert("affiliateUsers", {
      userId,
      role: "affiliate" as const,
      status,
      stripeConnectStatus: "not_started" as const,
      createdAt: Date.now(),
    }),
  );
  return { userId, affiliateUserId };
}

/** A commission the affiliate may attach an invoice to. */
async function seedReferral(t: Harness, affiliateUserId: Id<"affiliateUsers">) {
  const referralCodeId = await t.run((ctx) =>
    ctx.db.insert("referralCodes", {
      affiliateUserId,
      code: "TEST123",
      isCustom: false,
      isActive: true,
      createdAt: Date.now(),
    }),
  );
  const orderId = await t.run((ctx) =>
    ctx.db.insert("orders", {
      customerEmail: "client@resto.fr",
      customerFirstName: "Marc",
      customerLastName: "Payet",
      customerPhone: "0600000000",
      restaurantName: "Le Test",
      city: "Paris",
      buyerType: "business" as const,
      plan: "essentielle" as const,
      orderType: "creation" as const,
      amountCents: 250000,
      status: "paid" as const,
      createdAt: Date.now(),
    }),
  );
  return await t.run((ctx) =>
    ctx.db.insert("referrals", {
      referrerId: affiliateUserId,
      referralCodeId,
      orderId,
      customerEmail: "client@resto.fr",
      status: "validated" as const,
      commissionCents: 50000,
      discountPercent: 10,
      discountAmountCents: 25000,
      createdAt: Date.now(),
    }),
  );
}

async function storeFile(t: Harness): Promise<Id<"_storage">> {
  return await t.run((ctx) =>
    ctx.storage.store(new Blob(["%PDF-1.4"], { type: "application/pdf" })),
  );
}

async function storageIds(t: Harness): Promise<string[]> {
  const files = await t.run((ctx) =>
    ctx.db.system.query("_storage").collect(),
  );
  return files.map((file) => file._id);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("referrals.generateInvoiceUploadUrl", () => {
  test("an anonymous caller is refused", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.referrals.generateInvoiceUploadUrl, {}),
    ).rejects.toThrow("Non authentifié");
  });

  test("a signed-in account with no apporteur profile is refused outright", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "nobody@example.com" }),
    );
    const asUser = t.withIdentity({ subject: userId });

    // The sibling `attachReferralInvoice` has always demanded this profile.
    // Minting the URL is the first half of the same operation and used to ask
    // for less, so a bare account could mint storage all day.
    for (let i = 0; i < 10; i++) {
      await expect(
        asUser.mutation(api.referrals.generateInvoiceUploadUrl, {}),
      ).rejects.toThrow("Profil apporteur introuvable");
    }
    expect(await storageIds(t)).toHaveLength(0);
  });

  test("a suspended apporteur may still mint, exactly as it may still attach", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedAffiliate(t, "suspendu@example.com", "suspended");

    // Pinned deliberately. `attachReferralInvoice` does not gate on
    // `affiliate.status`, so minting must not either: a mint-only gate would
    // leave the attach half of the flow unreachable, and art. 4.2 makes the
    // invoice mandatory before payout — the stricter rule would withhold money
    // rather than stop an abuse. If that rule is ever wanted, it belongs on
    // both halves and is a business decision, not a security one.
    const url = await t
      .withIdentity({ subject: userId })
      .mutation(api.referrals.generateInvoiceUploadUrl, {});
    expect(url).toBeTruthy();
  });

  test("one apporteur cannot mint without limit", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedAffiliate(t, "apporteur@example.com");
    const asUser = t.withIdentity({ subject: userId });

    let minted = 0;
    let refused = 0;
    for (let i = 0; i < 10; i++) {
      try {
        await asUser.mutation(api.referrals.generateInvoiceUploadUrl, {});
        minted++;
      } catch {
        refused++;
      }
    }

    expect(minted).toBe(RATE_LIMITS.invoiceUploadUrlPerAffiliate.limit);
    expect(refused).toBe(10 - RATE_LIMITS.invoiceUploadUrlPerAffiliate.limit);
  });

  test("the refusal is the French message a visitor should see", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedAffiliate(t, "apporteur@example.com");
    const asUser = t.withIdentity({ subject: userId });
    for (let i = 0; i < RATE_LIMITS.invoiceUploadUrlPerAffiliate.limit; i++) {
      await asUser.mutation(api.referrals.generateInvoiceUploadUrl, {});
    }
    await expect(
      asUser.mutation(api.referrals.generateInvoiceUploadUrl, {}),
    ).rejects.toThrow("Trop de requêtes");
  });

  test("one apporteur cannot spend another's quota", async () => {
    const t = convexTest(schema, modules);
    const first = await seedAffiliate(t, "un@example.com");
    const second = await seedAffiliate(t, "deux@example.com");

    // Exhaust the first. The window is keyed on the id the server resolved, so
    // the second must be untouched — this is what would break if ids were
    // case-folded into the key the way an email address is.
    const asFirst = t.withIdentity({ subject: first.userId });
    for (let i = 0; i < RATE_LIMITS.invoiceUploadUrlPerAffiliate.limit; i++) {
      await asFirst.mutation(api.referrals.generateInvoiceUploadUrl, {});
    }
    await expect(
      asFirst.mutation(api.referrals.generateInvoiceUploadUrl, {}),
    ).rejects.toThrow("Trop de requêtes");

    const url = await t
      .withIdentity({ subject: second.userId })
      .mutation(api.referrals.generateInvoiceUploadUrl, {});
    expect(url).toBeTruthy();
  });
});

describe("storageSweep.sweepOrphanUploads", () => {
  /** Move the clock past the TTL so today's files count as abandoned. */
  function travelPastTtl(): void {
    const future = Date.now() + ORPHAN_TTL_MS + 60_000;
    vi.spyOn(Date, "now").mockReturnValue(future);
  }

  test("a file nobody attached is deleted once it is past the TTL", async () => {
    const t = convexTest(schema, modules);
    const orphan = await storeFile(t);
    expect(await storageIds(t)).toContain(orphan);

    travelPastTtl();
    const report = await t.mutation(internal.storageSweep.sweepOrphanUploads, {});

    expect(report.deleted).toBe(1);
    expect(await storageIds(t)).toHaveLength(0);
  });

  test("a file younger than the TTL is left alone", async () => {
    const t = convexTest(schema, modules);
    await storeFile(t);

    const report = await t.mutation(internal.storageSweep.sweepOrphanUploads, {});

    expect(report.expired).toBe(0);
    expect(report.deleted).toBe(0);
    expect(await storageIds(t)).toHaveLength(1);
  });

  test("an invoice attached to a commission is never deleted", async () => {
    const t = convexTest(schema, modules);
    const { userId, affiliateUserId } = await seedAffiliate(t, "apporteur@example.com");
    const referralId = await seedReferral(t, affiliateUserId);

    const invoice = await storeFile(t);
    const orphan = await storeFile(t);
    // Attach through the real mutation, so the sweep is proved against the
    // field the application actually writes rather than one a fixture invented.
    await t
      .withIdentity({ subject: userId })
      .mutation(api.referrals.attachReferralInvoice, {
        referralId,
        storageId: invoice,
      });

    travelPastTtl();
    const report = await t.mutation(internal.storageSweep.sweepOrphanUploads, {});

    expect(report.deleted).toBe(1);
    const remaining = await storageIds(t);
    expect(remaining).toEqual([invoice]);
    expect(remaining).not.toContain(orphan);
  });

  test("a signed contract PDF is never deleted", async () => {
    const t = convexTest(schema, modules);
    const { affiliateUserId } = await seedAffiliate(t, "apporteur@example.com");
    const contractVersionId = await t.run((ctx) =>
      ctx.db.insert("contractVersions", {
        version: "1.0",
        title: "Contrat apporteur",
        content: "Article 1",
        contentHash: "h",
        status: "active" as const,
        createdAt: Date.now(),
      }),
    );

    // The other producer of storage in this deployment: the id lands on
    // `contractSignatures.signedDocumentFileId`, which is a `v.string()` rather
    // than a `v.id("_storage")` and would be missed by a sweep that only looked
    // for typed references.
    const signed = await storeFile(t);
    await t.run((ctx) =>
      ctx.db.insert("contractSignatures", {
        affiliateUserId,
        contractVersionId,
        status: "signed" as const,
        contractSnapshotContent: "Article 1",
        contractSnapshotHash: "h",
        signedDocumentFileId: signed,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    const orphan = await storeFile(t);

    travelPastTtl();
    const report = await t.mutation(internal.storageSweep.sweepOrphanUploads, {});

    expect(report.deleted).toBe(1);
    const remaining = await storageIds(t);
    expect(remaining).toEqual([signed]);
    expect(remaining).not.toContain(orphan);
  });

  test("a reference table it cannot read whole aborts the run and deletes nothing", async () => {
    const t = convexTest(schema, modules);
    const { affiliateUserId } = await seedAffiliate(t, "apporteur@example.com");
    const contractVersionId = await t.run((ctx) =>
      ctx.db.insert("contractVersions", {
        version: "1.0",
        title: "Contrat apporteur",
        content: "Article 1",
        contentHash: "h",
        status: "active" as const,
        createdAt: Date.now(),
      }),
    );
    await t.run(async (ctx) => {
      for (let i = 0; i <= SIGNATURE_SCAN_CAP; i++) {
        await ctx.db.insert("contractSignatures", {
          affiliateUserId,
          contractVersionId,
          status: "signed" as const,
          contractSnapshotContent: "Article 1",
          contractSnapshotHash: "h",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    });
    const orphan = await storeFile(t);

    travelPastTtl();
    const report = await t.mutation(internal.storageSweep.sweepOrphanUploads, {});

    // A file referenced by a row the sweep did not read looks exactly like an
    // orphan. Deleting a live invoice is far worse than leaving one on disk, so
    // an incomplete view must delete nothing at all.
    expect(report.abortedReason).toMatch(/contractSignatures/);
    expect(report.expired).toBe(1);
    expect(report.deleted).toBe(0);
    expect(await storageIds(t)).toEqual([orphan]);
  });

  test("a run that deletes leaves an audit row behind", async () => {
    const t = convexTest(schema, modules);
    await storeFile(t);

    travelPastTtl();
    await t.mutation(internal.storageSweep.sweepOrphanUploads, {});

    const activity = await t.run((ctx) => ctx.db.query("saActivity").collect());
    expect(activity).toHaveLength(1);
    expect(activity[0].action).toBe("storage.sweep");
  });

  test("a quiet day costs one page read and no reference scan", async () => {
    const t = convexTest(schema, modules);
    const report = await t.mutation(internal.storageSweep.sweepOrphanUploads, {});
    expect(report).toEqual({ scanned: 0, expired: 0, deleted: 0 });
  });
});
