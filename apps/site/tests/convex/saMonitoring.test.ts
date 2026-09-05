/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import crons from "../../convex/crons";
import {
  SLOW_RESPONSE_MS,
  classifyResponse,
  convexTarget,
  deriveHealth,
  httpTarget,
  uptimePercent,
} from "../../convex/saMonitoring";

const modules = import.meta.glob("../../convex/**/*.ts");

/* The monitoring console used to report two numbers nobody had measured:
   `uptime30d` was the constant `saFleet.create` stamped at provisioning, and
   `health` was promoted to "healthy" the day a deployment went live. The only
   writer of `saMonitoringChecks` was a public mutation behind `requireAdmin`
   with no callers — so no cron could have fed it even if one had existed.

   These tests hold the producer that replaced it: the rules it decides by, the
   fact that a system caller can write without an identity while the console's
   own surface still cannot be read without one, and — the part that regressed
   silently last time — that a deployment nothing has probed reports nothing
   rather than a flattering default. The `fetch` itself is not tested here: the
   decisions are what matters, and they are pure. */

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

type SeedOptions = {
  status?:
    | "provisioning"
    | "staging"
    | "live"
    | "degraded"
    | "suspended"
    | "offboarded";
  name?: string;
  domain?: string;
  convexUrl?: string;
  lastCheckAt?: number;
  uptime30d?: number;
};

async function seedDeployment(
  t: ReturnType<typeof convexTest>,
  opts: SeedOptions = {},
) {
  const now = Date.now();
  return await t.run(async (ctx) => {
    return await ctx.db.insert("saDeployments", {
      customerEmail: "chef@restaurant.example",
      restaurantName: opts.name ?? "Chez Test",
      city: "Lyon",
      name: opts.name ?? "chez-test",
      domain: opts.domain ?? "chez-test.example",
      convexUrl: opts.convexUrl,
      environment: "production" as const,
      status: opts.status ?? "live",
      health: "unknown" as const,
      region: "eu-west-3",
      plan: "essentielle" as const,
      uptime30d: opts.uptime30d ?? 0,
      storeCount: 1,
      provisionedAt: now,
      lastCheckAt: opts.lastCheckAt,
      integrations: [],
      maintenance: { status: "active" as const, autoRenew: true },
      createdAt: now,
      updatedAt: now,
    });
  });
}

/** Records one probe round the way the action does: one instant, n checks. */
async function record(
  t: ReturnType<typeof convexTest>,
  deploymentId: Id<"saDeployments">,
  checkedAt: number,
  statuses: { kind: "http" | "convex"; status: "up" | "degraded" | "down" }[],
) {
  await t.mutation(internal.saMonitoring.recordProbeResults, {
    deploymentId,
    checkedAt,
    results: statuses.map((s) => ({
      kind: s.kind,
      target: s.kind === "http" ? "https://chez-test.example/" : "convex",
      status: s.status,
      statusCode: s.kind === "http" ? (s.status === "down" ? 503 : 200) : undefined,
      latencyMs: s.status === "down" ? undefined : 210,
    })),
  });
}

describe("probe rules are decided, not guessed", () => {
  test("a fast 2xx is up, a slow one is degraded", () => {
    expect(classifyResponse({ statusCode: 200, latencyMs: 180 }).status).toBe(
      "up",
    );
    expect(
      classifyResponse({ statusCode: 200, latencyMs: SLOW_RESPONSE_MS + 1 })
        .status,
    ).toBe("degraded");
    // Exactly at the threshold is still up: the bound is "slower than".
    expect(
      classifyResponse({ statusCode: 200, latencyMs: SLOW_RESPONSE_MS }).status,
    ).toBe("up");
  });

  test("an error page is down, throttling is only degraded", () => {
    expect(classifyResponse({ statusCode: 500, latencyMs: 90 }).status).toBe(
      "down",
    );
    expect(classifyResponse({ statusCode: 404, latencyMs: 90 }).status).toBe(
      "down",
    );
    // 429 means the host is alive and serving — we are the ones being limited.
    expect(classifyResponse({ statusCode: 429, latencyMs: 90 }).status).toBe(
      "degraded",
    );
  });

  test("the status code survives into the check row", () => {
    const out = classifyResponse({ statusCode: 502, latencyMs: 120 });
    expect(out.statusCode).toBe(502);
    expect(out.message).toContain("502");
  });

  test("targets are the ones a client actually serves", () => {
    // No /health route exists in apps/themes or apps/reference — the root is
    // what a customer loads, and /instance_name is what the Convex CLI's own
    // network test calls.
    expect(httpTarget("lebistrot.fr")).toBe("https://lebistrot.fr/");
    expect(httpTarget("lebistrot.fr/")).toBe("https://lebistrot.fr/");
    expect(convexTarget("https://swift-otter-101.convex.cloud")).toBe(
      "https://swift-otter-101.convex.cloud/instance_name",
    );
    expect(convexTarget(undefined)).toBeNull();
  });
});

