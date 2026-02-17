import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/storeIntegrations";

export const listByStore = query(defs.listByStore);
export const getByStorePlatform = query(defs.getByStorePlatform);
export const upsert = mutation(defs.upsert);
export const remove = mutation(defs.remove);
