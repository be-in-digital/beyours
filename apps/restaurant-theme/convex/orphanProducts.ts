import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/orphanProducts";

export const listByStorePlatform = query(defs.listByStorePlatform);
export const listPending = query(defs.listPending);
export const create = mutation(defs.create);
export const match = mutation(defs.match);
export const ignore = mutation(defs.ignore);
export const remove = mutation(defs.remove);
