import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/stores";

export const list = query(defs.list);
export const getById = query(defs.getById);
export const getBySlug = query(defs.getBySlug);
export const create = mutation(defs.create);
export const update = mutation(defs.update);
export const updateHours = mutation(defs.updateHours);
export const updateBranding = mutation(defs.updateBranding);
export const updateSettings = mutation(defs.updateSettings);
export const updateAddress = mutation(defs.updateAddress);
export const remove = mutation(defs.remove);
