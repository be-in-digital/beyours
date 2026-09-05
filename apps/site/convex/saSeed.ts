import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { planPrices } from "./planPrices";
import { WITHDRAWAL_WAIVER } from "../lib/legal/withdrawal-waiver";

/* ══════════════════════════════════════════════
   Superadmin console seed.
   - Seeds the demo SALES data only when `orders` is empty
     (never pollutes a database that holds real sales).
   - Always (re)builds the `sa*` ops tables from the paid orders
     already present. Wipes ONLY the `sa*` tables.
   `pnpm seed`        → seed when the fleet is empty
   `pnpm seed:reset`  → wipe the sa* tables, then rebuild
   ══════════════════════════════════════════════ */

const DAY = 86_400_000;
const SALES_DAYS = 60;

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function startOfDay(ts: number) {
  return Math.floor(ts / DAY) * DAY;
}

type Sub = "active" | "past_due" | "canceled" | "none";
type Health = "healthy" | "degraded" | "down" | "unknown";

type Resto = {
  first: string;
  last: string;
  email: string;
  phone: string;
  restaurant: string;
  city: string;
  plan: "essentielle" | "premium";
  buyerType: "business" | "personal";
  siret: string;
  sub: Sub;
  health: Health;
  behind: boolean;
  baseDaily: number;
  stores: number;
};

const RESTAURANTS: Resto[] = [
  { first: "Marc", last: "Lefèvre", email: "marc@lepetitbistrot.fr", phone: "0612345678", restaurant: "Le Petit Bistrot", city: "Bordeaux", plan: "premium", buyerType: "business", siret: "81245678900023", sub: "active", health: "healthy", behind: false, baseDaily: 145000, stores: 1 },
  { first: "Yuki", last: "Tanaka", email: "contact@sushizen.fr", phone: "0622114509", restaurant: "Sushi Zen", city: "Lyon", plan: "premium", buyerType: "business", siret: "79911233400017", sub: "active", health: "healthy", behind: false, baseDaily: 208000, stores: 2 },
  { first: "Giuseppe", last: "Romano", email: "giuseppe@pizzanapoli.fr", phone: "0688776655", restaurant: "Pizza Napoli", city: "Marseille", plan: "essentielle", buyerType: "business", siret: "53499822100011", sub: "active", health: "degraded", behind: true, baseDaily: 98000, stores: 1 },
  { first: "Sophie", last: "Aubert", email: "sophie@comptoirdore.fr", phone: "0645891233", restaurant: "Le Comptoir Doré", city: "Paris", plan: "premium", buyerType: "business", siret: "90122344500028", sub: "active", health: "healthy", behind: false, baseDaily: 318000, stores: 3 },
  { first: "Kevin", last: "Dubois", email: "kevin@burgerfactory.fr", phone: "0633221100", restaurant: "Burger Factory", city: "Lille", plan: "essentielle", buyerType: "business", siret: "67733411200019", sub: "active", health: "healthy", behind: false, baseDaily: 122000, stores: 1 },
  { first: "Amir", last: "Benali", email: "amir@chezamir.fr", phone: "0678901234", restaurant: "Chez Amir", city: "Toulouse", plan: "essentielle", buyerType: "business", siret: "44566788900015", sub: "past_due", health: "down", behind: true, baseDaily: 76000, stores: 1 },
  { first: "Marco", last: "Bianchi", email: "marco@latrattoria.fr", phone: "0609876543", restaurant: "La Trattoria", city: "Nice", plan: "premium", buyerType: "business", siret: "22344566700021", sub: "active", health: "healthy", behind: false, baseDaily: 176000, stores: 2 },
  { first: "Lin", last: "Chen", email: "lin@wokandco.fr", phone: "0655443322", restaurant: "Wok & Co", city: "Nantes", plan: "essentielle", buyerType: "business", siret: "55677899000013", sub: "active", health: "healthy", behind: false, baseDaily: 89000, stores: 1 },
  { first: "Emma", last: "Fischer", email: "emma@jardinvert.fr", phone: "0611223344", restaurant: "Le Jardin Vert", city: "Strasbourg", plan: "premium", buyerType: "business", siret: "33455677800016", sub: "none", health: "unknown", behind: false, baseDaily: 0, stores: 1 },
  { first: "Diego", last: "Morales", email: "diego@tacosloco.fr", phone: "0666554433", restaurant: "Tacos Loco", city: "Montpellier", plan: "essentielle", buyerType: "business", siret: "77899011200024", sub: "active", health: "degraded", behind: false, baseDaily: 64000, stores: 1 },
  { first: "Julien", last: "Marchand", email: "julien@brasserieduport.fr", phone: "0677889900", restaurant: "Brasserie du Port", city: "Rennes", plan: "premium", buyerType: "business", siret: "99011233400027", sub: "active", health: "healthy", behind: false, baseDaily: 154000, stores: 1 },
  { first: "Yann", last: "Le Goff", email: "yann@lekraken.fr", phone: "0688990011", restaurant: "Le Kraken", city: "Brest", plan: "essentielle", buyerType: "business", siret: "66788900100018", sub: "active", health: "healthy", behind: false, baseDaily: 71000, stores: 1 },
  { first: "Laura", last: "Petit", email: "laura@greenbowl.fr", phone: "0644556677", restaurant: "Green Bowl", city: "Grenoble", plan: "essentielle", buyerType: "personal", siret: "11233455600014", sub: "canceled", health: "unknown", behind: true, baseDaily: 0, stores: 1 },
  { first: "Omar", last: "Yıldız", email: "omar@maisonkebab.fr", phone: "0600112233", restaurant: "Maison Kebab", city: "Dijon", plan: "essentielle", buyerType: "business", siret: "88900122300025", sub: "canceled", health: "unknown", behind: false, baseDaily: 0, stores: 1 },
];

