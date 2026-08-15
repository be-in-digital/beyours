/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");

const CONTRACT_CONTENT =
  "CONTRAT D'APPORTEUR D'AFFAIRES\n\n" +
  "Article 1 — Objet\nLe présent contrat définit les conditions du mandat.\n\n" +
  "Article 2 — Commission\n500 € par client signé, versée sous 14 jours.\n";

async function seed(t: ReturnType<typeof convexTest>) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "jean@test.com" }),
  );
  const contractVersionId = await t.run((ctx) =>
    ctx.db.insert("contractVersions", {
      version: "1.0",
      title: "Contrat apporteur d'affaires",
      content: CONTRACT_CONTENT,
      contentHash: "seedhash",
      status: "active" as const,
      createdAt: Date.now(),
      activatedAt: Date.now(),
    }),
  );
  const affiliateUserId = await t.run((ctx) =>
    ctx.db.insert("affiliateUsers", {
      userId,
      role: "affiliate" as const,
      status: "active" as const,
      contractStatus: "pending_contract" as const,
      requiredContractVersionId: contractVersionId,
      stripeConnectStatus: "not_started" as const,
      createdAt: Date.now(),
    }),
  );
  return { userId, contractVersionId, affiliateUserId };
}

describe("affiliateSignature — signature électronique simple (SES) in-house", () => {
  test("signe, génère + stocke le PDF, et active l'apporteur", async () => {
    const t = convexTest(schema, modules);
    const { userId, contractVersionId, affiliateUserId } = await seed(t);

    const asUser = t.withIdentity({ subject: userId });
    const result = await asUser.action(
      api.affiliateSignature.signAffiliateContract,
      { fullName: "Jean Dupont", consented: true, userAgent: "vitest" },
    );
    expect(result.signatureId).toBeDefined();

    // Piste d'audit enregistrée
    const sig = await t.run((ctx) => ctx.db.get(result.signatureId));
    expect(sig).not.toBeNull();
    expect(sig!.status).toBe("signed");
    expect(sig!.signatureMethod).toBe("in_app_ses");
    expect(sig!.signerName).toBe("Jean Dupont");
    expect(sig!.signerUserAgent).toBe("vitest");
    expect(sig!.signedAt).toBeGreaterThan(0);
    expect(sig!.signedDocumentFileId).toBeTruthy();
    expect(sig!.contractVersionId).toBe(contractVersionId);
    // Hash serveur = SHA-256 du contenu exact (64 hex)
    expect(sig!.contractSnapshotHash).toMatch(/^[0-9a-f]{64}$/);

    // Apporteur activé
    const affiliate = await t.run((ctx) => ctx.db.get(affiliateUserId));
    expect(affiliate!.contractStatus).toBe("active");
    expect(affiliate!.acceptedContractVersionId).toBe(contractVersionId);

    // PDF signé réellement stocké et non vide
    const pdfSize = await t.run(async (ctx) => {
      const blob = await ctx.storage.get(
        sig!.signedDocumentFileId as Id<"_storage">,
      );
      return blob ? (await blob.arrayBuffer()).byteLength : 0;
    });
    expect(pdfSize).toBeGreaterThan(1000);

    // Téléchargeable via la query dashboard
    const dl = await asUser.query(
      api.contractSignatures.getSignedContractUrl,
      {},
    );
    expect(dl?.url).toBeTruthy();
  });

  test("refuse la signature sans consentement", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seed(t);
    const asUser = t.withIdentity({ subject: userId });
    await expect(
      asUser.action(api.affiliateSignature.signAffiliateContract, {
        fullName: "Jean Dupont",
        consented: false,
      }),
    ).rejects.toThrow(/consentement/i);
  });

  test("refuse la signature sans nom complet", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seed(t);
    const asUser = t.withIdentity({ subject: userId });
    await expect(
      asUser.action(api.affiliateSignature.signAffiliateContract, {
        fullName: "Jo",
        consented: true,
      }),
    ).rejects.toThrow(/nom complet/i);
  });
});