describe("health is derived, and a single blip is not an outage", () => {
  const round = (
    checkedAt: number,
    status: "up" | "degraded" | "down",
    kind: "http" | "convex" = "http",
  ) => ({ kind, status, checkedAt });

  test("nothing measured reads as unknown", () => {
    expect(deriveHealth([])).toBe("unknown");
  });

  test("the latest successful round is healthy", () => {
    expect(deriveHealth([round(200, "up"), round(100, "down")])).toBe("healthy");
  });

  test("one failed round is degraded, two consecutive are down", () => {
    expect(deriveHealth([round(200, "down"), round(100, "up")])).toBe(
      "degraded",
    );
    expect(deriveHealth([round(200, "down"), round(100, "down")])).toBe("down");
  });

  test("a round is scored by its worst check", () => {
    // Site answers, Convex does not: the round failed.
    expect(
      deriveHealth([
        round(200, "up", "http"),
        round(200, "down", "convex"),
        round(100, "up", "http"),
      ]),
    ).toBe("degraded");
    expect(
      deriveHealth([
        round(200, "up", "http"),
        round(200, "down", "convex"),
        round(100, "down", "convex"),
      ]),
    ).toBe("down");
  });

  test("third-party checks do not decide availability", () => {
    // An integration in error says something about Stripe, not about whether
    // the restaurant's system is reachable.
    expect(
      deriveHealth([
        { kind: "integration", status: "down", checkedAt: 200 },
        round(100, "up"),
      ]),
    ).toBe("healthy");
  });
});

describe("uptime is computed from the recorded checks", () => {
  test("no history reports nothing at all", () => {
    expect(uptimePercent([])).toBeNull();
    expect(
      uptimePercent([{ kind: "convex", status: "up", checkedAt: 1 }]),
    ).toBeNull();
  });

  test("it is the share of http probes that answered", () => {
    const samples = Array.from({ length: 10 }, (_, i) => ({
      kind: "http" as const,
      status: (i < 2 ? "down" : "up") as "up" | "down",
      checkedAt: i,
    }));
    expect(uptimePercent(samples)).toBe(80);
  });

  test("a degraded probe still answered, so it counts as available", () => {
    expect(
      uptimePercent([
        { kind: "http", status: "degraded", checkedAt: 2 },
        { kind: "http", status: "up", checkedAt: 1 },
      ]),
    ).toBe(100);
  });

  test("only http probes count", () => {
    expect(
      uptimePercent([
        { kind: "http", status: "up", checkedAt: 3 },
        { kind: "convex", status: "down", checkedAt: 3 },
        { kind: "integration", status: "down", checkedAt: 3 },
      ]),
    ).toBe(100);
  });
});

