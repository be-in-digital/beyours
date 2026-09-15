import { describe, it, expect } from "vitest";
import { euros, escapeHtml } from "../convex/email/layout";
import {
  affiliateCommissionEmail,
  affiliateWelcomeEmail,
  contactConfirmationEmail,
  contactTeamNotificationEmail,
  deploymentHealthEmail,
  orderConfirmationEmail,
  paymentFailedEmail,
  renewalReceiptEmail,
  type BuiltEmail,
} from "../convex/email/templates";

const LOGO = "https://beyours.fr/logo.png";

/** Every branded email must carry subject, an HTML doc, and a text fallback. */
function expectWellFormed(email: BuiltEmail) {
  expect(email.subject.length).toBeGreaterThan(0);
  expect(email.text.trim().length).toBeGreaterThan(0);
  expect(email.html).toContain("<!DOCTYPE html>");
  expect(email.html).toContain(LOGO); // logo present
  expect(email.html).toContain("#c5542c"); // terracotta accent (brand)
  expect(email.html).toContain("BeYours"); // footer signature
}

describe("euros", () => {
  it("formats cents as French euros", () => {
    expect(euros(350000)).toBe("3 500,00 €");
    expect(euros(250000)).toBe("2 500,00 €");
    expect(euros(0)).toBe("0,00 €");
  });
});

describe("escapeHtml", () => {
  it("neutralises HTML in user input", () => {
    expect(escapeHtml('<script>"x"</script>')).toBe(
      "&lt;script&gt;&quot;x&quot;&lt;/script&gt;",
    );
  });
});

describe("orderConfirmationEmail", () => {
  it("is well-formed and shows the paid total + restaurant", () => {
    const email = orderConfirmationEmail({
      firstName: "Nadia",
      restaurantName: "Chez Momo",
      plan: "essentielle",
      orderType: "creation",
      amountCents: 350000,
      paymentMethod: "card",
      isFounders: false,
      logoUrl: LOGO,
      bookingUrl: "https://cal.com/bid",
    });
    expectWellFormed(email);
    expect(email.html).toContain("Nadia");
    expect(email.html).toContain("Chez Momo");
    expect(email.html).toContain("3 500,00 €");
    expect(email.text).toContain("3 500,00 €");
  });

  it("escapes a restaurant name containing HTML", () => {
    const email = orderConfirmationEmail({
      firstName: "Léa",
      restaurantName: "<b>Pizza</b>",
      plan: "premium",
      orderType: "creation",
      amountCents: 750000,
      logoUrl: LOGO,
    });
    expect(email.html).not.toContain("<b>Pizza</b>");
    expect(email.html).toContain("&lt;b&gt;Pizza&lt;/b&gt;");
  });

  it("carries the link back to the order the success page asks for (#528)", () => {
    /*
     * THE CONTRADICTION. `components/checkout/kickoff-gate.tsx` tells a buyer
     * who lands on `/checkout/success` without a valid `orderId`: « Si vous
     * venez de payer, ouvrez le lien reçu par email. » This email carried no
     * such link. Its only CTA is the booking URL, which goes straight to the
     * booking tool and past the gate — so the one instruction the page gives
     * pointed at something that did not exist, and a buyer who closed the tab
     * had no way back to the kickoff booking.
     */
    const email = orderConfirmationEmail({
      firstName: "Nadia",
      restaurantName: "Chez Momo",
      plan: "essentielle",
      orderType: "creation",
      amountCents: 350000,
      logoUrl: LOGO,
      orderUrl: "https://beyours.fr/checkout/success?orderId=abc123",
    });
    expect(email.html).toContain("https://beyours.fr/checkout/success?orderId=abc123");
    expect(email.text).toContain("https://beyours.fr/checkout/success?orderId=abc123");
  });

  it("stays well-formed when there is no order link to give", () => {
    // Anti-vacuity, and the real case: `orderUrl` is optional, so a template
    // that required it would throw rather than degrade.
    const email = orderConfirmationEmail({
      firstName: "Nadia",
      restaurantName: "Chez Momo",
      plan: "essentielle",
      orderType: "creation",
      amountCents: 350000,
      logoUrl: LOGO,
    });
    expectWellFormed(email);
    expect(email.html).not.toContain("checkout/success");
  });
});

