/**
 * The three properties a campaign send has to hold.
 *
 * Sending was one synchronous loop from the browser over every active
 * subscriber: an SES call, two mutation round-trips and a 100 ms pause each.
 * Around 3,000 subscribers it exceeded the Convex time limit, the campaign
 * stayed at `sending` for good, and the only escape — "Relancer" — restarted at
 * the first subscriber and mailed everyone who had already received it again.
 *
 * These cover the pieces that make the batched version safe: which subscribers
 * a page yields, which of them a campaign has already reached, and which
 * scheduled campaigns are due. The batch action that strings them together is
 * covered end to end in `apps/reference/tests/convex/campaign-send.test.ts`.
 */

import { describe, expect, it } from "vitest"
import { alreadySentTo, sentCountsSince } from "../emailEvents"
import { dueForSending } from "../emailCampaigns"
import {
  CONVEX_DOCUMENTS_READ_LIMIT,
  MAX_CAP_LOOKUP_BATCH,
  MAX_EMAILS_PER_WEEK,
  resolveWeeklyCap,
} from "../campaignDelivery"

const CAMPAIGN = "campaigns:a"
const OTHER_CAMPAIGN = "campaigns:b"

/** A ctx whose `emailEvents` table is the array handed in. */
function eventsCtx(events: Array<Record<string, unknown>>) {
  return {
    db: {
      query: () => ({
        withIndex: (_name: string, fn: (q: unknown) => unknown) => {
          const captured: Record<string, unknown> = {}
          const q = {
            eq: (field: string, value: unknown) => {
              captured[field] = value
              return q
            },
          }
          fn(q)
          return {
            collect: async () =>
              events.filter(
                (e) =>
                  e.campaignId === captured.campaignId &&
                  e.subscriberId === captured.subscriberId
              ),
          }
        },
      }),
    },
  }
}

describe("alreadySentTo", () => {
  it("names the subscribers this campaign has already reached", async () => {
    const ctx = eventsCtx([
      { campaignId: CAMPAIGN, subscriberId: "s1", type: "sent" },
      { campaignId: CAMPAIGN, subscriberId: "s3", type: "sent" },
    ])

    const reached = await alreadySentTo.handler(ctx, {
      campaignId: CAMPAIGN,
      subscriberIds: ["s1", "s2", "s3"],
    })

    // This is what stops "Relancer" mailing subscribers 1–400 a second time.
    expect(reached.sort()).toEqual(["s1", "s3"])
  })

  it("does not count another campaign's send", async () => {
    const ctx = eventsCtx([
      { campaignId: OTHER_CAMPAIGN, subscriberId: "s1", type: "sent" },
    ])
    expect(
      await alreadySentTo.handler(ctx, {
        campaignId: CAMPAIGN,
        subscriberIds: ["s1"],
      })
    ).toEqual([])
  })

  it("does not mistake an open or a bounce for a send", async () => {
    // The events table holds the whole lifecycle. Only `sent` means the message
    // left, and only that may suppress a retry.
    const ctx = eventsCtx([
      { campaignId: CAMPAIGN, subscriberId: "s1", type: "opened" },
      { campaignId: CAMPAIGN, subscriberId: "s2", type: "bounced" },
    ])
    expect(
      await alreadySentTo.handler(ctx, {
        campaignId: CAMPAIGN,
        subscriberIds: ["s1", "s2"],
      })
    ).toEqual([])
  })

  it("asks nothing for an empty page", async () => {
    const ctx = eventsCtx([])
    expect(
      await alreadySentTo.handler(ctx, { campaignId: CAMPAIGN, subscriberIds: [] })
    ).toEqual([])
  })
})


/**
 * A ctx that records how the events table was asked, not just what came back.
 *
 * The defect in `sentCountsSince` was invisible in its return value — the
 * counts were right, and stayed right, while the read behind them grew without
 * bound until Convex refused the transaction. So what has to be held here is
 * the shape of the question: which index, which range, and that the read stops
 * at the cap. The cost itself is measured against the real schema in each
 * app's `tests/convex/campaign-weekly-cap.test.ts`, which is the only place an
 * index can actually be exercised.
 */
