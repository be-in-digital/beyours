import { query, mutation } from "./_generated/server"
import * as defs from "@beindigital-engine/convex-functions/userProfiles"

export const getByUserId = query(defs.getByUserId)
export const upsert = mutation(defs.upsert)