describe("renewalReceiptEmail", () => {
  it("is well-formed with the period and amount", () => {
    const email = renewalReceiptEmail({
      plan: "essentielle",
      amountCents: 100000,
      invoiceUrl: "https://stripe.com/invoice",
      periodStartMs: Date.UTC(2026, 0, 1),
      periodEndMs: Date.UTC(2027, 0, 1),
      logoUrl: LOGO,
    });
    expectWellFormed(email);
    expect(email.html).toContain("1 000,00 €");
  });
});

describe("paymentFailedEmail", () => {
  it("is well-formed and urges an update", () => {
    const email = paymentFailedEmail({
      amountCents: 100000,
      updateUrl: "https://stripe.com/pay",
      logoUrl: LOGO,
    });
    expectWellFormed(email);
    expect(email.subject.toLowerCase()).toContain("échoué");
  });
});

describe("contact emails", () => {
  it("confirmation to prospect is well-formed", () => {
    expectWellFormed(
      contactConfirmationEmail({ firstName: "Sam", logoUrl: LOGO, discoverUrl: "x" }),
    );
  });

  it("team notification carries the lead + escapes the message", () => {
    const email = contactTeamNotificationEmail({
      name: "Sam Riva",
      email: "sam@resto.fr",
      restaurant: "Le Comptoir",
      message: "Bonjour <img src=x>",
      submittedAtMs: Date.UTC(2026, 5, 1),
      logoUrl: LOGO,
    });
    expectWellFormed(email);
    expect(email.html).toContain("sam@resto.fr");
    expect(email.html).not.toContain("<img src=x>");
    expect(email.subject).toContain("Sam Riva");
  });
});

describe("affiliate emails", () => {
  it("welcome is well-formed", () => {
    expectWellFormed(
      affiliateWelcomeEmail({
        firstName: "Théo",
        logoUrl: LOGO,
        dashboardUrl: "https://beyours.fr/parrainage/dashboard",
      }),
    );
  });

  it("commission (paid) is well-formed", () => {
    const email = affiliateCommissionEmail({
      amountCents: 50000,
      paid: true,
      logoUrl: LOGO,
    });
    expectWellFormed(email);
    expect(email.html).toContain("500,00 €");
  });
});

describe("deploymentHealthEmail", () => {
  const base = {
    restaurantName: "Chez Mario",
    domain: "chez-mario.fr",
    changedAtMs: Date.UTC(2026, 8, 7, 20, 4),
    consoleUrl: "https://beyours.fr/admin/monitoring",
    logoUrl: LOGO,
  };

  it("says which way it went, in the subject", () => {
    // The subject is what an inbox rule and a phone notification match on, so
    // the prefix stays first and the state is readable without opening it.
    const down = deploymentHealthEmail({
      ...base,
      previousHealth: "healthy",
      health: "down",
      message: "http : Délai dépassé (10 s)",
      uptime30d: 99.42,
    });

    expectWellFormed(down);
    expect(down.subject).toBe("[Monitoring] Chez Mario — hors ligne");
    expect(down.html).toContain("chez-mario.fr");
    expect(down.html).toContain("99.42 %");
    expect(down.text).toContain("Délai dépassé");
  });

  it("reads as an all-clear on the way back up", () => {
    const up = deploymentHealthEmail({
      ...base,
      previousHealth: "down",
      health: "healthy",
    });

    expectWellFormed(up);
    expect(up.subject).toBe("[Monitoring] Chez Mario — en ligne");
    expect(up.html).toContain("de nouveau en ligne");
  });

  it("escapes an establishment name that carries markup", () => {
    const alert = deploymentHealthEmail({
      ...base,
      restaurantName: '<script>alert(1)</script>',
      previousHealth: "healthy",
      health: "down",
    });

    expect(alert.html).not.toContain("<script>alert(1)</script>");
    expect(alert.html).toContain("&lt;script&gt;");
  });
});