function recordingEventsCtx(events: Array<Record<string, unknown>>) {
  const asked: Array<{ index: string; eq: Record<string, unknown>; gte?: number; take?: number }> = []
  return {
    asked,
    db: {
      query: () => ({
        withIndex: (index: string, fn: (q: unknown) => unknown) => {
          const eq: Record<string, unknown> = {}
          let gte: number | undefined
          const q = {
            eq: (field: string, value: unknown) => {
              eq[field] = value
              return q
            },
            gte: (_field: string, value: number) => {
              gte = value
              return q
            },
          }
          fn(q)
          const matching = () =>
            events.filter(
              (e) =>
                Object.entries(eq).every(([field, value]) => e[field] === value) &&
                (gte === undefined || (e.occurredAt as number) >= gte)
            )
          const call = { index, eq, gte } as (typeof asked)[number]
          return {
            take: async (n: number) => {
              asked.push({ ...call, take: n })
              return matching().slice(0, n)
            },
            collect: async () => {
              asked.push(call)
              return matching()
            },
          }
        },
      }),
    },
  }
}

const WEEK_AGO = 1_700_000_000_000 - 7 * 24 * 60 * 60 * 1000

describe("sentCountsSince", () => {
  it("asks the index that pairs the subscriber with the type and the window", async () => {
    // The whole defect, in one assertion. Reading `by_subscriberId` and sorting
    // `type` and `occurredAt` out in JavaScript returns the same numbers — and
    // reads the subscriber's entire lifetime history to do it, until a batch of
    // them crosses Convex's per-transaction ceiling and the campaign stops for
    // good. The index has to carry all three, or the read is unbounded.
    const ctx = recordingEventsCtx([])
    await sentCountsSince.handler(ctx, {
      subscriberIds: ["s1"],
      since: WEEK_AGO,
      cap: 3,
    })

    expect(ctx.asked).toHaveLength(1)
    expect(ctx.asked[0].index).toBe("by_subscriber_type_occurredAt")
    expect(ctx.asked[0].eq).toEqual({ subscriberId: "s1", type: "sent" })
    expect(ctx.asked[0].gte).toBe(WEEK_AGO)
    // Not `.collect()`: the window alone does not bound a store whose sending
    // has run away, and that is when the cap matters most.
    expect(ctx.asked[0].take).toBe(3)
  })

  it("counts this subscriber's sends inside the window", async () => {
    const ctx = recordingEventsCtx([
      { subscriberId: "s1", type: "sent", occurredAt: WEEK_AGO + 1 },
      { subscriberId: "s1", type: "sent", occurredAt: WEEK_AGO + 2 },
      { subscriberId: "s2", type: "sent", occurredAt: WEEK_AGO + 3 },
    ])
    expect(
      await sentCountsSince.handler(ctx, {
        subscriberIds: ["s1", "s2"],
        since: WEEK_AGO,
        cap: 3,
      })
    ).toEqual([
      { subscriberId: "s1", count: 2 },
      { subscriberId: "s2", count: 1 },
    ])
  })

  it("stops counting at the cap, which is all the guard asks of the number", async () => {
    // `withinWeeklyCap(count, cap)` is `count < cap`, so a count that stopped at
    // the cap decides identically — and reads a constant number of documents
    // rather than however many the store sent.
    const many = Array.from({ length: 50 }, (_, i) => ({
      subscriberId: "s1",
      type: "sent",
      occurredAt: WEEK_AGO + i,
    }))
    const ctx = recordingEventsCtx(many)
    expect(
      await sentCountsSince.handler(ctx, {
        subscriberIds: ["s1"],
        since: WEEK_AGO,
        cap: 3,
      })
    ).toEqual([{ subscriberId: "s1", count: 3 }])
  })

  it("never reads nothing, and never reads without limit", async () => {
    // `v.number()` is a float64, so every one of these reaches the handler.
    // `.take(0)` would report zero, which reads as "under the cap" and waves
    // every subscriber through the guard it is supposed to be enforcing;
    // `.take(Infinity)` is the unbounded read the index was added to stop.
    for (const cap of [0, -1, 0.5, NaN, Infinity, -Infinity, 1e9]) {
      const ctx = recordingEventsCtx([
        { subscriberId: "s1", type: "sent", occurredAt: WEEK_AGO + 1 },
      ])
      const counts = await sentCountsSince.handler(ctx, {
        subscriberIds: ["s1"],
        since: WEEK_AGO,
        cap,
      })
      const take = ctx.asked[0].take ?? 0
      expect(take).toBeGreaterThanOrEqual(1)
      expect(take).toBeLessThanOrEqual(MAX_EMAILS_PER_WEEK)
      expect(counts).toEqual([{ subscriberId: "s1", count: 1 }])
    }
  })

  it("asks nothing for an empty page", async () => {
    const ctx = recordingEventsCtx([])
    expect(
      await sentCountsSince.handler(ctx, {
        subscriberIds: [],
        since: WEEK_AGO,
        cap: 3,
      })
    ).toEqual([])
    expect(ctx.asked).toEqual([])
  })

  it("refuses a page too large to answer in one transaction", async () => {
    // The per-subscriber read is bounded; the number of subscribers is not, and
    // `BATCH_SIZE` is the only thing holding the product under the ceiling.
    // Raising it for throughput would reopen this defect with nothing to say so
    // — hence a refusal that names the knob rather than a Convex read error.
    const ctx = recordingEventsCtx([])
    const tooMany = Array.from(
      { length: MAX_CAP_LOOKUP_BATCH + 1 },
      (_, i) => `subs:${i}`
    )
    await expect(
      sentCountsSince.handler(ctx, {
        subscriberIds: tooMany,
        since: WEEK_AGO,
        cap: MAX_EMAILS_PER_WEEK,
      })
    ).rejects.toThrow(/MAX_CAP_LOOKUP_BATCH/)
    // Refused before reading anything, not part-way through.
    expect(ctx.asked).toEqual([])
  })

  it("answers a page of exactly the largest size it allows", async () => {
    const ctx = recordingEventsCtx([])
    const full = Array.from({ length: MAX_CAP_LOOKUP_BATCH }, (_, i) => `subs:${i}`)
    const counts = await sentCountsSince.handler(ctx, {
      subscriberIds: full,
      since: WEEK_AGO,
      cap: MAX_EMAILS_PER_WEEK,
    })
    expect(counts).toHaveLength(MAX_CAP_LOOKUP_BATCH)
  })
})

