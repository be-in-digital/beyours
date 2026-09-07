/**
 * What still points at an email template or an email segment.
 *
 * WHY THIS EXISTS: `emailTemplates.remove` and `emailSegments.remove` were both
 * a bare `ctx.db.delete(args.id)`, and the two references they leave behind fail
 * in opposite directions — which is why neither was noticed.
 *
 * `emailCampaigns.templateId` is REQUIRED. Delete the template a scheduled
 * campaign names and the send **halts**: `sendBatch` reads the template, finds
 * nothing and returns. The campaign stayed at `sending` for ever and the owner's
 * screen went on showing "En cours".
 *
 * `emailCampaigns.segmentId` is optional, and that is worse. The send read the
 * segment to build the audience filter and skipped filtering when it came back
 * null — so deleting a segment did not stop the campaign, it **broadened** it.
 * A message written for "clients inactifs depuis 6 mois" went to the entire
 * list, at once, with nothing to undo it. Marketing mail is not recallable.
 *
 * `emailAutomations.steps[]` holds the same two columns and was reachable from
 * neither delete path.
 *
 * WHAT COUNTS AS LIVE. A campaign that can still send — `draft`, `scheduled`,
 * `sending`, `paused` — blocks the delete. A campaign that has finished — `sent`,
 * `cancelled`, `failed` — does not: it will never dereference the template
 * again, and blocking deletion of a template for as long as any campaign ever
 * built on it exists would make the template list unmaintainable within a year.
 * The residue is honest and bounded: an old campaign's `templateId` can point at
 * a deleted row, the stats dialog then shows no preview, and "Dupliquer" on that
 * campaign produces another campaign with the same dead link. Nothing throws and
 * nothing sends.
 *
 * Automations are blocked whatever their status. There are at most five per
 * establishment, each is editable at any moment, and an automation's step has
 * no terminal state to be finished in.
 *
 * The reads go through `by_storeId`. Neither table has a reverse index and
 * neither is worth one: campaigns and segments are counted in dozens per
 * establishment, which is the cost profile `products.remove` already accepted
 * for menus, promotions and prizes.
 */

/** Campaign statuses from which a send can still run. */
export const LIVE_CAMPAIGN_STATUSES: ReadonlyArray<string> = [
  "draft",
  "scheduled",
  "sending",
  "paused",
]

/** Is this campaign one a delete has to protect? */
export function isLiveCampaign(campaign: { status?: unknown }): boolean {
  return LIVE_CAMPAIGN_STATUSES.includes(String(campaign.status))
}

/** A referring document, as a refusal message needs it. */
export interface AssetReference {
  name: string
}

/**
 * The live campaigns of `storeId` that name this template or segment.
 *
 * `field` is the column to read — `templateId` or `segmentId`. Passing the name
 * rather than a predicate keeps the two call sites identical apart from one
 * word, which is the point: they drifted before.
 */
export async function liveCampaignsReferencing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  storeId: unknown,
  field: "templateId" | "segmentId",
  id: unknown
): Promise<AssetReference[]> {
  const campaigns = await ctx.db
    .query("emailCampaigns")
    .withIndex("by_storeId", (q: { eq: (f: string, v: unknown) => unknown }) =>
      q.eq("storeId", storeId)
    )
    .collect()

  return campaigns
    .filter(
      (campaign: Record<string, unknown>) =>
        campaign[field] === id && isLiveCampaign(campaign)
    )
    .map((campaign: { name?: unknown }) => ({ name: String(campaign.name ?? "") }))
}

/**
 * The automations of `storeId` with a step naming this template or segment.
 *
 * Every status counts — see the note above on why an automation has no finished
 * state.
 */
export async function automationsReferencing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  storeId: unknown,
  field: "templateId" | "segmentId",
  id: unknown
): Promise<AssetReference[]> {
  const automations = await ctx.db
    .query("emailAutomations")
    .withIndex("by_storeId", (q: { eq: (f: string, v: unknown) => unknown }) =>
      q.eq("storeId", storeId)
    )
    .collect()

  return automations
    .filter((automation: { steps?: Array<Record<string, unknown>> }) =>
      (automation.steps ?? []).some((step) => step[field] === id)
    )
    .map((automation: { name?: unknown }) => ({ name: String(automation.name ?? "") }))
}

/** `"« A », « B »"` — the names a refusal quotes back at the owner. */
export function quoteNames(references: AssetReference[]): string {
  return references.map((reference) => `« ${reference.name} »`).join(", ")
}
