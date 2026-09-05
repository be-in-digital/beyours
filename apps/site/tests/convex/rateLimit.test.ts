/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import {
  FIELD_LIMITS,
  RATE_LIMITS,
  SITE_SUBJECT,
  checkRateLimit,
  rateLimitKey,
} from "../../convex/rateLimit";
import { drainScheduled, scheduledCount } from "./helpers/scheduled";

const modules = import.meta.glob("../../convex/**/*.ts");

/**
 * The guards on the two entry points anyone can drive in a loop.
 *
 * Before this: `contactLeads.submit` was an unauthenticated SES relay. Fifty
 * anonymous calls were accepted, wrote fifty rows and scheduled a hundred sends
 * — half of them to whatever address the caller typed. And any signed-in
 * account, affiliate or not, could mint unlimited upload URLs.
 */

describe("rate limit policy", () => {
  test("a fixed window admits up to twice the limit across a boundary", () => {
    // This is the price of a fixed window over a sliding one, and it is pinned
    // here rather than left to be discovered in production: an operator can
    // read `count` since `windowStart` off the row, and in exchange 2x the
    // limit can land back-to-back either side of a boundary.
    const rule = { limit: 3, windowMs: 1_000, foldSubjectCase: false };
    const t0 = 1_000_000;

    // Fill the first window.
    let window = { windowStart: t0, count: 0 };
    for (let i = 0; i < rule.limit; i++) {
      const verdict = checkRateLimit(window, rule, t0 + 900);
      expect(verdict.allowed).toBe(true);
      window = verdict.next!;
    }
    expect(checkRateLimit(window, rule, t0 + 900).allowed).toBe(false);

    // One millisecond later the window rolls and the budget is whole again, so
    // 2 * limit have been admitted inside one window's worth of wall clock.
    const rolled = checkRateLimit(window, rule, t0 + rule.windowMs);
    expect(rolled.allowed).toBe(true);
    expect(rolled.next).toEqual({ windowStart: t0 + rule.windowMs, count: 1 });
  });

  test("a refused verdict says when the caller may try again", () => {
    const rule = { limit: 1, windowMs: 60_000, foldSubjectCase: false };
    const verdict = checkRateLimit({ windowStart: 5_000, count: 1 }, rule, 6_000);
    expect(verdict.allowed).toBe(false);
    expect(verdict.retryAt).toBe(65_000);
  });

  test("an email subject is case-folded, a Convex id is not", () => {
    // The lead row stores the address lowercased, so the limiter must agree
    // with it — otherwise one Shift key is one fresh budget.
    expect(rateLimitKey("contactPerEmail", "Yanis@Resto.EXAMPLE")).toBe(
      rateLimitKey("contactPerEmail", "yanis@resto.example"),
    );
    expect(RATE_LIMITS.contactPerEmail.foldSubjectCase).toBe(true);

    // Convex ids are case-sensitive: two affiliates can differ only in the case
    // of one character, and folding them would let one spend the other's quota.
    expect(rateLimitKey("invoiceUploadUrlPerAffiliate", "jd7aBc")).not.toBe(
      rateLimitKey("invoiceUploadUrlPerAffiliate", "jd7abc"),
    );
    expect(RATE_LIMITS.invoiceUploadUrlPerAffiliate.foldSubjectCase).toBe(false);
  });

  test("the confirmation window is tighter than the submit window", () => {
    // The relay bound must stay below the submit bound: the confirmation is the
    // only message addressed to somebody the caller chose.
    expect(RATE_LIMITS.contactConfirmationSiteWide.limit).toBeLessThan(
      RATE_LIMITS.contactSiteWide.limit,
    );
  });
});

