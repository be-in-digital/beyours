/// <reference types="vite/client" />
import { describe, expect, test, vi } from "vitest";
import { COMPANY, LATE_PAYMENT, VAT } from "../../lib/legal/company";
import {
  invoiceCustomFields,
  invoiceFooter,
  invoiceLegalSettings,
  latePaymentTerms,
  sellerIdentity,
  taxDisplayMismatch,
  vatConfigurationProblem,
  vatMention,
} from "../../convex/invoiceLegal";

/* What an invoice must state about its seller: art. L441-9 of the commercial
   code and art. 242 nonies A of annex II to the tax code. Stripe supplies the
   date, number, lines, totals and buyer; the rest is on us. */
describe("sellerIdentity", () => {
  test("names the company as the law wants it named", () => {
    const identity = sellerIdentity();
    expect(identity).toContain(COMPANY.operatorName);
    expect(identity).toContain(COMPANY.legalName);
    expect(identity).toContain("SAS");
    /* Grouped with a non-breaking space, and never with a comma: « 1,000 € »
       reads as one euro on a French invoice. */
    expect(identity).toContain("1\u00a0000 €");
    expect(identity).not.toContain("1,000");
    expect(identity).toContain(COMPANY.address.street);
    expect(identity).toContain(COMPANY.address.postalCode);
    expect(identity).toContain(COMPANY.rcs);
  });

  /* The parenthetical gloss on the legal form belongs on a legal notice page,
     not squeezed into an invoice footer. */
  test("drops the gloss on the legal form", () => {
    expect(sellerIdentity()).not.toContain("société par actions simplifiée");
  });
});

describe("vatMention", () => {
  test("follows the regime declared as the source of truth", () => {
    expect(vatMention()).toContain(
      VAT.regime === "franchise" ? "293 B" : COMPANY.vatNumber,
    );
  });

  /* The two mentions are mutually exclusive: claiming the franchise while
     charging VAT, or the reverse, states something false on a legal document. */
  test("never states both at once", () => {
    const mention = vatMention();
    const claimsFranchise = mention.includes("293 B");
    const claimsVatNumber = mention.includes(COMPANY.vatNumber);
    expect(claimsFranchise).not.toBe(claimsVatNumber);
  });

  test("states the franchise exemption when that is the regime", async () => {
    vi.resetModules();
    vi.doMock("../../lib/legal/company", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../../lib/legal/company")>();
      return { ...actual, VAT: { ...actual.VAT, regime: "franchise" as const } };
    });
    const franchise = await import("../../convex/invoiceLegal");
    expect(franchise.vatMention()).toContain("293 B du CGI");
    vi.doUnmock("../../lib/legal/company");
    vi.resetModules();
  });
});

describe("latePaymentTerms", () => {
  test("carries the penalty rate, the indemnity and the discount terms", () => {
    const terms = latePaymentTerms();
    expect(terms).toContain(LATE_PAYMENT.penaltyRate);
    expect(terms).toContain(`${LATE_PAYMENT.indemnityEuros} €`);
    expect(terms).toContain("escompte");
    expect(terms).toContain("L441-10");
  });
});

describe("invoiceFooter", () => {
  test("a professional's invoice states the late payment terms", () => {
    const footer = invoiceFooter("business");
    expect(footer).toContain(COMPANY.rcs);
    expect(footer).toContain(`${LATE_PAYMENT.indemnityEuros} €`);
  });

  /* These terms bind professionals. On a consumer's invoice they have no
     place, and a 40 € recovery indemnity aimed at a consumer is worse than
     merely useless. */
  test("a consumer's invoice leaves them off", () => {
    const footer = invoiceFooter("personal");
    expect(footer).toContain(COMPANY.rcs);
    expect(footer).not.toContain("L441-10");
    expect(footer).not.toContain("indemnité forfaitaire");
  });

  test("both keep the seller's identity and the VAT position", () => {
    for (const buyer of ["business", "personal"] as const) {
      const footer = invoiceFooter(buyer);
      expect(footer).toContain(COMPANY.legalName);
      expect(footer).toContain(vatMention());
    }
  });
});

