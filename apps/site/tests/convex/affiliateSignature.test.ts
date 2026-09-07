/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { makeFunctionReference } from "convex/server";
import { PDFDocument } from "pdf-lib";
import { inflateSync } from "node:zlib";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import { MAX_SIGNATURE_CLOCK_SKEW_MS } from "../../convex/contractSignatures";
import {
  SIGNER_IP_SECRET_ENV,
  SIGNER_IP_SECRET_MIN_LENGTH,
  mintSignerIpAttestation,
} from "../../lib/security/signer-attestation";

const modules = import.meta.glob("../../convex/**/*.ts");

/* ── The signer's IP ──
   `signerIp` used to be a plain argument of the public action: the address
   printed on the signature certificate was whatever the signer sent. What the
   action takes now is an attestation the NEXT server minted over the address it
   observed, and it records only what verifies against the deployment's secret.
   See tests/signer-attestation.test.ts for the crypto and
   lib/security/signer-attestation.ts for why the observation has to cross the
   gap this way. */
const SIGNER_IP_SECRET = "s".repeat(SIGNER_IP_SECRET_MIN_LENGTH);

/** Run `body` on a deployment that holds the shared secret. */
async function withSignerIpSecret<T>(
  secret: string | undefined,
  body: () => Promise<T>,
): Promise<T> {
  const saved = process.env[SIGNER_IP_SECRET_ENV];
  if (secret === undefined) delete process.env[SIGNER_IP_SECRET_ENV];
  else process.env[SIGNER_IP_SECRET_ENV] = secret;
  try {
    return await body();
  } finally {
    if (saved === undefined) delete process.env[SIGNER_IP_SECRET_ENV];
    else process.env[SIGNER_IP_SECRET_ENV] = saved;
  }
}

/** What `/api/signer-ip` hands the page for an address it saw. */
const observedIp = async (ip: string, secret = SIGNER_IP_SECRET) =>
  (await mintSignerIpAttestation(ip, { secret, now: Date.now() }))!;

/**
 * Every text-positioning y-coordinate the document actually emits.
 *
 * pdf-lib Flate-compresses its content streams, so the numbers are not visible
 * in the raw bytes — they have to be inflated first. This is what makes "the
 * SHA-256 hash is still on the page" a measurement rather than an assumption.
 */
function textYCoordinates(pdfBytes: Buffer): { xs: number[]; ys: number[] } {
  const raw = pdfBytes.toString("latin1");
  const xs: number[] = [];
  const ys: number[] = [];
  const re = /stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const start = match.index + match[0].length;
    const end = raw.indexOf("endstream", start);
    if (end === -1) continue;
    let text: string;
    try {
      text = inflateSync(
        Buffer.from(raw.slice(start, end), "latin1"),
      ).toString("latin1");
    } catch {
      continue; // not a Flate stream (a font file, say)
    }
    for (const m of text.matchAll(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm/g)) {
      xs.push(Number(m[1]));
      ys.push(Number(m[2]));
    }
  }
  return { xs, ys };
}


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

    // Audit trail recorded
    const sig = await t.run((ctx) => ctx.db.get(result.signatureId));
    expect(sig).not.toBeNull();
    expect(sig!.status).toBe("signed");
    expect(sig!.signatureMethod).toBe("in_app_ses");
    expect(sig!.signerName).toBe("Jean Dupont");
    expect(sig!.signerUserAgent).toBe("vitest");
    expect(sig!.signedAt).toBeGreaterThan(0);
    expect(sig!.signedDocumentFileId).toBeTruthy();
    expect(sig!.contractVersionId).toBe(contractVersionId);
    // Server-side hash = SHA-256 of the exact content (64 hex chars)
    expect(sig!.contractSnapshotHash).toMatch(/^[0-9a-f]{64}$/);

    // Affiliate activated
    const affiliate = await t.run((ctx) => ctx.db.get(affiliateUserId));
    expect(affiliate!.contractStatus).toBe("active");
    expect(affiliate!.acceptedContractVersionId).toBe(contractVersionId);

    // The signed PDF really is stored, and is not empty
    const pdfSize = await t.run(async (ctx) => {
      const blob = await ctx.storage.get(
        sig!.signedDocumentFileId as Id<"_storage">,
      );
      return blob ? (await blob.arrayBuffer()).byteLength : 0;
    });
    expect(pdfSize).toBeGreaterThan(1000);

    // Downloadable through the dashboard query
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

