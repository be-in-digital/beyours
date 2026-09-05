/**
 * Monitoring — the loop behind the console.
 *
 * `saMonitoringChecks` used to have exactly one non-seed writer, a public
 * mutation behind `requireAdmin` that nothing called. So every number the
 * console showed came from provisioning, not from measurement: `uptime30d` was
 * the literal 100 stamped by `saFleet.create`, and `health` was flipped to
 * "healthy" the day the deployment went live. This module is the missing
 * producer — a cron probes each live instance, records what it saw, and the
 * two derived columns are recomputed from those rows and nothing else.
 *
 * WHAT IS PROBED, and why those targets:
 *
 * - `https://<domain>/` — the storefront root. There is deliberately no
 *   invented health endpoint: neither `apps/themes` nor `apps/reference`
 *   serves one (their only routes are `app/api/{auth,translate,upload,files,
 *   email,webhooks}`), so a probe of `/health` would report every client down.
 *   The root is what a customer loads, which makes it the honest signal. If a
 *   real `/health` route ever ships in `apps/themes`, point `httpTarget()` at
 *   it — the rest of this module does not care.
 * - `<convexUrl>/instance_name` — the client's Convex backend. This is not a
 *   guess either: it is the endpoint `npx convex network-test` itself uses to
 *   decide a deployment is reachable (`convex/dist/cjs/cli/lib/networkTest.js`
 *   builds `new URL("/instance_name", url)` and requires a 200). A plain GET on
 *   the deployment root is not a documented liveness signal, so we do not fake
 *   one from it. Skipped entirely when the deployment has no `convexUrl`.
 *
 * WHAT IS DELIBERATELY NOT PROBED: the `integration` and `webhook` check kinds.
 * Reaching Stripe or Uber Eats on a client's behalf needs that client's
 * credentials, which this backend does not hold. Those two kinds stay in the
 * schema, unwritten, rather than being filled with a signal we cannot measure.
 */

