import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/prizes";

export const list = query(defs.list);
export const create = mutation(defs.create);
export const update = mutation(defs.update);
export const remove = mutation(defs.remove);