/* Demo clients are priced off the real plan prices — a seeder quoting stale
   amounts makes the console's revenue figures wrong for the seeded fleet. */
const CREATION_CENTS = {
  essentielle: planPrices.essentielle.creation,
  premium: planPrices.premium.creation,
};
const MAINT_CENTS = {
  essentielle: planPrices.essentielle.maintenanceYearly,
  premium: planPrices.premium.maintenanceYearly,
};
const LATEST_VERSION = "2.1.0";
const BEHIND_VERSION = "2.0.1";

const PROSPECTS = [
  { first: "Nadia", last: "Cherif", email: "nadia@lolivier.fr", phone: "0612000001", restaurant: "L'Olivier", city: "Aix-en-Provence", plan: "premium" as const },
  { first: "Paul", last: "Girard", email: "paul@chezpaul.fr", phone: "0612000002", restaurant: "Chez Paul", city: "Angers", plan: "essentielle" as const },
  { first: "Sofia", last: "Costa", email: "sofia@pastafresca.fr", phone: "0612000003", restaurant: "Pasta Fresca", city: "Reims", plan: "essentielle" as const },
  { first: "Hugo", last: "Roy", email: "hugo@leresto.fr", phone: "0612000004", restaurant: "Le Resto", city: "Le Havre", plan: "premium" as const },
  { first: "Léa", last: "Moreau", email: "lea@sunfood.fr", phone: "0612000005", restaurant: "Sun Food", city: "Tours", plan: "essentielle" as const },
];

function subStatusToDeployment(sub: Sub): "live" | "provisioning" | "suspended" | "offboarded" {
  if (sub === "active" || sub === "past_due") return "live";
  if (sub === "none") return "provisioning";
  return "offboarded";
}