/**
 * A signer whose name leaves Windows-1252 used to be blocked for ever.
 *
 * The PDF was drawn with `StandardFonts.Helvetica`, which is WinAnsi-only,
 * while `fullName` is free text validated only on length. « Łukasz », « Ayşe »,
 * « Ștefan » and « Nguyễn » each threw inside `drawText` — and because the
 * signature row was committed with `status: "signed"` BEFORE the PDF existed,
 * with no duplicate guard, every retry added another orphan while
 * `activateAfterSignature` never ran. `contractStatus` stayed
 * `pending_contract`, every `/parrainage/dashboard*` page redirected, and no
 * commission could be earned.
 */
describe("affiliateSignature — names outside Windows-1252", () => {
  const NAMES = [
    ["Polish", "Łukasz Kowalski"],
    ["Vietnamese", "Nguyễn Văn An"],
    ["Turkish", "Ayşe Şahin"],
    ["Romanian", "Ștefan Popescu"],
    ["Ukrainian", "Дмитро Коваль"],
    ["French", "Aurélie Lefèvre"],
  ] as const;

  for (const [language, fullName] of NAMES) {
    test(`a ${language} signer completes onboarding`, async () => {
      const t = convexTest(schema, modules);
      const { userId, contractVersionId, affiliateUserId } = await seed(t);
      const asUser = t.withIdentity({ subject: userId });

      const { signatureId } = await asUser.action(
        api.affiliateSignature.signAffiliateContract,
        { fullName, consented: true, userAgent: "vitest" },
      );

      const sig = await t.run((ctx) => ctx.db.get(signatureId));
      expect(sig!.signerName).toBe(fullName);
      expect(sig!.status).toBe("signed");
      expect(sig!.signedDocumentFileId).toBeTruthy();
      expect(sig!.signatureRef).toBeTruthy();

      // The document really exists, and is a PDF rather than an empty blob.
      const pdfSize = await t.run(async (ctx) => {
        const blob = await ctx.storage.get(
          sig!.signedDocumentFileId as Id<"_storage">,
        );
        return blob ? (await blob.arrayBuffer()).byteLength : 0;
      });
      expect(pdfSize).toBeGreaterThan(1000);

      // And onboarding is actually unblocked, which is the point.
      const affiliate = await t.run((ctx) => ctx.db.get(affiliateUserId));
      expect(affiliate!.contractStatus).toBe("active");
      expect(affiliate!.acceptedContractVersionId).toBe(contractVersionId);
    });
  }

  test("a name the embedded faces cannot draw still signs", async () => {
    // CJK is outside the subset, so the glyphs render as `.notdef`. That must
    // degrade the document, never block the signature: the row holds the exact
    // string, and the certificate carries the Unicode escapes beside it.
    const t = convexTest(schema, modules);
    const { userId, affiliateUserId } = await seed(t);

    const { signatureId } = await t
      .withIdentity({ subject: userId })
      .action(api.affiliateSignature.signAffiliateContract, {
        fullName: "山田 太郎",
        consented: true,
      });

    const sig = await t.run((ctx) => ctx.db.get(signatureId));
    expect(sig!.signerName).toBe("山田 太郎");
    expect(sig!.signedDocumentFileId).toBeTruthy();
    const affiliate = await t.run((ctx) => ctx.db.get(affiliateUserId));
    expect(affiliate!.contractStatus).toBe("active");
  });
});

