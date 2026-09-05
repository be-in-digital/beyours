"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  animate,
  useMotionValue,
} from "framer-motion";
import {
  Store,
  ChefHat,
  LayoutDashboard,
  Languages,
  Trophy,
  ShoppingBag,
  Smartphone,
  UtensilsCrossed,
  Bell,
  Repeat,
  BarChart3,
  Star,
  ExternalLink,
  Printer,
  ArrowRight,
  Timer,
} from "lucide-react";
import { StorefrontPreview } from "@/components/storefront-preview";
import { features } from "@/components/features/features-data";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════
   Interactive feature showcase.
   5 tabs, each with a live visual (the real product, an animated KDS,
   animating KPIs, AI translation, loyalty). Then the full list.
   ═══════════════════════════════════════════════ */

const TABS = [
  { id: "site", label: "Site & commande", icon: Store },
  { id: "cuisine", label: "Cuisine (KDS)", icon: ChefHat },
  { id: "pilotage", label: "Pilotage", icon: LayoutDashboard },
  { id: "langues", label: "Multi-langues", icon: Languages },
  { id: "fidelite", label: "Fidélité & jeu", icon: Trophy },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function FeatureShowcase() {
  const [tab, setTab] = useState<TabId>("site");

  return (
    <div>
      {/* Onglets */}
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-transparent bg-primary text-primary-foreground shadow-[0_10px_24px_-14px_rgba(197,84,44,0.7)]"
                  : "border-[color:var(--border)] bg-surface-1 text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Panneau */}
      <div className="rounded-3xl border border-[color:var(--border)] bg-surface-1 p-5 sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {tab === "site" && <SitePanel />}
            {tab === "cuisine" && <KdsPanel />}
            {tab === "pilotage" && <PilotagePanel />}
            {tab === "langues" && <LangPanel />}
            {tab === "fidelite" && <FidelitePanel />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Everything is included */}
      <AllFeaturesGrid />
    </div>
  );
}

function PanelLayout({
  title,
  body,
  points,
  visual,
}: {
  title: string;
  body: string;
  points: string[];
  visual: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="order-2 lg:order-1">
        <h3 className="font-display text-2xl font-semibold tracking-[-0.01em] sm:text-3xl">
          {title}
        </h3>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          {body}
        </p>
        <ul className="mt-6 space-y-2.5">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="text-foreground">{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="order-1 lg:order-2">{visual}</div>
    </div>
  );
}

function SitePanel() {
  return (
    <PanelLayout
      title="Un vrai site de commande, à votre marque"
      body="Vos clients commandent en direct, sans commission. Ajout au panier, click and collect, paiement sécurisé. C'est le produit livré, pas une maquette."
      points={[
        "0 % de commission sur les commandes directes",
        "Design premium adapté à votre univers",
        "Optimisé mobile, pensé pour convertir",
      ]}
      visual={
        <div>
          <StorefrontPreview />
          <Link
            href="/demo/pizzeria-trattoria"
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Visiter un vrai site de démo
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      }
    />
  );
}

const KDS_TICKETS = [
  { table: "Table 4", items: ["2× Margherita", "1× Tiramisu"] },
  { table: "À emporter", items: ["1× Burger signature", "Frites"] },
  { table: "Table 9", items: ["1× Filet de bœuf", "2× Spritz"] },
];
const KDS_STATUS = [
  { label: "Nouveau", token: "info" },
  { label: "En préparation", token: "warning" },
  { label: "Prêt", token: "success" },
] as const;

function KdsPanel() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1700);
    return () => clearInterval(id);
  }, []);
  return (
    <PanelLayout
      title="La cuisine reçoit tout, en temps réel"
      body="Chaque commande s'affiche à l'écran cuisine et s'imprime automatiquement. Site, plateformes, sur place : un seul flux, zéro double saisie, zéro commande oubliée."
      points={[
        "Impression automatique des tickets",
        "Statuts en temps réel : nouveau, en préparation, prêt",
        "Multi-postes et alertes sonores",
      ]}
      visual={
        <div className="rounded-2xl border border-[color:var(--border)] bg-[#141019] p-4">
          <div className="mb-3 flex items-center justify-between text-white/70">
            <span className="text-xs font-semibold uppercase tracking-widest">
              Écran cuisine
            </span>
            <Printer className="h-4 w-4 animate-pulse text-amber-300" />
          </div>
          <div className="space-y-2.5">
            {KDS_TICKETS.map((t, i) => {
              const status = KDS_STATUS[(tick + i) % KDS_STATUS.length]!;
              return (
                <div
                  key={t.table}
                  className="rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">
                      {t.table}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: `var(--${status.token}-soft)`,
                        color: `var(--${status.token})`,
                      }}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/50">
                    {t.items.join(" · ")}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      }
    />
  );
}

function CountUp({
  to,
  suffix = "",
  prefix = "",
}: {
  to: number;
  suffix?: string;
  prefix?: string;
}) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState("0");
  useEffect(() => {
    const controls = animate(mv, to, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
    });
    const unsub = mv.on("change", (v) =>
      setDisplay(Math.round(v).toLocaleString("fr-FR")),
    );
    return () => {
      controls.stop();
      unsub();
    };
  }, [mv, to]);
  return (
    <span className="tabular-nums">
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

function PilotagePanel() {
  const kpis: {
    label: string;
    value: number;
    prefix?: string;
    suffix?: string;
  }[] = [
    { label: "Commandes ce mois", value: 342, suffix: "" },
    { label: "Panier moyen", value: 27, suffix: " €" },
    { label: "Commandes à traiter", value: 12, suffix: "" },
    { label: "CA en direct", value: 9240, suffix: " €" },
  ];
  return (
    <PanelLayout
      title="Tout votre restaurant, sur un écran"
      body="Chiffre d'affaires, commandes, panier moyen, commandes à traiter : vous pilotez à la donnée, pas au ressenti. Vue en temps réel, sans compétence technique."
      points={[
        "Les chiffres du jour en un coup d'œil, comparés à la veille",
        "Le chiffre d'affaires des 7 derniers jours en graphique",
        "Répartition des commandes par type et par canal de vente",
      ]}
      visual={
        <div className="rounded-2xl border border-[color:var(--border)] bg-background p-5">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60">
            Aperçu · données de démonstration
          </p>
          <div className="grid grid-cols-2 gap-3">
            {kpis.map((k) => (
              <div
                key={k.label}
                className="rounded-xl border border-[color:var(--border)] bg-surface-1 p-4"
              >
                <p className="font-display text-2xl font-semibold text-foreground">
                  <CountUp to={k.value} suffix={k.suffix} prefix={k.prefix} />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{k.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-end gap-1.5">
            {[40, 55, 48, 70, 62, 85, 78].map((h, i) => (
              <motion.span
                key={i}
                initial={{ height: 0 }}
                animate={{ height: h }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.6 }}
                className="flex-1 rounded-t bg-primary/70"
                style={{ maxHeight: 90 }}
              />
            ))}
          </div>
        </div>
      }
    />
  );
}

const LANGS = [
  { code: "FR", name: "Filet de bœuf, jus corsé", desc: "Pommes grenaille, échalote confite" },
  { code: "EN", name: "Beef fillet, rich jus", desc: "Grenaille potatoes, confit shallot" },
  { code: "ES", name: "Solomillo de ternera", desc: "Patatas grenaille, chalota confitada" },
  { code: "IT", name: "Filetto di manzo", desc: "Patate novelle, scalogno confit" },
  { code: "DE", name: "Rinderfilet, kräftiger Jus", desc: "Drillinge, confierte Schalotte" },
];

function LangPanel() {
  const [i, setI] = useState(0);
  const cur = LANGS[i]!;
  return (
    <PanelLayout
      title="Votre carte, dans toutes les langues"
      body="Ajoutez une langue, l'IA traduit votre carte automatiquement. Vos clients touristes commandent dans leur langue, sans que vous touchiez à quoi que ce soit."
      points={[
        "Langues illimitées, ajoutées en un clic",
        "Traduction automatique par IA, environ 0,001 € par plat",
        "Correction manuelle possible à tout moment",
      ]}
      visual={
        <div className="rounded-2xl border border-[color:var(--border)] bg-background p-5">
          <div className="mb-4 flex flex-wrap gap-1.5">
            {LANGS.map((l, idx) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setI(idx)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  i === idx
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {l.code}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-surface-1 p-4">
            <div className="h-14 w-14 shrink-0 rounded-xl bg-[url('/photos/plat-gastronomie.webp')] bg-cover bg-center" />
            <AnimatePresence mode="wait">
              <motion.div
                key={cur.code}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-sm font-semibold text-foreground">
                  {cur.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {cur.desc}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-primary">24 €</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
            <Languages className="h-3.5 w-3.5 text-primary" />
            Traduit automatiquement à l&apos;ajout de la langue.
          </p>
        </div>
      }
    />
  );
}

function FidelitePanel() {
  return (
    <PanelLayout
      title="Le jeu qui fait revenir vos clients"
      body="Roue de la fortune et carte à gratter, branchées sur votre site et votre base clients. Chaque partie vous rapporte un avis, un abonné ou un client dans votre base. Vous pilotez le taux de gain."
      points={[
        "Roue et carte à gratter incluses",
        "Débloquées par un avis Google ou un abonnement",
        "Taux de gain et lots pilotés par vous",
      ]}
      visual={
        <div className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-gradient-to-br from-primary/[0.08] to-transparent p-8 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 shadow-[0_0_40px_rgba(245,165,36,0.4)]">
            <Trophy className="h-9 w-9 text-[#3A1D00]" />
          </div>
          <p className="mt-5 font-display text-xl font-semibold">
            Jouable plus haut sur cette page
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Tournez la roue, gagnez, recevez votre ticket QR.
          </p>
          <a
            href="#jeu"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Revoir le jeu
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      }
    />
  );
}

/* ── Every feature, listed out ── */

const FEATURE_ICONS: Record<string, typeof Store> = {
  "site-web-premium": Store,
  "formation-google-business": Star,
  "commande-en-ligne": ShoppingBag,
  "experience-mobile": Smartphone,
  "dashboard-administrateur": LayoutDashboard,
  "gestion-menu": UtensilsCrossed,
  "centralisation-commandes": Bell,
  "integration-plateformes": Repeat,
  "fidelisation-gamification": Trophy,
  analytics: BarChart3,
};

function AllFeaturesGrid() {
  return (
    <div className="mt-16">
      <p className="text-center text-sm font-semibold uppercase tracking-widest text-primary">
        Inclus dans l&apos;offre Essentielle, sauf mention contraire
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => {
          const Icon = FEATURE_ICONS[f.id] ?? Store;
          const soon = f.notYetAvailable;
          return (
            <div
              key={f.id}
              className={cn(
                "relative flex gap-3 rounded-2xl border p-4",
                soon
                  ? "border-[color:var(--info-border)] bg-[color:var(--info-soft)]"
                  : "border-[color:var(--border)] bg-surface-1",
              )}
            >
              {soon && (
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[color:var(--info)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--info-foreground)]">
                  <Timer className="h-3 w-3" />
                  {soon.label}
                </span>
              )}
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                  soon
                    ? "bg-[color:var(--info)]/15 text-[color:var(--info)]"
                    : "bg-primary/10 text-primary",
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className={soon ? "pr-14" : ""}>
                <p className="text-sm font-semibold text-foreground">
                  {f.title}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {f.shortDescription}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