function integrationsFor(r: Resto) {
  const base: {
    key: "stripe" | "sumup" | "paypal" | "square" | "uber_eats" | "deliveroo" | "uber_direct" | "ses";
    status: "connected" | "disconnected" | "error" | "not_configured";
    detail?: string;
  }[] = [
    { key: "stripe", status: "connected" },
    { key: "ses", status: "connected" },
    { key: "uber_eats", status: "connected" },
  ];
  if (r.plan === "premium") {
    base.push({ key: "deliveroo", status: "connected" });
    base.push({ key: "uber_direct", status: "connected" });
  }
  if (r.health === "down") {
    const s = base.find((b) => b.key === "stripe");
    if (s) { s.status = "error"; s.detail = "Webhook Stripe en échec (401)"; }
  }
  if (r.restaurant === "Pizza Napoli") {
    const u = base.find((b) => b.key === "uber_eats");
    if (u) { u.status = "error"; u.detail = "Sync menu Uber Eats bloquée (token expiré)"; }
  }
  return base;
}

async function wipeOps(ctx: MutationCtx) {
  const tables = [
    "saActivity",
    "saMonitoringChecks",
    "saIncidentUpdates",
    "saIncidents",
    "saSalesSnapshots",
    "saStores",
    "saDeployments",
  ] as const;
  for (const t of tables) {
    for (const row of await ctx.db.query(t).collect()) await ctx.db.delete(row._id);
  }
}

async function seedCommercial(ctx: MutationCtx) {
  const now = Date.now();
  for (const [idx, r] of RESTAURANTS.entries()) {
    const rand = mulberry32(idx * 6151 + 7);
    const signedAt = now - Math.floor((60 + rand() * 400) * DAY);

    // Build order (paid)
    const creationCents = CREATION_CENTS[r.plan];
    const orderId = await ctx.db.insert("orders", {
      customerEmail: r.email,
      customerFirstName: r.first,
      customerLastName: r.last,
      customerPhone: r.phone,
      restaurantName: r.restaurant,
      city: r.city,
      buyerType: r.buyerType,
      siret: r.buyerType === "business" ? r.siret : undefined,
      plan: r.plan,
      orderType: "creation",
      amountCents: creationCents,
      status: r.sub === "none" ? "pending" : "paid",
      paymentMethod: "card",
      stripeSessionId: `cs_${idx}_creation`,
      /* Demo data, but the shape has to be the real one: ./schema.ts says every
         order created from now on carries the waiver, and a seed that skipped it
         made that sentence false — and put waiverless rows into the revenue the
         ops console reports. Marked as seeded so nobody mistakes it for a tick
         somebody actually made. */
      withdrawalWaiver: {
        consentedAt: signedAt,
        version: WITHDRAWAL_WAIVER.version,
        text: WITHDRAWAL_WAIVER.text,
        cgvClause: `${WITHDRAWAL_WAIVER.cgvClause} — donnée de démonstration`,
      },
      createdAt: signedAt,
    });
    if (r.sub !== "none") {
      await ctx.db.insert("payments", {
        orderId,
        stripePaymentIntentId: `pi_${idx}_creation`,
        stripeSessionId: `cs_${idx}_creation`,
        status: "succeeded",
        amountCents: creationCents,
        paymentMethod: "card",
        paidAt: signedAt + 60_000,
        createdAt: signedAt,
      });
      await ctx.db.insert("invoices", {
        orderId,
        stripeInvoiceId: `in_${idx}_creation`,
        stripeCustomerId: `cus_${idx}`,
        customerEmail: r.email,
        plan: r.plan,
        amountCents: creationCents,
        status: "paid",
        hostedInvoiceUrl: "https://invoice.stripe.com/i/demo",
        paidAt: signedAt + 60_000,
        createdAt: signedAt,
      });
    }

    // Abonnement maintenance
    if (r.sub !== "none") {
      const periodEnd =
        r.restaurant === "Chez Amir"
          ? now - 4 * DAY
          : r.restaurant === "Le Kraken"
            ? now + 8 * DAY
            : r.restaurant === "Pizza Napoli"
              ? now + 18 * DAY
              : r.restaurant === "Tacos Loco"
                ? now + 26 * DAY
                : now + Math.floor((30 + rand() * 300)) * DAY;
      await ctx.db.insert("subscriptions", {
        orderId,
        stripeSubscriptionId: `sub_${idx}`,
        stripeCustomerId: `cus_${idx}`,
        customerEmail: r.email,
        plan: r.plan,
        billingPeriod: "yearly",
        status: r.sub,
        currentPeriodStart: signedAt + 21 * DAY,
        currentPeriodEnd: periodEnd,
        canceledAt: r.sub === "canceled" ? now - 20 * DAY : undefined,
        createdAt: signedAt + 21 * DAY,
      });
      // Facture maintenance
      const overdue = r.restaurant === "Chez Amir";
      await ctx.db.insert("invoices", {
        orderId,
        stripeInvoiceId: `in_${idx}_maint`,
        stripeCustomerId: `cus_${idx}`,
        customerEmail: r.email,
        plan: r.plan,
        amountCents: MAINT_CENTS[r.plan],
        status: overdue ? "open" : r.sub === "canceled" ? "void" : "paid",
        hostedInvoiceUrl: "https://invoice.stripe.com/i/demo",
        paidAt: overdue || r.sub === "canceled" ? undefined : now - 34 * DAY,
        periodStart: now - 40 * DAY,
        periodEnd: now + 325 * DAY,
        createdAt: now - 40 * DAY,
      });
    }
  }

  // Prospects
  for (const p of PROSPECTS) {
    await ctx.db.insert("whitelist", {
      firstName: p.first,
      lastName: p.last,
      email: p.email,
      phone: p.phone,
      restaurantName: p.restaurant,
      city: p.city,
      plan: p.plan,
      message: "Intéressé par une démo.",
      createdAt: now - Math.floor(mulberry32(p.email.length)() * 30 * DAY),
    });
  }
}