describe("the producer writes what the console reads back", () => {
  test("the system writer needs no admin identity", async () => {
    const t = convexTest(schema, modules);
    const id = await seedDeployment(t);

    // This is the whole point: a cron carries no identity. The old writer was
    // a public mutation behind requireAdmin, which is why it never had one.
    await record(t, id, Date.now(), [{ kind: "http", status: "up" }]);

    const rows = await t.run(async (ctx) =>
      ctx.db.query("saMonitoringChecks").collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.deploymentId).toBe(id);
  });

  test("it recomputes uptime over the recorded window", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const id = await seedDeployment(t);
    const now = Date.now();

    for (let i = 9; i >= 0; i--) {
      await record(t, id, now - i * 600_000, [
        { kind: "http", status: i === 3 || i === 6 ? "down" : "up" },
      ]);
    }

    const dep = await admin.query(api.saFleet.get, { deploymentId: id });
    expect(dep?.uptime30d).toBe(80);
    expect(dep?.lastCheckAt).toBe(now);
  });

  test("checks older than the window stop counting", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const id = await seedDeployment(t);
    const now = Date.now();

    // Two ancient failures, then two recent successes.
    await record(t, id, now - 40 * 24 * 60 * 60 * 1000, [
      { kind: "http", status: "down" },
    ]);
    await record(t, id, now - 35 * 24 * 60 * 60 * 1000, [
      { kind: "http", status: "down" },
    ]);
    await record(t, id, now - 600_000, [{ kind: "http", status: "up" }]);
    await record(t, id, now, [{ kind: "http", status: "up" }]);

    const dep = await admin.query(api.saFleet.get, { deploymentId: id });
    expect(dep?.uptime30d).toBe(100);
  });

  test("health follows the rounds, blip then outage", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const id = await seedDeployment(t);
    const now = Date.now();

    await record(t, id, now - 1_200_000, [{ kind: "http", status: "up" }]);
    expect(
      (await admin.query(api.saFleet.get, { deploymentId: id }))?.health,
    ).toBe("healthy");

    await record(t, id, now - 600_000, [{ kind: "http", status: "down" }]);
    expect(
      (await admin.query(api.saFleet.get, { deploymentId: id }))?.health,
    ).toBe("degraded");

    await record(t, id, now, [{ kind: "http", status: "down" }]);
    expect(
      (await admin.query(api.saFleet.get, { deploymentId: id }))?.health,
    ).toBe("down");
  });

  test("a round with no http check keeps the last measured uptime", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const id = await seedDeployment(t, {
      convexUrl: "https://swift-otter-101.convex.cloud",
    });
    const now = Date.now();

    await record(t, id, now - 600_000, [{ kind: "http", status: "down" }]);
    await record(t, id, now - 300_000, [{ kind: "http", status: "up" }]);
    const before = (await admin.query(api.saFleet.get, { deploymentId: id }))
      ?.uptime30d;
    expect(before).toBe(50);

    await record(t, id, now, [{ kind: "convex", status: "up" }]);
    const after = (await admin.query(api.saFleet.get, { deploymentId: id }))
      ?.uptime30d;
    // Not overwritten with a fabricated figure.
    expect(after).toBe(50);
  });

  test("only health transitions reach the activity feed", async () => {
    const t = convexTest(schema, modules);
    const id = await seedDeployment(t);
    const now = Date.now();

    for (let i = 5; i >= 0; i--) {
      await record(t, id, now - i * 600_000, [{ kind: "http", status: "up" }]);
    }

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("saActivity")
        .filter((q) => q.eq(q.field("action"), "monitoring.health_changed"))
        .collect(),
    );
    // unknown → healthy, once — not one row per round.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.summary).toContain("unknown");
  });

  test("a deployment deleted mid-round is dropped, not thrown on", async () => {
    const t = convexTest(schema, modules);
    const id = await seedDeployment(t);
    await t.run(async (ctx) => ctx.db.delete(id));

    await expect(
      record(t, id, Date.now(), [{ kind: "http", status: "up" }]),
    ).resolves.toBeUndefined();

    const rows = await t.run(async (ctx) =>
      ctx.db.query("saMonitoringChecks").collect(),
    );
    expect(rows).toHaveLength(0);
  });
});

