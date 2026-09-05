"use node";

/**
 * In-house simple electronic signature (SES) — affiliates.
 *
 * An alternative to Yousign: signing happens inside the app, with no third-party
 * provider. Legal level = SIMPLE electronic signature (eIDAS art. 25, admissible;
 * the burden of proof lies with Be in Digital). Suitable for a low-stakes B2B
 * affiliate mandate.
 *
 * Audit trail kept:
 *  - identity: authenticated affiliate account (email + password)
 *  - explicit consent + the name typed by the signatory
 *  - server-side timestamp
 *  - SHA-256 digest of the exact signed content (integrity)
 *  - signed PDF + « certificat de signature » page stored (Convex storage)
 *
 * Yousign was removed (subscription expired, unused); should we ever move to an
 * ADVANCED/QUALIFIED signature, bring a qualified provider back in.
 *
 * TWO PROPERTIES THIS FILE HAS TO HOLD, both learned the hard way.
 *
 * 1. EVERY NAME SIGNS. The PDF used to be drawn with `StandardFonts.Helvetica`,
 *    which encodes Windows-1252 and nothing else, while `fullName` is free text
 *    checked only for length. « Łukasz », « Ayşe », « Ștefan » and « Nguyễn »
 *    each made `drawText` throw, so no document was ever produced: the affiliate
 *    stayed `pending_contract`, every `/parrainage/dashboard*` page redirected,
 *    and no commission could be earned. A Polish, Turkish, Romanian or
 *    Vietnamese name was a permanent block on onboarding. The faces in
 *    ./fonts are embedded for that reason.
 *
 * 2. NO ROW WITHOUT A DOCUMENT. An action is not a transaction. The signature
 *    row used to be committed with `status: "signed"` BEFORE the PDF existed,
 *    with no duplicate guard, so each failed attempt left another signed-looking
 *    row carrying no document — corrupting the very audit trail the eIDAS art.
 *    25 claim above rests on. The document is now produced and stored first, and
 *    a single mutation writes the row, attaches the file and activates the
 *    affiliate together. A failure before that point leaves nothing behind; a
 *    retry after it returns the signature already on file.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createHash, randomUUID } from "crypto";
import type { Id } from "./_generated/dataModel";
import {
  DEJA_VU_SANS_BOLD_BASE64,
  DEJA_VU_SANS_REGULAR_BASE64,
  decodeFontBase64,
  escapeCodePoints,
  unrepresentableCodePoints,
} from "./fonts";

const A4 = { w: 595, h: 842 };
const MARGIN = 50;

/**
 * Register fontkit on `pdf` and embed the two Unicode faces.
 *
 * Lives in this module rather than ./fonts because fontkit is Node-only and
 * this file is the `"use node"` one. `subset: true` keeps only the glyphs the
 * document actually draws, so the signed contract stays roughly the size it was
 * under Helvetica.
 */
async function embedUnicodeFonts(
  pdf: PDFDocument,
): Promise<{ regular: PDFFont; bold: PDFFont }> {
  pdf.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all([
    pdf.embedFont(decodeFontBase64(DEJA_VU_SANS_REGULAR_BASE64), {
      subset: true,
    }),
    pdf.embedFont(decodeFontBase64(DEJA_VU_SANS_BOLD_BASE64), { subset: true }),
  ]);
  return { regular, bold };
}

