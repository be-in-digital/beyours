/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");
const DAY = 24 * 60 * 60 * 1000;

const CONTRACT =
  "CONTRAT D'APPORTEUR D'AFFAIRES\n\nArticle 1 — Objet\nMandat d'apporteur.\n" +
  "Article 3.2 — Nouveau Client\nSeul un client nouveau ouvre droit à commission.\n";

async function seedAffiliate(t: ReturnType<typeof convexTest>, email: string) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { email }));
  const contractVersionId = await t.run((ctx) =>
    ctx.db.insert("contractVersions", {
      version: "1.0", title: "Contrat apporteur", content: CONTRACT,
      contentHash: "h", status: "active" as const,
      createdAt: Date.now(), activatedAt: Date.now(),
    }),
  );
  const affiliateUserId = await t.run((ctx) =>
    ctx.db.insert("affiliateUsers", {
      userId, role: "affiliate" as const, status: "active" as const,
      contractStatus: "pending_contract" as const,
      requiredContractVersionId: contractVersionId,
      stripeConnectStatus: "not_started" as const, createdAt: Date.now(),
    }),
  );
  return { userId, contractVersionId, affiliateUserId };
}

async function seedOrder(t: ReturnType<typeof convexTest>, email: string) {
  return t.run((ctx) =>
    ctx.db.insert("orders", {
      customerEmail: email, customerFirstName: "Marc", customerLastName: "Payet",
      customerPhone: "0600000000", restaurantName: "Le Test", city: "Paris",
      buyerType: "business" as const, plan: "essentielle" as const,
      orderType: "creation" as const, amountCents: 250000,
      status: "paid" as const, createdAt: Date.now(),
    }),
  );
}