describe("invoiceCustomFields", () => {
  test("carries the SIRET", () => {
    const fields = invoiceCustomFields();
    expect(fields).toHaveLength(1);
    expect(fields[0]!.value).toBe(COMPANY.siret);
  });

  /* Stripe silently rejects a field over its limits, which would drop the
     SIRET off the invoice without a word. */
  test("fits inside what Stripe accepts", () => {
    for (const field of invoiceCustomFields()) {
      expect(field.name.length).toBeLessThanOrEqual(40);
      expect(field.value.length).toBeLessThanOrEqual(140);
    }
    expect(invoiceCustomFields().length).toBeLessThanOrEqual(4);
  });
});

describe("invoiceLegalSettings", () => {
  /* The same object feeds the Checkout session (first invoice) and the Stripe
     customer (every renewal), so a renewal cannot end up stating less. */
  test("gives Stripe the same mentions for the first invoice and the renewals", () => {
    const settings = invoiceLegalSettings("business");
    expect(settings.footer).toBe(invoiceFooter("business"));
    expect(settings.custom_fields).toEqual(invoiceCustomFields());
  });
});

describe("vatConfigurationProblem", () => {
  test("catches a company on the réel that charges nothing", () => {
    const problem =
      VAT.regime === "reel" ? vatConfigurationProblem(false) : "n/a";
    expect(problem).not.toBeNull();
  });

  test("says nothing when the regime and what Stripe charges agree", () => {
    expect(vatConfigurationProblem(VAT.regime === "reel")).toBeNull();
  });

  /* The decision was made in #174, so this text stopped being a question and
     became an instruction: it is what an operator reads when a deployment or a
     sale is turned away, and it has to name the flags to set. */
  test("names what to fix rather than what to decide", () => {
    const problem = vatConfigurationProblem(VAT.regime !== "reel");
    expect(problem).toContain("STRIPE_TAX_ENABLED");
    expect(problem).toContain("NEXT_PUBLIC_TVA_ENABLED");
    expect(problem).toContain("lib/legal/company.ts");
  });
});

/* ── taxDisplayMismatch ──
   Tested here rather than only through `createCheckoutSession`, because half of
   it cannot be reached that way: under the régime réel, `vatConfigurationProblem`
   refuses a Stripe that is not charging VAT before this function is ever asked
   about the display. So the over-quoted branch has no route through the action,
   and an adversarial pass found it asserted by nothing at all. A message an
   operator only ever sees in the one state we cannot reproduce is exactly the
   one worth pinning. */

describe("taxDisplayMismatch", () => {
  test("says nothing when the summary and Stripe agree", () => {
    expect(taxDisplayMismatch(true, true)).toBeNull();
    expect(taxDisplayMismatch(false, false)).toBeNull();
  });

  test("refuses a summary with no VAT against a Stripe that charges it", () => {
    const problem = taxDisplayMismatch(true, false);
    expect(problem).not.toBeNull();
    // The Next-side flag is the one to go and set; naming the Convex flag here
    // would send the operator to the wrong console.
    expect(problem).toContain("NEXT_PUBLIC_TVA_ENABLED");
    expect(problem).toContain("inférieur");
  });

  test("refuses the over-quoted direction, which no action path can reach", () => {
    const problem = taxDisplayMismatch(false, true);
    expect(problem).not.toBeNull();
    expect(problem).toContain("supérieur");
    // Both flags are named here: which one is wrong depends on the regime, and
    // this branch is reachable only when the regime itself has moved.
    expect(problem).toContain("STRIPE_TAX_ENABLED");
  });

  test("tells the two directions apart", () => {
    expect(taxDisplayMismatch(true, false)).not.toBe(taxDisplayMismatch(false, true));
  });
});