import { v } from "convex/values";
import {
  query,
  action,
  internalQuery,
  internalMutation,
  internalAction,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./admin";
import { recordSaActivity } from "./saActivity";

/* ── Tunables ──
   Every one of these is a judgement call, so each carries its reasoning. */

/** How long a target gets to answer before the probe gives up.
    A cold Next.js serverless start on a low-traffic restaurant site routinely
    costs a second or two; 10 s is far past any legitimate cold start and well
    past the point a customer has closed the tab. A timeout is recorded as a
    `down` check, never as a crashed run. */
export const PROBE_TIMEOUT_MS = 10_000;

/** Above this, a response that arrived is still recorded, as `degraded`.
    Set above the cold-start band on purpose: 1.5 s would flag every first
    request of the morning and teach the console's operator to ignore it. */
export const SLOW_RESPONSE_MS = 3_000;

/** Targets probed at once. The fleet is ≤ ~30 deployments (see
    MISE_EN_PROD.md §5), so this bounds a round at a handful of open sockets
    while still finishing well inside one action. */
export const PROBE_CONCURRENCY = 5;

/** Window `uptime30d` is computed over — the name of the column, literally. */
export const UPTIME_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Ceiling on the rows one recompute reads. At the cron's 10-minute cadence a
    deployment produces ~4 320 http checks and as many convex checks over 30
    days, so this cap sits comfortably above a full window and only bites if
    the cadence is raised. It is a `take` on a descending index scan, so
    hitting it shortens the window rather than corrupting the ratio. */
export const UPTIME_SAMPLE_CAP = 12_000;

/** Identifies us in the client's access logs; a probe that looks like an
    anonymous bot is the kind of thing a client's WAF blocks. */
const PROBE_USER_AGENT = "BeYours-Monitor/1.0 (+https://beyours.fr)";

/** Kinds that say something about availability. `integration` and `webhook`
    describe a third party, not whether the client's system is reachable, so
    they are excluded from both derivations below. */
const AVAILABILITY_KINDS: readonly string[] = ["http", "convex"];

type CheckStatus = "up" | "degraded" | "down";
type CheckKind = "http" | "convex" | "integration" | "webhook";
type Health = "healthy" | "degraded" | "down" | "unknown";

const checkKind = v.union(
  v.literal("http"),
  v.literal("convex"),
  v.literal("integration"),
  v.literal("webhook"),
);
const checkStatus = v.union(
  v.literal("up"),
  v.literal("degraded"),
  v.literal("down"),
);

/* ── Pure rules ──
   Kept as plain functions, and exported, so the thresholds above can be tested
   without a network: the interesting part of a prober is how it decides, not
   how it fetches. */

export type ProbeSample = {
  kind: CheckKind;
  status: CheckStatus;
  checkedAt: number;
};

export type ProbeOutcome = {
  status: CheckStatus;
  statusCode?: number;
  latencyMs?: number;
  message?: string;
};

const WORSE: Record<CheckStatus, number> = { up: 0, degraded: 1, down: 2 };

function worseOf(a: CheckStatus, b: CheckStatus): CheckStatus {
  return WORSE[b] > WORSE[a] ? b : a;
}

/**
 * Maps one HTTP response to a check status.
 *
 * - anything ≥ 400 is `down`: a customer who gets a 404 or a 502 cannot order,
 *   and the exact code is kept in `statusCode` so the distinction is not lost;
 * - 429 is the exception — the host is alive and serving, we are the ones
 *   being throttled, so it is `degraded` rather than an outage;
 * - a healthy response that took longer than `SLOW_RESPONSE_MS` is `degraded`.
 */
export function classifyResponse(input: {
  statusCode: number;
  latencyMs: number;
}): ProbeOutcome {
  const { statusCode, latencyMs } = input;
  if (statusCode === 429) {
    return {
      status: "degraded",
      statusCode,
      latencyMs,
      message: "HTTP 429 — trop de requêtes",
    };
  }
  if (statusCode >= 400) {
    return {
      status: "down",
      statusCode,
      latencyMs,
      message: `HTTP ${statusCode}`,
    };
  }
  if (latencyMs > SLOW_RESPONSE_MS) {
    return {
      status: "degraded",
      statusCode,
      latencyMs,
      message: `Réponse lente (${latencyMs} ms)`,
    };
  }
  return { status: "up", statusCode, latencyMs };
}

/** Verdicts of the most recent probe rounds, newest first.
    A round is the set of checks sharing a `checkedAt` — the prober stamps every
    check of one pass with the same instant — and its verdict is its worst
    check, so a site that answers while its Convex backend is down is not
    reported as healthy. */
function recentRoundVerdicts(
  samples: readonly ProbeSample[],
  limit: number,
): CheckStatus[] {
  const byRound = new Map<number, CheckStatus>();
  for (const s of samples) {
    if (!AVAILABILITY_KINDS.includes(s.kind)) continue;
    const current = byRound.get(s.checkedAt);
    byRound.set(
      s.checkedAt,
      current === undefined ? s.status : worseOf(current, s.status),
    );
  }
  return [...byRound.entries()]
    .sort((a, b) => b[0] - a[0])
    .slice(0, limit)
    .map(([, verdict]) => verdict);
}

/**
 * Health of a deployment, derived from what was actually recorded.
 *
 * The noise guard is the whole point: a probe that fails once is a probe that
 * failed once — a redeploy, a DNS blip, a proxy hiccup — and paging on it
 * trains everyone to ignore the console. So a single failed round reads as
 * `degraded`, and only two consecutive failed rounds (≈ 20 minutes at the cron
 * cadence) read as `down`. A deployment nothing has probed stays `unknown`
 * rather than inheriting an optimistic default.
 */
export function deriveHealth(samples: readonly ProbeSample[]): Health {
  const [latest, previous] = recentRoundVerdicts(samples, 2);
  if (latest === undefined) return "unknown";
  if (latest === "up") return "healthy";
  if (latest === "degraded") return "degraded";
  return previous === "down" ? "down" : "degraded";
}

/**
 * Availability over the sampled window, as a percentage, or `null` when there
 * is nothing to compute it from.
 *
 * Only `http` checks count. Uptime, as the console labels it, is the share of
 * time the customer-facing site answered; folding the Convex probe in would
 * double the sample for deployments that have a `convexUrl` and halve the
 * figure of a client whose site is fine but whose backend is not — two
 * different facts, and `health` already carries the second one.
 *
 * `degraded` counts as available on purpose: the site answered. Slowness is
 * surfaced through the check feed and through `health`, not by quietly
 * deducting from a number labelled uptime.
 */
export function uptimePercent(samples: readonly ProbeSample[]): number | null {
  let total = 0;
  let down = 0;
  for (const s of samples) {
    if (s.kind !== "http") continue;
    total += 1;
    if (s.status === "down") down += 1;
  }
  if (total === 0) return null;
  return Math.round(((total - down) / total) * 10_000) / 100;
}

/** The URL probed for a deployment's storefront. */
export function httpTarget(domain: string): string {
  return `https://${domain.replace(/\/+$/, "")}/`;
}

/** The URL probed for a deployment's Convex backend, or null when it has none. */
export function convexTarget(convexUrl: string | undefined): string | null {
  if (!convexUrl) return null;
  return `${convexUrl.replace(/\/+$/, "")}/instance_name`;
}

/* ── Read surface (the console) ── */

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const deps = await ctx.db.query("saDeployments").take(500);
    const rows = await Promise.all(
      deps.map(async (d) => {
        const latest = await ctx.db
          .query("saMonitoringChecks")
          .withIndex("by_deployment_time", (q) => q.eq("deploymentId", d._id))
          .order("desc")
          .first();
        return {
          _id: d._id,
          name: d.name,
          restaurantName: d.restaurantName,
          domain: d.domain,
          status: d.status,
          health: d.health,
          uptime30d: d.uptime30d,
          /* Null until the prober has run at least once. Every reader has to
             branch on it: `uptime30d` before the first check is a placeholder,
             and rendering it is exactly the lie this module exists to end. */
          lastCheckAt: d.lastCheckAt ?? null,
          version: d.version,
          region: d.region,
          latestCheck: latest,
          integrationErrors: d.integrations.filter((i) => i.status === "error"),
        };
      }),
    );
    const byHealth: Record<string, number> = {
      healthy: 0,
      degraded: 0,
      down: 0,
      unknown: 0,
    };
    let uptimeSum = 0;
    let monitored = 0;
    let integrationErrors = 0;
    for (const r of rows) {
      byHealth[r.health] = (byHealth[r.health] ?? 0) + 1;
      integrationErrors += r.integrationErrors.length;
      if (
        (r.status === "live" || r.status === "degraded") &&
        r.lastCheckAt !== null
      ) {
        uptimeSum += r.uptime30d;
        monitored += 1;
      }
    }
    const rank: Record<string, number> = {
      down: 3,
      degraded: 2,
      unknown: 1,
      healthy: 0,
    };
    return {
      deployments: rows.sort(
        (a, b) => (rank[b.health] ?? 0) - (rank[a.health] ?? 0),
      ),
      rollup: {
        total: deps.length,
        byHealth: {
          healthy: byHealth.healthy ?? 0,
          degraded: byHealth.degraded ?? 0,
          down: byHealth.down ?? 0,
          unknown: byHealth.unknown ?? 0,
        },
        integrationErrors,
        monitored,
        /* Null, not 100, when nothing has been probed: an average over an
           empty set is not a full score. */
        avgUptime: monitored ? uptimeSum / monitored : null,
      },
    };
  },
});

