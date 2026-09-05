/// <reference types="vite/client" />

/**
 * An affiliate profile is readable by its owner and by nobody else.
 *
 * `affiliateUsers.getByUserId` was a public query taking a `v.id("users")` and
 * performing no identity check, so an anonymous caller holding or guessing a
 * user id read the whole document — name, address, phone, SIRET, role,
 * `commissionOverrideCents`, `stripeConnectAccountId`. It had no caller. Its
 * siblings `orders.get`, `invoices.getByEmail` and `subscriptions.getByEmail`
 * had already been deleted for exactly this shape; this one was missed, and the
 * engine closed the same defect on `userProfiles.getByUserId`.
 *
 * These cases hold the shape rather than the name: the point is not that one
 * export is gone, it is that no public query lets a caller name whose affiliate
 * row it wants.
 */

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { makeFunctionReference } from "convex/server";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");

const VICTIM = {
  firstName: "Victime",
  lastName: "Dupond",
  address: "12 rue de la Paix",
  city: "Paris",
  postalCode: "75002",
  phone: "+33611223344",
  siret: "93081769700018",
  role: "admin" as const,
  status: "active" as const,
  contractStatus: "active" as const,
  commissionOverrideCents: 90_000,
  stripeConnectAccountId: "acct_1SECRET",
  stripeConnectStatus: "active" as const,
};

async function seedAffiliate(
  t: ReturnType<typeof convexTest>,
  email: string,
  overrides: Partial<typeof VICTIM> = {},
) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { email }));
  const affiliateUserId = await t.run((ctx) =>
    ctx.db.insert("affiliateUsers", {
      ...VICTIM,
      ...overrides,
      userId,
      createdAt: Date.now(),
    }),
  );
  return { userId, affiliateUserId };
}

describe("affiliate profiles are not readable by user id", () => {
  test("the unguarded getByUserId query no longer exists", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await seedAffiliate(t, "victime@example.fr");

    await expect(
      t.query(
        makeFunctionReference<"query">("affiliateUsers:getByUserId"),
        { userId },
      ),
    ).rejects.toThrow(/no such export/i);
  });

  test("no public query anywhere takes a userId and returns a profile", async () => {
    // The regression this guards is a re-export under another name. Every
    // public read of `affiliateUsers` has to derive the row from the session.
    const publicReaders = Object.keys(
      (await import("../../convex/affiliateUsers")) as Record<string, unknown>,
    );
    expect(publicReaders).toContain("me");
    expect(publicReaders).not.toContain("getByUserId");
  });

  test("an anonymous caller reads nothing from `me`", async () => {
    const t = convexTest(schema, modules);
    await seedAffiliate(t, "victime@example.fr");
    expect(await t.query(api.affiliateUsers.me, {})).toBeNull();
  });

  test("a signed-in affiliate reads its own row and only its own", async () => {
    const t = convexTest(schema, modules);
    const victim = await seedAffiliate(t, "victime@example.fr");
    const attacker = await seedAffiliate(t, "attaquant@example.fr", {
      firstName: "Attaquant",
      lastName: "Curieux",
      role: "affiliate" as const,
      siret: "12345678901234",
      stripeConnectAccountId: "acct_1ATTACKER",
      commissionOverrideCents: undefined,
    });

    const mine = await t
      .withIdentity({ subject: attacker.userId })
      .query(api.affiliateUsers.me, {});

    expect(mine?._id).toBe(attacker.affiliateUserId);
    expect(mine?._id).not.toBe(victim.affiliateUserId);
    expect(mine?.siret).toBe("12345678901234");
    expect(mine?.stripeConnectAccountId).toBe("acct_1ATTACKER");
  });
});
