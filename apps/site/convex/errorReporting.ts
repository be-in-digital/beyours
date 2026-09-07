/**
 * Where a backend error goes on beyours.fr.
 *
 * Before this file the answer was `console.error` into the Convex dashboard's
 * log window, which expires. That window is the entire failure record of the
 * Stripe webhook — the endpoint that settles a purchase, records a renewal and
 * flags a failed payment. When a renewal charge fails to record, nobody finds
 * out: the log has rolled over by the time anyone thinks to look, and the
 * customer's next contact is about something else.
 *
 * #368 wired this for the engine (`apps/*\/convex/errorReporting.ts`). It did
 * not reach here, because `apps/site` shares no package with the engine — see
 * `lib/observability/sentry.ts` for why that boundary is kept and what it costs.
 *
 * NO `"use node"`, deliberately. A `"use node"` module may only export actions,
 * and nothing outside one can import from it — which would exclude every
 * `httpAction` (they cannot be `"use node"` at all) and therefore the two
 * Stripe webhook routes, i.e. exactly the surface this exists for. The default
 * Convex runtime has `fetch`, and the envelope is built with no SDK.
 *
 * ## How to use it
 *
 * From an action or an `httpAction`:
 *
 * ```ts
 * } catch (err) {
 *   console.error(`Error processing ${event.type}:`, err);
 *   await captureBackendError(ctx, { error: err, source: "stripeWebhook", tags: { … } });
 *   return new Response("Processing error", { status: 500 });
 * }
 * ```
 *
 * `console.error` STAYS. The dashboard is still the fastest place to read a log
 * while a deploy is in front of you; this adds a second destination that
 * outlives it, it does not replace the first.
 *
 * ## The one trap
 *
 * From a **mutation**, the report is scheduled inside the mutation's
 * transaction — so it survives only if the mutation goes on to COMMIT. That is
 * right for the `console.error`-and-continue pattern and wrong for a mutation
 * that rethrows: the throw rolls the transaction back and takes the scheduled
 * report with it. Report a rethrowing mutation from the action above it, which
 * is not a transaction and cannot be rolled back.
 *
 * See `apps/docs/deployment/sentry.md`.
 */

import { v } from "convex/values";
import {
  buildSentryEnvelope,
  buildSentryErrorEvent,
  describeUnknownError,
  formatSentryEventId,
  parseSentryDsn,
  resolveSentryOptions,
  sentryAuthHeader,
  type SentryEnvSource,
  type SentryExtraValue,
} from "../lib/observability/sentry";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

/** Identifies this transport to Sentry, and appears on every event. */
const SENTRY_CLIENT = "beyours-site-convex/1.0.0";

/**
 * How long the ingest POST may take.
 *
 * A Convex action has a finite budget and Stripe is waiting on the webhook it
 * belongs to. Sentry being slow must cost a report, never a retry storm from
 * Stripe: past this the request is aborted and the failure is logged like any
 * other.
 */
const INGEST_TIMEOUT_MS = 3_000;

/** What a report carries. Flat and validated, because it crosses a function boundary. */
const reportArgs = {
  /** What was running — `"stripeWebhook"`, `"saMonitoring.runRound"`. */
  source: v.string(),
  /** The exception class. Titles the Sentry issue. */
  name: v.string(),
  message: v.string(),
  stack: v.optional(v.string()),
  level: v.optional(
    v.union(
      v.literal("fatal"),
      v.literal("error"),
      v.literal("warning"),
      v.literal("info"),
    ),
  ),
  /** Searchable in Sentry. Keep them low-cardinality: an event type, a plan. */
  tags: v.optional(v.record(v.string(), v.string())),
  /**
   * Context, flat and primitive. Scrubbed by `redactSentryExtra` before it
   * leaves, so a key named `signature` or `token` is filtered even when a call
   * site forgets. The validator refuses nesting, which is what makes that one
   * pass a complete guard rather than a shallow one.
   */
  extra: v.optional(
    v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null())),
  ),
};

/** What `reportError` answers, so a caller and a test can tell what happened. */
export type ReportOutcome =
  | { reported: true; eventId: string }
  | { reported: false; reason: "no-dsn" | "bad-dsn" | "rejected" | "threw" };

/**
 * Sends one event to this deployment's Sentry project.
 *
 * `internalAction`, so it is unreachable from a browser: the argument list is
 * an arbitrary message and arbitrary tags, and a public version would let
 * anyone write into the issue stream and exhaust the quota a real incident
 * needs.
 *
 * Never throws. Every failure — no DSN, a malformed DSN, a 429, a timeout —
 * ends as a returned reason and a `console.error`. A reporter that throws while
 * reporting turns one failed webhook into two, and the second is invisible for
 * exactly the same reason as the first.
 */
