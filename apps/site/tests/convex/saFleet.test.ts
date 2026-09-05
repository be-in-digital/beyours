/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.ts");

/* Offboarding used to be a label and nothing else: `status: "offboarded"` was
   patched in, an activity row was written, and the deployment kept every
   credential it had been provisioned with. These tests cross the seam the
   status change actually runs through — validator, schema, mutation, and the
   query the console reads back — because that is where a field that is written
   but never surfaced would hide. */

async function asAdmin(t: ReturnType<typeof convexTest>) {
  const adminUserId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", { email: "admin@example.com" });
  });
  await t.run(async (ctx) => {
    await ctx.db.insert("affiliateUsers", {
      userId: adminUserId,
      role: "admin" as const,
      status: "active" as const,
      stripeConnectStatus: "not_started" as const,
      createdAt: Date.now(),
    });
  });
  return t.withIdentity({ subject: adminUserId });
}

async function seedDeployment(
  t: ReturnType<typeof convexTest>,
  status: "live" | "offboarded" = "live",
) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    return await ctx.db.insert("saDeployments", {
      customerEmail: "chef@restaurant.example",
      restaurantName: "Chez Test",
      city: "Lyon",
      name: "chez-test",
      domain: "chez-test.example",
      environment: "production" as const,
      status,
      health: "healthy" as const,
      region: "eu-west-3",
      plan: "essentielle" as const,
      uptime30d: 100,
      storeCount: 1,
      provisionedAt: now,
      integrations: [],
      maintenance: { status: "active" as const, autoRenew: true },
      createdAt: now,
      updatedAt: now,
    });
  });
}

describe("offboarding does not silently look finished", () => {
  test("moving to offboarded stamps offboardedAt but revokes nothing", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const id = await seedDeployment(t);

    await admin.mutation(api.saFleet.updateStatus, {
      deploymentId: id,
      status: "offboarded",
    });

    const dep = await admin.query(api.saFleet.get, { deploymentId: id });
    expect(dep?.status).toBe("offboarded");
    expect(dep?.offboardedAt).toBeTypeOf("number");
    // The point of the whole change: gone is not the same as revoked.
    expect(dep?.accessRevokedAt).toBeUndefined();
  });

  test("it records that revocation is still outstanding", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const id = await seedDeployment(t);

    await admin.mutation(api.saFleet.updateStatus, {
      deploymentId: id,
      status: "offboarded",
    });

    const rows = await t.run(async (ctx) => {
      return await ctx.db.query("saActivity").collect();
    });
    const pending = rows.filter(
      (r) => r.action === "deployment.revocation_pending",
    );
    expect(pending).toHaveLength(1);
    expect(pending[0]!.deploymentId).toBe(id);
  });

  test("recordAccessRevoked stamps the date the console reads back", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const id = await seedDeployment(t, "offboarded");

    await admin.mutation(api.saFleet.recordAccessRevoked, { deploymentId: id });

    const dep = await admin.query(api.saFleet.get, { deploymentId: id });
    expect(dep?.accessRevokedAt).toBeTypeOf("number");
  });

  test("it is refused on a deployment that has not been offboarded", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const id = await seedDeployment(t, "live");

    await expect(
      admin.mutation(api.saFleet.recordAccessRevoked, { deploymentId: id }),
    ).rejects.toThrow(/sorti/i);
  });

  test("it is refused to a caller who is not an admin", async () => {
    const t = convexTest(schema, modules);
    const id = await seedDeployment(t, "offboarded");

    await expect(
      t.mutation(api.saFleet.recordAccessRevoked, { deploymentId: id }),
    ).rejects.toThrow();
  });

  test("calling it twice keeps the first date", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const id = await seedDeployment(t, "offboarded");

    await admin.mutation(api.saFleet.recordAccessRevoked, { deploymentId: id });
    const first = (await admin.query(api.saFleet.get, { deploymentId: id }))
      ?.accessRevokedAt;
    await admin.mutation(api.saFleet.recordAccessRevoked, { deploymentId: id });
    const second = (await admin.query(api.saFleet.get, { deploymentId: id }))
      ?.accessRevokedAt;

    expect(second).toBe(first);
  });

  test("coming back out of offboarding clears both stamps", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const id = await seedDeployment(t, "live");

    await admin.mutation(api.saFleet.updateStatus, {
      deploymentId: id,
      status: "offboarded",
    });
    await admin.mutation(api.saFleet.recordAccessRevoked, { deploymentId: id });
    await admin.mutation(api.saFleet.updateStatus, {
      deploymentId: id,
      status: "live",
    });

    const dep = await admin.query(api.saFleet.get, { deploymentId: id });
    expect(dep?.status).toBe("live");
    // Stale stamps would read as "this one was already dealt with".
    expect(dep?.offboardedAt).toBeUndefined();
    expect(dep?.accessRevokedAt).toBeUndefined();

    // A second departure is a fresh one, and outstanding again.
    await admin.mutation(api.saFleet.updateStatus, {
      deploymentId: id,
      status: "offboarded",
    });
    const again = await admin.query(api.saFleet.get, { deploymentId: id });
    expect(again?.offboardedAt).toBeTypeOf("number");
    expect(again?.accessRevokedAt).toBeUndefined();
  });

  test("the fleet list surfaces the pending state too", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const id = await seedDeployment(t);

    await admin.mutation(api.saFleet.updateStatus, {
      deploymentId: id,
      status: "offboarded",
    });

    const rows = await admin.query(api.saFleet.list, {});
    const row = rows.find((r) => r._id === id);
    expect(row?.offboardedAt).toBeTypeOf("number");
    expect(row?.accessRevokedAt).toBeUndefined();
  });
});

