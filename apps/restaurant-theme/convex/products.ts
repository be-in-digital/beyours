import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/products";

export const list = query(defs.list);
export const getById = query(defs.getById);
export const getByCategory = query(defs.getByCategory);
export const getBySlug = query(defs.getBySlug);
export const getFeatured = query(defs.getFeatured);
export const create = mutation(defs.create);
export const update = mutation(defs.update);
export const updateStock = mutation(defs.updateStock);
export const toggleStatus = mutation(defs.toggleStatus);
export const remove = mutation(defs.remove);
