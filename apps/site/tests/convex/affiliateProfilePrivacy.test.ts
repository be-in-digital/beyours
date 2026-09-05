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

  test("no public function in the module lets a caller name the person", async () => {
    // Stronger than "the old export is gone", which a re-export under another
    // name would walk straight past. Every PUBLIC function in the module is
    // asked what arguments it declares, and none of them may take a user or
    // affiliate id: a public read here has to derive its row from the session.
    const module_ = (await import("../../convex/affiliateUsers")) as Record<
      string,
      unknown
    >;

    const publicNames: string[] = [];
    for (const [name, value] of Object.entries(module_)) {
      const fn = value as {
        isQuery?: boolean;
        isMutation?: boolean;
        isAction?: boolean;
        isPublic?: boolean;
        exportArgs?: () => string;
      };
      const isConvexFunction = Boolean(
        fn?.isQuery || fn?.isMutation || fn?.isAction,
      );
      if (!isConvexFunction || !fn.isPublic) continue;
      publicNames.push(name);

      const args = JSON.parse(fn.exportArgs?.() ?? "{}") as {
        value?: Record<string, unknown>;
      };
      const declared = Object.keys(args.value ?? {});
      expect(
        declared,
        `public ${name} declares an argument naming whose row to return`,
      ).not.toContain("userId");
      expect(declared).not.toContain("affiliateUserId");
    }

    // The sweep is meaningless if it found nothing to sweep.
    expect(publicNames).toContain("me");
    expect(publicNames.length).toBeGreaterThanOrEqual(3);
    expect(publicNames).not.toContain("getByUserId");
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
