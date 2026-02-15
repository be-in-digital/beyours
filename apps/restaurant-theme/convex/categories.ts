import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/categories";

export const list = query(defs.list);
export const getById = query(defs.getById);
export const create = mutation(defs.create);
export const update = mutation(defs.update);
export const reorder = mutation(defs.reorder);
export const remove = mutation(defs.remove);