export const reportError = internalAction({
  args: reportArgs,
  handler: async (_ctx, args): Promise<ReportOutcome> => {
    try {
      const options = resolveSentryOptions("convex", process.env as SentryEnvSource);
      // The normal state of CI and of local development. It has to cost
      // nothing and say nothing.
      if (!options) return { reported: false, reason: "no-dsn" };

      // Unreachable in practice, and kept because "in practice" is doing work
      // in that sentence: `resolveSentryOptions` gates on `isSentryDsn`, which
      // IS `parseSentryDsn(...) !== null`. This branch is what stops the two
      // ever drifting into disagreeing silently.
      const dsn = parseSentryDsn(options.dsn);
      if (!dsn) {
        console.error(
          "[errorReporting] SENTRY_DSN is not a usable DSN; the report was dropped",
        );
        return { reported: false, reason: "bad-dsn" };
      }

      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      const now = Date.now();

      const event = buildSentryErrorEvent({
        error: rebuildError(args.name, args.message, args.stack),
        eventId: formatSentryEventId(bytes),
        now,
        environment: options.environment,
        release: options.release,
        level: args.level,
        source: args.source,
        tags: { ...options.initialScope.tags, ...args.tags },
        extra: args.extra,
      });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), INGEST_TIMEOUT_MS);
      try {
        const response = await fetch(dsn.envelopeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-sentry-envelope",
            "X-Sentry-Auth": sentryAuthHeader(dsn, SENTRY_CLIENT),
          },
          body: buildSentryEnvelope(event, options.dsn, now),
          signal: controller.signal,
        });

        if (!response.ok) {
          // 429 is the interesting one: the project is over quota, which is a
          // configuration problem on our side and not a transient fault.
          console.error(
            `[errorReporting] Sentry refused the event: ${response.status} ${response.statusText}`,
          );
          return { reported: false, reason: "rejected" };
        }

        return { reported: true, eventId: event.event_id };
      } finally {
        clearTimeout(timer);
      }
    } catch (failure) {
      console.error("[errorReporting] the reporter itself failed:", failure);
      return { reported: false, reason: "threw" };
    }
  },
});

/**
 * Rebuilds an `Error` from the flattened fields, so `describeUnknownError` and
 * the stack parser see the same shape here as they would at the call site.
 *
 * The alternative — passing the described pieces straight through — would give
 * two code paths producing Sentry events, and the one used in production would
 * be the one no unit test covers.
 */
function rebuildError(name: string, message: string, stack: string | undefined): Error {
  const error = new Error(message);
  error.name = name;
  // Assigning `undefined` would leave V8's own capture in place, pointing at
  // this function rather than at the code that failed. Clear it instead.
  error.stack = stack ?? "";
  return error;
}

/** Only the scheduler is needed, so a query, a mutation and an action all fit. */
type ReportingCtx = { scheduler: MutationCtx["scheduler"] };

/** What a call site passes. `error` is the caught value, whatever shape it has. */
export interface CaptureInput {
  error: unknown;
  source: string;
  level?: "fatal" | "error" | "warning" | "info";
  tags?: Record<string, string>;
  extra?: Record<string, SentryExtraValue>;
}

/**
 * Hands one caught error to the reporter, from anywhere with a scheduler.
 *
 * Scheduled rather than awaited even from an action: a webhook must answer
 * Stripe before Sentry answers us, and a `runAfter(0)` is a database write that
 * returns immediately. It also means one code path from every kind of function
 * instead of a branch per context.
 *
 * Never throws, so it is safe inside a `catch` — the whole point is that adding
 * it to an existing handler cannot change what that handler does.
 *
 * @see the transaction trap in this module's header before calling it from a
 *      mutation that rethrows.
 */
export async function captureBackendError(
  ctx: ReportingCtx,
  input: CaptureInput,
): Promise<void> {
  try {
    const described = describeUnknownError(input.error);
    await ctx.scheduler.runAfter(0, internal.errorReporting.reportError, {
      source: input.source,
      name: described.type,
      message: described.value,
      ...(described.stack ? { stack: described.stack } : {}),
      ...(input.level ? { level: input.level } : {}),
      ...(input.tags ? { tags: input.tags } : {}),
      ...(input.extra ? { extra: input.extra } : {}),
    });
  } catch (schedulingFailure) {
    // The original error has already been logged by the call site. This one is
    // about the reporting itself, and it must not replace it.
    console.error("[errorReporting] could not schedule a report:", schedulingFailure);
  }
}
