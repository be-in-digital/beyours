/**
 * The half of Auto Blog that was sold and never built.
 *
 * `blogAutoConfig` stored a frequency, days, an hour, a timezone and an
 * approval mode. `blogAutoQueue` carried an index whose comment read "Cron:
 * find pending jobs due for execution". Between them there was nothing: an
 * owner who configured "weekly, Tuesday, 09:00, auto-publish" got an article
 * only by pressing "Generate with AI" themselves.
 *
 * Planning is separate from generating, as `tasks/auto-blog-spec.md` §4.2 asks.
 * The planner is a mutation — cheap, transactional, and safe to run every hour;
 * the executor is an action, because it talks to OpenAI and may take minutes.
 * Splitting them means a generation that dies half way leaves a queue row
 * saying so, instead of an hour of silence.
 */

import { checkAutoBlogAccess, releaseArticleQuota } from "./blogAutoGuards"
import {
  buildIdempotencyKey,
  dueSlots,
  slotKey,
  themeForSlot,
} from "./blogAutoSchedule"

export interface PlanningSummary {
  /** Configurations examined. */
  considered: number
  /** Jobs whose executor never came back, put back in the queue. */
  requeuedStale: number
  /** Jobs whose article had in fact been written before the executor died. */
  salvagedStale: number
  /** Jobs written. */
  queued: number
  /** Due, but the owner's plan or quota said no. */
  skippedNoAccess: number
  /** Due, but this slot was already queued by an earlier sweep. */
  skippedDuplicate: number
}

/**
 * Queue an article for every enabled configuration whose hour has come.
 *
 * Runs hourly and writes nothing else: no OpenAI call, no article. A
 * configuration is skipped — never failed — when the subscription lapsed or the
 * monthly quota is spent, because neither is an error the owner needs woken up
 * about, and the next month starts it again by itself.
 */
export async function planAutoBlogJobsCore(
  ctx: any,
  at: number,
): Promise<PlanningSummary> {
  const recovered = await requeueStaleJobsCore(ctx, at)
  const summary: PlanningSummary = {
    considered: 0,
    requeuedStale: recovered.requeued,
    salvagedStale: recovered.salvaged,
    queued: 0,
    skippedNoAccess: 0,
    skippedDuplicate: 0,
  }

  const configs = await ctx.db
    .query("blogAutoConfig")
    .withIndex("by_isEnabled", (q: any) => q.eq("isEnabled", true))
    .collect()

  for (const config of configs) {
    summary.considered++

    // Not just this hour: any slot inside the catch-up window that no sweep
    // reached. A skipped run used to cost the owner the article silently.
    const slots = dueSlots(config, at)
    if (slots.length === 0) continue

    // The plan is re-read here rather than trusted from the config row: a
    // subscription that lapsed since the owner saved it does not change the row.
    const access = await checkAutoBlogAccess(ctx, config.ownerId)
    if (!access.allowed) {
      summary.skippedNoAccess++
      continue
    }

    for (const local of slots) {
      const theme = themeForSlot(config.themes ?? [], local)
      if (!theme) continue

      const key = buildIdempotencyKey(config.storeId, slotKey(local))
      const existing = await ctx.db
        .query("blogAutoQueue")
        .withIndex("by_idempotencyKey", (q: any) => q.eq("idempotencyKey", key))
        .first()
      if (existing) {
        summary.skippedDuplicate++
        continue
      }

      await ctx.db.insert("blogAutoQueue", {
        ownerId: config.ownerId,
        storeId: config.storeId,
        configId: config._id,
        status: "pending",
        scheduledFor: at,
        theme,
        locale: config.primaryLocale,
        retryCount: 0,
        maxRetries: 3,
        idempotencyKey: key,
        createdAt: at,
        updatedAt: at,
      })
      await ctx.db.patch(config._id, { lastPlannedAt: at, updatedAt: at })
      summary.queued++
    }
  }

  return summary
}

// ============================================================================
// Queue execution
// ============================================================================
/**
 * How long a job may sit in `generating` before it is presumed dead.
 *
 * A generation is minutes of OpenAI, so this is generous. It exists because
 * `generating` is a state nothing else leaves: an executor that hits the Convex
 * action time limit, or a deployment that restarts mid-sweep, leaves the row
 * there for ever and the owner's article simply never arrives.
 */
export const STALE_GENERATING_MS = 60 * 60 * 1000

/** How many stale jobs one planner sweep will recover. */
const STALE_REQUEUE_BATCH = 50

/**
 * Put back the jobs whose executor never came back, and refund what they took.
 *
 * Two things were missed the first time this was written. The executor reserves
 * a slot before it generates and releases it in its own catch; a run that dies
 * outright never reaches that catch, so recovering the row while leaving the
 * reservation spent meant four dead executors burned four slots and produced
 * nothing. And a run can die *after* `_saveGeneratedArticle` has committed —
 * the article exists, the job still says `generating` — so a blind requeue
 * would generate a second article for a slot the owner paid for once. A job
 * that already has an `articleId` is therefore completed, not retried.
 *
 * Bounded, because this runs inside the hourly planner mutation: an unbounded
 * `collect` over a backlog would exceed the transaction limits and take the
 * whole planner down with it, not just the stale rows.
 */
