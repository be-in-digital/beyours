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
import { createCountingDb } from "./support/countingDb"

const CAMPAIGN = "campaigns:a"
const OTHER_CAMPAIGN = "campaigns:b"

/**
 * A ctx whose `emailEvents` table is the array handed in.
 *
 * `createCountingDb` rather than a hand-rolled double, and the difference
 * matters here specifically. The double this replaces accepted
 * `withIndex("by_anything")` and applied whatever equalities it was given, so
 * the query could name an index the schema does not declare and still pass —
 * and it silently ignored the third equality when `alreadySentTo` grew one.
 * The shared harness reads the real indexes out of `@be-yours/convex-schema`
 * and enforces Convex's own prefix rule, so naming an index wrong fails here
 * instead of in production.
 */
function eventsCtx(events: Array<Record<string, unknown>>) {
  return createCountingDb({
    emailEvents: events.map((event, index) => ({
      _id: `emailEvents:${index}`,
      ...event,
    })),
  })
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

const NOON = 1_700_000_000_000
const STORE = "stores:1"

/**
 * A deployment holding these campaigns, on the real schema.
 *
 * `countingDb` rather than a hand-rolled double, and deliberately: the previous
 * one here answered `.filter().collect()` with the rows the test wanted, which
 * is exactly what an unindexed full scan looks like from the inside. It could
 * not tell the sweep's `by_storeId_status` walk from the table scan it
 * replaced, and it was green for the whole time the scan was shipping.
 */
function campaignsCtx(
  campaigns: Array<Record<string, unknown>>,
  stores: Array<Record<string, unknown>> = [{ _id: STORE, name: "Chez Luigi" }]
) {
  return createCountingDb({
    stores,
    emailCampaigns: campaigns.map((c) => ({ storeId: STORE, ...c })),
  })
}

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
    // And none of them is read: the sweep seeks the `scheduled` range of each
    // store rather than reading the campaign history to reject it.
    expect(ctx.reads()).toBe(1) // the one store
  })

  it("finds a due campaign in every establishment, not just the first", async () => {
    const ctx = createCountingDb({
      stores: [
        { _id: "stores:1", name: "Chez Luigi" },
        { _id: "stores:2", name: "Luigi Gare" },
      ],
      emailCampaigns: [
        { _id: "c1", storeId: "stores:1", status: "scheduled", scheduledAt: NOON - 1 },
        { _id: "c2", storeId: "stores:2", status: "scheduled", scheduledAt: NOON - 1 },
      ],
    })
    expect(await dueForSending.handler(ctx, { now: NOON })).toEqual(["c1", "c2"])
  })
})