async function seedAffiliates(ctx: MutationCtx) {
  const now = Date.now();
  // Programme settings
  const existingSettings = await ctx.db.query("affiliateSettings").take(1);
  if (existingSettings.length === 0) {
    await ctx.db.insert("affiliateSettings", {
      defaultCommissionCents: 50000,
      defaultDiscountPercent: 10,
      validationDelayDays: 14,
      programEnabled: true,
      updatedAt: now,
    });
  }

  const TEAM = [
    { first: "Camille", last: "Renaud", email: "camille@apporteur.fr" },
    { first: "Lucas", last: "Meyer", email: "lucas@apporteur.fr" },
    { first: "Inès", last: "Dahmani", email: "ines@apporteur.fr" },
  ];
  const affiliateIds: Id<"affiliateUsers">[] = [];
  const codeIds: Id<"referralCodes">[] = [];
  for (const [i, m] of TEAM.entries()) {
    const userId = await ctx.db.insert("users", {
      name: `${m.first} ${m.last}`,
      email: m.email,
    } as never);
    const aid = await ctx.db.insert("affiliateUsers", {
      userId: userId as Id<"users">,
      firstName: m.first,
      lastName: m.last,
      phone: "0600000000",
      role: "affiliate",
      status: "active",
      contractStatus: "active",
      stripeConnectStatus: i === 0 ? "active" : "not_started",
      createdAt: now - 120 * DAY,
    });
    affiliateIds.push(aid);
    const cid = await ctx.db.insert("referralCodes", {
      affiliateUserId: aid,
      code: `${m.first.toUpperCase()}500`,
      isCustom: false,
      isActive: true,
      createdAt: now - 120 * DAY,
    });
    codeIds.push(cid);
  }

  // A few referrals attached to existing orders
  const orders = await ctx.db.query("orders").take(200);
  const paidOrders = orders.filter((o) => o.status === "paid").slice(0, 5);
  const statuses = ["paid", "validated", "pending", "payable", "paid"] as const;
  for (const [i, o] of paidOrders.entries()) {
    const ai = i % affiliateIds.length;
    const status = statuses[i]!;
    await ctx.db.insert("referrals", {
      referrerId: affiliateIds[ai]!,
      referralCodeId: codeIds[ai]!,
      orderId: o._id,
      customerEmail: o.customerEmail,
      customerName: `${o.customerFirstName} ${o.customerLastName}`,
      status,
      commissionCents: 50000,
      discountPercent: 10,
      discountAmountCents: Math.round(o.amountCents * 0.1),
      validatedAt: status !== "pending" ? o.createdAt + 14 * DAY : undefined,
      paidAt: status === "paid" ? o.createdAt + 30 * DAY : undefined,
      createdAt: o.createdAt + DAY,
    });
  }
}

