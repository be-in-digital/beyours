/**
 * Running a test's scheduled jobs to completion before the test ends.
 *
 * `ctx.scheduler.runAfter(0, …)` leaves a job `pending` until a timer fires,
 * and `finishInProgressScheduledFunctions` only waits on jobs that have
 * already STARTED. So a test that returns straight after the mutation that
 * scheduled one leaves the job running against a harness being torn down,
 * which surfaces as an unhandled `Write outside of transaction
 * …_scheduled_functions`.
 *
 * That does not fail a single test — every assertion still passes — it fails
 * the RUN, which is how it reaches CI as a green suite with a red exit code.
 * Anything that settles an order (confirmation email) or records a renewal
 * (receipt, dunning mail) schedules work and needs this.
 */

import type { convexTest } from "convex-test";

type TestConvex = ReturnType<typeof convexTest>;

/** Poll until nothing is left to start, then wait on what is running. */
export async function drainScheduled(t: TestConvex): Promise<void> {
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

/** How many jobs were scheduled for a function whose name ends `fnSuffix`. */
export async function scheduledCount(
  t: TestConvex,
  fnSuffix: string,
): Promise<number> {
  const jobs = await t.run((ctx) =>
    ctx.db.system.query("_scheduled_functions").collect(),
  );
  return jobs.filter((job) => job.name.includes(fnSuffix)).length;
}
