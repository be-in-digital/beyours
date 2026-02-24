import { query, internalMutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/emailEvents";

// === Queries (public — for subscriber timeline and campaign debug) ===

export const listByCampaign = query(defs.listByCampaign);
export const listBySubscriber = query(defs.listBySubscriber);

// === Internal mutations (called by SES webhook HTTP action only) ===

export const create = internalMutation(defs.create);
export const createBatch = internalMutation(defs.createBatch);