async function buildOps(ctx: MutationCtx) {
  const now = Date.now();
  const today = startOfDay(now);
  const orders = await ctx.db.query("orders").take(5000);
  const configByEmail = new Map(RESTAURANTS.map((r) => [r.email, r]));

  // 1 deployment per client (build order, paid or pending)
  const seen = new Set<string>();
  const creationOrders = orders.filter((o) => o.orderType === "creation");
  let idx = 0;
  const deploymentByEmail = new Map<string, Id<"saDeployments">>();

  for (const o of creationOrders) {
    if (seen.has(o.customerEmail)) continue;
    seen.add(o.customerEmail);
    const cfg = configByEmail.get(o.customerEmail);
    const sub: Sub = cfg?.sub ?? (o.status === "paid" ? "active" : "none");
    const health: Health = cfg?.health ?? "healthy";
    const behind = cfg?.behind ?? false;
    const depStatus = subStatusToDeployment(sub);
    const rand = mulberry32(idx * 8887 + 11);
    const goLive =
      depStatus === "live" || sub === "canceled" ? o.createdAt + 21 * DAY : undefined;
    const uptime =
      health === "down" ? 96.2 + rand()
      : health === "degraded" ? 98.4 + rand()
      : depStatus === "live" ? 99.85 + rand() * 0.14
      : 100;
    const stores = cfg?.stores ?? 1;

    const depId = await ctx.db.insert("saDeployments", {
      customerEmail: o.customerEmail,
      restaurantName: o.restaurantName,
      city: o.city,
      orderId: o._id,
      name: `${o.restaurantName} — ${depStatus === "live" ? "Prod" : depStatus}`,
      domain: `${o.restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.beyours.app`,
      convexUrl: `https://${["swift", "bright", "warm", "clever", "brave"][idx % 5]}-${["otter", "fox", "heron", "lynx", "wren"][idx % 5]}-${100 + idx}.convex.cloud`,
      environment: "production",
      status: depStatus,
      health,
      region: idx % 3 === 0 ? "eu-west-3" : "eu-west-1",
      plan: o.plan,
      version: behind ? BEHIND_VERSION : LATEST_VERSION,
      latestVersion: LATEST_VERSION,
      uptime30d: Math.round(uptime * 100) / 100,
      storeCount: stores,
      goLiveAt: goLive,
      provisionedAt: o.createdAt + 7 * DAY,
      lastCheckAt: now - Math.floor(rand() * 20 * 60_000),
      lastDeployAt: now - Math.floor((3 + rand() * 40) * DAY),
      integrations: cfg ? integrationsFor(cfg) : [{ key: "stripe", status: "connected" }, { key: "ses", status: "connected" }],
      maintenance: {
        status: sub === "canceled" ? "expired" : sub === "none" ? "none" : "active",
        coveredUntil: goLive ? goLive + 365 * DAY : undefined,
        autoRenew: o.restaurantName !== "Pizza Napoli" && sub === "active",
      },
      createdAt: o.createdAt + 7 * DAY,
      updatedAt: now,
    });
    deploymentByEmail.set(o.customerEmail, depId);

    const cities = [o.city, "Centre", "Gare", "Rive Droite"];
    for (let s = 0; s < stores; s++) {
      await ctx.db.insert("saStores", {
        deploymentId: depId,
        name: stores === 1 ? o.restaurantName : `${o.restaurantName} — ${cities[s]}`,
        city: o.city,
        status: depStatus === "live" ? "open" : depStatus === "suspended" ? "temporarily_unavailable" : "draft",
        createdAt: o.createdAt + 10 * DAY,
      });
    }

    // 60 days of sales for live deployments
    const baseDaily = cfg?.baseDaily ?? (o.plan === "premium" ? 150000 : 90000);
    if (depStatus === "live" && baseDaily > 0) {
      const weekday = [1.05, 0.82, 0.9, 0.98, 1.12, 1.35, 1.28];
      for (let i = SALES_DAYS - 1; i >= 0; i--) {
        const dayTs = today - i * DAY;
        const dow = new Date(dayTs).getUTCDay();
        const trend = 0.86 + 0.28 * ((SALES_DAYS - i) / SALES_DAYS);
        const noise = 0.86 + rand() * 0.3;
        let gross = Math.round(baseDaily * weekday[dow]! * trend * noise);
        if (health === "down" && i <= 2) gross = Math.round(gross * 0.24);
        if (gross < 3000) gross = 3000;
        const refunded = Math.round(gross * (0.008 + rand() * 0.028));
        const aov = 2300 + Math.floor(rand() * 900);
        const orderCount = Math.max(1, Math.round(gross / aov));
        const website = Math.round(gross * (0.4 + rand() * 0.08));
        const uber = Math.round(gross * (0.26 + rand() * 0.08));
        const deliveroo = Math.round(gross * (o.plan === "premium" ? 0.16 + rand() * 0.06 : 0.06 + rand() * 0.04));
        const pos = Math.max(0, gross - website - uber - deliveroo);
        await ctx.db.insert("saSalesSnapshots", {
          deploymentId: depId,
          customerEmail: o.customerEmail,
          day: new Date(dayTs).toISOString().slice(0, 10),
          dayTs,
          grossCents: gross,
          netCents: gross - refunded,
          refundedCents: refunded,
          orderCount,
          avgOrderValueCents: Math.round(gross / orderCount),
          byType: {
            delivery: Math.round(orderCount * 0.5),
            pickup: Math.round(orderCount * 0.3),
            dine_in: Math.max(0, orderCount - Math.round(orderCount * 0.5) - Math.round(orderCount * 0.3)),
          },
          bySource: { website, uber_eats: uber, deliveroo, pos },
          currency: "EUR",
          createdAt: dayTs + 23 * 3_600_000,
        });
      }
    }
    idx++;
  }

  await seedIncidents(ctx, deploymentByEmail, now);
  await seedMonitoring(ctx, now);
}

