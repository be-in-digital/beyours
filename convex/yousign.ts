"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Yousign API v3 integration for contract signing.
 *
 * Required environment variables:
 * - YOUSIGN_API_KEY: Yousign API key (sandbox or production)
 * - YOUSIGN_API_URL: "https://api-sandbox.yousign.app/v3" or "https://api.yousign.app/v3"
 */

const getYousignConfig = () => {
  const apiKey = process.env.YOUSIGN_API_KEY;
  const apiUrl =
    process.env.YOUSIGN_API_URL ?? "https://api-sandbox.yousign.app/v3";

  if (!apiKey) {
    throw new Error("YOUSIGN_NOT_CONFIGURED");
  }

  return { apiKey, apiUrl };
};

/**
 * Generate a PDF from contract text content using pdf-lib.
 * Returns the PDF as a Uint8Array.
 */
async function generateContractPdf(
  content: string,
  signerName: string,
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fontSize = 9;
  const titleFontSize = 14;
  const lineHeight = fontSize * 1.4;
  const margin = 50;
  const pageWidth = 595; // A4
  const pageHeight = 842; // A4
  const maxWidth = pageWidth - margin * 2;

  // Split content into lines, wrapping long lines
  const rawLines = content.split("\n");
  const wrappedLines: { text: string; bold: boolean }[] = [];

  for (const rawLine of rawLines) {
    const isBold =
      rawLine.startsWith("Article ") ||
      rawLine.startsWith("CONTRAT ") ||
      rawLine.startsWith("Entre ") ||
      rawLine.startsWith("Et") ||
      rawLine.match(/^\d+\.\d+ —/);
    const currentFont = isBold ? boldFont : font;

    if (rawLine.trim() === "" || rawLine.trim() === "---") {
      wrappedLines.push({ text: "", bold: false });
      continue;
    }

    // Word-wrap
    const words = rawLine.split(" ");
    let currentLine = "";
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = currentFont.widthOfTextAtSize(testLine, fontSize);
      if (width > maxWidth && currentLine) {
        wrappedLines.push({ text: currentLine, bold: !!isBold });
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      wrappedLines.push({ text: currentLine, bold: !!isBold });
    }
  }

  // Render lines across pages
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Title
  const title = "CONTRAT D'APPORTEUR D'AFFAIRES";
  page.drawText(title, {
    x: margin,
    y,
    size: titleFontSize,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= titleFontSize * 2;

  page.drawText(`Be in Digital — ${signerName}`, {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 10 * 2;

  // Draw separator
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= lineHeight;

  for (const line of wrappedLines) {
    if (y < margin + 30) {
      // Add footer
      page.drawText(
        `Page ${pdfDoc.getPageCount()}`,
        {
          x: pageWidth / 2 - 20,
          y: 25,
          size: 8,
          font,
          color: rgb(0.6, 0.6, 0.6),
        },
      );
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    if (line.text === "") {
      y -= lineHeight * 0.5;
      continue;
    }

    page.drawText(line.text, {
      x: margin,
      y,
      size: fontSize,
      font: line.bold ? boldFont : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= lineHeight;
  }

  // Last page footer
  page.drawText(`Page ${pdfDoc.getPageCount()}`, {
    x: pageWidth / 2 - 20,
    y: 25,
    size: 8,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });

  const bytes = await pdfDoc.save();
  return { bytes, pageCount: pdfDoc.getPageCount() };
}

/**
 * Create a Yousign signature request and return the signer URL.
 * Flow:
 * 1. Generate PDF from contract content (using pdf-lib)
 * 2. Upload PDF to Yousign
 * 3. Create signature request
 * 4. Add signer
 * 5. Activate the request
 * 6. Return signer URL
 */
/**
 * Check signature status directly with Yousign API.
 * Fallback for when webhooks don't fire (sandbox/trial).
 */
export const checkSignatureStatus = action({
  args: {
    signatureId: v.id("contractSignatures"),
  },
  handler: async (ctx, args): Promise<{ status: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    const signature: Awaited<
      ReturnType<typeof ctx.runQuery>
    > = await ctx.runQuery(internal.contractSignatures.getById, {
      id: args.signatureId,
    });
    if (!signature) throw new Error("Signature introuvable");
    if (!signature.yousignSignatureRequestId) {
      return { status: "pending" };
    }

    // Already signed in our DB
    if (signature.status === "signed") {
      return { status: "signed" };
    }

    const { apiKey, apiUrl } = getYousignConfig();

    // Check with Yousign API
    const response = await fetch(
      `${apiUrl}/signature_requests/${signature.yousignSignatureRequestId}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    );
    if (!response.ok) {
      console.error("Yousign check status error:", response.status);
      return { status: "pending" };
    }

    const sr = (await response.json()) as { status: string };
    console.log(`Yousign SR status: ${sr.status}`);

    // Yousign statuses: "draft", "ongoing", "done", "declined", "expired", "canceled"
    if (sr.status === "done") {
      // Activate via the same path as webhook
      await ctx.runMutation(
        internal.contractSignatures.activateAfterSignature,
        {
          signatureId: args.signatureId,
          signedAt: Date.now(),
        },
      );
      return { status: "signed" };
    }

    if (sr.status === "declined") {
      await ctx.runMutation(internal.contractSignatures.updateStatus, {
        signatureId: args.signatureId,
        status: "declined",
      });
      return { status: "declined" };
    }

    if (sr.status === "expired" || sr.status === "canceled") {
      await ctx.runMutation(internal.contractSignatures.updateStatus, {
        signatureId: args.signatureId,
        status: sr.status as "expired" | "canceled",
      });
      return { status: sr.status };
    }

    return { status: "pending" };
  },
});

export const createSignatureRequest = action({
  args: {
    signatureId: v.id("contractSignatures"),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    // Get affiliate
    const affiliate: Awaited<
      ReturnType<typeof ctx.runQuery>
    > = await ctx.runQuery(internal.affiliateUsers.getMeInternal, {});
    if (!affiliate) throw new Error("Profil apporteur introuvable");

    // Get the signature record
    const signature: Awaited<
      ReturnType<typeof ctx.runQuery>
    > = await ctx.runQuery(internal.contractSignatures.getById, {
      id: args.signatureId,
    });
    if (!signature) throw new Error("Signature introuvable");
    if (signature.affiliateUserId !== affiliate._id) {
      throw new Error("Accès refusé");
    }

    // If already has a Yousign URL, return it
    if (signature.yousignSignerUrl) {
      return { url: signature.yousignSignerUrl };
    }

    const { apiKey, apiUrl } = getYousignConfig();

    // Get affiliate email
    const email = await ctx.runQuery(
      internal.affiliateUsers.getEmailById,
      { affiliateUserId: affiliate._id },
    );

    // Step 1: Create signature request
    const srResponse = await fetch(`${apiUrl}/signature_requests`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Contrat d'apporteur d'affaires - Be in Digital",
        delivery_mode: "none",
        timezone: "Europe/Paris",
        external_id: signature._id,
      }),
    });
    if (!srResponse.ok) {
      const error = await srResponse.text();
      console.error("Yousign create SR error:", srResponse.status, error);
      throw new Error(`YOUSIGN_SR_ERROR: ${error}`);
    }
    const sr = (await srResponse.json()) as { id: string };

    // Step 2: Generate PDF and upload to Yousign
    const { bytes: pdfBytes, pageCount } = await generateContractPdf(
      signature.contractSnapshotContent,
      `${affiliate.firstName ?? "Apporteur"} ${affiliate.lastName ?? ""}`.trim(),
    );
    const formData = new FormData();
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
    formData.append("file", blob, "contrat-apporteur-affaires.pdf");
    formData.append("nature", "signable_document");

    const docResponse = await fetch(
      `${apiUrl}/signature_requests/${sr.id}/documents`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      },
    );
    if (!docResponse.ok) {
      const error = await docResponse.text();
      console.error("Yousign upload doc error:", docResponse.status, error);
      throw new Error(`YOUSIGN_DOC_ERROR: ${error}`);
    }
    const doc = (await docResponse.json()) as { id: string };

    // Step 3: Add signer
    // Build signer info — only include phone_number if it's a valid E.164 format
    const signerInfo: Record<string, string> = {
      first_name: affiliate.firstName ?? "Apporteur",
      last_name: affiliate.lastName ?? "Inconnu",
      email: email || "noreply@beindigital.fr",
      locale: "fr",
    };
    if (affiliate.phone && /^\+\d{10,15}$/.test(affiliate.phone)) {
      signerInfo.phone_number = affiliate.phone;
    }

    const signerResponse = await fetch(
      `${apiUrl}/signature_requests/${sr.id}/signers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          info: signerInfo,
          signature_level: "electronic_signature",
          signature_authentication_mode: "no_otp",
          fields: [
            {
              type: "signature",
              document_id: doc.id,
              page: pageCount,
              x: 100,
              y: 50,
              width: 200,
              height: 50,
            },
          ],
          // redirect_urls only available on paid Yousign plans (not trial/sandbox)
          // redirect_urls: { success: returnUrl, error: returnUrl },
        }),
      },
    );
    if (!signerResponse.ok) {
      const error = await signerResponse.text();
      console.error("Yousign add signer error:", signerResponse.status, error);
      throw new Error(`YOUSIGN_SIGNER_ERROR: ${error}`);
    }
    const signer = (await signerResponse.json()) as {
      id: string;
      signature_link: string;
    };

    // Step 4: Activate the signature request
    const activateResponse = await fetch(
      `${apiUrl}/signature_requests/${sr.id}/activate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!activateResponse.ok) {
      const error = await activateResponse.text();
      console.error("Yousign activate error:", activateResponse.status, error);
      throw new Error(`YOUSIGN_ACTIVATE_ERROR: ${error}`);
    }

    // Step 5: Fetch signer again to get the signature_link (only available after activation)
    const signerGetResponse = await fetch(
      `${apiUrl}/signature_requests/${sr.id}/signers/${signer.id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );
    if (!signerGetResponse.ok) {
      const error = await signerGetResponse.text();
      console.error("Yousign get signer error:", signerGetResponse.status, error);
      throw new Error(`YOUSIGN_GET_SIGNER_ERROR: ${error}`);
    }
    const activatedSigner = (await signerGetResponse.json()) as {
      id: string;
      signature_link: string;
    };

    // Step 6: Save Yousign data to the signature record
    await ctx.runMutation(internal.contractSignatures.updateYousignData, {
      signatureId: args.signatureId,
      yousignSignatureRequestId: sr.id,
      yousignSignerUrl: activatedSigner.signature_link,
    });

    return { url: activatedSigner.signature_link };
  },
});