export const recentChecks = query({
  args: {
    deploymentId: v.optional(v.id("saDeployments")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = args.limit ?? 40;
    let checks: Doc<"saMonitoringChecks">[];
    if (args.deploymentId) {
      checks = await ctx.db
        .query("saMonitoringChecks")
        .withIndex("by_deployment_time", (q) =>
          q.eq("deploymentId", args.deploymentId!),
        )
        .order("desc")
        .take(limit);
    } else {
      checks = await ctx.db
        .query("saMonitoringChecks")
        .withIndex("by_checkedAt")
        .order("desc")
        .take(limit);
    }
    const deps = await ctx.db.query("saDeployments").take(500);
    const depMap = new Map(deps.map((d) => [d._id as Id<"saDeployments">, d]));
    return checks.map((c) => ({
      ...c,
      deploymentName: depMap.get(c.deploymentId)?.restaurantName ?? "—",
    }));
  },
});

/* ── Producer ── */

/**
 * The deployments a round should probe.
 *
 * Fleet-wide, that is `live` and `degraded` only: `provisioning` and `staging`
 * instances have no domain worth reaching yet, and `suspended` / `offboarded`
 * ones are expected to be unreachable — recording them as down would fill the
 * console with outages we caused on purpose.
 *
 * With an explicit `deploymentId` the status filter is dropped: an operator who
 * clicks « Sonder maintenant » on a suspended instance is asking a question,
 * and answering "no data" would be unhelpful.
 */
export const probeTargets = internalQuery({
  args: { deploymentId: v.optional(v.id("saDeployments")) },
  handler: async (ctx, args) => {
    const deps = args.deploymentId
      ? [await ctx.db.get(args.deploymentId)].filter(
          (d): d is Doc<"saDeployments"> => d !== null,
        )
      : (await ctx.db.query("saDeployments").take(500)).filter(
          (d) => d.status === "live" || d.status === "degraded",
        );
    return deps.map((d) => ({
      deploymentId: d._id,
      restaurantName: d.restaurantName,
      domain: d.domain,
      convexUrl: d.convexUrl ?? null,
    }));
  },
});

/**
 * Records one probe round for one deployment and recomputes what the console
 * reads back from it.
 *
 * `internalMutation`, so the cron can call it: the old `recordCheck` was a
 * public mutation behind `requireAdmin`, which made the table unwritable by
 * anything that was not a logged-in human — the reason it never had a producer.
 *
 * All checks of a round share `checkedAt`, which is what lets `deriveHealth`
 * tell "this pass failed" from "these two checks failed".
 */
export const recordProbeResults = internalMutation({
  args: {
    deploymentId: v.id("saDeployments"),
    checkedAt: v.optional(v.number()),
    results: v.array(
      v.object({
        kind: checkKind,
        target: v.string(),
        status: checkStatus,
        latencyMs: v.optional(v.number()),
        statusCode: v.optional(v.number()),
        message: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const dep = await ctx.db.get(args.deploymentId);
    /* Offboarded and deleted between the query and the write: drop the round
       rather than failing it — there is nothing left to report on. */
    if (!dep) return;
    if (args.results.length === 0) return;

    const checkedAt = args.checkedAt ?? Date.now();
    for (const r of args.results) {
      await ctx.db.insert("saMonitoringChecks", {
        deploymentId: args.deploymentId,
        kind: r.kind,
        target: r.target,
        status: r.status,
        latencyMs: r.latencyMs,
        statusCode: r.statusCode,
        message: r.message,
        checkedAt,
      });
    }

    const samples = await ctx.db
      .query("saMonitoringChecks")
      .withIndex("by_deployment_time", (q) =>
        q
          .eq("deploymentId", args.deploymentId)
          .gte("checkedAt", checkedAt - UPTIME_WINDOW_MS),
      )
      .order("desc")
      .take(UPTIME_SAMPLE_CAP);

    const health = deriveHealth(samples);
    const uptime = uptimePercent(samples);
    await ctx.db.patch(args.deploymentId, {
      /* A backfilled round must not rewind the clock the console shows. */
      lastCheckAt: Math.max(checkedAt, dep.lastCheckAt ?? 0),
      health,
      /* Null only when the round carried no http check; keeping the previous
         figure beats overwriting it with a fabricated one. */
      uptime30d: uptime ?? dep.uptime30d,
      updatedAt: Date.now(),
    });

    /* Only transitions are logged. A round every ten minutes means 144 rows a
       day per failing deployment, which would bury the activity feed the
       console reads — and "still down" is not news. */
    if (health !== dep.health) {
      await recordSaActivity(ctx, {
        kind: "system",
        action: "monitoring.health_changed",
        summary: `${dep.restaurantName} · santé ${dep.health} → ${health}`,
        actorName: "Monitoring",
        customerEmail: dep.customerEmail,
        deploymentId: dep._id,
      });
    }
  },
});

/** Truncated so a verbose upstream error cannot dominate a check row. */
function probeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return `Délai dépassé (${Math.round(PROBE_TIMEOUT_MS / 1000)} s)`;
    }
    return err.message.slice(0, 200);
  }
  return String(err).slice(0, 200);
}

/**
 * One GET, measured.
 *
 * A network failure is a result, not an incident in the prober, so everything
 * the request can raise is caught and returned as a `down` check. The abort
 * signal is built *before* that `try` on purpose: if the runtime ever lacked
 * `AbortSignal.timeout`, catching it here would record the entire fleet as
 * down. Thrown, it surfaces as a failed round instead — a broken prober must
 * never be reported as a broken client.
 */
async function probeUrl(target: string): Promise<ProbeOutcome> {
  /* Without this, one unresponsive host would hold the round open for as long
     as the runtime allows and starve every deployment behind it. */
  const signal = AbortSignal.timeout(PROBE_TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(target, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": PROBE_USER_AGENT },
      signal,
    });
    return classifyResponse({
      statusCode: res.status,
      latencyMs: Date.now() - started,
    });
  } catch (err) {
    return {
      status: "down",
      latencyMs: Date.now() - started,
      message: probeErrorMessage(err),
    };
  }
}