async function seedIncidents(
  ctx: MutationCtx,
  depByEmail: Map<string, Id<"saDeployments">>,
  now: number,
) {
  type Spec = {
    email: string | null;
    title: string;
    severity: "sev1" | "sev2" | "sev3" | "sev4";
    status: "open" | "investigating" | "identified" | "monitoring" | "resolved";
    area: ("payments" | "orders" | "kitchen" | "integrations" | "site" | "delivery" | "auth" | "other")[];
    detectedBy: "monitoring" | "client" | "team";
    startedAgo: number;
    resolvedAgo?: number;
    assignee?: string;
    impact: string;
    updates: { ago: number; status?: Spec["status"]; message: string; by?: string }[];
  };
  const specs: Spec[] = [
    { email: "amir@chezamir.fr", title: "Paiements Stripe en échec — webhook 401", severity: "sev1", status: "investigating", area: ["payments", "integrations"], detectedBy: "monitoring", startedAgo: 2 * 3_600_000, assignee: "Camille Renaud", impact: "Encaissements carte bloqués sur la boutique en ligne.", updates: [ { ago: 2 * 3_600_000, status: "open", message: "Alerte monitoring : 100% des webhooks Stripe renvoient 401." }, { ago: 95 * 60_000, status: "investigating", message: "Clé de signature invalidée après rotation. Régénération en cours.", by: "Camille Renaud" } ] },
    { email: "giuseppe@pizzanapoli.fr", title: "Sync menu Uber Eats bloquée", severity: "sev2", status: "identified", area: ["integrations", "delivery"], detectedBy: "client", startedAgo: 6 * 3_600_000, assignee: "Lucas Meyer", impact: "Les mises à jour de prix ne remontent plus sur Uber Eats.", updates: [ { ago: 6 * 3_600_000, status: "open", message: "Le client signale des prix non à jour sur Uber Eats." }, { ago: 4 * 3_600_000, status: "identified", message: "Refresh token OAuth Uber révoqué. Ré-autorisation nécessaire.", by: "Lucas Meyer" } ] },
    { email: "diego@tacosloco.fr", title: "Site lent — p95 latence > 3s", severity: "sev2", status: "monitoring", area: ["site"], detectedBy: "monitoring", startedAgo: 26 * 3_600_000, assignee: "Lucas Meyer", impact: "Temps de chargement dégradé aux heures de pointe.", updates: [ { ago: 26 * 3_600_000, status: "open", message: "Latence p95 au-delà du seuil (3s)." }, { ago: 20 * 3_600_000, status: "monitoring", message: "Index ajouté, latence à 480ms. Sous surveillance 24h.", by: "Lucas Meyer" } ] },
    { email: null, title: "Emails transactionnels retardés (SES)", severity: "sev3", status: "monitoring", area: ["integrations", "other"], detectedBy: "monitoring", startedAgo: 8 * 3_600_000, assignee: "Inès Dahmani", impact: "Confirmations de commande envoyées avec ~10 min de délai (plateforme).", updates: [ { ago: 8 * 3_600_000, status: "open", message: "File SES en retard sur eu-west-1." }, { ago: 6 * 3_600_000, status: "monitoring", message: "Débit rétabli, file en résorption.", by: "Inès Dahmani" } ] },
    { email: "sophie@comptoirdore.fr", title: "Imprimante cuisine hors-ligne", severity: "sev3", status: "resolved", area: ["kitchen"], detectedBy: "client", startedAgo: 3 * DAY, resolvedAgo: 3 * DAY - 5 * 3_600_000, assignee: "Camille Renaud", impact: "Tickets non imprimés sur une station.", updates: [ { ago: 3 * DAY, status: "open", message: "Le poste cuisine n'imprime plus : imprimante par défaut absente de Chrome." }, { ago: 3 * DAY - 5 * 3_600_000, status: "resolved", message: "Imprimante re-sélectionnée par défaut, mode kiosque relancé. Impression OK.", by: "Camille Renaud" } ] },
    { email: "marc@lepetitbistrot.fr", title: "Erreurs 500 intermittentes au checkout", severity: "sev2", status: "resolved", area: ["orders", "site"], detectedBy: "monitoring", startedAgo: 9 * DAY, resolvedAgo: 9 * DAY - 3 * 3_600_000, assignee: "Lucas Meyer", impact: "~2% des commandes échouaient au paiement.", updates: [ { ago: 9 * DAY, status: "open", message: "Pic d'erreurs 500 au checkout." }, { ago: 9 * DAY - 3 * 3_600_000, status: "resolved", message: "Race condition corrigée, déploiement v2.1.0.", by: "Lucas Meyer" } ] },
    { email: "amir@chezamir.fr", title: "Certificat SSL expirant sous 5 jours", severity: "sev4", status: "resolved", area: ["site", "other"], detectedBy: "monitoring", startedAgo: 34 * DAY, resolvedAgo: 34 * DAY - 2 * 3_600_000, assignee: "Camille Renaud", impact: "Renouvellement TLS préventif.", updates: [ { ago: 34 * DAY, status: "open", message: "Certificat expirant sous 5 jours." }, { ago: 34 * DAY - 2 * 3_600_000, status: "resolved", message: "Renouvellement forcé et vérifié.", by: "Camille Renaud" } ] },
  ];

  let seq = 1;
  const year = new Date(now).getFullYear();
  const restByEmail = new Map(RESTAURANTS.map((r) => [r.email, r]));
  for (const s of specs) {
    const depId = s.email ? depByEmail.get(s.email) : undefined;
    const startedAt = now - s.startedAgo;
    const resolvedAt = s.resolvedAgo ? now - s.resolvedAgo : undefined;
    const number = `INC-${year}-${String(seq++).padStart(4, "0")}`;
    const incId = await ctx.db.insert("saIncidents", {
      number,
      title: s.title,
      description: s.impact,
      deploymentId: depId,
      customerEmail: s.email ?? undefined,
      restaurantName: s.email ? restByEmail.get(s.email)?.restaurant : undefined,
      severity: s.severity,
      status: s.status,
      area: s.area,
      detectedBy: s.detectedBy,
      assigneeName: s.assignee,
      impact: s.impact,
      startedAt,
      acknowledgedAt: startedAt + 12 * 60_000,
      resolvedAt,
      resolutionSummary: s.status === "resolved" ? s.updates[s.updates.length - 1]?.message : undefined,
      createdAt: startedAt,
      updatedAt: resolvedAt ?? now,
    });
    for (const u of s.updates) {
      await ctx.db.insert("saIncidentUpdates", {
        incidentId: incId,
        status: u.status,
        message: u.message,
        authorName: u.by ?? "Monitoring",
        createdAt: now - u.ago,
      });
    }
    await ctx.db.insert("saActivity", {
      kind: "incident",
      action: "incident.created",
      summary: `${number} · ${s.title}`,
      deploymentId: depId,
      customerEmail: s.email ?? undefined,
      incidentId: incId,
      actorName: s.assignee ?? "Monitoring",
      createdAt: startedAt,
    });
  }
}

