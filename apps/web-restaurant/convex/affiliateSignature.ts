"use node";

/**
 * Signature électronique simple (SES) in-house — apporteurs d'affaires.
 *
 * Alternative à Yousign : la signature se fait dans l'app, sans prestataire
 * tiers. Niveau juridique = signature électronique SIMPLE (eIDAS art. 25,
 * recevable ; la charge de la preuve incombe à Be in Digital). Adapté à un
 * mandat d'apporteur B2B à faible enjeu.
 *
 * Piste d'audit conservée :
 *  - identité : compte apporteur authentifié (email + mot de passe)
 *  - consentement explicite + nom saisi par le signataire
 *  - horodatage serveur
 *  - empreinte SHA-256 du contenu exact signé (intégrité)
 *  - PDF signé + page « certificat de signature » stocké (Convex storage)
 *
 * L'adaptateur Yousign (`yousign.ts`) reste en place, inutilisé, pour un
 * éventuel passage à une signature AVANCÉE/QUALIFIÉE via prestataire qualifié.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createHash } from "crypto";
import type { Id } from "./_generated/dataModel";

const A4 = { w: 595, h: 842 };
const MARGIN = 50;

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
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

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

  // Corps du contrat (word-wrap, multi-pages)
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

  // ── Page certificat de signature ──
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
 * Signe le contrat d'apporteur dans l'app (SES), sans prestataire tiers.
 * Génère le PDF signé + certificat, le stocke, enregistre la piste d'audit,
 * et active l'apporteur.
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

    const signedAt = Date.now();
    const contentHash = createHash("sha256")
      .update(contract.content, "utf8")
      .digest("hex");

    // 1. Enregistrer la signature (status "signed" + audit)
    const signatureId = await ctx.runMutation(
      internal.contractSignatures.createInAppSignatureRecord,
      {
        affiliateUserId: affiliate._id,
        contractVersionId: contract._id,
        contractSnapshotContent: contract.content,
        contractSnapshotHash: contentHash,
        signerName: fullName,
        signerUserAgent: args.userAgent,
        signerIp: args.signerIp,
        signedAt,
      },
    );

    // 2. PDF signé + certificat
    const bytes = await generateSignedContractPdf({
      content: contract.content,
      title: contract.title,
      version: contract.version,
      signerName: fullName,
      signerEmail: email ?? "—",
      signedAt,
      contentHash,
      signatureRef: signatureId,
      userAgent: args.userAgent,
      signerIp: args.signerIp,
    });

    // 3. Stocker le document signé (copie ArrayBuffer propre pour BlobPart)
    const buf = new Uint8Array(bytes.byteLength);
    buf.set(bytes);
    const storageId = await ctx.storage.store(
      new Blob([buf], { type: "application/pdf" }),
    );

    // 4. Attacher le document + activer l'apporteur
    await ctx.runMutation(
      internal.contractSignatures.activateAfterSignature,
      {
        signatureId,
        signedAt,
        signedDocumentFileId: storageId,
      },
    );

    return { signatureId };
  },
});
