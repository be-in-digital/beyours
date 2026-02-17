import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/storeIntegrations";

export const listByStore = query(defs.listByStore);
export const listByPlatformEnabled = query(defs.listByPlatformEnabled);
export const getByStorePlatform = query(defs.getByStorePlatform);
export const getBySiteId = query(defs.getBySiteId);
export const getByBrandId = query(defs.getByBrandId);
export const upsert = mutation(defs.upsert);
export const updateMenuSyncStatus = mutation(defs.updateMenuSyncStatus);
export const remove = mutation(defs.remove);
