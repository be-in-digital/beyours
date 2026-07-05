import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * System audit log table.
 * Tracks all system-level operations (backups, restores, migrations, version checks).
 */
export const systemAuditLogTable = defineTable({
  action: v.union(
    v.literal("backup_export"),
    v.literal("backup_import"),
    v.literal("backup_import_dryrun"),
    v.literal("migration_run"),
    v.literal("version_check"),
    v.literal("lock_force_release"),
    v.literal("maintenance_contract_set"),
    v.literal("migration_request_created"),
    v.literal("migration_request_status_changed"),
  ),
  performedBy: v.string(),
  performedAt: v.number(),
  details: v.optional(v.string()),
  result: v.union(v.literal("success"), v.literal("failure")),
  errorMessage: v.optional(v.string()),
})
  .index("by_performedAt", ["performedAt"])
  .index("by_action", ["action"])
