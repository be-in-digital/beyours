import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/payments";

export const getByOrder = query(defs.getByOrder);
export const getByStore = query(defs.getByStore);
export const create = mutation(defs.create);
export const updateStatus = mutation(defs.updateStatus);
export const refund = mutation(defs.refund);
