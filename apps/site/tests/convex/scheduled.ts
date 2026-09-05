/**
 * Run every scheduled job to completion before a test ends.
 *
 * `finishInProgressScheduledFunctions` only waits on jobs that have already
 * started, and `runAfter(0, …)` leaves them `pending` until a timer fires — so
 * a test that returns straight after a mutation which schedules email leaves
 * those actions running against a harness being torn down, which surfaces as
 * "Write outside of transaction" and fails the run. Poll until nothing is left.
 *
 * The same helper is inlined in ./rateLimit.test.ts, which predates this file;
 * it is left there rather than churning a passing test file for a move.
 */
import type { convexTest } from "convex-test";

export async function drainScheduled(
  t: ReturnType<typeof convexTest>,
): Promise<void> {
  for (let i = 0; i < 500; i++) {
    const remaining = await t.run(async (ctx) => {
      const jobs = await ctx.db.system.query("_scheduled_functions").collect();
      return jobs.filter(
        (job) => job.state.kind === "pending" || job.state.kind === "inProgress",
      ).length;
    });
    if (remaining === 0) return;
    await t.finishInProgressScheduledFunctions();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("drainScheduled: scheduled functions never settled");
}
