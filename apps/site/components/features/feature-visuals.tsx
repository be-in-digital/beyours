/* ═══════════════════════════════════════════════
   Feature Visuals — clean mini-UIs in the storefront style
   Rebuilt as the real product: photo menu cards,
   order feeds, integrations, terracotta charts.
   ═══════════════════════════════════════════════ */

import Image from "next/image";
import {
  Globe,
  Star,
  TrendingUp,
  ShoppingBag,
  Plus,
  Clock,
  Bell,
  Check,
  QrCode,
  Sparkles,
  Ticket,
  BarChart3,
  MapPin,
  UtensilsCrossed,
} from "lucide-react";
import type { Feature } from "./features-data";

/** Route to the right mockup based on feature.mockupPattern + id */
export function FeatureVisual({ feature }: { feature: Feature }) {
  switch (feature.id) {
    case "site-web-premium":
      return <SiteWebVisual />;
    case "commande-en-ligne":
      return <CommandeVisual />;
    case "experience-mobile":
      return <MobileAppVisual />;
    case "centralisation-commandes":
      return <CentralisationVisual />;
    case "integration-plateformes":
      return <IntegrationVisual />;
    case "fidelisation-gamification":
      return <FideliteVisual />;
    case "analytics":
      return <AnalyticsVisual />;
    default:
      // Fallback aligned on the declared pattern
      if (feature.mockupPattern === "mobile") return <MobileAppVisual />;
      if (feature.mockupPattern === "integration") return <IntegrationVisual />;
      return <AnalyticsVisual />;
  }
}

/* ── Cadre commun : carte claire, ombre chaude ── */

function VisualCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-surface-1 shadow-[0_20px_50px_-28px_rgba(112,60,34,0.4)]">
      {children}
    </div>
  );
}

function BrowserBar({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-[color:var(--border)] bg-secondary/60 px-4 py-2.5">
      <div className="flex gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-surface-4" />
        <span className="h-2.5 w-2.5 rounded-full bg-surface-4" />
        <span className="h-2.5 w-2.5 rounded-full bg-surface-4" />
      </div>
      <div className="mx-auto flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1 text-[10px] font-medium text-muted-foreground">
        <MapPin className="h-3 w-3 text-primary-ink" strokeWidth={2.2} />
        {url}
      </div>
    </div>
  );
}

/* ── 01 · Site Web Premium — vitrine + hero plat ── */

