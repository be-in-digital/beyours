import { defineTable } from "convex/server"
import { v } from "convex/values"

/**
 * System audit log table.
 *
 * Tracks system-level operations (backups, restores, migrations, version
 * checks), establishment changes (creation, edits, deletion), and who was
 * granted or stripped of access (role, establishments, modules).
 *
 * `targetStoreId` is set on establishment entries and left unset on the
 * system-wide ones, which belong to no single store. That distinction is what
 * lets a reader without super-admin rights be shown the system entries plus
 * the stores they actually have access to, and nothing else.
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
    v.literal("store_created"),
    v.literal("store_updated"),
    v.literal("store_deleted"),
    // Who may do what, and who changed it. `userProfiles` is the single source
    // of authority in this product and nothing recorded a change to it: a
    // manager could be promoted, moved to another restaurant or dismissed and
    // the log showed nothing at all.
    v.literal("access_granted"),
    v.literal("access_changed"),
    v.literal("access_revoked"),
  ),
  performedBy: v.string(),
  performedAt: v.number(),
  /** The establishment the entry is about. Unset for system-wide operations. */
  targetStoreId: v.optional(v.id("stores")),
  /**
   * The account an access entry is about — NOT the one that performed it,
   * which is `performedBy`. Unset on every other kind of entry.
   *
   * Indexed, because the question an audit trail has to answer about access is
   * "what happened to this person", and scanning the whole log to find out
   * would make it useless at exactly the size where it matters.
   */
  targetUserId: v.optional(v.string()),
  details: v.optional(v.string()),
  result: v.union(v.literal("success"), v.literal("failure")),
  errorMessage: v.optional(v.string()),
})
  .index("by_performedAt", ["performedAt"])
  .index("by_action", ["action"])
  .index("by_targetStoreId_performedAt", ["targetStoreId", "performedAt"])
  .index("by_targetUserId_performedAt", ["targetUserId", "performedAt"])