export async function requeueStaleJobsCore(
  ctx: any,
  at: number,
  staleAfterMs: number = STALE_GENERATING_MS,
): Promise<{ requeued: number; salvaged: number }> {
  const stuck = await ctx.db
    .query("blogAutoQueue")
    .withIndex("by_status_scheduledFor", (q: any) => q.eq("status", "generating"))
    .take(STALE_REQUEUE_BATCH)

  let requeued = 0
  let salvaged = 0

  for (const job of stuck) {
    const startedAt = job.startedAt ?? job.updatedAt ?? job.createdAt
    if (at - startedAt < staleAfterMs) continue

    // The article got written; only the bookkeeping was lost.
    if (job.articleId) {
      const article = await ctx.db.get(job.articleId)
      await ctx.db.patch(job._id, {
        status: article?.status === "published" ? "published" : "draft_created",
        completedAt: at,
        updatedAt: at,
      })
      salvaged++
      continue
    }

    await releaseArticleQuota(ctx, job.ownerId)
    await failJobCore(ctx, {
      jobId: job._id,
      errorCode: "executor_lost",
      errorMessage: "La génération ne s'est jamais terminée ; le travail est remis en file.",
      at,
      retryDelayMs: 0,
    })
    requeued++
  }

  return { requeued, salvaged }
}


/** What the executor needs to generate one article. */
export interface ClaimedJob {
  jobId: string
  ownerId: string
  storeId: string
  categoryId: string | null
  theme: string
  locale: string
  tone: "formel" | "decontracte" | "storytelling"
  autoTranslate: boolean
  approvalMode: "draft_review" | "auto_publish"
}

/** Pending jobs whose time has come, oldest first. */
export async function dueJobIdsCore(
  ctx: any,
  at: number,
  limit: number,
): Promise<string[]> {
  const jobs = await ctx.db
    .query("blogAutoQueue")
    .withIndex("by_status_scheduledFor", (q: any) =>
      q.eq("status", "pending").lte("scheduledFor", at),
    )
    .order("asc")
    .take(limit)
  return jobs.map((job: any) => job._id)
}

/**
 * Move one job from `pending` to `generating` and hand back what it needs.
 *
 * The transition is the claim: two overlapping executor runs both read the same
 * pending row, and only the one whose transaction commits first sees it as
 * `pending`. Returning null is the loser's answer, not an error.
 *
 * The plan is checked once more here, because a job can sit in the queue while
 * a subscription lapses, and `approvalMode` is resolved against the plan rather
 * than read from the config — a downgrade must stop auto-publishing even though
 * the config still says otherwise.
 */
export async function claimJobCore(
  ctx: any,
  jobId: string,
  at: number,
): Promise<ClaimedJob | null> {
  const job = await ctx.db.get(jobId)
  if (!job || job.status !== "pending") return null

  const config = await ctx.db.get(job.configId)
  if (!config || !config.isEnabled) {
    await ctx.db.patch(jobId, {
      status: "cancelled",
      errorCode: "config_disabled",
      completedAt: at,
      updatedAt: at,
    })
    return null
  }

  const access = await checkAutoBlogAccess(ctx, job.ownerId)
  if (!access.allowed) {
    await ctx.db.patch(jobId, {
      status: "cancelled",
      errorCode: "no_access",
      errorMessage: access.reason,
      completedAt: at,
      updatedAt: at,
    })
    return null
  }

  const entitlements = access.entitlements
  const allowAutoPublish = entitlements?.autoBlog?.allowAutoPublish === true
  const allowMultiLanguage = entitlements?.autoBlog?.allowMultiLanguage === true

  await ctx.db.patch(jobId, {
    status: "generating",
    startedAt: at,
    updatedAt: at,
  })

  return {
    jobId,
    ownerId: job.ownerId,
    storeId: job.storeId,
    categoryId: config.categoryId ?? null,
    theme: job.theme,
    locale: job.locale,
    tone: config.tone,
    autoTranslate: config.autoTranslate === true && allowMultiLanguage,
    approvalMode:
      config.approvalMode === "auto_publish" && allowAutoPublish
        ? "auto_publish"
        : "draft_review",
  }
}

/** Record a generated article against its job. */
export async function completeJobCore(
  ctx: any,
  args: {
    jobId: string
    articleId: string
    status: "draft" | "published"
    at: number
  },
): Promise<void> {
  const job = await ctx.db.get(args.jobId)
  if (!job) return

  await ctx.db.patch(args.jobId, {
    status: args.status === "published" ? "published" : "draft_created",
    articleId: args.articleId,
    completedAt: args.at,
    updatedAt: args.at,
  })
  await ctx.db.patch(job.configId, {
    lastGeneratedAt: args.at,
    updatedAt: args.at,
  })
}

/**
 * Record a failure, and put the job back if it has retries left.
 *
 * A retry is scheduled far enough out that a rate limit or a five-minute OpenAI
 * outage has passed by the time the next sweep picks it up, and the counter
 * stops it looping on a prompt that will never work.
 */
export async function failJobCore(
  ctx: any,
  args: {
    jobId: string
    errorCode: string
    errorMessage: string
    at: number
    retryDelayMs?: number
  },
): Promise<void> {
  const job = await ctx.db.get(args.jobId)
  if (!job) return
  // A cancelled job is a decision — the configuration was switched off, or the
  // subscription lapsed. Retrying it would undo that.
  if (job.status === "cancelled") return

  const retryCount = (job.retryCount ?? 0) + 1
  const exhausted = retryCount > (job.maxRetries ?? 3)
  const delay = args.retryDelayMs ?? 15 * 60 * 1000

  await ctx.db.patch(args.jobId, {
    status: exhausted ? "failed" : "pending",
    retryCount,
    errorCode: args.errorCode,
    errorMessage: args.errorMessage.slice(0, 500),
    ...(exhausted
      ? { completedAt: args.at }
      : { scheduledFor: args.at + delay, startedAt: undefined }),
    updatedAt: args.at,
  })
}