describe("contactLeads.submit — the unauthenticated relay", () => {
  test("a flood from one address is refused after the per-address window", async () => {
    const t = convexTest(schema, modules);
    let accepted = 0;
    for (let i = 0; i < 50; i++) {
      try {
        await t.mutation(api.contactLeads.submit, {
          name: "Bot",
          email: "victim@example.com",
          message: "spam",
        });
        accepted++;
      } catch {
        /* refused */
      }
    }

    expect(accepted).toBe(RATE_LIMITS.contactPerEmail.limit);
    const leads = await t.run((ctx) => ctx.db.query("contactLeads").collect());
    expect(leads).toHaveLength(RATE_LIMITS.contactPerEmail.limit);
    await drainScheduled(t);
  });

  test("a flood that changes address every call still meets the site-wide window", async () => {
    const t = convexTest(schema, modules);
    const attempts = RATE_LIMITS.contactSiteWide.limit + 10;
    let accepted = 0;
    for (let i = 0; i < attempts; i++) {
      try {
        await t.mutation(api.contactLeads.submit, {
          name: "Bot",
          email: `victim${i}@example.com`,
          message: "spam",
        });
        accepted++;
      } catch {
        /* refused */
      }
    }

    // The per-address window is dodged by construction here. The site-wide one
    // cannot be, which is the whole reason there are two.
    expect(accepted).toBe(RATE_LIMITS.contactSiteWide.limit);
    await drainScheduled(t);
  });

  test("mail to a caller-supplied address is bounded harder than the submit", async () => {
    const t = convexTest(schema, modules);
    const attempts = RATE_LIMITS.contactSiteWide.limit;
    for (let i = 0; i < attempts; i++) {
      await t.mutation(api.contactLeads.submit, {
        name: "Bot",
        email: `victim${i}@example.com`,
        message: "spam",
      });
    }

    // The confirmation is the relay vector — it mails an address the caller
    // chose — so it stops well before the submit does.
    expect(await scheduledCount(t, "sendContactConfirmation")).toBe(
      RATE_LIMITS.contactConfirmationSiteWide.limit,
    );
    // The team notification only ever reaches our own inbox, so it rides the
    // submit window and no tighter one.
    expect(await scheduledCount(t, "sendContactTeamNotification")).toBe(attempts);
    await drainScheduled(t);
  });

  test("spending the confirmation window still stores the lead and tells the team", async () => {
    const t = convexTest(schema, modules);
    const overshoot = RATE_LIMITS.contactConfirmationSiteWide.limit + 5;
    for (let i = 0; i < overshoot; i++) {
      await t.mutation(api.contactLeads.submit, {
        name: "Prospect",
        email: `prospect${i}@resto.fr`,
        message: "Je veux un site.",
      });
    }

    // Losing a prospect costs more than a missing courtesy email, so the
    // confirmation window never refuses the submit itself.
    const leads = await t.run((ctx) => ctx.db.query("contactLeads").collect());
    expect(leads).toHaveLength(overshoot);
    expect(await scheduledCount(t, "sendContactTeamNotification")).toBe(overshoot);
    await drainScheduled(t);
  });

  test("a real submit still works and still mails both sides", async () => {
    const t = convexTest(schema, modules);
    const result = await t.mutation(api.contactLeads.submit, {
      name: "Camille Roux",
      email: "Camille@Bistrot.FR",
      restaurant: "Le Bistrot",
      message: "Bonjour, je souhaite un devis.",
      website: "",
    });

    expect(result).toEqual({ ok: true });
    const leads = await t.run((ctx) => ctx.db.query("contactLeads").collect());
    expect(leads).toHaveLength(1);
    expect(leads[0].email).toBe("camille@bistrot.fr");
    expect(leads[0].restaurant).toBe("Le Bistrot");
    expect(await scheduledCount(t, "sendContactConfirmation")).toBe(1);
    expect(await scheduledCount(t, "sendContactTeamNotification")).toBe(1);
    await drainScheduled(t);
  });

  test("a filled honeypot is accepted, dropped, and costs the caller nothing to learn", async () => {
    const t = convexTest(schema, modules);
    const result = await t.mutation(api.contactLeads.submit, {
      name: "Bot",
      email: "bot@example.com",
      message: "buy pills",
      website: "http://spam.example",
    });

    // Same answer a real submit gets: an error here would teach the next
    // iteration of the script which field to leave alone.
    expect(result).toEqual({ ok: true });
    const leads = await t.run((ctx) => ctx.db.query("contactLeads").collect());
    expect(leads).toHaveLength(0);
    expect(await scheduledCount(t, "sendContact")).toBe(0);
  });

  test("an oversized honeypot value is dropped rather than reported", async () => {
    const t = convexTest(schema, modules);
    // A length error would name the honeypot field out loud, which is the one
    // thing the caller must never be told — hence it is not length-checked.
    const result = await t.mutation(api.contactLeads.submit, {
      name: "Bot",
      email: "bot@example.com",
      message: "spam",
      website: "http://spam.example/".repeat(500),
    });
    expect(result).toEqual({ ok: true });
    const leads = await t.run((ctx) => ctx.db.query("contactLeads").collect());
    expect(leads).toHaveLength(0);
  });

  test("a honeypot flood cannot spend the window real visitors share", async () => {
    const t = convexTest(schema, modules);
    for (let i = 0; i < 200; i++) {
      await t.mutation(api.contactLeads.submit, {
        name: "Bot",
        email: `bot${i}@example.com`,
        message: "spam",
        website: "x",
      });
    }

    // The honeypot is checked before the limiters precisely so the guard cannot
    // become the denial of service.
    const counters = await t.run((ctx) => ctx.db.query("rateLimits").collect());
    expect(counters).toHaveLength(0);

    const result = await t.mutation(api.contactLeads.submit, {
      name: "Camille",
      email: "camille@bistrot.fr",
      message: "Bonjour.",
    });
    expect(result).toEqual({ ok: true });
    await drainScheduled(t);
  });

  test("an oversized field is refused before any database read", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.contactLeads.submit, {
        name: "Camille",
        email: "camille@bistrot.fr",
        message: "x".repeat(FIELD_LIMITS.message + 1),
      }),
    ).rejects.toThrow(/dépasse/);

    // `v.string()` has no length of its own, so this used to be a megabyte a
    // caller could store at will. Nothing is written, and no window is spent.
    const counters = await t.run((ctx) => ctx.db.query("rateLimits").collect());
    expect(counters).toHaveLength(0);
  });

  test("the counter row an operator would read carries the key, start and count", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.contactLeads.submit, {
      name: "Camille",
      email: "Camille@Bistrot.FR",
      message: "Bonjour.",
    });

    const rows = await t.run((ctx) => ctx.db.query("rateLimits").collect());
    const perEmail = rows.find((r) => r.key.startsWith("contactPerEmail:"));
    expect(perEmail?.key).toBe("contactPerEmail:camille@bistrot.fr");
    expect(perEmail?.count).toBe(1);
    expect(typeof perEmail?.windowStart).toBe("number");
    expect(rows.some((r) => r.key === `contactSiteWide:${SITE_SUBJECT}`)).toBe(
      true,
    );
    await drainScheduled(t);
  });
});
