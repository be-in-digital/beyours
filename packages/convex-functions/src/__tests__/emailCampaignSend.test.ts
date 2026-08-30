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
import { alreadySentTo } from "../emailEvents"
import { dueForSending } from "../emailCampaigns"

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
