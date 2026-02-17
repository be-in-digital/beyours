import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/externalProductMappings";

export const listByStorePlatform = query(defs.listByStorePlatform);
export const getByInternal = query(defs.getByInternal);
export const getByExternal = query(defs.getByExternal);
export const upsert = mutation(defs.upsert);
export const remove = mutation(defs.remove);
export const removeAllByStorePlatform = mutation(defs.removeAllByStorePlatform);
