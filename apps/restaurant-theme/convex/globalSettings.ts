import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/globalSettings";

export const get = query(defs.get);
export const upsert = mutation(defs.upsert);
