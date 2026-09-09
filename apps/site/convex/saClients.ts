import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin } from "./admin";

/** Clients derived from REAL orders (grouped by email). */
// @guarded-inline: requireAdmin() — resolves the caller with getAuthUserId
//   and refuses anyone whose affiliateUsers row is not role admin
export const list = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const orders = await ctx.db.query("orders").take(5000);
    const subs = await ctx.db.query("subscriptions").take(5000);
    const deps = await ctx.db.query("saDeployments").take(500);

    const subByEmail = new Map<string, Doc<"subscriptions">>();
    for (const s of subs) {
      const cur = subByEmail.get(s.customerEmail);
      if (!cur || s.createdAt > cur.createdAt) subByEmail.set(s.customerEmail, s);
    }
    const depByEmail = new Map<string, Doc<"saDeployments">>();
    for (const d of deps) {
      if (!depByEmail.has(d.customerEmail)) depByEmail.set(d.customerEmail, d);
    }

    const groups = new Map<string, Doc<"orders">[]>();
    for (const o of orders) {
      const g = groups.get(o.customerEmail) ?? [];
      g.push(o);
      groups.set(o.customerEmail, g);
    }

    let rows = [...groups.entries()].map(([email, list]) => {
      const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
      const latest = sorted[0]!;
      const paid = list.filter((o) => o.status === "paid");
      const sub = subByEmail.get(email);
      const dep = depByEmail.get(email);
      return {
        email,
        name: `${latest.customerFirstName} ${latest.customerLastName}`.trim(),
        restaurantName: latest.restaurantName,
        city: latest.city,
        plan: latest.plan,
        buyerType: latest.buyerType,
        totalSpentCents: paid.reduce((s, o) => s + o.amountCents, 0),
        orderCount: list.length,
        paidOrderCount: paid.length,
        firstOrderAt: sorted[sorted.length - 1]?.createdAt ?? latest.createdAt,
        lastOrderAt: latest.createdAt,
        hasSubscription: !!sub,
        subscriptionStatus: sub?.status ?? null,
        deploymentId: dep?._id ?? null,
        deploymentStatus: dep?.status ?? null,
        deploymentHealth: dep?.health ?? null,
      };
    });

    if (args.search) {
      const s = args.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.email.toLowerCase().includes(s) ||
          r.restaurantName.toLowerCase().includes(s) ||
          r.city.toLowerCase().includes(s),
      );
    }
    return rows.sort((a, b) => b.totalSpentCents - a.totalSpentCents);
  },
});

/**
 * A customer's paid orders, for linking one to a deployment at provisioning.
 *
 * The link is what lets the maintenance gate answer for THIS site rather than
 * for the healthiest contract its owner holds (convex/maintenance.ts,
 * byLicenseKey). It cannot be guessed: a customer running two restaurants has
 * two paid orders, and picking the most recent would give both sites the same
 * contract — the very fault the link exists to remove. So the console shows
 * them, with the deployment each is already linked to, and a human chooses.
 */
// @guarded-inline: requireAdmin() — resolves the caller with getAuthUserId
//   and refuses anyone whose affiliateUsers row is not role admin
export const paidOrders = query({
  args: { customerEmail: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_email", (q) => q.eq("customerEmail", args.customerEmail))
      .take(50);

    const deployments = await ctx.db.query("saDeployments").take(500);
    const linkedTo = new Map<string, string>();
    for (const d of deployments) {
      if (d.orderId) linkedTo.set(d.orderId, d.name);
    }

    return orders
      .filter((o) => o.status === "paid")
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((o) => ({
        _id: o._id,
        restaurantName: o.restaurantName,
        city: o.city,
        plan: o.plan,
        orderType: o.orderType,
        amountCents: o.amountCents,
        createdAt: o.createdAt,
        linkedDeployment: linkedTo.get(o._id) ?? null,
      }));
  },
});

/** Prospects (liste d'attente / whitelist). */
// @guarded-inline: requireAdmin() — resolves the caller with getAuthUserId
//   and refuses anyone whose affiliateUsers row is not role admin
export const prospects = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("whitelist").take(2000);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// @guarded-inline: requireAdmin() — resolves the caller with getAuthUserId
//   and refuses anyone whose affiliateUsers row is not role admin
export const stats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const orders = await ctx.db.query("orders").take(5000);
    const subs = await ctx.db.query("subscriptions").take(5000);
    const prospects = await ctx.db.query("whitelist").take(2000);

    const emails = new Set(orders.map((o) => o.customerEmail));
    const payingEmails = new Set(
      orders.filter((o) => o.status === "paid").map((o) => o.customerEmail),
    );
    return {
      totalClients: emails.size,
      payingClients: payingEmails.size,
      activeSubscriptions: subs.filter((s) => s.status === "active").length,
      prospects: prospects.length,
    };
  },
});
