/**
 * Internal auth helpers for actions that don't have ctx.db.
 *
 * Actions use ctx.runQuery to call these internal queries,
 * which propagate the auth context.
 */

import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireStorePermission } from "@beindigital-engine/convex-functions/auth";

/**
 * Verify the current user has a specific permission on a store.
 * Call from actions via ctx.runQuery(internal.authHelpers.checkStorePermission, {...})
 */
export const checkStorePermission = internalQuery({
  args: {
    storeId: v.id("stores"),
    permission: v.string(),
  },
  handler: async (ctx, args) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await requireStorePermission(ctx, args.storeId, args.permission as any);
    return true;
  },
});
