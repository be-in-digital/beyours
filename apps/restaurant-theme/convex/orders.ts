import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/orders";

export const list = query(defs.list);
export const getById = query(defs.getById);
export const getByCustomer = query(defs.getByCustomer);
export const getByStatus = query(defs.getByStatus);
export const create = mutation(defs.create);
export const updateStatus = mutation(defs.updateStatus);
export const remove = mutation(defs.remove);