function wrap(
  text: string,
  font: import("pdf-lib").PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(" ")) {
    const test = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(test, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

async function generateSignedContractPdf(opts: {
  content: string;
  title: string;
  version: string;
  signerName: string;
  signerEmail: string;
  signedAt: number;
  contentHash: string;
  signatureRef: string;
  userAgent?: string | undefined;
  signerIp?: string | undefined;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  /* Not `StandardFonts.Helvetica`: it is WinAnsi-only, and a signatory's name is
     free text. See ./fonts, and property 1 in this file's header. */
  const { regular: font, bold } = await embedUnicodeFonts(pdf);

  const size = 9;
  const lh = size * 1.4;
  const maxW = A4.w - MARGIN * 2;
  const ink = rgb(0.1, 0.1, 0.1);
  const grey = rgb(0.45, 0.45, 0.45);

  let page = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN;

  page.drawText("CONTRAT D'APPORTEUR D'AFFAIRES", {
    x: MARGIN,
    y,
    size: 14,
    font: bold,
    color: ink,
  });
  y -= 26;
  page.drawText(`${opts.title} — version ${opts.version}`, {
    x: MARGIN,
    y,
    size: 10,
    font,
    color: grey,
  });
  y -= 22;

  // Contract body (word-wrapped, spans several pages)
  for (const raw of opts.content.split("\n")) {
    const isBold =
      raw.startsWith("Article ") ||
      raw.startsWith("CONTRAT ") ||
      /^\d+\.\d+/.test(raw);
    const f = isBold ? bold : font;
    if (raw.trim() === "" || raw.trim() === "---") {
      y -= lh * 0.5;
      continue;
    }
    for (const line of wrap(raw, f, size, maxW)) {
      if (y < MARGIN + 30) {
        page = pdf.addPage([A4.w, A4.h]);
        y = A4.h - MARGIN;
      }
      page.drawText(line, { x: MARGIN, y, size, font: f, color: ink });
      y -= lh;
    }
  }

  // ── Signature certificate page ──
  const cert = pdf.addPage([A4.w, A4.h]);
  let cy = A4.h - MARGIN;
  cert.drawText("CERTIFICAT DE SIGNATURE ÉLECTRONIQUE", {
    x: MARGIN,
    y: cy,
    size: 13,
    font: bold,
    color: ink,
  });
  cy -= 20;
  cert.drawText(
    "Signature électronique simple, horodatée et journalisée (eIDAS art. 25).",
    { x: MARGIN, y: cy, size: 9, font, color: grey },
  );
  cy -= 24;
  cert.drawLine({
    start: { x: MARGIN, y: cy },
    end: { x: A4.w - MARGIN, y: cy },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  cy -= 24;

  const rows: [string, string][] = [
    ["Signataire", opts.signerName],
    /* The embedded subsets cover Latin, Greek and Cyrillic. A name outside them
       — CJK, Arabic — draws as `.notdef` boxes rather than throwing, so the
       exact string is repeated here as Unicode escapes: the certificate stays
       readable evidence of who signed even when the glyphs are not. */
    ...(unrepresentableCodePoints(opts.signerName).length > 0
      ? ([
          ["Signataire (Unicode)", escapeCodePoints(opts.signerName)],
        ] as [string, string][])
      : []),
    ["Email (compte authentifié)", opts.signerEmail],
    ["Date et heure (UTC)", new Date(opts.signedAt).toISOString()],
    ["Consentement", "Accepté explicitement avant signature"],
    ["Contrat", `${opts.title} — version ${opts.version}`],
    ["Empreinte SHA-256 du contenu", opts.contentHash],
    ["Référence de signature", opts.signatureRef],
    ["Navigateur déclaré", opts.userAgent ?? "—"],
    ["Adresse IP déclarée", opts.signerIp ?? "—"],
  ];
  for (const [label, value] of rows) {
    cert.drawText(`${label} :`, {
      x: MARGIN,
      y: cy,
      size: 9,
      font: bold,
      color: ink,
    });
    for (const line of wrap(value, font, 9, maxW - 190)) {
      cert.drawText(line, { x: MARGIN + 190, y: cy, size: 9, font, color: ink });
      cy -= 13;
    }
    cy -= 4;
  }

  cy -= 12;
  const note =
    "L'identité du signataire est établie par l'authentification à son compte apporteur " +
    "(email + mot de passe). L'intégrité du contrat est garantie par l'empreinte SHA-256 " +
    "ci-dessus : toute modification ultérieure du contenu invaliderait cette empreinte. " +
    "Ce certificat et le contrat forment un tout indissociable, conservé par Be in Digital.";
  for (const line of wrap(note, font, 8, maxW)) {
    cert.drawText(line, { x: MARGIN, y: cy, size: 8, font, color: grey });
    cy -= 11;
  }

  return await pdf.save();
}

/**
 * Signs the affiliate contract inside the app (SES), with no third-party
 * provider. Generates the signed PDF + certificate, stores it, records the audit
 * trail, and activates the affiliate.
 */
export const signAffiliateContract = action({
  args: {
    fullName: v.string(),
    consented: v.boolean(),
    userAgent: v.optional(v.string()),
    signerIp: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ signatureId: Id<"contractSignatures"> }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");
    if (!args.consented) {
      throw new Error("Le consentement est requis pour signer.");
    }
    const fullName = args.fullName.trim();
    if (fullName.length < 3) {
      throw new Error("Veuillez saisir votre nom complet pour signer.");
    }

    const affiliate = await ctx.runQuery(
      internal.affiliateUsers.getMeInternal,
      {},
    );
    if (!affiliate) throw new Error("Profil apporteur introuvable");

    const contract = await ctx.runQuery(
      internal.contractVersions.getActiveInternal,
      {},
    );
    if (!contract) throw new Error("Aucun contrat actif à signer.");

    const email = await ctx.runQuery(internal.affiliateUsers.getEmailById, {
      affiliateUserId: affiliate._id,
    });

    /* 1. Already signed? Return it rather than minting a second document.
          Cheap short-circuit only: the authoritative check is inside
          `recordInAppSignature`, in the same transaction as the insert. */
    const alreadySigned = await ctx.runQuery(
      internal.contractSignatures.findSignedSignatureInternal,
      { affiliateUserId: affiliate._id, contractVersionId: contract._id },
    );
    if (alreadySigned) return { signatureId: alreadySigned._id };

    const signedAt = Date.now();
    const contentHash = createHash("sha256")
      .update(contract.content, "utf8")
      .digest("hex");

    /* Minted here, not taken from the row's `_id`, so the certificate can name
       the signature before the row exists. Stored on the row below, which is
       what makes a PDF traceable back to its record. */
    const signatureRef = randomUUID();

    // 2. Signed PDF + certificate. Nothing has been written yet: a failure
    //    here — an unrenderable glyph, an out-of-memory save — leaves no row.
    const bytes = await generateSignedContractPdf({
      content: contract.content,
      title: contract.title,
      version: contract.version,
      signerName: fullName,
      signerEmail: email ?? "—",
      signedAt,
      contentHash,
      signatureRef,
      userAgent: args.userAgent,
      signerIp: args.signerIp,
    });

    // 3. Store the signed document (clean ArrayBuffer copy for BlobPart)
    const buf = new Uint8Array(bytes.byteLength);
    buf.set(bytes);
    const storageId = await ctx.storage.store(
      new Blob([buf], { type: "application/pdf" }),
    );

    // 4. Row + document + activation, in one transaction.
    const signatureId = await ctx.runMutation(
      internal.contractSignatures.recordInAppSignature,
      {
        affiliateUserId: affiliate._id,
        contractVersionId: contract._id,
        contractSnapshotContent: contract.content,
        contractSnapshotHash: contentHash,
        signerName: fullName,
        signerUserAgent: args.userAgent,
        signerIp: args.signerIp,
        signatureRef,
        signedDocumentFileId: storageId,
        signedAt,
      },
    );

    return { signatureId };
  },
});