function SiteWebVisual() {
  return (
    <VisualCard>
      <BrowserBar url="trattoria-nonna.fr" />

      {/* Venue hero */}
      <div className="relative h-40 w-full overflow-hidden sm:h-44">
        <Image
          src="/photos/plat-gastronomie.webp"
          alt="Page d'accueil du restaurant Trattoria Nonna"
          fill
          sizes="(max-width: 1024px) 100vw, 520px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground shadow-sm">
          <Globe className="h-3 w-3" strokeWidth={2.4} /> Site à votre image
        </span>
        <div className="absolute inset-x-4 bottom-3">
          <p className="font-display text-lg font-semibold leading-none text-white">
            Trattoria Nonna
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-white/85">
            <Star className="h-3 w-3 fill-primary text-primary-ink" />
            4,9 · Cuisine italienne · Bordeaux
          </p>
        </div>
      </div>

      {/* Bloc perf SEO + vitesse */}
      <div className="grid grid-cols-2 gap-3 p-4">
        <div className="rounded-xl border border-[color:var(--border)] bg-background p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Vitesse
          </p>
          <p className="mt-1 font-display text-lg font-semibold tabular-nums text-foreground">
            0,8 s
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full w-[92%] rounded-full bg-primary" />
          </div>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-background p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            SEO local
          </p>
          <p className="mt-1 flex items-center gap-1.5 font-display text-lg font-semibold tabular-nums text-foreground">
            Top 3
            <TrendingUp className="h-4 w-4 text-primary-ink" strokeWidth={2.4} />
          </p>
          <div className="mt-2 flex items-end gap-1">
            {[40, 62, 55, 78, 88].map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t ${i === 4 ? "bg-primary" : "bg-primary/25"}`}
                style={{ height: `${(h / 88) * 24}px` }}
              />
            ))}
          </div>
        </div>
      </div>
    </VisualCard>
  );
}

/* ── 02 · Online ordering — a working cart ── */

const commandeItems = [
  {
    name: "Burger Signature",
    desc: "Bœuf maturé, cheddar affiné",
    price: "14,90 €",
    img: "/photos/burger-premium.webp",
    added: true,
  },
  {
    name: "Filet, jus corsé",
    desc: "Pommes grenaille, échalote",
    price: "24,00 €",
    img: "/photos/plat-gastronomie.webp",
    added: false,
  },
];

function CommandeVisual() {
  return (
    <VisualCard>
      <BrowserBar url="trattoria-nonna.fr/commander" />

      {/* Onglets livraison / retrait */}
      <div className="flex items-center gap-2 border-b border-[color:var(--border)] px-4 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground">
          Click & Collect
        </span>
        <span className="rounded-full border border-[color:var(--border)] bg-background px-3 py-1.5 text-[11px] font-medium text-secondary-foreground">
          Livraison
        </span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary-ink">
          <Clock className="h-3 w-3" strokeWidth={2.4} /> 20 min
        </span>
      </div>

      {/* Plats */}
      <div className="divide-y divide-[color:var(--border)]">
        {commandeItems.map((it) => (
          <div key={it.name} className="flex items-center gap-3 px-4 py-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
              <Image
                src={it.img}
                alt={it.name}
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {it.name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {it.desc}
              </p>
              <p className="mt-0.5 text-xs font-semibold tabular-nums text-primary-ink">
                {it.price}
              </p>
            </div>
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                it.added
                  ? "bg-primary text-primary-foreground"
                  : "border border-[color:var(--border)] bg-background text-foreground"
              }`}
            >
              {it.added ? (
                <Check className="h-4 w-4" strokeWidth={2.6} />
              ) : (
                <Plus className="h-4 w-4" strokeWidth={2.4} />
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Barre panier — 0 % commission */}
      <div className="flex items-center justify-between gap-3 border-t border-[color:var(--border)] bg-secondary/50 px-4 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary-ink">
          0 % de commission
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
          <ShoppingBag className="h-3.5 w-3.5" strokeWidth={2.2} />
          Commander · 14,90 €
        </span>
      </div>
    </VisualCard>
  );
}

/* ── 09 · Mobile experience — light phone ── */

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-[210px] rounded-[2rem] border border-[color:var(--border)] bg-surface-1 p-1.5 shadow-[0_28px_60px_-30px_rgba(112,60,34,0.5)] sm:w-[224px]">
      <div className="overflow-hidden rounded-[1.6rem] bg-background">
        {/* Encoche */}
        <div className="relative flex items-center justify-center pt-2">
          <span className="h-1.5 w-16 rounded-full bg-surface-3" />
        </div>
        {children}
      </div>
    </div>
  );
}

