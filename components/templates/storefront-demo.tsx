"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ShoppingBag,
  Plus,
  Minus,
  Star,
  MapPin,
  Clock,
  ArrowLeft,
  X,
  Check,
  CheckCircle2,
  Truck,
  ChevronRight,
} from "lucide-react";
import {
  flattenMenu,
  resolveStorefrontTheme,
  type MenuItem,
  type StorefrontTheme,
} from "@/lib/template-storefront";
import type { Category, Template } from "@/lib/templates-data";

const eur = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const DELIVERY_FEE = 2.5;

type View = "home" | "menu" | "product" | "checkout" | "confirmed";
type CartLine = { item: MenuItem; qty: number };

/**
 * Site de commande démo, **visitable et utilisable** en plein écran, peint aux
 * couleurs / à la police / à l'ambiance d'un template. Tokens scopés en
 * variables CSS sur le conteneur racine. Aucun backend : panier et commande
 * simulés côté client.
 *
 * Reçoit les données brutes (template + catégorie, sérialisables) et résout le
 * thème côté client — l'icône lucide du thème ne traverse jamais la frontière
 * serveur→client.
 */
export function StorefrontDemo({
  template,
  category,
}: {
  template: Template;
  category: Category;
}) {
  const theme = useMemo(
    () => resolveStorefrontTheme(template, category),
    [template, category],
  );
  const reduce = useReducedMotion();
  const { palette, accent, accentInk } = theme;
  const Icon = theme.icon;
  const heading = `var(${theme.fontVar}), var(--font-display), sans-serif`;

  const allItems = useMemo(() => flattenMenu(theme.menu), [theme.menu]);
  const featured = useMemo(() => {
    const signatures = allItems.filter((i) => i.tag === "Signature");
    return (signatures.length ? signatures : allItems).slice(0, 3);
  }, [allItems]);

  const [view, setView] = useState<View>("home");
  const [activeCat, setActiveCat] = useState(theme.menu[0]?.id ?? "");
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [productQty, setProductQty] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [mode, setMode] = useState<"livraison" | "retrait">("livraison");

  const count = cart.reduce((n, l) => n + l.qty, 0);
  const subtotal = cart.reduce((s, l) => s + l.item.price * l.qty, 0);
  const delivery = mode === "livraison" && cart.length ? DELIVERY_FEE : 0;
  const total = subtotal + delivery;

  const scope = useMemo(
    () =>
      ({
        "--background": palette.bg,
        "--foreground": palette.ink,
        "--surface-1": palette.surface,
        "--surface-2": palette.surface2,
        "--surface-4": palette.surfaceHi,
        "--secondary": palette.surface2,
        "--muted-foreground": palette.muted,
        "--border": palette.border,
        "--primary": accent,
        "--primary-foreground": accentInk,
        fontFamily: "var(--font-geist-sans), sans-serif",
        color: palette.ink,
        backgroundColor: palette.bg,
      }) as React.CSSProperties,
    [palette, accent, accentInk],
  );

  function addToCart(item: MenuItem, qty = 1) {
    setCart((c) => {
      const found = c.find((l) => l.item.id === item.id);
      if (found)
        return c.map((l) =>
          l.item.id === item.id ? { ...l, qty: l.qty + qty } : l,
        );
      return [...c, { item, qty }];
    });
  }
  function changeQty(id: string, delta: number) {
    setCart((c) =>
      c
        .map((l) => (l.item.id === id ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  }
  function openProduct(item: MenuItem) {
    setSelected(item);
    setProductQty(1);
    setView("product");
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }
  function goto(v: View) {
    setView(v);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  const btn = "transition-transform duration-150 hover:scale-[1.03] active:scale-95";
  const tile = (size: string, i = 0) => ({
    background: `color-mix(in srgb, ${accent} ${13 + (i % 4) * 4}%, ${palette.surface2})`,
    color: accent,
    borderRadius: theme.radius,
    minWidth: size,
    minHeight: size,
  });

  return (
    <div style={scope} className="flex min-h-screen flex-col">
      {/* Bandeau démo */}
      <div
        className="flex items-center justify-center gap-3 px-4 py-1.5 text-center text-[11px] font-medium sm:text-xs"
        style={{ background: accent, color: accentInk }}
      >
        <span className="truncate">
          Démo interactive — ce site est 100 % personnalisable à votre enseigne
        </span>
        <Link
          href="/templates"
          className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold underline-offset-2 hover:underline"
          style={{ background: accentInk, color: accent }}
        >
          Quitter
        </Link>
      </div>

      {/* Header sticky */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b px-4 py-3 backdrop-blur-md sm:px-6"
        style={{ borderColor: palette.border, background: `color-mix(in srgb, ${palette.surface} 88%, transparent)` }}
      >
        <button onClick={() => goto("home")} className="flex items-center gap-2.5" aria-label="Accueil">
          <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: accent, color: accentInk }}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="text-lg font-semibold leading-none" style={{ fontFamily: heading }}>
            {theme.name}
          </span>
        </button>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => goto("home")}
            className={`hidden rounded-full px-3 py-1.5 text-sm font-medium sm:block ${view === "home" ? "" : "text-muted-foreground hover:text-foreground"}`}
            style={view === "home" ? { color: accent } : undefined}
          >
            Accueil
          </button>
          <button
            onClick={() => goto("menu")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${view === "menu" ? "" : "text-muted-foreground hover:text-foreground"}`}
            style={view === "menu" ? { color: accent } : undefined}
          >
            La carte
          </button>
          <button
            onClick={() => setCartOpen(true)}
            aria-label={`Panier, ${count} article${count > 1 ? "s" : ""}`}
            className={`relative grid h-10 w-10 place-items-center rounded-full ${btn}`}
            style={{ background: accent, color: accentInk }}
          >
            <ShoppingBag className="h-5 w-5" strokeWidth={2} />
            {count > 0 && (
              <span
                className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold ring-2"
                style={{ background: palette.surface, color: accent, borderColor: palette.surface }}
              >
                {count}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          {/* ── ACCUEIL ── */}
          {view === "home" && (
            <motion.div key="home" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Hero */}
              <section className="relative h-[62vh] min-h-[420px] w-full overflow-hidden">
                <Image src={theme.heroImage} alt={theme.name} fill priority sizes="100vw" className="object-cover" />
                <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${palette.headerOverlay}, transparent 65%)` }} />
                <div className="absolute inset-x-0 bottom-0 mx-auto max-w-5xl px-5 pb-10 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2">
                    {theme.promises.map((p) => (
                      <span key={p} className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: accent, color: accentInk }}>
                        {p}
                      </span>
                    ))}
                  </div>
                  <h1 className="mt-4 text-5xl font-semibold leading-[0.95] text-white sm:text-6xl" style={{ fontFamily: heading }}>
                    {theme.name}
                  </h1>
                  <p className="mt-3 flex items-center gap-2 text-sm text-white/85">
                    <Star className="h-4 w-4 fill-current" style={{ color: accent }} />
                    {theme.rating} · {theme.cuisine} · {theme.city}
                  </p>
                  <p className="mt-2 max-w-xl text-base text-white/80">{theme.tagline}</p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button onClick={() => goto("menu")} className={`rounded-full px-6 py-3 text-sm font-semibold ${btn}`} style={{ background: accent, color: accentInk }}>
                      Voir la carte
                    </button>
                    <button onClick={() => goto("menu")} className={`rounded-full bg-white/95 px-6 py-3 text-sm font-semibold text-neutral-900 ${btn}`}>
                      Commander
                    </button>
                  </div>
                </div>
              </section>

              {/* Infos établissement */}
              <section className="mx-auto grid max-w-5xl gap-4 px-5 py-8 sm:grid-cols-3 sm:px-6">
                {[
                  { icon: Clock, label: "Horaires", value: theme.hours },
                  { icon: MapPin, label: "Adresse", value: theme.address },
                  { icon: Truck, label: "Livraison & retrait", value: "Livraison 30 min · Click & Collect" },
                ].map((info) => (
                  <div key={info.label} className="flex items-start gap-3 rounded-2xl border bg-surface-1 p-4" style={{ borderColor: palette.border }}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${accent} 14%, ${palette.surface2})`, color: accent }}>
                      <info.icon className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{info.label}</p>
                      <p className="mt-0.5 text-sm font-medium" style={{ color: palette.ink }}>{info.value}</p>
                    </div>
                  </div>
                ))}
              </section>

              {/* Incontournables */}
              <section className="mx-auto max-w-5xl px-5 pb-16 sm:px-6">
                <h2 className="mb-5 text-2xl font-semibold" style={{ fontFamily: heading }}>
                  Nos incontournables
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  {featured.map((item, i) => (
                    <button key={item.id} onClick={() => openProduct(item)} className="group flex flex-col overflow-hidden rounded-2xl border bg-surface-1 text-left transition-transform hover:-translate-y-1" style={{ borderColor: palette.border }}>
                      <div className="grid h-32 w-full place-items-center" style={{ background: `color-mix(in srgb, ${accent} ${14 + i * 5}%, ${palette.surface2})`, color: accent }}>
                        <Icon className="h-12 w-12" strokeWidth={1.4} />
                      </div>
                      <div className="flex flex-1 flex-col gap-1 p-4">
                        {item.tag && <span className="w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: accent, color: accentInk }}>{item.tag}</span>}
                        <p className="font-semibold" style={{ fontFamily: heading }}>{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                        <p className="mt-1 font-semibold tabular-nums" style={{ color: accent }}>{eur(item.price)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </motion.div>
          )}

          {/* ── CARTE ── */}
          {view === "menu" && (
            <motion.div key="menu" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto max-w-4xl px-5 pb-28 pt-8 sm:px-6">
              <h1 className="text-3xl font-semibold" style={{ fontFamily: heading }}>La carte</h1>
              <p className="mt-1 text-muted-foreground">{theme.cuisine} · {theme.city}</p>

              {/* Onglets catégories */}
              <div className="sticky top-[68px] z-20 -mx-5 mb-2 mt-5 flex gap-2 overflow-x-auto px-5 py-2 sm:top-[72px]" style={{ background: palette.bg }}>
                {theme.menu.map((cat) => (
                  <a
                    key={cat.id}
                    href={`#cat-${cat.id}`}
                    onClick={() => setActiveCat(cat.id)}
                    className="shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium"
                    style={
                      activeCat === cat.id
                        ? { background: accent, color: accentInk, borderColor: accent }
                        : { borderColor: palette.border, color: palette.muted }
                    }
                  >
                    {cat.label}
                  </a>
                ))}
              </div>

              {theme.menu.map((cat) => (
                <section key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-32 pt-6">
                  <h2 className="mb-3 text-xl font-semibold" style={{ fontFamily: heading }}>{cat.label}</h2>
                  <div className="overflow-hidden rounded-2xl border bg-surface-1" style={{ borderColor: palette.border }}>
                    {cat.items.map((item, i) => (
                      <div key={item.id} className="flex items-center gap-4 border-b p-3.5 last:border-b-0" style={{ borderColor: palette.border }}>
                        <button onClick={() => openProduct(item)} className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
                          <span className="grid h-16 w-16 shrink-0 place-items-center" style={tile("4rem", i)}>
                            <Icon className="h-7 w-7" strokeWidth={1.6} />
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-semibold" style={{ fontFamily: heading }}>{item.name}</span>
                              {item.tag && <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: `color-mix(in srgb, ${accent} 16%, ${palette.surface2})`, color: accent }}>{item.tag}</span>}
                            </span>
                            <span className="mt-0.5 line-clamp-1 block text-sm text-muted-foreground">{item.desc}</span>
                            <span className="mt-0.5 block text-sm font-semibold tabular-nums" style={{ color: accent }}>{eur(item.price)}</span>
                          </span>
                        </button>
                        <button
                          onClick={() => addToCart(item)}
                          aria-label={`Ajouter ${item.name}`}
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${btn}`}
                          style={{ background: accent, color: accentInk }}
                        >
                          <Plus className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </motion.div>
          )}

          {/* ── FICHE PRODUIT ── */}
          {view === "product" && selected && (
            <motion.div key="product" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto max-w-3xl px-5 pb-28 pt-6 sm:px-6">
              <button onClick={() => goto("menu")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" strokeWidth={2} /> La carte
              </button>
              <div className="mt-5 grid gap-6 sm:grid-cols-2">
                <div className="grid aspect-square w-full place-items-center" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 22%, ${palette.surface2}), ${palette.surface2})`, borderRadius: theme.radius, color: accent }}>
                  <Icon className="h-24 w-24" strokeWidth={1.2} />
                </div>
                <div className="flex flex-col">
                  {selected.tag && <span className="w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: accent, color: accentInk }}>{selected.tag}</span>}
                  <h1 className="mt-2 text-3xl font-semibold leading-tight" style={{ fontFamily: heading }}>{selected.name}</h1>
                  <p className="mt-2 text-muted-foreground">{selected.desc}</p>
                  <p className="mt-3 text-2xl font-semibold tabular-nums" style={{ color: accent }}>{eur(selected.price)}</p>

                  <div className="mt-auto pt-6">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3 rounded-full border p-1" style={{ borderColor: palette.border }}>
                        <button onClick={() => setProductQty((q) => Math.max(1, q - 1))} aria-label="Moins" className="grid h-8 w-8 place-items-center rounded-full bg-surface-2"><Minus className="h-4 w-4" /></button>
                        <span className="w-5 text-center font-semibold tabular-nums">{productQty}</span>
                        <button onClick={() => setProductQty((q) => q + 1)} aria-label="Plus" className="grid h-8 w-8 place-items-center rounded-full bg-surface-2"><Plus className="h-4 w-4" /></button>
                      </div>
                      <button
                        onClick={() => { addToCart(selected, productQty); setCartOpen(true); }}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold ${btn}`}
                        style={{ background: accent, color: accentInk }}
                      >
                        Ajouter · {eur(selected.price * productQty)}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── CHECKOUT ── */}
          {view === "checkout" && (
            <motion.div key="checkout" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto max-w-4xl px-5 pb-16 pt-6 sm:px-6">
              <button onClick={() => goto("menu")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" strokeWidth={2} /> Continuer mes achats
              </button>
              <h1 className="mt-4 text-3xl font-semibold" style={{ fontFamily: heading }}>Finaliser la commande</h1>

              <div className="mt-6 grid gap-8 md:grid-cols-[1fr_20rem]">
                {/* Formulaire */}
                <div className="space-y-5">
                  <div className="flex gap-2 rounded-full border p-1" style={{ borderColor: palette.border }}>
                    {(["livraison", "retrait"] as const).map((m) => (
                      <button key={m} onClick={() => setMode(m)} className="flex-1 rounded-full px-4 py-2 text-sm font-medium capitalize" style={mode === m ? { background: accent, color: accentInk } : { color: palette.muted }}>
                        {m === "livraison" ? "Livraison" : "Click & Collect"}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Prénom & nom" placeholder="Camille Martin" palette={palette} />
                    <Field label="Téléphone" placeholder="06 12 34 56 78" palette={palette} />
                  </div>
                  {mode === "livraison" && <Field label="Adresse de livraison" placeholder={theme.address} palette={palette} />}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Créneau</label>
                    <select className="w-full rounded-xl border bg-surface-1 px-3 py-2.5 text-sm outline-none" style={{ borderColor: palette.border, color: palette.ink }}>
                      <option>Dès que possible (~30 min)</option>
                      <option>Dans 1 heure</option>
                      <option>Ce soir · 20h00</option>
                    </select>
                  </div>
                  <p className="text-xs text-muted-foreground">Démo — aucun paiement réel ne sera effectué.</p>
                </div>

                {/* Récap */}
                <aside className="h-fit rounded-2xl border bg-surface-1 p-5" style={{ borderColor: palette.border }}>
                  <h2 className="text-lg font-semibold" style={{ fontFamily: heading }}>Récapitulatif</h2>
                  <div className="mt-3 space-y-2.5">
                    {cart.map((l) => (
                      <div key={l.item.id} className="flex justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">{l.qty}× {l.item.name}</span>
                        <span className="tabular-nums">{eur(l.item.price * l.qty)}</span>
                      </div>
                    ))}
                    {!cart.length && <p className="text-sm text-muted-foreground">Votre panier est vide.</p>}
                  </div>
                  <div className="mt-4 space-y-1.5 border-t pt-4 text-sm" style={{ borderColor: palette.border }}>
                    <Row label="Sous-total" value={eur(subtotal)} palette={palette} />
                    <Row label={mode === "livraison" ? "Livraison" : "Retrait"} value={delivery ? eur(delivery) : "Offert"} palette={palette} />
                    <div className="flex justify-between pt-1 text-base font-semibold" style={{ color: palette.ink }}>
                      <span>Total</span>
                      <span className="tabular-nums">{eur(total)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => goto("confirmed")}
                    disabled={!cart.length}
                    className={`mt-5 w-full rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-40 ${btn}`}
                    style={{ background: accent, color: accentInk }}
                  >
                    Payer · {eur(total)}
                  </button>
                </aside>
              </div>
            </motion.div>
          )}

          {/* ── CONFIRMATION ── */}
          {view === "confirmed" && (
            <motion.div key="confirmed" initial={reduce ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="mx-auto grid max-w-md place-items-center px-5 py-24 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full" style={{ background: accent, color: accentInk }}>
                <CheckCircle2 className="h-8 w-8" strokeWidth={2} />
              </span>
              <h1 className="mt-5 text-3xl font-semibold" style={{ fontFamily: heading }}>Commande confirmée&nbsp;!</h1>
              <p className="mt-2 text-muted-foreground">
                Merci. Votre commande chez <span style={{ color: palette.ink }}>{theme.name}</span> est en préparation.
                Un email de confirmation vient de partir.
              </p>
              <p className="mt-4 rounded-full px-4 py-1.5 text-sm font-medium" style={{ background: palette.surface2, color: palette.ink }}>
                Commande n° BID-{theme.slug.slice(0, 3).toUpperCase()}-4821
              </p>
              <button onClick={() => { setCart([]); goto("home"); }} className={`mt-7 rounded-full px-6 py-3 text-sm font-semibold ${btn}`} style={{ background: accent, color: accentInk }}>
                Retour à l&apos;accueil
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer thémé */}
      <footer className="border-t px-5 py-8 sm:px-6" style={{ borderColor: palette.border, background: palette.surface }}>
        <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: accent, color: accentInk }}><Icon className="h-4 w-4" /></span>
            <span className="font-semibold" style={{ fontFamily: heading }}>{theme.name}</span>
          </div>
          <p className="text-xs text-muted-foreground">{theme.address} · {theme.hours}</p>
          <p className="text-xs text-muted-foreground">Propulsé par BeYours · 0 % commission</p>
        </div>
      </footer>

      {/* Barre panier flottante */}
      <AnimatePresence>
        {count > 0 && !cartOpen && view !== "checkout" && view !== "confirmed" && (
          <motion.button
            initial={reduce ? false : { y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            onClick={() => setCartOpen(true)}
            className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-full px-5 py-3.5 text-sm font-semibold shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)]"
            style={{ background: accent, color: accentInk }}
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" strokeWidth={2.2} /> Voir le panier · {count}
            </span>
            <span className="tabular-nums">{eur(total)}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Drawer panier */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCartOpen(false)} />
            <motion.aside
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l"
              style={{ background: palette.surface, borderColor: palette.border, color: palette.ink }}
              initial={reduce ? false : { x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: palette.border }}>
                <h2 className="text-lg font-semibold" style={{ fontFamily: heading }}>Votre panier</h2>
                <button onClick={() => setCartOpen(false)} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full bg-surface-2"><X className="h-5 w-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {cart.length ? (
                  <div className="space-y-3">
                    {cart.map((l, i) => (
                      <div key={l.item.id} className="flex items-center gap-3">
                        <span className="grid h-14 w-14 shrink-0 place-items-center" style={tile("3.5rem", i)}><Icon className="h-6 w-6" strokeWidth={1.6} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold" style={{ fontFamily: heading }}>{l.item.name}</p>
                          <p className="text-xs tabular-nums text-muted-foreground">{eur(l.item.price)}</p>
                          <div className="mt-1 inline-flex items-center gap-2.5 rounded-full border p-0.5" style={{ borderColor: palette.border }}>
                            <button onClick={() => changeQty(l.item.id, -1)} aria-label="Moins" className="grid h-6 w-6 place-items-center rounded-full bg-surface-2"><Minus className="h-3.5 w-3.5" /></button>
                            <span className="w-4 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                            <button onClick={() => changeQty(l.item.id, 1)} aria-label="Plus" className="grid h-6 w-6 place-items-center rounded-full bg-surface-2"><Plus className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums" style={{ color: accent }}>{eur(l.item.price * l.qty)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid h-full place-items-center text-center">
                    <div>
                      <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
                      <p className="mt-3 text-sm text-muted-foreground">Votre panier est vide.</p>
                      <button onClick={() => { setCartOpen(false); goto("menu"); }} className="mt-4 rounded-full px-4 py-2 text-sm font-semibold" style={{ background: accent, color: accentInk }}>Voir la carte</button>
                    </div>
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="border-t px-5 py-4" style={{ borderColor: palette.border }}>
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Sous-total</span>
                    <span className="font-semibold tabular-nums">{eur(subtotal)}</span>
                  </div>
                  <button
                    onClick={() => { setCartOpen(false); goto("checkout"); }}
                    className={`flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold ${btn}`}
                    style={{ background: accent, color: accentInk }}
                  >
                    Passer commande <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, placeholder, palette }: { label: string; placeholder: string; palette: StorefrontTheme["palette"] }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        className="w-full rounded-xl border bg-surface-1 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60"
        style={{ borderColor: palette.border, color: palette.ink }}
      />
    </div>
  );
}

function Row({ label, value, palette }: { label: string; value: string; palette: StorefrontTheme["palette"] }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums" style={{ color: palette.ink }}>{value}</span>
    </div>
  );
}
