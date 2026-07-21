import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireBackOfficeAccess } from "./authz";

/**
 * CRM agence — v1. Inbox des leads entrants (`contactSubmissions`), conversion
 * en contact, liste + ajout de contacts (prospection sortante).
 *
 * Toutes les fonctions exigent un accès back-office actif
 * (`requireBackOfficeAccess`) : un compte sans rôle ne lit/écrit rien.
 */

// ── Inbox : leads entrants (formulaire de contact) ───────────────────────────
export const inbox = query({
  args: {},
  handler: async (ctx) => {
    await requireBackOfficeAccess(ctx);
    const submissions = await ctx.db
      .query("contactSubmissions")
      .withIndex("by_created")
      .order("desc")
      .take(50);
    // On n'expose jamais le hash IP au client.
    return submissions.map((s) => ({
      _id: s._id,
      name: s.name,
      email: s.email,
      message: s.message,
      createdAt: s.createdAt,
      status: s.status,
      converted: s.convertedContactId !== undefined,
    }));
  },
});

export const markSubmission = mutation({
  args: {
    id: v.id("contactSubmissions"),
    status: v.union(
      v.literal("new"),
      v.literal("read"),
      v.literal("replied"),
      v.literal("archived"),
    ),
  },
  handler: async (ctx, args) => {
    await requireBackOfficeAccess(ctx);
    await ctx.db.patch("contactSubmissions", args.id, { status: args.status });
  },
});

/** Convertit un lead entrant en contact CRM (idempotent). */
export const convertLead = mutation({
  args: { submissionId: v.id("contactSubmissions") },
  handler: async (ctx, args) => {
    const user = await requireBackOfficeAccess(ctx);
    const submission = await ctx.db.get(
      "contactSubmissions",
      args.submissionId,
    );
    if (!submission) throw new Error("Lead introuvable");
    if (submission.convertedContactId) return submission.convertedContactId;

    const contactId = await ctx.db.insert("contacts", {
      firstName: submission.name,
      email: submission.email,
      source: "contact_form",
      stage: "lead",
      ownerId: user._id,
      createdById: user._id,
    });
    await ctx.db.patch("contactSubmissions", args.submissionId, {
      status: "replied",
      convertedContactId: contactId,
    });
    return contactId;
  },
});

// ── Contacts ─────────────────────────────────────────────────────────────────
export const contacts = query({
  args: {},
  handler: async (ctx) => {
    await requireBackOfficeAccess(ctx);
    return await ctx.db.query("contacts").order("desc").take(100);
  },
});

/** Ajout manuel d'un contact (prospection sortante). */
export const createContact = mutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireBackOfficeAccess(ctx);
    return await ctx.db.insert("contacts", {
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      source: "outbound",
      stage: "lead",
      ownerId: user._id,
      createdById: user._id,
    });
  },
});
