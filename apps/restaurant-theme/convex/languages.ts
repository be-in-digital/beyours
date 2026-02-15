import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/languages";

export const list = query(defs.list);
export const create = mutation(defs.create);
export const update = mutation(defs.update);
export const toggleActive = mutation(defs.toggleActive);
export const setDefault = mutation(defs.setDefault);
export const remove = mutation(defs.remove);