describe("the weekly cap's read budget", () => {
  it("keeps the worst page x cap inside Convex's read ceiling", () => {
    // The arithmetic the whole fix rests on, asserted rather than reasoned
    // about, so that moving either constant fails here instead of in a
    // customer's campaign.
    expect(MAX_CAP_LOOKUP_BATCH * MAX_EMAILS_PER_WEEK).toBeLessThanOrEqual(
      CONVEX_DOCUMENTS_READ_LIMIT
    )
    expect((MAX_CAP_LOOKUP_BATCH + 1) * MAX_EMAILS_PER_WEEK).toBeGreaterThan(
      CONVEX_DOCUMENTS_READ_LIMIT
    )
  })

  it("leaves room for the send action's own page", () => {
    // `BATCH_SIZE` is 40 in both apps. Restated as a floor rather than imported,
    // because the send action is a `"use node"` module this suite cannot load.
    expect(MAX_CAP_LOOKUP_BATCH).toBeGreaterThanOrEqual(40)
  })

  it("resolves a cap to itself, so query and caller bound the same number", () => {
    // `sentCountsSince` resolves the cap it is given; the caller compares
    // against the cap it resolved. Those agree only because resolving twice
    // changes nothing — if it stopped being idempotent, a saturated count would
    // start reading as under the cap.
    for (const raw of [undefined, null, "3", 0, -2, 0.5, 1, 3, 3.7, 99, 100, 101, NaN, Infinity]) {
      const once = resolveWeeklyCap(raw)
      expect(resolveWeeklyCap(once)).toBe(once)
    }
  })
})

/** A ctx whose `emailCampaigns` table is the array handed in. */
function campaignsCtx(campaigns: Array<Record<string, unknown>>) {
  return {
    db: {
      query: () => ({
        filter: () => ({
          collect: async () => campaigns.filter((c) => c.status === "scheduled"),
        }),
      }),
    },
  }
}

const NOON = 1_700_000_000_000

describe("dueForSending", () => {
  it("returns the campaigns whose moment has passed", async () => {
    const ctx = campaignsCtx([
      { _id: "c1", status: "scheduled", scheduledAt: NOON - 60_000 },
      { _id: "c2", status: "scheduled", scheduledAt: NOON + 60_000 },
      { _id: "c3", status: "scheduled", scheduledAt: NOON },
    ])
    expect(await dueForSending.handler(ctx, { now: NOON })).toEqual(["c1", "c3"])
  })

  it("ignores a scheduled campaign with no time on it", async () => {
    // Nothing to be due against. Sending it now would be a decision the owner
    // never made.
    const ctx = campaignsCtx([{ _id: "c1", status: "scheduled" }])
    expect(await dueForSending.handler(ctx, { now: NOON })).toEqual([])
  })

  it("ignores everything that is not scheduled", async () => {
    const ctx = campaignsCtx([
      { _id: "c1", status: "sending", scheduledAt: NOON - 1 },
      { _id: "c2", status: "sent", scheduledAt: NOON - 1 },
      { _id: "c3", status: "paused", scheduledAt: NOON - 1 },
      { _id: "c4", status: "cancelled", scheduledAt: NOON - 1 },
    ])
    // A paused campaign in particular: the owner stopped it on purpose, and the
    // cron must not undo that a minute later.
    expect(await dueForSending.handler(ctx, { now: NOON })).toEqual([])
  })
})