/** Runs `worker` over `items`, at most `limit` in flight. */
async function mapBounded<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      for (;;) {
        const index = cursor++;
        const item = items[index];
        if (item === undefined) return;
        await worker(item);
      }
    })(),
  );
  await Promise.all(lanes);
}

type ProbeRoundResult = { probed: number; failed: number };

/**
 * One pass over the fleet.
 *
 * Every deployment is isolated: its probes are caught, and so is the mutation
 * that records them, because a round that aborts halfway leaves the console
 * showing a state that is neither the old one nor the new one.
 */
async function runProbeRound(
  ctx: ActionCtx,
  deploymentId?: Id<"saDeployments">,
): Promise<ProbeRoundResult> {
  const targets = await ctx.runQuery(internal.saMonitoring.probeTargets, {
    deploymentId,
  });
  /* One instant for the whole round, so every check written by this pass shares
     a `checkedAt` and `deriveHealth` can group them. */
  const checkedAt = Date.now();
  let failed = 0;

  await mapBounded(targets, PROBE_CONCURRENCY, async (target) => {
    try {
      const results: {
        kind: CheckKind;
        target: string;
        status: CheckStatus;
        latencyMs?: number;
        statusCode?: number;
        message?: string;
      }[] = [];

      const http = httpTarget(target.domain);
      results.push({ kind: "http", target: http, ...(await probeUrl(http)) });

      const convex = convexTarget(target.convexUrl ?? undefined);
      if (convex) {
        results.push({
          kind: "convex",
          target: convex,
          ...(await probeUrl(convex)),
        });
      }

      await ctx.runMutation(internal.saMonitoring.recordProbeResults, {
        deploymentId: target.deploymentId,
        checkedAt,
        results,
      });
    } catch (err) {
      failed += 1;
      console.error(
        `Monitoring probe failed for ${target.restaurantName}:`,
        err,
      );
    }
  });

  return { probed: targets.length - failed, failed };
}

/** The cron entry point (see convex/crons.ts). */
export const runProbes = internalAction({
  args: {},
  handler: async (ctx): Promise<ProbeRoundResult> => {
    return await runProbeRound(ctx);
  },
});

/**
 * « Sonder maintenant » — the same round, on demand.
 *
 * An action cannot call `requireAdmin`: that helper takes a `QueryCtx |
 * MutationCtx` and reads the database, which an `ActionCtx` has no access to.
 * So authentication is delegated to `admin.assertAdmin`, an internal query that
 * runs the very same check — `ctx.runQuery` carries the caller's identity, so
 * this is the admin gate, not a weaker copy of it.
 */
export const probeNow = action({
  args: { deploymentId: v.optional(v.id("saDeployments")) },
  handler: async (ctx, args): Promise<ProbeRoundResult> => {
    await ctx.runQuery(internal.admin.assertAdmin, {});
    return await runProbeRound(ctx, args.deploymentId);
  },
});