describe("a deployment nothing has probed claims nothing", () => {
  test("going live does not invent a health", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const id = await seedDeployment(t, { status: "provisioning" });

    await admin.mutation(api.saFleet.updateStatus, {
      deploymentId: id,
      status: "live",
    });

    const dep = await admin.query(api.saFleet.get, { deploymentId: id });
    expect(dep?.status).toBe("live");
    expect(dep?.goLiveAt).toBeTypeOf("number");
    // It used to be promoted to "healthy" here, with nothing behind it.
    expect(dep?.health).toBe("unknown");
  });

  test("the fleet uptime is null rather than a flattering default", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    await seedDeployment(t, { uptime30d: 100 });

    const overview = await admin.query(api.saMonitoring.overview, {});
    expect(overview.rollup.avgUptime).toBeNull();
    expect(overview.rollup.monitored).toBe(0);
    expect(overview.deployments[0]!.lastCheckAt).toBeNull();

    const stats = await admin.query(api.saFleet.stats, {});
    expect(stats.avgUptime).toBeNull();
  });

  test("an unprobed deployment does not dilute a measured average", async () => {
    const t = convexTest(schema, modules);
    const admin = await asAdmin(t);
    const measured = await seedDeployment(t, { name: "mesuré" });
    await seedDeployment(t, { name: "jamais-sondé", uptime30d: 100 });

    await record(t, measured, Date.now() - 600_000, [
      { kind: "http", status: "down" },
    ]);
    await record(t, measured, Date.now(), [{ kind: "http", status: "up" }]);

    const overview = await admin.query(api.saMonitoring.overview, {});
    expect(overview.rollup.monitored).toBe(1);
    expect(overview.rollup.avgUptime).toBe(50);
  });
});

describe("target selection", () => {
  test("only live and degraded deployments are probed", async () => {
    const t = convexTest(schema, modules);
    const live = await seedDeployment(t, { status: "live", name: "live" });
    const degraded = await seedDeployment(t, {
      status: "degraded",
      name: "degraded",
    });
    for (const status of [
      "provisioning",
      "staging",
      "suspended",
      "offboarded",
    ] as const) {
      await seedDeployment(t, { status, name: status });
    }

    const targets = await t.query(internal.saMonitoring.probeTargets, {});
    expect(targets.map((x) => x.deploymentId).sort()).toEqual(
      [live, degraded].sort(),
    );
  });

  test("an explicitly named deployment is probed whatever its status", async () => {
    const t = convexTest(schema, modules);
    const suspended = await seedDeployment(t, { status: "suspended" });

    const targets = await t.query(internal.saMonitoring.probeTargets, {
      deploymentId: suspended,
    });
    expect(targets).toHaveLength(1);
    expect(targets[0]!.deploymentId).toBe(suspended);
  });

  test("targets carry what the probe needs and nothing else", async () => {
    const t = convexTest(schema, modules);
    await seedDeployment(t, {
      domain: "lebistrot.fr",
      convexUrl: "https://swift-otter-101.convex.cloud",
    });

    const targets = await t.query(internal.saMonitoring.probeTargets, {});
    expect(targets[0]).toMatchObject({
      domain: "lebistrot.fr",
      convexUrl: "https://swift-otter-101.convex.cloud",
    });
  });
});

describe("the console's own surface still requires an admin", () => {
  test("the overview and the feed refuse an anonymous caller", async () => {
    const t = convexTest(schema, modules);
    await seedDeployment(t);

    await expect(t.query(api.saMonitoring.overview, {})).rejects.toThrow();
    await expect(
      t.query(api.saMonitoring.recentChecks, {}),
    ).rejects.toThrow();
  });

  test("« Sonder maintenant » is gated before it reaches the network", async () => {
    const t = convexTest(schema, modules);
    await seedDeployment(t);

    // An action cannot call requireAdmin, so it delegates to admin.assertAdmin
    // through ctx.runQuery — which rejects here, before any fetch is attempted.
    await expect(t.action(api.saMonitoring.probeNow, {})).rejects.toThrow(
      /authentifié|autoris/i,
    );
  });

  test("a signed-in non-admin is refused too", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "apporteur@example.com" }),
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("affiliateUsers", {
        userId,
        role: "affiliate" as const,
        status: "active" as const,
        stripeConnectStatus: "not_started" as const,
        createdAt: Date.now(),
      });
    });
    const affiliate = t.withIdentity({ subject: userId });

    await expect(
      affiliate.action(api.saMonitoring.probeNow, {}),
    ).rejects.toThrow(/autoris/i);
  });
});

describe("the loop is actually scheduled", () => {
  test("a cron runs the prober every ten minutes", () => {
    const jobs = Object.values(crons.crons);
    const probe = jobs.find((c) => c.name === "saMonitoring:runProbes");
    expect(probe).toBeDefined();
    expect(probe!.schedule).toEqual({ type: "cron", cron: "*/10 * * * *" });
  });
});