describe("Apporteurs — parcours complet", () => {
  test("inscription → signature → code → vente → validation → payable → payé", async () => {
    const t = convexTest(schema, modules);
    const { userId, affiliateUserId } = await seedAffiliate(t, "apporteur@test.fr");
    const asAffiliate = t.withIdentity({ subject: userId });

    // 1. Le contrat à signer est servi par contractVersions.getActive
    const toSign = await asAffiliate.query(api.contractVersions.getActive, {});
    expect(toSign, "un contrat actif doit être proposé à la signature").not.toBeNull();
    expect(toSign!.content.length).toBeGreaterThan(0);

    // 2. Signature SES → activation
    const sig = await asAffiliate.action(api.affiliateSignature.signAffiliateContract, {
      fullName: "Ada Lovelace", consented: true, userAgent: "vitest",
    });
    const affiliate = await t.run((ctx) => ctx.db.get(affiliateUserId));
    expect(affiliate!.contractStatus, "signature → contrat actif").toBe("active");

    // 3. PDF signé récupérable par l'apporteur
    const url = await asAffiliate.query(api.contractSignatures.getSignedContractUrl, {});
    expect(url, "le PDF signé doit être téléchargeable").toBeTruthy();

    // 4. Code de parrainage
    const code = await asAffiliate.mutation(api.referralCodes.generateMyCode, {});
    expect(code).toBeTruthy();
    const codeDoc = await t.run((ctx) =>
      ctx.db.query("referralCodes").withIndex("by_affiliateUserId", (q) => q.eq("affiliateUserId", affiliateUserId)).first(),
    );
    const check = await t.query(api.referralCodes.validateCode, { code: codeDoc!.code });
    expect(check.valid, "le code doit être valide publiquement").toBe(true);

    // 5. Vente attribuée
    const orderId = await seedOrder(t, "client@resto.fr");
    const referralId = await t.mutation(internal.referrals.createFromCheckout, {
      referrerId: affiliateUserId, referralCodeId: codeDoc!._id, orderId,
      customerEmail: "client@resto.fr", commissionCents: 50000,
      discountPercent: 10, discountAmountCents: 25000,
    });
    let ref = await t.run((ctx) => ctx.db.get(referralId));
    expect(ref!.status, "une vente fraîche est en attente").toBe("pending");

    // 6. Délai de rétractation écoulé → validated
    await t.run(async (ctx) => {
      await ctx.db.patch(referralId, { createdAt: Date.now() - 20 * DAY });
    });
    await t.mutation(internal.referrals.validatePendingReferrals, {});
    ref = await t.run((ctx) => ctx.db.get(referralId));
    expect(ref!.status, "après le délai, la vente est validée").toBe("validated");

    // 7. Sans Stripe Connect actif, rien ne devient payable
    await t.mutation(internal.referrals.markValidatedAsPayable, {});
    ref = await t.run((ctx) => ctx.db.get(referralId));
    expect(ref!.status, "pas de Connect actif → pas payable").toBe("validated");

    // 8. Connect actif mais sans SIRET ni facture : toujours pas payable (art. 4.2)
    await t.run((ctx) =>
      ctx.db.patch(affiliateUserId, {
        stripeConnectStatus: "active" as const, stripeConnectAccountId: "acct_test",
      }),
    );
    await t.mutation(internal.referrals.markValidatedAsPayable, {});
    ref = await t.run((ctx) => ctx.db.get(referralId));
    expect(ref!.status, "sans SIRET ni facture → pas payable").toBe("validated");

    // 9. SIRET renseigné + facture de l'apporteur déposée
    await t.run((ctx) => ctx.db.patch(affiliateUserId, { siret: "123 456 789 00012" }));
    const uploadUrl = await asAffiliate.mutation(api.referrals.generateInvoiceUploadUrl, {});
    expect(uploadUrl, "l'apporteur doit obtenir une URL d'upload").toBeTruthy();
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob(["facture pdf"], { type: "application/pdf" })),
    );
    await asAffiliate.mutation(api.referrals.attachReferralInvoice, { referralId, storageId });
    const invoiceUrl = await asAffiliate.query(api.referrals.getReferralInvoiceUrl, { referralId });
    expect(invoiceUrl, "la facture déposée doit être relisible").toBeTruthy();

    await t.mutation(internal.referrals.markValidatedAsPayable, {});
    ref = await t.run((ctx) => ctx.db.get(referralId));
    expect(ref!.status, "Connect + SIRET + facture → payable").toBe("payable");

    // 10. Virement
    await t.mutation(internal.referrals.markPaid, {
      referralId, stripeTransferId: "tr_test",
    });
    ref = await t.run((ctx) => ctx.db.get(referralId));
    expect(ref!.status).toBe("paid");
    expect(ref!.stripeTransferId).toBe("tr_test");

    // 11. Ce que voit l'apporteur
    const stats = await asAffiliate.query(api.referrals.getMyStats, {});
    expect(stats, "le dashboard doit renvoyer des stats").not.toBeNull();
    expect(stats!.totalReferrals, "1 vente attribuée").toBe(1);
    expect(stats!.totalEarned, "500 € de commission acquise").toBe(50000);
    const mine = await asAffiliate.query(api.referrals.getMyReferrals, {});
    expect(mine.length).toBe(1);
  });

  test("art. 3.2 — un client déjà connu ne rouvre pas droit à commission", async () => {
    const t = convexTest(schema, modules);
    const { affiliateUserId } = await seedAffiliate(t, "a2@test.fr");
    const codeId = await t.run((ctx) =>
      ctx.db.insert("referralCodes", {
        affiliateUserId, code: "ADA10", isCustom: false, isActive: true,
        createdAt: Date.now(),
      }),
    );
    await seedOrder(t, "connu@resto.fr");
    const orderId = await seedOrder(t, "connu@resto.fr");
    const referralId = await t.mutation(internal.referrals.createFromCheckout, {
      referrerId: affiliateUserId, referralCodeId: codeId, orderId,
      customerEmail: "connu@resto.fr", commissionCents: 50000,
      discountPercent: 10, discountAmountCents: 25000,
    });
    const ref = await t.run((ctx) => ctx.db.get(referralId));
    expect(ref!.status, "client déjà client → bloqué").toBe("blocked");
  });
});
