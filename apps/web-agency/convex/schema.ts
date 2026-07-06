import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Schema Convex AGENCE — strictement minimal.
 *
 * Decision Log #21 + #27 :
 * - Convex agence est SÉPARÉ du Convex resto (deployment distinct).
 * - Une seule table : contactSubmissions.
 * - Le contenu (case studies, products) est en MDX build-time, pas en Convex.
 * - PII : on stocke l'email mais on hashe l'IP (review security).
 */
export default defineSchema({
  contactSubmissions: defineTable({
    name: v.string(),
    email: v.string(),
    message: v.string(),
    createdAt: v.number(),
    /** Hash SHA-256 de l'IP — anonymisation pour anti-spam sans PII. */
    ipHashed: v.string(),
    /** Honeypot field : si rempli → spam confirmé. */
    honeypotTriggered: v.boolean(),
    /** Statut de traitement : new → read → replied → archived. */
    status: v.union(
      v.literal("new"),
      v.literal("read"),
      v.literal("replied"),
      v.literal("archived"),
    ),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),
});
