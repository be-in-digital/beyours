import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/translations";

export const getForEntity = query(defs.getForEntity);
export const getByLanguage = query(defs.getByLanguage);
export const upsert = mutation(defs.upsert);
export const bulkUpsert = mutation(defs.bulkUpsert);
export const remove = mutation(defs.remove);