describe("affiliateSignature — no row without a document", () => {
  test("signing twice returns the signature already on file", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seed(t);
    const asUser = t.withIdentity({ subject: userId });

    const first = await asUser.action(
      api.affiliateSignature.signAffiliateContract,
      { fullName: "Łukasz Kowalski", consented: true },
    );
    const second = await asUser.action(
      api.affiliateSignature.signAffiliateContract,
      { fullName: "Łukasz Kowalski", consented: true },
    );
    const third = await asUser.action(
      api.affiliateSignature.signAffiliateContract,
      { fullName: "Quelqu'un D'autre", consented: true },
    );

    expect(second.signatureId).toBe(first.signatureId);
    expect(third.signatureId).toBe(first.signatureId);

    const rows = await t.run((ctx) =>
      ctx.db.query("contractSignatures").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.signerName).toBe("Łukasz Kowalski");
  });

  test("every signed row carries its document", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seed(t);
    const asUser = t.withIdentity({ subject: userId });

    for (const fullName of ["Łukasz Kowalski", "Nguyễn Văn An", "山田 太郎"]) {
      await asUser
        .action(api.affiliateSignature.signAffiliateContract, {
          fullName,
          consented: true,
        })
        .catch(() => undefined);
    }

    const rows = await t.run((ctx) =>
      ctx.db.query("contractSignatures").collect(),
    );
    const signed = rows.filter((r) => r.status === "signed");
    expect(signed).toHaveLength(rows.length);
    for (const row of signed) {
      expect(row.signedDocumentFileId).toBeTruthy();
    }
  });

  test("legacy orphans do not hide the real signature", async () => {
    // A deployment that ran the old ordering already carries one orphan per
    // failed attempt: `status: "signed"`, no document, sorting ahead of
    // everything. A fixed-size window would be filled by them, and the
    // affiliate would sign again — or lose access to their own contract.
    const t = convexTest(schema, modules);
    const { userId, contractVersionId, affiliateUserId } = await seed(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < 25; i++) {
        await ctx.db.insert("contractSignatures", {
          affiliateUserId,
          contractVersionId,
          status: "signed" as const,
          contractSnapshotContent: CONTRACT_CONTENT,
          contractSnapshotHash: "orphan",
          signerName: "Łukasz Kowalski",
          signatureMethod: "in_app_ses" as const,
          signedAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    });

    const asUser = t.withIdentity({ subject: userId });
    const first = await asUser.action(
      api.affiliateSignature.signAffiliateContract,
      { fullName: "Łukasz Kowalski", consented: true },
    );
    const second = await asUser.action(
      api.affiliateSignature.signAffiliateContract,
      { fullName: "Łukasz Kowalski", consented: true },
    );

    expect(second.signatureId).toBe(first.signatureId);
    const rows = await t.run((ctx) =>
      ctx.db.query("contractSignatures").collect(),
    );
    expect(rows.filter((r) => r.signedDocumentFileId)).toHaveLength(1);

    // And the affiliate can still reach their own signed contract.
    const dl = await asUser.query(
      api.contractSignatures.getSignedContractUrl,
      {},
    );
    expect(dl?.url).toBeTruthy();
  });

  test("the repair marks old orphans failed and leaves real signatures alone", async () => {
    const t = convexTest(schema, modules);
    const { userId, contractVersionId, affiliateUserId } = await seed(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("contractSignatures", {
          affiliateUserId,
          contractVersionId,
          status: "signed" as const,
          contractSnapshotContent: CONTRACT_CONTENT,
          contractSnapshotHash: "orphan",
          signerName: "Łukasz Kowalski",
          signatureMethod: "in_app_ses" as const,
          signedAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    });
    const real = await t
      .withIdentity({ subject: userId })
      .action(api.affiliateSignature.signAffiliateContract, {
        fullName: "Łukasz Kowalski",
        consented: true,
      });

    const first = await t.mutation(
      internal.migrations.markOrphanSignaturesFailed,
      {},
    );
    expect(first.marked).toBe(3);

    const rows = await t.run((ctx) =>
      ctx.db.query("contractSignatures").collect(),
    );
    expect(rows.filter((r) => r.status === "failed")).toHaveLength(3);
    const signed = rows.filter((r) => r.status === "signed");
    expect(signed).toHaveLength(1);
    expect(signed[0]!._id).toBe(real.signatureId);

    // Idempotent: nothing left to mark on a second run.
    const second = await t.mutation(
      internal.migrations.markOrphanSignaturesFailed,
      {},
    );
    expect(second.marked).toBe(0);
  });

  test("the audit fields survive a hostile name", async () => {
    // The certificate rows used to be drawn with no page break while the name
    // was capped only at a MINIMUM of three characters. A long enough one
    // pushed the email, the timestamp, the consent line, the contract version,
    // the SHA-256 hash, the signature reference and the eIDAS note below y=0 —
    // invisible in the produced document. The name is capped now AND the page
    // breaks; this checks both, by reading the text back out of the PDF.
    const t = convexTest(schema, modules);
    const { userId } = await seed(t);
    const asUser = t.withIdentity({ subject: userId });

    // Past the cap: refused, rather than silently mangled.
    await expect(
      asUser.action(api.affiliateSignature.signAffiliateContract, {
        fullName: "Łukasz ".repeat(1_000).trim(),
        consented: true,
      }),
    ).rejects.toThrow(/dépasse/);

    // At the cap: accepted, and every audit field still lands on a page.
    const longButLegal = `Łukasz ${"Kowalski ".repeat(12)}`.slice(0, 118).trim();
    const { signatureId } = await withSignerIpSecret(SIGNER_IP_SECRET, async () =>
      asUser.action(api.affiliateSignature.signAffiliateContract, {
        fullName: longButLegal,
        consented: true,
        userAgent: "Mozilla ".repeat(20),
        signerIpAttestation: await observedIp("203.0.113.42"),
      }),
    );

    const sig = await t.run((ctx) => ctx.db.get(signatureId));
    // `t.run` may only return a Convex value, so the bytes come back as a
    // latin1 string and are turned into a buffer on this side.
    const raw = await t.run(async (ctx) => {
      const blob = await ctx.storage.get(
        sig!.signedDocumentFileId as Id<"_storage">,
      );
      return Buffer.from(await blob!.arrayBuffer()).toString("latin1");
    });
    const pdf = await PDFDocument.load(Buffer.from(raw, "latin1"));
    // Every Tm y-coordinate the document emits must be on the page. This is
    // the regression: the audit rows used to be drawn below y=0.
    const { ys } = textYCoordinates(Buffer.from(raw, "latin1"));
    expect(ys.length).toBeGreaterThan(0);
    expect(Math.min(...ys)).toBeGreaterThan(0);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(sig!.signatureRef).toBeTruthy();
    expect(sig!.contractSnapshotHash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("the certificate takes another page rather than running off one", async () => {
    // The cap on `fullName` keeps an ordinary certificate to one page, so the
    // page break needs a field the action does not control to exercise it: the
    // signer's email comes from the `users` row, not from an argument.
    const t = convexTest(schema, modules);
    const { userId } = await seed(t);
    await t.run((ctx) =>
      ctx.db.patch(userId, { email: `${"a".repeat(6_000)}@exemple.fr` }),
    );

    const { signatureId } = await t
      .withIdentity({ subject: userId })
      .action(api.affiliateSignature.signAffiliateContract, {
        fullName: "Łukasz Kowalski",
        consented: true,
      });

    const sig = await t.run((ctx) => ctx.db.get(signatureId));
    const raw = await t.run(async (ctx) => {
      const blob = await ctx.storage.get(
        sig!.signedDocumentFileId as Id<"_storage">,
      );
      return Buffer.from(await blob!.arrayBuffer()).toString("latin1");
    });

    const pdf = await PDFDocument.load(Buffer.from(raw, "latin1"));
    const { ys } = textYCoordinates(Buffer.from(raw, "latin1"));
    // More pages than contract + certificate: the certificate itself spilled.
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(3);
    // And still nothing below the bottom margin.
    expect(Math.min(...ys)).toBeGreaterThan(0);
  });

  test("a name with no space in it is broken, not run off the page", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seed(t);
    const { signatureId } = await t
      .withIdentity({ subject: userId })
      .action(api.affiliateSignature.signAffiliateContract, {
        fullName: "Ł".repeat(110),
        consented: true,
      });

    const sig = await t.run((ctx) => ctx.db.get(signatureId));
    const raw = await t.run(async (ctx) => {
      const blob = await ctx.storage.get(
        sig!.signedDocumentFileId as Id<"_storage">,
      );
      return Buffer.from(await blob!.arrayBuffer()).toString("latin1");
    });
    // Compare against the same document with a short name: the unbroken token
    // has to occupy MORE drawn lines. Asserting an x-coordinate would not do
    // it — every line starts at one of two fixed columns, so that assertion is
    // true whether or not the text runs off the edge.
    const shortRaw = await (async () => {
      const t2 = convexTest(schema, modules);
      const seeded = await seed(t2);
      const { signatureId: id2 } = await t2
        .withIdentity({ subject: seeded.userId })
        .action(api.affiliateSignature.signAffiliateContract, {
          fullName: "Jan Kowalski",
          consented: true,
        });
      const sig2 = await t2.run((ctx) => ctx.db.get(id2));
      return await t2.run(async (ctx) => {
        const blob = await ctx.storage.get(
          sig2!.signedDocumentFileId as Id<"_storage">,
        );
        return Buffer.from(await blob!.arrayBuffer()).toString("latin1");
      });
    })();

    const long = textYCoordinates(Buffer.from(raw, "latin1"));
    const short = textYCoordinates(Buffer.from(shortRaw, "latin1"));
    expect(long.ys.length).toBeGreaterThan(short.ys.length);
    expect(Math.min(...long.ys)).toBeGreaterThan(0);
    expect(sig!.signerName).toBe("Ł".repeat(110));
  });

  test("no public mutation can forge a contract snapshot", async () => {
    // `createSignatureRequest` was public, reachable by any signed-in account,
    // and inserted a row from caller-supplied `contractSnapshotContent` and
    // `contractSnapshotHash` with no document — arbitrary text stored as the
    // contract somebody signed, in the table the eIDAS claim rests on.
    const t = convexTest(schema, modules);
    const { userId, contractVersionId } = await seed(t);

    await expect(
      t.withIdentity({ subject: userId }).mutation(
        makeFunctionReference<"mutation">(
          "contractSignatures:createSignatureRequest",
        ),
        {
          contractVersionId,
          contractSnapshotContent: "Le signataire renonce à sa commission.",
          contractSnapshotHash: "deadbeef",
        },
      ),
    ).rejects.toThrow(/no such export/i);

    expect(
      await t.run((ctx) => ctx.db.query("contractSignatures").collect()),
    ).toEqual([]);
  });

  test("a refusal writes nothing at all", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seed(t);
    const asUser = t.withIdentity({ subject: userId });

    await expect(
      asUser.action(api.affiliateSignature.signAffiliateContract, {
        fullName: "Łukasz Kowalski",
        consented: false,
      }),
    ).rejects.toThrow();

    expect(
      await t.run((ctx) => ctx.db.query("contractSignatures").collect()),
    ).toEqual([]);
  });
});

/**
 * The two audit values that used to come from whoever asked.
 *
 * Measured before the fix, as any signed-in account holding an affiliate
 * profile (`affiliateUsers.createAfterSignup` is public, so that is anyone):
 *
 *     signAffiliateContract({ …, signerIp: "8.8.8.8" })
 *       -> contractSignatures.signerIp === "8.8.8.8"
 *     contractSignatures.updateStatus({ signatureId, status: "signed",
 *                                       signedAt: 0, signerIp: "8.8.8.8" })
 *       -> the row is backdated to 1 January 1970, from another address
 *
 * Both rows sit on the « certificat de signature » page beside the SHA-256
 * digest and the authenticated account — the parts that ARE evidence. A trail
 * whose timestamp and location are set by the party it is evidence against
 * proves nothing, and reads exactly like one that does.
 */
describe("affiliateSignature — a record the signer cannot write", () => {
  test("a signed record carries the address the server observed", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seed(t);
    const asUser = t.withIdentity({ subject: userId });

    const before = Date.now();
    const { signatureId } = await withSignerIpSecret(SIGNER_IP_SECRET, async () =>
      asUser.action(api.affiliateSignature.signAffiliateContract, {
        fullName: "Jean Dupont",
        consented: true,
        signerIpAttestation: await observedIp("203.0.113.42"),
      }),
    );

    const sig = await t.run((ctx) => ctx.db.get(signatureId));
    expect(sig!.signerIp).toBe("203.0.113.42");
    // And the timestamp is the server's own clock, taken during this call.
    expect(sig!.signedAt).toBeGreaterThanOrEqual(before);
    expect(sig!.signedAt).toBeLessThanOrEqual(Date.now());
  });

  test("an address the caller made up is recorded as no address", async () => {
    // The forgery this whole mechanism exists for: a well-formed attestation
    // whose IP was swapped after minting. The signature still completes — the
    // account, the consent, the timestamp and the digest are what it rests on —
    // and the certificate says « non établie » rather than naming Google's DNS.
    const t = convexTest(schema, modules);
    const { userId } = await seed(t);
    const asUser = t.withIdentity({ subject: userId });

    const honest = await observedIp("203.0.113.42");
    const { signatureId } = await withSignerIpSecret(SIGNER_IP_SECRET, async () =>
      asUser.action(api.affiliateSignature.signAffiliateContract, {
        fullName: "Jean Dupont",
        consented: true,
        signerIpAttestation: { ...honest, ip: "8.8.8.8" },
      }),
    );

    const sig = await t.run((ctx) => ctx.db.get(signatureId));
    expect(sig!.signerIp).toBeUndefined();
    expect(sig!.status).toBe("signed");
    expect(sig!.signedDocumentFileId).toBeTruthy();
  });

  test("an attestation minted under another secret is refused too", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seed(t);
    const asUser = t.withIdentity({ subject: userId });

    const elsewhere = await observedIp("203.0.113.42", "z".repeat(64));
    const { signatureId } = await withSignerIpSecret(SIGNER_IP_SECRET, async () =>
      asUser.action(api.affiliateSignature.signAffiliateContract, {
        fullName: "Jean Dupont",
        consented: true,
        signerIpAttestation: elsewhere,
      }),
    );

    expect((await t.run((ctx) => ctx.db.get(signatureId)))!.signerIp).toBeUndefined();
  });

  test("with no secret on the deployment, no address is recorded and signing still works", async () => {
    // Fail-closed and non-blocking: a missing env var must not be an onboarding
    // outage, and must not be a reason to record an unverified address either.
    const t = convexTest(schema, modules);
    const { userId, affiliateUserId } = await seed(t);
    const asUser = t.withIdentity({ subject: userId });

    const { signatureId } = await withSignerIpSecret(undefined, async () =>
      asUser.action(api.affiliateSignature.signAffiliateContract, {
        fullName: "Jean Dupont",
        consented: true,
        signerIpAttestation: await observedIp("203.0.113.42"),
      }),
    );

    const sig = await t.run((ctx) => ctx.db.get(signatureId));
    expect(sig!.signerIp).toBeUndefined();
    expect(sig!.status).toBe("signed");
    expect(
      (await t.run((ctx) => ctx.db.get(affiliateUserId)))!.contractStatus,
    ).toBe("active");
  });

  test("the action no longer accepts a bare `signerIp`", async () => {
    // Removed rather than ignored: Convex refuses an unknown argument, so a
    // stale bundle still sending one fails loudly instead of being quietly
    // overruled — the same rule `createCheckoutSession` follows for the
    // referral percent it used to bill.
    const t = convexTest(schema, modules);
    const { userId } = await seed(t);

    await expect(
      t.withIdentity({ subject: userId }).action(
        makeFunctionReference<"action">(
          "affiliateSignature:signAffiliateContract",
        ),
        { fullName: "Jean Dupont", consented: true, signerIp: "8.8.8.8" },
      ),
    ).rejects.toThrow(/signerIp/);

    expect(
      await t.run((ctx) => ctx.db.query("contractSignatures").collect()),
    ).toEqual([]);
  });

  test("no internal mutation can backdate or relocate a signature", async () => {
    // `contractSignatures.updateStatus` patched a caller's `signedAt` and
    // `signerIp` straight onto the row, and could set `status: "signed"` with no
    // document. It was the Yousign webhook's writer and outlived that flow with
    // no caller at all.
    const t = convexTest(schema, modules);
    const { userId } = await seed(t);
    const asUser = t.withIdentity({ subject: userId });

    const { signatureId } = await asUser.action(
      api.affiliateSignature.signAffiliateContract,
      { fullName: "Jean Dupont", consented: true },
    );
    const signedAt = (await t.run((ctx) => ctx.db.get(signatureId)))!.signedAt;

    await expect(
      t.mutation(
        makeFunctionReference<"mutation">("contractSignatures:updateStatus"),
        {
          signatureId,
          status: "signed",
          signedAt: 0,
          signerIp: "8.8.8.8",
        },
      ),
    ).rejects.toThrow(/no such export/i);

    const sig = await t.run((ctx) => ctx.db.get(signatureId));
    expect(sig!.signedAt).toBe(signedAt);
    expect(sig!.signerIp).toBeUndefined();
  });

  test("the writer that remains refuses a timestamp that is not the server's", async () => {
    // `recordInAppSignature` still takes `signedAt`, because the certificate is
    // drawn before the transaction and both have to print the same instant. It
    // is internal — no client reaches it — and this is what keeps "it is the
    // server's clock" enforced rather than merely conventional.
    const t = convexTest(schema, modules);
    const { contractVersionId, affiliateUserId } = await seed(t);

    const write = (signedAt: number) =>
      t.mutation(internal.contractSignatures.recordInAppSignature, {
        affiliateUserId,
        contractVersionId,
        contractSnapshotContent: CONTRACT_CONTENT,
        contractSnapshotHash: "0".repeat(64),
        signerName: "Jean Dupont",
        signatureRef: "ref",
        signedDocumentFileId: "kg2fake",
        signedAt,
      });

    await expect(write(0)).rejects.toThrow(/[Hh]orodatage/);
    await expect(
      write(Date.now() + MAX_SIGNATURE_CLOCK_SKEW_MS + 60_000),
    ).rejects.toThrow(/[Hh]orodatage/);
    expect(
      await t.run((ctx) => ctx.db.query("contractSignatures").collect()),
    ).toEqual([]);

    await expect(write(Date.now())).resolves.toBeDefined();
  });
});

