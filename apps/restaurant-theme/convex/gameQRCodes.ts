import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/gameQRCodes";

export const list = query(defs.list);
export const create = mutation(defs.create);
export const remove = mutation(defs.remove);