/* `saFleet.update` was the only writer of domain, version, storeCount, notes
   and integrations after provisioning, and it was mounted on no page at all —
   so none of those could be corrected without opening the Convex dashboard. It
   is now behind « Modifier » on the deployment page, and two of its arguments
   are gone: `health` and `uptime30d` belong to the prober
   (convex/saMonitoring.ts), and a value typed here would be overwritten by the
   next round ten minutes later. */
describe("operator corrections go through update", () => {
  test("it writes the fields the console displays read-only", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const id = await seedDeployment(t);

    await admin.mutation(api.saFleet.update, {
      deploymentId: id,
      domain: "chez-test.fr",
      region: "eu-west-1",
      version: "1.4.2",
      latestVersion: "1.5.0",
      storeCount: 3,
      notes: "Bascule DNS faite le 12/03.",
      integrations: [
        { key: "stripe", status: "connected" },
        { key: "deliveroo", status: "error", detail: "Webhook 401" },
      ],
    });

    const dep = await admin.query(api.saFleet.get, { deploymentId: id });
    expect(dep?.domain).toBe("chez-test.fr");
    expect(dep?.region).toBe("eu-west-1");
    expect(dep?.version).toBe("1.4.2");
    expect(dep?.latestVersion).toBe("1.5.0");
    expect(dep?.storeCount).toBe(3);
    expect(dep?.notes).toBe("Bascule DNS faite le 12/03.");
    expect(dep?.integrations).toHaveLength(2);
    expect(dep?.integrations[1]).toEqual({
      key: "deliveroo",
      status: "error",
      detail: "Webhook 401",
    });
  });

  test("recording a new version stamps lastDeployAt", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const id = await seedDeployment(t);

    // Nothing wrote this field before; « Dernier déploiement » was always "—".
    expect(
      (await admin.query(api.saFleet.get, { deploymentId: id }))?.lastDeployAt,
    ).toBeUndefined();

    await admin.mutation(api.saFleet.update, {
      deploymentId: id,
      version: "1.4.2",
    });
    const stamped = (await admin.query(api.saFleet.get, { deploymentId: id }))
      ?.lastDeployAt;
    expect(stamped).toBeTypeOf("number");

    // Re-submitting the same version is not a deploy.
    await admin.mutation(api.saFleet.update, {
      deploymentId: id,
      version: "1.4.2",
      notes: "rien de neuf",
    });
    expect(
      (await admin.query(api.saFleet.get, { deploymentId: id }))?.lastDeployAt,
    ).toBe(stamped);
  });

  test("health and uptime are no longer settable by hand", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const id = await seedDeployment(t);

    // Typed out of the signature; the validator refuses them at runtime too,
    // so an old caller fails loudly instead of writing a figure the next probe
    // round silently overwrites.
    const forbidden = {
      deploymentId: id,
      health: "healthy",
      uptime30d: 99.99,
    } as unknown as { deploymentId: typeof id };

    await expect(
      admin.mutation(api.saFleet.update, forbidden),
    ).rejects.toThrow(/Unexpected field `(health|uptime30d)`/);
  });

  test("it is refused to a caller who is not an admin", async () => {
    const t = convexTest(schema, modules);
    const id = await seedDeployment(t);

    await expect(
      t.mutation(api.saFleet.update, {
        deploymentId: id,
        domain: "pirate.example",
      }),
    ).rejects.toThrow();
  });

  test("provisioning no longer claims a perfect uptime", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);

    const id = await admin.mutation(api.saFleet.create, {
      customerEmail: "chef@restaurant.example",
      restaurantName: "Chez Test",
      city: "Lyon",
      name: "chez-test",
      domain: "chez-test.example",
      plan: "essentielle",
    });

    const dep = await admin.query(api.saFleet.get, { deploymentId: id });
    // `uptime30d` is a placeholder every reader gates on `lastCheckAt`; it is
    // 0 rather than 100 so an ungated reader fails visibly.
    expect(dep?.uptime30d).toBe(0);
    expect(dep?.lastCheckAt).toBeUndefined();
    expect(dep?.health).toBe("unknown");
  });
});
