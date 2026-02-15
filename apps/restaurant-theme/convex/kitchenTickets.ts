import { query, mutation } from "./_generated/server";
import * as defs from "@beindigital-engine/convex-functions/kitchenTickets";

export const getByStore = query(defs.getByStore);
export const getByStatus = query(defs.getByStatus);
export const getByStation = query(defs.getByStation);
export const getByOrder = query(defs.getByOrder);
export const create = mutation(defs.create);
export const updateStatus = mutation(defs.updateStatus);
export const assignStation = mutation(defs.assignStation);
export const assignTo = mutation(defs.assignTo);
export const incrementPrintCount = mutation(defs.incrementPrintCount);
