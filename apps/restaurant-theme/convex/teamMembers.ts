import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/teamMembers";

export const list = query(defs.list);
export const getByUser = query(defs.getByUser);
export const getByRole = query(defs.getByRole);
export const create = mutation(defs.create);
export const update = mutation(defs.update);
export const toggleActive = mutation(defs.toggleActive);
export const remove = mutation(defs.remove);