/**
 * Onboarding ends with a code, or it has not ended.
 *
 * `referralCodes.assertMayHoldACode` refuses to mint for an affiliate who has
 * not signed — correctly, since a code an unsigned affiliate can publish is a
 * discount and a commission with no contract behind either. But the mint was
 * still happening at SIGNUP: `/parrainage/inscription` called `generateMyCode`
 * between `createAfterSignup` and the redirect to the contract page, while the
 * affiliate is `pending_contract`. So the call could only throw — into a
 * `catch` that redirected anyway. Walking the real flow measured it:
 *
 *     createAfterSignup       contractStatus=pending_contract
 *     generateMyCode          throws « Signez le contrat… »
 *     signAffiliateContract   contractStatus=active
 *     getMyCode               null
 *     referralCodes rows      0
 *
 * Signed, activated, and holding nothing — with no button anywhere in the
 * dashboard that creates one. The mint moved to the signature, which is where
 * entitlement to a code begins, and these cases hold it there.
 */
describe("affiliateSignature — signing mints the referral code", () => {
  test("the whole onboarding walk ends with a usable code", async () => {
    const t = convexTest(schema, modules);
    const { userId, affiliateUserId } = await seed(t);
    const asUser = t.withIdentity({ subject: userId });

    // Signup mints nothing: this is the call the page used to make, and it is
    // refused for exactly the reason it should be.
    await expect(
      asUser.mutation(api.referralCodes.generateMyCode, {}),
    ).rejects.toThrow(/contrat/i);
    expect(await t.run((ctx) => ctx.db.query("referralCodes").collect())).toEqual(
      [],
    );

    await asUser.action(api.affiliateSignature.signAffiliateContract, {
      fullName: "Jean Dupont",
      consented: true,
    });

    const affiliate = await t.run((ctx) => ctx.db.get(affiliateUserId));
    expect(affiliate!.contractStatus).toBe("active");

    // What the dashboard reads — the assertion that failed before the fix.
    const mine = await asUser.query(api.referralCodes.getMyCode, {});
    expect(mine).not.toBeNull();
    expect(mine!.code).toMatch(/^BID-[A-Z2-9]{5}$/);
    expect(mine!.affiliateUserId).toBe(affiliateUserId);
    expect(mine!.isActive).toBe(true);
  });

  test("the code is minted with the activation, not beside it", async () => {
    /* A signature that does not activate — the affiliate signed a version they
       are not the one required to sign — mints nothing either. The code and
       the activation are one decision. */
    const t = convexTest(schema, modules);
    const { userId, affiliateUserId } = await seed(t);

    await t.run(async (ctx) => {
      const other = await ctx.db.insert("contractVersions", {
        version: "0.9",
        title: "Contrat apporteur d'affaires",
        content: CONTRACT_CONTENT,
        contentHash: "seedhash-old",
        status: "archived" as const,
        createdAt: Date.now(),
      });
      await ctx.db.patch(affiliateUserId, { requiredContractVersionId: other });
    });

    await t
      .withIdentity({ subject: userId })
      .action(api.affiliateSignature.signAffiliateContract, {
        fullName: "Jean Dupont",
        consented: true,
      });

    const affiliate = await t.run((ctx) => ctx.db.get(affiliateUserId));
    expect(affiliate!.contractStatus).toBe("pending_contract");
    expect(affiliate!.acceptedContractVersionId).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.query("referralCodes").collect())).toEqual(
      [],
    );
  });

  test("signing twice does not mint a second code", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seed(t);
    const asUser = t.withIdentity({ subject: userId });

    await asUser.action(api.affiliateSignature.signAffiliateContract, {
      fullName: "Jean Dupont",
      consented: true,
    });
    await asUser.action(api.affiliateSignature.signAffiliateContract, {
      fullName: "Jean Dupont",
      consented: true,
    });

    expect(
      await t.run((ctx) => ctx.db.query("referralCodes").collect()),
    ).toHaveLength(1);
  });

  test("re-signing a superseded version keeps the code already published", async () => {
    /* `contractVersions.activate` moves every active affiliate to
       `blocked_new_version` and they sign again. A custom code they have been
       handing out for months must survive that untouched. */
    const t = convexTest(schema, modules);
    const { userId, affiliateUserId, contractVersionId } = await seed(t);
    const asUser = t.withIdentity({ subject: userId });

    await asUser.action(api.affiliateSignature.signAffiliateContract, {
      fullName: "Jean Dupont",
      consented: true,
    });
    const custom = await asUser.mutation(api.referralCodes.customizeMyCode, {
      code: "GIULIA",
    });

    const v2 = await t.run(async (ctx) => {
      await ctx.db.patch(contractVersionId, { status: "archived" as const });
      const id = await ctx.db.insert("contractVersions", {
        version: "2.0",
        title: "Contrat apporteur d'affaires",
        content: CONTRACT_CONTENT + "\nArticle 3 — Nouveau",
        contentHash: "seedhash2",
        status: "active" as const,
        createdAt: Date.now(),
        activatedAt: Date.now(),
      });
      await ctx.db.patch(affiliateUserId, {
        contractStatus: "blocked_new_version" as const,
        requiredContractVersionId: id,
      });
      return id;
    });

    await asUser.action(api.affiliateSignature.signAffiliateContract, {
      fullName: "Jean Dupont",
      consented: true,
    });

    const affiliate = await t.run((ctx) => ctx.db.get(affiliateUserId));
    expect(affiliate!.contractStatus).toBe("active");
    expect(affiliate!.acceptedContractVersionId).toBe(v2);

    const active = await asUser.query(api.referralCodes.getMyCode, {});
    expect(active!._id).toBe(custom!._id);
    expect(active!.code).toBe("GIULIA");
  });

  test("`generateMyCode` still recovers an affiliate left without one", async () => {
    /* The dashboard's « Générer mon code ». It covers the affiliates who
       onboarded while the mint was still attempted at signup — signed,
       activated, holding nothing — for whom the page previously drew an empty
       code chip and offered no way out. */
    const t = convexTest(schema, modules);
    const { userId, affiliateUserId } = await seed(t);
    const asUser = t.withIdentity({ subject: userId });

    await asUser.action(api.affiliateSignature.signAffiliateContract, {
      fullName: "Jean Dupont",
      consented: true,
    });

    // Put them back in the state that onboarding used to leave behind.
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("referralCodes").collect()) {
        await ctx.db.delete(row._id);
      }
    });
    expect(await asUser.query(api.referralCodes.getMyCode, {})).toBeNull();

    const minted = await asUser.mutation(api.referralCodes.generateMyCode, {});
    expect(minted?.code).toMatch(/^BID-[A-Z2-9]{5}$/);
    expect(minted?.affiliateUserId).toBe(affiliateUserId);

    // And it is idempotent: pressing twice does not mint a second.
    await asUser.mutation(api.referralCodes.generateMyCode, {});
    expect(
      await t.run((ctx) => ctx.db.query("referralCodes").collect()),
    ).toHaveLength(1);
  });
});
