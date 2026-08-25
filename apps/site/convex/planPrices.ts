/* Plan prices (cents, excluding tax) — the single source of truth.

   Read by the checkout (convex/stripe.ts), the superadmin console
   (convex/saLib.ts), the demo seeder (convex/saSeed.ts) and the Next side
   (lib/payment-providers.ts, which re-exports it).

   Plain constants on purpose — no Convex function wrappers, no imports — so
   both the Convex bundler and the Next bundler can pull it in. Prices live
   here rather than in lib/ because convex/ never imports from lib/; keeping
   the dependency pointing this way keeps the graph acyclic. */

export type PlanId = "essentielle" | "premium";

export const planPrices = {
  essentielle: {
    creation: 350000,
    maintenanceMonthly: 10000,
    maintenanceYearly: 100000,
  },
  premium: {
    creation: 750000,
    maintenanceMonthly: 20000,
    maintenanceYearly: 200000,
  },
} as const satisfies Record<
  PlanId,
  { creation: number; maintenanceMonthly: number; maintenanceYearly: number }
>;