async function seedMonitoring(ctx: MutationCtx, now: number) {
  const deps = await ctx.db.query("saDeployments").take(500);
  let k = 0;
  for (const dep of deps) {
    if (dep.status !== "live") continue;
    const rand = mulberry32(k++ * 104729 + 3);
    for (let j = 5; j >= 0; j--) {
      const checkedAt = now - j * 5 * 60_000;
      const down = dep.health === "down" && j <= 2;
      const degraded = dep.health === "degraded" && j <= 3;
      await ctx.db.insert("saMonitoringChecks", {
        deploymentId: dep._id,
        kind: "http",
        /* Same targets the real prober uses (convex/saMonitoring.ts). Demo data
           that points at a route nothing serves teaches the wrong thing. */
        target: `https://${dep.domain}/`,
        status: down ? "down" : degraded ? "degraded" : "up",
        latencyMs: down ? undefined : Math.round((degraded ? 1400 : 220) + rand() * 260),
        statusCode: down ? 503 : 200,
        message: down ? "503 Service Unavailable" : undefined,
        checkedAt,
      });
    }
    await ctx.db.insert("saMonitoringChecks", {
      deploymentId: dep._id,
      kind: "convex",
      target: dep.convexUrl ? `${dep.convexUrl}/instance_name` : "convex",
      status: dep.health === "down" ? "down" : "up",
      latencyMs: Math.round(40 + rand() * 60),
      checkedAt: now - 60_000,
    });
    const errored = dep.integrations.find((i) => i.status === "error");
    if (errored) {
      await ctx.db.insert("saMonitoringChecks", {
        deploymentId: dep._id,
        kind: "integration",
        target: errored.key,
        status: "down",
        message: errored.detail ?? "Intégration en erreur",
        checkedAt: now - 3 * 60_000,
      });
    }
  }
}

export const run = internalMutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const hasOps = (await ctx.db.query("saDeployments").take(1)).length > 0;
    if (hasOps && !args.force) {
      return { skipped: true, reason: "Flotte déjà seedée. `pnpm seed:reset` pour réinitialiser." };
    }
    if (args.force) await wipeOps(ctx);

    const ordersEmpty = (await ctx.db.query("orders").take(1)).length === 0;
    if (ordersEmpty) {
      await seedCommercial(ctx);
      await seedAffiliates(ctx);
    }
    await buildOps(ctx);

    const deps = await ctx.db.query("saDeployments").take(500);
    return { ok: true, deployments: deps.length, seededCommercial: ordersEmpty };
  },
});

export const reset = internalMutation({
  args: { confirm: v.boolean() },
  handler: async (ctx, args) => {
    if (!args.confirm) throw new Error("Ajoutez { confirm: true } pour réinitialiser.");
    await wipeOps(ctx);
    await buildOps(ctx);
    return { ok: true, reset: true };
  },
});