function MobileAppVisual() {
  return (
    <div className="flex items-center justify-center py-2">
      <PhoneFrame>
        {/* App header */}
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground">
              Bonjour Jean 👋
            </p>
            <p className="font-display text-sm font-semibold text-foreground">
              Le Petit Bistrot
            </p>
          </div>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary-ink">
            <Bell className="h-4 w-4" strokeWidth={2} />
          </span>
        </div>

        {/* Featured dish visual */}
        <div className="relative mx-4 mt-1 h-24 overflow-hidden rounded-xl">
          <Image
            src="/photos/burger-premium.webp"
            alt="Plat du jour dans l'application"
            fill
            sizes="200px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
          <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold text-primary-foreground">
            Plat du jour
          </span>
          <p className="absolute bottom-2 left-2 text-[11px] font-semibold text-white">
            Burger Signature · 14,90 €
          </p>
        </div>

        {/* Raccourcis */}
        <div className="mt-3 grid grid-cols-2 gap-2 px-4">
          {[
            { label: "Commander", sub: "Livraison / retrait", primary: true },
            { label: "Mes lots", sub: "1 à retirer", primary: false },
          ].map((c) => (
            <div
              key={c.label}
              className={`rounded-xl border p-2.5 ${
                c.primary
                  ? "border-[color:var(--border-accent)] bg-primary/10"
                  : "border-[color:var(--border)] bg-surface-1"
              }`}
            >
              <p
                className={`text-[11px] font-semibold ${c.primary ? "text-primary-ink" : "text-foreground"}`}
              >
                {c.label}
              </p>
              <p className="text-[9px] text-muted-foreground">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="p-4">
          <div className="flex h-9 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            Commander maintenant
          </div>
        </div>

        {/* Nav bar */}
        <div className="flex items-center justify-around border-t border-[color:var(--border)] px-4 py-2.5">
          <UtensilsCrossed className="h-4 w-4 text-primary-ink" strokeWidth={2} />
          <ShoppingBag className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
          <Star className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
        </div>
      </PhoneFrame>
    </div>
  );
}

/* ── 05 · Order centralisation — one unified feed ── */

const orderFlow = [
  {
    ref: "#1042",
    label: "2× Burger, 1× Frites",
    source: "Votre site",
    logo: null,
    status: "Nouveau",
    live: true,
  },
  {
    ref: "#1041",
    label: "Menu dégustation",
    source: "Click & collect",
    logo: null,
    status: "En cuisine",
    live: false,
  },
  {
    ref: "#1040",
    label: "Pizza Margherita ×2",
    source: "Sur place",
    logo: null,
    status: "Prête",
    live: false,
  },
];

function CentralisationVisual() {
  return (
    <VisualCard>
      {/* Dashboard header */}
      <div className="flex items-center justify-between border-b border-[color:var(--border)] bg-secondary/50 px-4 py-3">
        <p className="text-xs font-semibold text-foreground">
          Commandes en direct
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary-ink">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />1 flux unifié
        </span>
      </div>

      {/* Order rows */}
      <div className="divide-y divide-[color:var(--border)]">
        {orderFlow.map((o) => (
          <div key={o.ref} className="flex items-center gap-3 px-4 py-3">
            <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
              {o.ref}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">
                {o.label}
              </p>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-background px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                {o.logo ? (
                  <Image
                    src={o.logo}
                    alt=""
                    width={12}
                    height={12}
                    className="h-3 w-3 rounded-sm object-contain"
                  />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                )}
                {o.source}
              </span>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                o.live
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2 text-secondary-foreground"
              }`}
            >
              {o.status}
            </span>
          </div>
        ))}
      </div>

      {/* Platform channels: Deliveroo is certified and live, Uber Eats is
          still awaiting validation. No date is announced for Uber. */}
      <div className="flex items-center gap-2 border-t border-[color:var(--border)] bg-background px-4 py-2.5">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="text-[10px] font-medium text-foreground">
          Deliveroo — commandes intégrées
        </span>
        <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
          Uber Eats en attente
        </span>
      </div>

      {/* Pied — compteur */}
      <div className="flex items-center justify-between border-t border-[color:var(--border)] bg-background px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Bell className="h-3.5 w-3.5 text-primary-ink" strokeWidth={2.2} />
          Alerte à chaque commande
        </span>
        <span className="font-display text-sm font-semibold tabular-nums text-primary-ink">
          156 aujourd&apos;hui
        </span>
      </div>
    </VisualCard>
  );
}

/* ── 06 · Integrations — real logos feeding the hub ── */

const integrationRows = [
  {
    name: "Deliveroo",
    logo: "/logos/deliveroo.png",
    detail: "Menu et commandes synchronisés",
    live: true,
  },
  {
    name: "Uber Eats",
    logo: "/logos/uber-eats.png",
    detail: "Commandes synchronisées une fois la validation obtenue",
    live: false,
  },
  {
    name: "Uber Direct",
    logo: "/logos/uber-direct.png",
    detail: "Livraison sans flotte, après validation",
    live: false,
  },
];

function IntegrationVisual() {
  return (
    <VisualCard>
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">
            Canaux de commande
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[9px] font-semibold text-primary-ink">
            Unification à 70 %
          </span>
        </div>

        {/* Sources */}
        <div className="mt-4 space-y-2.5">
          {integrationRows.map((r) => (
            <div
              key={r.name}
              className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-background px-3 py-2.5"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[color:var(--border)] bg-surface-1">
                <Image
                  src={r.logo}
                  alt={r.name}
                  width={22}
                  height={22}
                  className="h-[22px] w-[22px] rounded-md object-contain"
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground">{r.name}</p>
                <p className="text-[10px] text-muted-foreground">{r.detail}</p>
              </div>
              {r.live ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[9px] font-semibold text-primary-ink">
                  <Check className="h-3 w-3" strokeWidth={2.6} /> Certifié
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
                  <Clock className="h-3 w-3" strokeWidth={2.4} /> En attente
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Everything converging on the hub */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[color:var(--border-contrast)]" />
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-semibold text-primary-foreground shadow-[0_10px_24px_-14px_rgba(197,84,44,0.6)]">
            <UtensilsCrossed className="h-3.5 w-3.5" strokeWidth={2.2} />
            Votre dashboard
          </span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[color:var(--border-contrast)]" />
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          Une fois certifiées, elles arriveront au même endroit, sans double saisie.
        </p>
      </div>
    </VisualCard>
  );
}

/* ── 07 · The game at the table — one scan, one action, one play, one prize.
   Nothing accumulates between plays, so nothing here counts up: no balance,
   no tier, no progress bar towards a next level. What the owner actually
   holds is the win ratio, so that is the control the card ends on. ── */

const gameSteps = [
  { Icon: QrCode, label: "Scan à table" },
  { Icon: Star, label: "Avis Google" },
  { Icon: Sparkles, label: "Une partie" },
];

function FideliteVisual() {
  return (
    <VisualCard>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[color:var(--border)] bg-secondary/50 px-4 py-3">
        <p className="text-xs font-semibold text-foreground">Jeu à table</p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-background px-2.5 py-1 text-[10px] font-medium text-secondary-foreground">
          <QrCode className="h-3 w-3 text-primary-ink" strokeWidth={2.2} /> Table 12
        </span>
      </div>

      <div className="p-4">
        {/* The three steps of a single play */}
        <div className="grid grid-cols-3 gap-2">
          {gameSteps.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-[color:var(--border)] bg-background px-2 py-2.5 text-center"
            >
              <span className="mx-auto grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary-ink">
                <s.Icon className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <p className="mt-1.5 text-[10px] font-semibold text-foreground">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* The wheel and the prize it gave */}
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-background p-3">
          <span
            aria-hidden="true"
            className="relative h-11 w-11 shrink-0 rounded-full border border-[color:var(--border-contrast)]"
            style={{
              background:
                "conic-gradient(var(--primary) 0deg 60deg, var(--surface-3) 60deg 120deg, var(--primary) 120deg 180deg, var(--surface-3) 180deg 240deg, var(--primary) 240deg 300deg, var(--surface-3) 300deg 360deg)",
            }}
          >
            <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-1" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground">
              Roue de la fortune
            </p>
            <p className="text-[10px] text-muted-foreground">
              Lot gagné : dessert offert
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[9px] font-semibold text-primary-ink">
            <Ticket className="h-3 w-3" strokeWidth={2.4} /> QR envoyé
          </span>
        </div>

        {/* The only dial the owner sets */}
        <div className="mt-2.5 rounded-xl border border-[color:var(--border)] bg-background p-3">
          <div className="flex items-center justify-between text-[11px] font-medium text-secondary-foreground">
            <span>Taux de gain</span>
            <span className="font-semibold tabular-nums text-primary-ink">30 %</span>
          </div>
          <div className="relative mt-2 h-2 rounded-full bg-surface-3">
            <div className="h-full w-[30%] rounded-full bg-primary" />
            <span
              aria-hidden="true"
              className="absolute top-1/2 left-[30%] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[color:var(--primary)] bg-surface-1"
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span className="tabular-nums">0 %</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" strokeWidth={2.2} /> 24 h avant de
              rejouer
            </span>
            <span className="tabular-nums">100 %</span>
          </div>
        </div>
      </div>
    </VisualCard>
  );
}

/* ── 08 · Analytics — KPIs + graphique terracotta ── */

const analyticsBars = [45, 58, 52, 70, 64, 82, 76, 95];

function AnalyticsVisual() {
  return (
    <VisualCard>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[color:var(--border)] bg-secondary/50 px-4 py-3">
        <p className="text-xs font-semibold text-foreground">Performances</p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-background px-2.5 py-1 text-[10px] font-medium text-secondary-foreground">
          <BarChart3 className="h-3 w-3 text-primary-ink" strokeWidth={2.2} /> 30
          jours
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 p-4">
        {[
          { label: "CA mensuel", value: "48,2 k€" },
          { label: "Panier moyen", value: "32,50 €" },
          { label: "Commandes", value: "1 483" },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-[color:var(--border)] bg-background p-3"
          >
            <p className="text-[10px] font-medium text-muted-foreground">
              {k.label}
            </p>
            <p className="mt-1 font-display text-sm font-semibold tabular-nums text-foreground">
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Terracotta bar chart */}
      <div className="px-4 pb-4">
        <div className="rounded-xl border border-[color:var(--border)] bg-background p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-muted-foreground">
              Chiffre d&apos;affaires
            </p>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-ink">
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={2.4} /> +24 %
            </span>
          </div>
          <div className="mt-3 flex h-20 items-end gap-2">
            {analyticsBars.map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t ${i === analyticsBars.length - 1 ? "bg-primary" : "bg-primary/25"}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </VisualCard>
  );
}
